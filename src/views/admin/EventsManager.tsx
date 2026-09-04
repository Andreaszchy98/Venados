import React, { useState, useEffect } from 'react';
import { UserProfile, VenueEvent, EventType, EventPriceTier } from '../../types';
import { storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  createVenueEvent,
  updateVenueEvent,
  deleteVenueEvent,
  subscribeVenueEvents,
  getEventPosterPlaceholder,
  computeDefaultOrderingWindow,
} from '../../lib/venueEvents';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { normalizeGoogleDriveImageUrl, isGoogleDriveUrl } from '../../lib/imageUtils';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  Tag,
  ShieldAlert,
  DollarSign,
  Sparkles,
  X,
  AlertCircle,
  DoorOpen,
  CheckCircle2,
  XCircle,
  Search,
  Upload,
  Image as ImageIcon,
  UtensilsCrossed,
  RotateCcw,
} from 'lucide-react';

interface EventsManagerProps {
  user: UserProfile;
}

function toDateTimeLocal(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
}

function toIsoString(dtLocal?: string): string {
  if (!dtLocal) return '';
  const d = new Date(dtLocal);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function formatWindowDateTime(isoString?: string): string {
  if (!isoString) return 'Sin definir';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Sin definir';
  return d.toLocaleString('es-MX', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DEFAULT_TIERS: EventPriceTier[] = [
  { section: 'Platea Baja Central', price: 450 },
  { section: 'Preferente Lateral', price: 320 },
  { section: 'Palco VIP Premier', price: 850 },
  { section: 'Bleachers / Grada General', price: 150 },
];

export const EventsManager: React.FC<EventsManagerProps> = ({ user }) => {
  // El superadmin NO debe tener acceso a esta vista ni a la gestión de eventos
  if (user.role !== 'admin') {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-3xl text-center space-y-3 max-w-xl mx-auto">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
        <h3 className="text-base font-black text-amber-900">Acceso Exclusivo de Sede</h3>
        <p className="text-xs text-amber-700">
          La gestión y programación de eventos (partidos, conciertos y venta de boletos) está reservada exclusivamente para el Administrador de cada sede operativa.
        </p>
      </div>
    );
  }

  const currentVenueId = user.venueId || DEFAULT_VENUE_ID;
  const currentVenueName = user.venueName || 'Estadio Teodoro Mariscal';

  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'inactive'>('all');

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<EventType>('baseball');
  const [formOpponent, setFormOpponent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('20:00 hrs');
  const [formGate, setFormGate] = useState('Puertas 1, 2 y 4');
  const [formActive, setFormActive] = useState(true);
  const [formTicketsAvailable, setFormTicketsAvailable] = useState(true);
  const [formPriceTiers, setFormPriceTiers] = useState<EventPriceTier[]>(DEFAULT_TIERS);
  const [formPosterUrl, setFormPosterUrl] = useState('');
  const [formOrderingOpensAt, setFormOrderingOpensAt] = useState('');
  const [formOrderingClosesAt, setFormOrderingClosesAt] = useState('');
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // Modal Eliminación
  const [eventToDelete, setEventToDelete] = useState<VenueEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeVenueEvents(
      currentVenueId,
      (updatedEvents) => {
        setEvents(updatedEvents);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentVenueId]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleOpenCreateModal = () => {
    const defaultDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
    const defaultTime = '20:00 hrs';
    const defWindow = computeDefaultOrderingWindow(defaultDate, defaultTime);

    setEditingEventId(null);
    setFormName('Venados de Mazatlán vs ');
    setFormType('baseball');
    setFormOpponent('');
    setFormDate(defaultDate);
    setFormTime(defaultTime);
    setFormGate('Puertas 1, 2, 4 y 8');
    setFormActive(true);
    setFormTicketsAvailable(true);
    setFormPriceTiers([...DEFAULT_TIERS]);
    setFormPosterUrl('');
    setFormOrderingOpensAt(toDateTimeLocal(defWindow.orderingOpensAt));
    setFormOrderingClosesAt(toDateTimeLocal(defWindow.orderingClosesAt));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event: VenueEvent) => {
    setEditingEventId(event.id);
    setFormName(event.name);
    setFormType(event.type);
    setFormOpponent(event.opponent || '');
    setFormDate(event.date);
    setFormTime(event.time || '20:00 hrs');
    setFormGate(event.gate || 'Puertas Generales');
    setFormActive(event.active);
    setFormTicketsAvailable(event.ticketsAvailable);
    setFormPriceTiers(
      event.priceTiers && event.priceTiers.length > 0
        ? event.priceTiers.map((t) => ({ ...t }))
        : [...DEFAULT_TIERS]
    );

    let opensAt = event.orderingOpensAt;
    let closesAt = event.orderingClosesAt;
    if (!opensAt || !closesAt) {
      const defWindow = computeDefaultOrderingWindow(event.date, event.time);
      opensAt = opensAt || defWindow.orderingOpensAt;
      closesAt = closesAt || defWindow.orderingClosesAt;
    }
    setFormPosterUrl(normalizeGoogleDriveImageUrl(event.posterUrl) || '');
    setFormOrderingOpensAt(toDateTimeLocal(opensAt));
    setFormOrderingClosesAt(toDateTimeLocal(closesAt));
    setIsModalOpen(true);
  };

  const handlePosterUrlChange = (val: string) => {
    const normalized = normalizeGoogleDriveImageUrl(val);
    setFormPosterUrl(normalized);
    if (isGoogleDriveUrl(val) && normalized !== val) {
      showNotice('success', 'Enlace de Google Drive detectado y transformado automáticamente a URL directa.');
    }
  };

  const handleRecalculateOrderingWindow = () => {
    if (!formDate) {
      showNotice('error', 'Selecciona primero una fecha para calcular el horario sugerido.');
      return;
    }
    const defWindow = computeDefaultOrderingWindow(formDate, formTime);
    setFormOrderingOpensAt(toDateTimeLocal(defWindow.orderingOpensAt));
    setFormOrderingClosesAt(toDateTimeLocal(defWindow.orderingClosesAt));
    showNotice('success', 'Ventana sugerida calculada: Abre 2h antes y cierra 4h después.');
  };

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotice('error', 'El archivo no debe exceder los 5 MB.');
      return;
    }

    setUploadingPoster(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const targetEventId = editingEventId || `event_${Date.now()}`;
      const storagePath = `venues/${currentVenueId}/events/${targetEventId}/poster.${fileExt}`;
      const storageRef = ref(storage, storagePath);

      try {
        const snap = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snap.ref);
        setFormPosterUrl(downloadUrl);
        showNotice('success', 'Póster promocional subido a Firebase Storage.');
      } catch (storageErr: any) {
        console.warn('Firebase Storage offline o con permisos restringidos, usando fallback seguro en memoria:', storageErr);
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          const result = loadEvt.target?.result as string;
          setFormPosterUrl(result);
          showNotice('success', 'Imagen cargada correctamente.');
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error('Error al subir póster:', err);
      showNotice('error', 'No se pudo subir la imagen.');
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleTierChange = (index: number, field: 'section' | 'price', value: any) => {
    const next = [...formPriceTiers];
    if (field === 'price') {
      next[index].price = Number(value) || 0;
    } else {
      next[index].section = value;
    }
    setFormPriceTiers(next);
  };

  const handleAddTier = () => {
    setFormPriceTiers([
      ...formPriceTiers,
      { section: `Sección Especial ${formPriceTiers.length + 1}`, price: 300 },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    if (formPriceTiers.length <= 1) {
      showNotice('error', 'Debe existir al menos un nivel de precio para el evento.');
      return;
    }
    setFormPriceTiers(formPriceTiers.filter((_, i) => i !== index));
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDate) {
      showNotice('error', 'Por favor ingresa el nombre y la fecha del evento.');
      return;
    }

    if (formPriceTiers.length === 0) {
      showNotice('error', 'Debes configurar al menos una sección con precio.');
      return;
    }

    setSaving(true);
    try {
      const defaultWindow = computeDefaultOrderingWindow(formDate, formTime);
      const finalOpensAt = toIsoString(formOrderingOpensAt) || defaultWindow.orderingOpensAt;
      const finalClosesAt = toIsoString(formOrderingClosesAt) || defaultWindow.orderingClosesAt;
      const finalPosterUrl = formPosterUrl.trim() || getEventPosterPlaceholder(formType);

      if (editingEventId) {
        // Actualizar evento existente
        await updateVenueEvent(
          editingEventId,
          {
            name: formName.trim(),
            type: formType,
            opponent: formOpponent.trim() || undefined,
            date: formDate,
            time: formTime.trim(),
            gate: formGate.trim() || undefined,
            active: formActive,
            ticketsAvailable: formTicketsAvailable,
            priceTiers: formPriceTiers,
            posterUrl: finalPosterUrl,
            orderingOpensAt: finalOpensAt,
            orderingClosesAt: finalClosesAt,
          },
          currentVenueId
        );
        showNotice('success', 'Evento actualizado con éxito en Firestore.');
      } else {
        // Crear nuevo evento (forzando venueId de la sede del admin)
        await createVenueEvent(
          {
            venueId: currentVenueId,
            name: formName.trim(),
            type: formType,
            opponent: formOpponent.trim() || undefined,
            date: formDate,
            time: formTime.trim(),
            gate: formGate.trim() || undefined,
            active: formActive,
            ticketsAvailable: formTicketsAvailable,
            priceTiers: formPriceTiers,
            posterUrl: finalPosterUrl,
            orderingOpensAt: finalOpensAt,
            orderingClosesAt: finalClosesAt,
          },
          currentVenueId
        );
        showNotice('success', 'Nuevo evento programado con éxito.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error guardando evento:', err);
      showNotice('error', err.message || 'Error al guardar el evento en la sede.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTickets = async (event: VenueEvent) => {
    try {
      const nextStatus = !event.ticketsAvailable;
      await updateVenueEvent(
        event.id,
        { ticketsAvailable: nextStatus },
        currentVenueId
      );
      showNotice(
        'success',
        nextStatus
          ? `Venta abierta para "${event.name}".`
          : `Venta cerrada para "${event.name}".`
      );
    } catch (err: any) {
      showNotice('error', 'No se pudo actualizar la disponibilidad de venta.');
    }
  };

  const handleToggleActive = async (event: VenueEvent) => {
    try {
      const nextActive = !event.active;
      await updateVenueEvent(
        event.id,
        { active: nextActive },
        currentVenueId
      );
      showNotice(
        'success',
        nextActive
          ? `Evento marcado como activo.`
          : `Evento marcado como inactivo/finalizado.`
      );
    } catch (err: any) {
      showNotice('error', 'No se pudo actualizar el estado del evento.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    setDeleting(true);
    try {
      await deleteVenueEvent(eventToDelete.id, currentVenueId);
      showNotice('success', `Evento "${eventToDelete.name}" eliminado.`);
      setEventToDelete(null);
    } catch (err: any) {
      showNotice('error', err.message || 'No se pudo eliminar el evento.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.opponent && ev.opponent.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'open') return ev.active && ev.ticketsAvailable;
    if (statusFilter === 'closed') return ev.active && !ev.ticketsAvailable;
    if (statusFilter === 'inactive') return !ev.active;
    return true;
  });

  const openEventsCount = events.filter((e) => e.active && e.ticketsAvailable).length;

  return (
    <div className="space-y-6">
      {/* Alerta / Notificación */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Header y Control de Sede */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-200">
              Operación de Sede
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {currentVenueId}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-700" />
            <span>Gestor de Eventos & Partidos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sede: <strong className="text-slate-800 font-semibold">{currentVenueName}</strong> • Control de calendario, precios por sección y apertura de taquilla digital.
          </p>
        </div>

        <button
          id="btn-create-event"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Programar Evento</span>
        </button>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Eventos Programados
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1">{events.length}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            En el historial de esta sede
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Venta Abierta en Taquilla
          </span>
          <p className="text-2xl font-black text-emerald-800 mt-1">{openEventsCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Disponibles para aficionados ahora
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Eventos Inactivos / Pasados
          </span>
          <p className="text-2xl font-black text-slate-600 mt-1">
            {events.filter((e) => !e.active).length}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Archivados o jugados
          </span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre u oponente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 rounded-xl text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({events.length})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              statusFilter === 'open'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Venta Abierta ({openEventsCount})
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              statusFilter === 'closed'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Venta Cerrada ({events.filter((e) => e.active && !e.ticketsAvailable).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              statusFilter === 'inactive'
                ? 'bg-white text-slate-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inactivos ({events.filter((e) => !e.active).length})
          </button>
        </div>
      </div>

      {/* Listado de Eventos en Tiempo Real */}
      {loading ? (
        <LoadingSpinner message="Cargando eventos de la sede..." />
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No hay eventos para mostrar</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? 'No se encontraron eventos coincidentes con la búsqueda.'
              : 'Comienza programando los partidos o conciertos para habilitar la venta de boletos.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Programar Primer Evento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                !ev.active
                  ? 'border-slate-200 opacity-60 bg-slate-50/50'
                  : ev.ticketsAvailable
                  ? 'border-emerald-200 hover:border-emerald-300 ring-1 ring-emerald-500/10'
                  : 'border-amber-200 hover:border-amber-300'
              }`}
            >
              <div>
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-800 border border-red-200">
                      {ev.type.toUpperCase()}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        !ev.active
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : ev.ticketsAvailable
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {!ev.active
                        ? 'Finalizado / Inactivo'
                        : ev.ticketsAvailable
                        ? '🟢 Venta Abierta'
                        : '🔒 Venta Cerrada'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(ev)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Editar evento"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEventToDelete(ev)}
                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Título y detalles con miniatura del póster (completo sin recortar) */}
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-300 shrink-0 shadow-xs relative flex items-center justify-center">
                    <img
                      src={ev.posterUrl || getEventPosterPlaceholder(ev.type)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xs opacity-35 scale-110 pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                    <img
                      src={ev.posterUrl || getEventPosterPlaceholder(ev.type)}
                      alt={ev.name}
                      className="relative z-10 max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                      {ev.name}
                    </h3>
                    {ev.opponent && (
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">
                        Rival: <span className="font-bold text-slate-800">{ev.opponent}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="font-semibold">{ev.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{ev.time || '20:00 hrs'}</span>
                  </div>
                  {ev.gate && (
                    <div className="flex items-center gap-1.5 col-span-2 text-slate-500">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{ev.gate}</span>
                    </div>
                  )}
                </div>

                {/* Indicador de Estado de Ventana de Pedidos de Alimentos */}
                {(() => {
                  const nowIso = new Date().toISOString();
                  const defW = computeDefaultOrderingWindow(ev.date, ev.time);
                  const opens = ev.orderingOpensAt || defW.orderingOpensAt;
                  const closes = ev.orderingClosesAt || defW.orderingClosesAt;
                  const isOpen = nowIso >= opens && nowIso <= closes;
                  const isUpcoming = nowIso < opens;

                  return (
                    <div className="mt-2.5 flex items-center justify-between text-[11px] bg-amber-50/70 p-2 rounded-xl border border-amber-200/80">
                      <div className="flex items-center gap-1.5 text-amber-900">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span className="font-bold">Pedidos Comida:</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isOpen
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isUpcoming
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {isOpen
                          ? '🟢 Abiertos Ahora'
                          : isUpcoming
                          ? `Abre ${formatWindowDateTime(opens)}`
                          : 'Ventana Cerrada'}
                      </span>
                    </div>
                  );
                })()}

                {/* Niveles de Precios (Price Tiers) */}
                <div className="mt-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Secciones & Precios ({ev.priceTiers?.length || 0})
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ev.priceTiers && ev.priceTiers.length > 0 ? (
                      ev.priceTiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <span className="text-[11px] font-medium text-slate-700 truncate pr-1">
                            {tier.section}
                          </span>
                          <span className="font-bold text-slate-900 text-[11px] shrink-0">
                            ${tier.price}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 col-span-2">
                        Sin tiers configurados
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción rápida: Toggles */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleTickets(ev)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    ev.ticketsAvailable
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  {ev.ticketsAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Venta Abierta (Cerrar)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Venta Cerrada (Abrir)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleToggleActive(ev)}
                  className={`py-1.5 px-3 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    ev.active
                      ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                  }`}
                  title={ev.active ? 'Desactivar evento' : 'Reactivar evento'}
                >
                  {ev.active ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR EVENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-700 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    {editingEventId ? 'Editar Evento de Sede' : 'Programar Nuevo Evento'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Sede: {currentVenueName} ({currentVenueId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveEvent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nombre del Evento o Partido *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Venados de Mazatlán vs Tomateros de Culiacán"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Tipo de Evento
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as EventType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  >
                    <option value="baseball">Béisbol</option>
                    <option value="football">Fútbol</option>
                    <option value="basketball">Básquetbol</option>
                    <option value="concert">Concierto / Recital</option>
                    <option value="other">Otro Espectáculo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Rival u Oponente (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Tomateros de Culiacán"
                    value={formOpponent}
                    onChange={(e) => setFormOpponent(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Hora
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 20:00 hrs"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Puerta de Acceso
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Puertas 1, 2 y 4"
                    value={formGate}
                    onChange={(e) => setFormGate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* Sección 1: Subida de Imagen Promocional (Póster para Cartelera) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-red-600" />
                      Póster Promocional del Evento (Cartelera)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Imagen grande que verán los aficionados en la cartelera estilo cine
                    </p>
                  </div>
                  {formPosterUrl && (
                    <button
                      type="button"
                      onClick={() => setFormPosterUrl('')}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                    >
                      Usar placeholder genérico
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Vista previa miniatura del póster (completa sin recortar) */}
                  <div className="w-36 h-24 sm:w-48 sm:h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-300 shrink-0 relative shadow-xs flex items-center justify-center">
                    <img
                      src={formPosterUrl || getEventPosterPlaceholder(formType)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xs opacity-35 scale-110 pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                    <img
                      src={formPosterUrl || getEventPosterPlaceholder(formType)}
                      alt="Póster preview"
                      className="relative z-10 max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    {!formPosterUrl && (
                      <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-1 text-center">
                        <span className="text-[9px] font-bold text-white uppercase leading-tight">
                          Placeholder por defecto ({formType})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones de carga */}
                  <div className="flex-1 space-y-2 w-full">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Subir archivo a Firebase Storage
                      </label>
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                        <Upload className="w-4 h-4 text-red-600" />
                        <span>{uploadingPoster ? 'Subiendo imagen...' : 'Seleccionar imagen del evento'}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          disabled={uploadingPoster}
                          onChange={handlePosterUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        O pega una URL de imagen (soporta enlaces de Google Drive)
                      </label>
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/poster.jpg o enlace compartido de Drive"
                        value={formPosterUrl}
                        onChange={(e) => handlePosterUrlChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                      />
                      {formPosterUrl && formPosterUrl.includes('googleusercontent.com/d/') && (
                        <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          Enlace de Google Drive optimizado con URL directa de imagen CDN.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Ventana de Horario de Pedidos de Alimentos */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                      Ventana de Horario de Pedidos (Comida & Bebida)
                    </label>
                    <p className="text-[11px] text-amber-900/80">
                      Horario en que los negocios y concesiones de la sede aceptan órdenes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRecalculateOrderingWindow}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    title="Calcular sugerido: 2h antes del evento hasta 4h después"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-700" />
                    <span>Calcular horario sugerido (-2h / +4h)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Pedidos abren (orderingOpensAt) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formOrderingOpensAt}
                      onChange={(e) => setFormOrderingOpensAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-600"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Sugerido: 2 horas antes del inicio del evento
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Pedidos cierran (orderingClosesAt) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formOrderingClosesAt}
                      onChange={(e) => setFormOrderingClosesAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-600"
                    />
                    <span className="text-[10px] text-slate-500 block">
                      Sugerido: 4 horas después del inicio del evento
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles de Venta y Activo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formTicketsAvailable}
                    onChange={(e) => setFormTicketsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-red-700 focus:ring-red-600"
                  />
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      Venta de Boletos Abierta
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Permite que los aficionados compren desde la app
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-red-700 focus:ring-red-600"
                  />
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      Evento Activo
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Visible en el calendario de la sede
                    </span>
                  </div>
                </label>
              </div>

              {/* Secciones & Price Tiers */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Secciones y Precios (Tiers)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Define los precios que verá el aficionado al comprar
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Sección
                  </button>
                </div>

                <div className="space-y-2">
                  {formPriceTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="Nombre de sección (ej. Platea Baja)"
                          value={tier.section}
                          onChange={(e) => handleTierChange(idx, 'section', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                        />
                      </div>
                      <div className="w-28 relative">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="number"
                          required
                          min="0"
                          step="10"
                          placeholder="Precio"
                          value={tier.price}
                          onChange={(e) => handleTierChange(idx, 'price', e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar sección"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? 'Guardando...' : editingEventId ? 'Actualizar Evento' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Eliminación */}
      {eventToDelete && (
        <ConfirmationModal
          isOpen={true}
          title="¿Eliminar Evento?"
          message={`¿Estás seguro de que deseas eliminar "${eventToDelete.name}" de la sede ${currentVenueName}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar Evento"
          cancelLabel="Cancelar"
          isDestructive={true}
          isLoading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setEventToDelete(null)}
        />
      )}
    </div>
  );
};

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
import { getOfficialPriceTiersForEvent, getOfficialPriceTiersForVenue, isLegacySection } from '../../lib/seatMap';
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
  Armchair,
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
  { section: 'Deluxe Supreme', price: 950 },
  { section: 'Platino', price: 750 },
  { section: 'Diamante', price: 600 },
  { section: 'Oro', price: 480 },
  { section: 'Sky Plus', price: 400 },
  { section: 'Plus', price: 350 },
  { section: 'Fan', price: 220 },
  { section: 'Fan Plus', price: 280 },
  { section: 'Sky', price: 160 },
];

export const EventsManager: React.FC<EventsManagerProps> = ({ user }) => {
  // El superadmin NO debe tener acceso a esta vista ni a la gestión de eventos
  if (user.role !== 'admin') {
    return (
      <div className="p-8 bg-amber-950/30 border border-amber-500/30 rounded-2xl text-center space-y-3 max-w-xl mx-auto">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-black text-amber-300 font-sports uppercase tracking-wider">Acceso Exclusivo de Sede</h3>
        <p className="text-xs text-amber-200/70 font-body">
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
  const [formAvailableSeats, setFormAvailableSeats] = useState<number | ''>(2820);
  const [formTotalCapacity, setFormTotalCapacity] = useState<number | ''>(16000);
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
    setFormAvailableSeats(2820);
    setFormTotalCapacity(16000);
    setFormPriceTiers(getOfficialPriceTiersForVenue(currentVenueId, currentVenueName, 'baseball'));
    setFormPosterUrl('');
    setFormOrderingOpensAt(toDateTimeLocal(defWindow.orderingOpensAt));
    setFormOrderingClosesAt(toDateTimeLocal(defWindow.orderingClosesAt));
    setIsModalOpen(true);
  };

  const handleResetToMapZones = () => {
    const mapTiers = getOfficialPriceTiersForVenue(currentVenueId, currentVenueName, formType);
    setFormPriceTiers(mapTiers);
    showNotice('success', 'Se han cargado las secciones y precios oficiales del mapa del estadio.');
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
    setFormAvailableSeats(event.availableSeats !== undefined ? event.availableSeats : 2820);
    setFormTotalCapacity(event.totalCapacity !== undefined ? event.totalCapacity : 16000);
    setFormPriceTiers(getOfficialPriceTiersForEvent(event, currentVenueName));

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
            availableSeats: formAvailableSeats !== '' ? Number(formAvailableSeats) : undefined,
            totalCapacity: formTotalCapacity !== '' ? Number(formTotalCapacity) : undefined,
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
            availableSeats: formAvailableSeats !== '' ? Number(formAvailableSeats) : undefined,
            totalCapacity: formTotalCapacity !== '' ? Number(formTotalCapacity) : undefined,
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
          className={`p-4 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-semibold border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
              : 'bg-red-950/40 text-red-300 border-red-500/30'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="font-body">{actionNotice.message}</span>
        </div>
      )}

      {/* Header y Control de Sede */}
      <div className="bg-[#0F1626] p-5 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-950/50 text-red-400 border border-red-500/40 font-sports tracking-wider uppercase">
              Operación de Sede
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {currentVenueId}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 font-sports tracking-wider uppercase">
            <Calendar className="w-6 h-6 text-red-500" />
            <span>Gestor de Eventos & Partidos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-body">
            Sede: <strong className="text-slate-200 font-semibold">{currentVenueName}</strong> • Control de calendario, precios por sección y apertura de taquilla digital.
          </p>
        </div>

        <button
          id="btn-create-event"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold font-sports uppercase tracking-wider shadow-lg shadow-red-950/30 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Programar Evento</span>
        </button>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-md">
          <span className="text-[11px] font-bold text-slate-400 font-sports uppercase tracking-wider">
            Total Eventos Programados
          </span>
          <p className="text-3xl font-scoreboard text-white mt-1">{events.length}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-body">
            En el historial de esta sede
          </span>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-md">
          <span className="text-[11px] font-bold text-emerald-400 font-sports uppercase tracking-wider">
            Venta Abierta en Taquilla
          </span>
          <p className="text-3xl font-scoreboard text-emerald-400 mt-1">{openEventsCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-body">
            Disponibles para aficionados ahora
          </span>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-md">
          <span className="text-[11px] font-bold text-slate-400 font-sports uppercase tracking-wider">
            Eventos Inactivos / Pasados
          </span>
          <p className="text-3xl font-scoreboard text-slate-400 mt-1">
            {events.filter((e) => !e.active).length}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-body">
            Archivados o jugados
          </span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-md">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre u oponente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#0A0E17] rounded-xl text-xs border border-slate-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#1E293B] text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({events.length})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-lg font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer ${
              statusFilter === 'open'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Venta Abierta ({openEventsCount})
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-lg font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer ${
              statusFilter === 'closed'
                ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40 shadow-xs'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            Venta Cerrada ({events.filter((e) => e.active && !e.ticketsAvailable).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer ${
              statusFilter === 'inactive'
                ? 'bg-[#1E293B] text-slate-300 shadow-xs'
                : 'text-slate-400 hover:text-white'
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
        <div className="bg-[#0F1626] rounded-2xl border border-dashed border-slate-700/80 p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold font-sports uppercase tracking-wider text-white">No hay eventos para mostrar</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto font-body">
            {searchQuery
              ? 'No se encontraron eventos coincidentes con la búsqueda.'
              : 'Comienza programando los partidos o conciertos para habilitar la venta de boletos.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl shadow-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Programar Primer Evento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              className={`bg-[#0F1626] rounded-2xl border p-5 shadow-lg flex flex-col justify-between transition-all ${
                !ev.active
                  ? 'border-slate-800 opacity-60 bg-[#0F1626]/60'
                  : ev.ticketsAvailable
                  ? 'border-emerald-500/40 hover:border-emerald-500/60 ring-1 ring-emerald-500/20'
                  : 'border-amber-500/40 hover:border-amber-500/60'
              }`}
            >
              <div>
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-sports tracking-wider bg-red-950/50 text-red-400 border border-red-500/40">
                      {ev.type.toUpperCase()}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-sports tracking-wider border ${
                        !ev.active
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : ev.ticketsAvailable
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                          : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
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
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Editar evento"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEventToDelete(ev)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Título y detalles con miniatura del póster (completo sin recortar) */}
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0 shadow-xs relative flex items-center justify-center">
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
                    <h3 className="font-black text-sm sm:text-base text-white leading-snug font-sports tracking-wide">
                      {ev.name}
                    </h3>
                    {ev.opponent && (
                      <p className="text-xs text-slate-400 mt-0.5 font-body">
                        Rival: <span className="font-bold text-slate-200">{ev.opponent}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-[#0A0E17] p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="font-semibold">{ev.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{ev.time || '20:00 hrs'}</span>
                  </div>
                  {ev.gate && (
                    <div className="flex items-center gap-1.5 col-span-2 text-slate-400">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
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
                    <div className="mt-2.5 flex items-center justify-between text-[11px] bg-[#0A0E17] p-2 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-bold font-sports uppercase tracking-wider">Pedidos Comida:</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-sports tracking-wider ${
                          isOpen
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                            : isUpcoming
                            ? 'bg-blue-950/60 text-blue-400 border border-blue-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
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

                {/* Asientos Disponibles Declarados */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] bg-[#0A0E17] p-2 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-indigo-300">
                    <Armchair className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="font-bold font-sports uppercase tracking-wider">Asientos Sede:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-black text-xs text-indigo-300 bg-indigo-950/70 border border-indigo-500/40 px-2 py-0.5 rounded-md font-scoreboard tracking-wider">
                      {(ev.availableSeats !== undefined ? ev.availableSeats : 2820).toLocaleString()} disp.
                    </span>
                    {ev.totalCapacity && (
                      <span className="text-[10px] text-slate-400 font-semibold font-body">
                        / {ev.totalCapacity.toLocaleString()} aforo
                      </span>
                    )}
                  </div>
                </div>

                {/* Niveles de Precios (Price Tiers) */}
                <div className="mt-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 font-sports uppercase tracking-wider block">
                    Secciones & Precios ({ev.priceTiers?.length || 0})
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ev.priceTiers && ev.priceTiers.length > 0 ? (
                      ev.priceTiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="bg-[#131A28] px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span className="text-[11px] font-medium text-slate-300 truncate pr-1">
                            {tier.section}
                          </span>
                          <span className="font-bold text-emerald-400 text-[11px] shrink-0 font-scoreboard tracking-wider">
                            ${tier.price}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 col-span-2">
                        Sin tiers configurados
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de acción rápida: Toggles */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleTickets(ev)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold font-sports uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    ev.ticketsAvailable
                      ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/80'
                      : 'bg-amber-950/50 text-amber-400 border-amber-500/40 hover:bg-amber-950/80'
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
                  className={`py-1.5 px-3 rounded-xl text-[11px] font-bold font-sports uppercase tracking-wider border transition-all cursor-pointer ${
                    ev.active
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-red-950/50 text-red-400 border-red-500/40 hover:bg-red-950/80'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0F1626] w-full max-w-xl rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 bg-[#0F1626] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-950/60 text-red-400 border border-red-500/30 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white font-sports uppercase tracking-wider">
                    {editingEventId ? 'Editar Evento de Sede' : 'Programar Nuevo Evento'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-body">
                    Sede: {currentVenueName} ({currentVenueId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveEvent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                  Nombre del Evento o Partido *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Venados de Mazatlán vs Tomateros de Culiacán"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                    Tipo de Evento
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as EventType)}
                    className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-red-500"
                  >
                    <option value="baseball">Béisbol</option>
                    <option value="football">Fútbol</option>
                    <option value="basketball">Básquetbol</option>
                    <option value="concert">Concierto / Recital</option>
                    <option value="other">Otro Espectáculo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                    Rival u Oponente (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Tomateros de Culiacán"
                    value={formOpponent}
                    onChange={(e) => setFormOpponent(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                    Hora
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 20:00 hrs"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                    Puerta de Acceso
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Puertas 1, 2 y 4"
                    value={formGate}
                    onChange={(e) => setFormGate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              {/* Sección 1: Subida de Imagen Promocional (Póster para Cartelera) */}
              <div className="p-4 bg-[#0A0E17] rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black uppercase font-sports tracking-wider text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-red-500" />
                      Póster Promocional del Evento (Cartelera)
                    </label>
                    <p className="text-[11px] text-slate-400 font-body">
                      Imagen grande que verán los aficionados en la cartelera estilo cine
                    </p>
                  </div>
                  {formPosterUrl && (
                    <button
                      type="button"
                      onClick={() => setFormPosterUrl('')}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
                    >
                      Usar placeholder genérico
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Vista previa miniatura del póster (completa sin recortar) */}
                  <div className="w-36 h-24 sm:w-48 sm:h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0 relative shadow-xs flex items-center justify-center">
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
                      <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-1 text-center">
                        <span className="text-[9px] font-bold text-slate-300 uppercase leading-tight font-sports tracking-wider">
                          Placeholder por defecto ({formType})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones de carga */}
                  <div className="flex-1 space-y-2 w-full">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 font-sports uppercase tracking-wider">
                        Subir archivo a Firebase Storage
                      </label>
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1E293B] border border-slate-700 hover:border-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                        <Upload className="w-4 h-4 text-red-400" />
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
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 font-sports uppercase tracking-wider">
                        O pega una URL de imagen (soporta enlaces de Google Drive)
                      </label>
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/poster.jpg o enlace compartido de Drive"
                        value={formPosterUrl}
                        onChange={(e) => handlePosterUrlChange(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#131A28] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500"
                      />
                      {formPosterUrl && formPosterUrl.includes('googleusercontent.com/d/') && (
                        <p className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1 font-body">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          Enlace de Google Drive optimizado con URL directa de imagen CDN.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Ventana de Horario de Pedidos de Alimentos */}
              <div className="p-4 bg-amber-950/20 rounded-xl border border-amber-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-black uppercase font-sports tracking-wider text-amber-300 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                      Ventana de Horario de Pedidos (Comida & Bebida)
                    </label>
                    <p className="text-[11px] text-amber-200/70 font-body">
                      Horario en que los negocios y concesiones de la sede aceptan órdenes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRecalculateOrderingWindow}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                    title="Calcular sugerido: 2h antes del evento hasta 4h después"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-400" />
                    <span>Calcular horario sugerido (-2h / +4h)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                      Pedidos abren (orderingOpensAt) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formOrderingOpensAt}
                      onChange={(e) => setFormOrderingOpensAt(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 block font-body">
                      Sugerido: 2 horas antes del inicio del evento
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                      Pedidos cierran (orderingClosesAt) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formOrderingClosesAt}
                      onChange={(e) => setFormOrderingClosesAt(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 block font-body">
                      Sugerido: 4 horas después del inicio del evento
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles de Venta y Activo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#0A0E17] rounded-xl border border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formTicketsAvailable}
                    onChange={(e) => setFormTicketsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-[#1E293B] border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-xs text-white block font-sports uppercase tracking-wider">
                      Venta de Boletos Abierta
                    </span>
                    <span className="text-[11px] text-slate-400 font-body">
                      Permite que los aficionados compren desde la app
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-[#1E293B] border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-xs text-white block font-sports uppercase tracking-wider">
                      Evento Activo
                    </span>
                    <span className="text-[11px] text-slate-400 font-body">
                      Visible en el calendario de la sede
                    </span>
                  </div>
                </label>
              </div>

              {/* Declaración de Aforo y Asientos Disponibles por el Admin de la Sede */}
              <div className="p-4 bg-indigo-950/20 rounded-xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Armchair className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs text-indigo-300 font-sports uppercase tracking-wider">
                        Aforo y Asientos Disponibles de la Sede
                      </h4>
                      <p className="text-[11px] text-indigo-200/70 font-body">
                        Declara cuántos asientos están disponibles para la compra de aficionados en este evento
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                      Asientos Disponibles a la Venta *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={formAvailableSeats}
                      onChange={(e) =>
                        setFormAvailableSeats(
                          e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10))
                        )
                      }
                      placeholder="Ej. 2820"
                      className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-indigo-500"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormAvailableSeats(2820)}
                        className="text-[10px] px-2 py-0.5 bg-[#1E293B] hover:bg-[#334155] text-indigo-300 font-bold rounded border border-indigo-500/40 cursor-pointer"
                      >
                        2,820 (Teodoro Mariscal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormAvailableSeats(3120)}
                        className="text-[10px] px-2 py-0.5 bg-[#1E293B] hover:bg-[#334155] text-indigo-300 font-bold rounded border border-indigo-500/40 cursor-pointer"
                      >
                        3,120 (El Encanto)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">
                      Capacidad Total / Aforo Oficial
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={formTotalCapacity}
                      onChange={(e) =>
                        setFormTotalCapacity(
                          e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10))
                        )
                      }
                      placeholder="Ej. 16000"
                      className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:border-indigo-500"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormTotalCapacity(16000)}
                        className="text-[10px] px-2 py-0.5 bg-[#1E293B] hover:bg-[#334155] text-indigo-300 font-bold rounded border border-indigo-500/40 cursor-pointer"
                      >
                        16,000 (Aforo Máx)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormTotalCapacity(25000)}
                        className="text-[10px] px-2 py-0.5 bg-[#1E293B] hover:bg-[#334155] text-indigo-300 font-bold rounded border border-indigo-500/40 cursor-pointer"
                      >
                        25,000 (Concierto)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secciones & Price Tiers */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 font-sports uppercase tracking-wider">
                      Secciones y Precios (Tiers)
                    </label>
                    <p className="text-[11px] text-slate-400 font-body">
                      Define los precios que verá el aficionado al comprar
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetToMapZones}
                      title="Sincronizar exactamente con las zonas del mapa del estadio y eliminar secciones obsoletas"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Secciones del Mapa
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Sección
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formPriceTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-[#0A0E17] p-2.5 rounded-xl border border-slate-800"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="Nombre de sección (ej. Platino, Oriente Central)"
                          value={tier.section}
                          onChange={(e) => handleTierChange(idx, 'section', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#131A28] border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-hidden focus:border-red-500"
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
                          className="w-full pl-6 pr-2 py-1.5 bg-[#131A28] border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-hidden focus:border-red-500 font-scoreboard text-base"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar sección"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#1E293B] border border-slate-700 text-slate-300 text-xs font-bold font-sports uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold font-sports uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
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

import React, { useState, useEffect } from 'react';
import { Venue, VenueEvent, EventType } from '../../types';
import {
  getAllVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  getVenueEvents,
  createVenueEvent,
  updateVenueEvent,
  deleteVenueEvent,
} from '../../lib/venues';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import {
  Building2,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  Search,
  Sparkles,
  Save,
  X,
  Activity,
} from 'lucide-react';

export const VenuesManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'venues' | 'events'>('venues');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenueFilter, setSelectedVenueFilter] = useState<string>('all');

  // Modal Venue
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [venueForm, setVenueForm] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    active: true,
  });

  // Modal Event
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<VenueEvent | null>(null);
  const [eventForm, setEventForm] = useState<{
    venueId: string;
    name: string;
    date: string;
    type: EventType;
    active: boolean;
  }>({
    venueId: '',
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'baseball',
    active: true,
  });

  // Modales de confirmación de eliminación
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<VenueEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [venuesData, eventsData] = await Promise.all([
        getAllVenues(),
        getVenueEvents(),
      ]);
      setVenues(venuesData);
      setEvents(eventsData);
    } catch (err: any) {
      console.error('Error cargando sedes y eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- Handlers de Venue ---
  const handleOpenNewVenue = () => {
    setEditingVenue(null);
    setVenueForm({
      name: '',
      city: '',
      state: '',
      address: '',
      active: true,
    });
    setIsVenueModalOpen(true);
  };

  const handleOpenEditVenue = (venue: Venue) => {
    setEditingVenue(venue);
    setVenueForm({
      name: venue.name,
      city: venue.city || '',
      state: venue.state || '',
      address: venue.address || '',
      active: venue.active,
    });
    setIsVenueModalOpen(true);
  };

  const handleSaveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueForm.name.trim()) return;

    setSaving(true);
    try {
      if (editingVenue) {
        await updateVenue(editingVenue.id, venueForm);
        setVenues((prev) =>
          prev.map((v) => (v.id === editingVenue.id ? { ...v, ...venueForm } : v))
        );
        showNotification('success', `Sede "${venueForm.name}" actualizada con éxito.`);
      } else {
        const created = await createVenue(venueForm);
        setVenues((prev) => [created, ...prev]);
        showNotification('success', `Nueva sede "${venueForm.name}" dada de alta correctamente.`);
      }
      setIsVenueModalOpen(false);
    } catch (err: any) {
      showNotification('error', `Error al guardar sede: ${err.message || 'Operación fallida'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteVenue = async () => {
    if (!venueToDelete) return;
    setDeletingVenue(true);
    try {
      await deleteVenue(venueToDelete.id);
      setVenues((prev) => prev.filter((v) => v.id !== venueToDelete.id));
      showNotification('success', `Sede "${venueToDelete.name}" eliminada.`);
      setVenueToDelete(null);
    } catch (err: any) {
      showNotification('error', `No se pudo eliminar la sede: ${err.message}`);
    } finally {
      setDeletingVenue(false);
    }
  };

  // --- Handlers de Eventos ---
  const handleOpenNewEvent = () => {
    setEditingEvent(null);
    setEventForm({
      venueId: venues[0]?.id || '',
      name: '',
      date: new Date().toISOString().split('T')[0],
      type: 'baseball',
      active: true,
    });
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (event: VenueEvent) => {
    setEditingEvent(event);
    setEventForm({
      venueId: event.venueId,
      name: event.name,
      date: event.date,
      type: event.type,
      active: event.active,
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.name.trim() || !eventForm.venueId) return;

    setSaving(true);
    try {
      if (editingEvent) {
        await updateVenueEvent(editingEvent.id, eventForm);
        setEvents((prev) =>
          prev.map((ev) => (ev.id === editingEvent.id ? { ...ev, ...eventForm } : ev))
        );
        showNotification('success', `Evento "${eventForm.name}" actualizado.`);
      } else {
        const created = await createVenueEvent(eventForm);
        setEvents((prev) => [created, ...prev]);
        showNotification('success', `Evento "${eventForm.name}" programado con éxito.`);
      }
      setIsEventModalOpen(false);
    } catch (err: any) {
      showNotification('error', `Error al guardar evento: ${err.message || 'Operación fallida'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setDeletingEvent(true);
    try {
      await deleteVenueEvent(eventToDelete.id);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventToDelete.id));
      showNotification('success', `Evento "${eventToDelete.name}" eliminado.`);
      setEventToDelete(null);
    } catch (err: any) {
      showNotification('error', `No se pudo eliminar el evento: ${err.message}`);
    } finally {
      setDeletingEvent(false);
    }
  };

  const filteredVenues = venues.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.city && v.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredEvents = events.filter((ev) => {
    const matchesVenue = selectedVenueFilter === 'all' || ev.venueId === selectedVenueFilter;
    const matchesSearch = ev.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesVenue && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Notificación Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Pestañas: Sedes vs Eventos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            id="subtab-venues"
            onClick={() => setActiveSubTab('venues')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'venues'
                ? 'bg-red-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Sedes ({venues.length})
          </button>

          <button
            id="subtab-events"
            onClick={() => setActiveSubTab('events')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'events'
                ? 'bg-red-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Eventos ({events.length})
          </button>
        </div>

        {/* Botón de acción */}
        {activeSubTab === 'venues' ? (
          <button
            id="btn-new-venue"
            onClick={handleOpenNewVenue}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4 text-red-400" />
            Nueva Sede
          </button>
        ) : (
          <button
            id="btn-new-event"
            onClick={handleOpenNewEvent}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4 text-red-400" />
            Programar Evento
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeSubTab === 'venues' ? 'Buscar sede por nombre o ciudad...' : 'Buscar evento por nombre...'}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
          />
        </div>

        {activeSubTab === 'events' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Sede:</span>
            <select
              value={selectedVenueFilter}
              onChange={(e) => setSelectedVenueFilter(e.target.value)}
              className="py-1.5 px-3 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-600"
            >
              <option value="all">Todas las Sedes</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Contenido: Listado de Sedes */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : activeSubTab === 'venues' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVenues.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No se encontraron sedes</p>
              <p className="text-xs text-slate-400 mt-1">Crea una nueva sede para comenzar a desplegar el sistema.</p>
            </div>
          ) : (
            filteredVenues.map((venue) => {
              const venueEventsCount = events.filter((e) => e.venueId === venue.id).length;
              return (
                <div
                  key={venue.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="p-2.5 rounded-xl bg-red-50 text-red-700">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          venue.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {venue.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {venue.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{venue.city ? `${venue.city}, ${venue.state || ''}` : 'Ubicación no especificada'}</span>
                    </p>

                    {venue.address && (
                      <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                        {venue.address}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Eventos registrados:</span>
                      <span className="font-bold text-slate-800">{venueEventsCount}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {venue.id.slice(0, 12)}...
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditVenue(venue)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
                        title="Editar Sede"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setVenueToDelete(venue)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-700 rounded-lg transition-colors"
                        title="Eliminar Sede"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Listado de Eventos */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Nombre del Evento</th>
                  <th className="px-5 py-3">Sede</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No hay eventos programados en esta sede
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const venueObj = venues.find((v) => v.id === ev.venueId);
                    return (
                      <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {ev.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">
                          {venueObj?.name || ev.venueId}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {ev.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono">
                          {ev.date}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              ev.active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {ev.active ? 'Activo' : 'Finalizado'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditEvent(ev)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
                              title="Editar Evento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEventToDelete(ev)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-700 rounded-lg transition-colors"
                              title="Eliminar Evento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Sede */}
      {isVenueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-600" />
                <span>{editingVenue ? 'Editar Sede' : 'Nueva Sede'}</span>
              </h3>
              <button
                onClick={() => setIsVenueModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVenue} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre de la Sede *</label>
                <input
                  type="text"
                  required
                  value={venueForm.name}
                  onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                  placeholder="Ej. Estadio Teodoro Mariscal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={venueForm.city}
                    onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                    placeholder="Ej. Mazatlán"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Estado</label>
                  <input
                    type="text"
                    value={venueForm.state}
                    onChange={(e) => setVenueForm({ ...venueForm, state: e.target.value })}
                    placeholder="Ej. Sinaloa"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Dirección completa</label>
                <textarea
                  rows={2}
                  value={venueForm.address}
                  onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                  placeholder="Av. Justo Sierra s/n, Fracc. Estadio..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="venue-active-check"
                  checked={venueForm.active}
                  onChange={(e) => setVenueForm({ ...venueForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 border-slate-300 focus:ring-red-500"
                />
                <label htmlFor="venue-active-check" className="text-slate-700 font-medium">
                  Sede activa para operaciones y eventos
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVenueModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : editingVenue ? 'Guardar Cambios' : 'Crear Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Evento */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-600" />
                <span>{editingEvent ? 'Editar Evento' : 'Programar Nuevo Evento'}</span>
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Sede del Evento *</label>
                <select
                  required
                  value={eventForm.venueId}
                  onChange={(e) => setEventForm({ ...eventForm, venueId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden font-semibold"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city || 'Sede'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre del Evento *</label>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="Ej. Temporada Regular 2026 / Concierto"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tipo de Evento</label>
                  <select
                    value={eventForm.type}
                    onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as EventType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  >
                    <option value="baseball">Béisbol</option>
                    <option value="concert">Concierto</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="event-active-check"
                  checked={eventForm.active}
                  onChange={(e) => setEventForm({ ...eventForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 border-slate-300 focus:ring-red-500"
                />
                <label htmlFor="event-active-check" className="text-slate-700 font-medium">
                  Evento activo
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : editingEvent ? 'Guardar Cambios' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar Sede */}
      <ConfirmationModal
        isOpen={!!venueToDelete}
        title="Eliminar Sede"
        message={`¿Estás seguro de que deseas eliminar la sede "${venueToDelete?.name}"? Esta acción es irreversible.`}
        confirmText={deletingVenue ? 'Eliminando...' : 'Eliminar Sede'}
        onConfirm={handleConfirmDeleteVenue}
        onCancel={() => setVenueToDelete(null)}
        isDestructive
      />

      {/* Modal de confirmación para eliminar Evento */}
      <ConfirmationModal
        isOpen={!!eventToDelete}
        title="Eliminar Evento"
        message={`¿Estás seguro de que deseas eliminar el evento "${eventToDelete?.name}"?`}
        confirmText={deletingEvent ? 'Eliminando...' : 'Eliminar Evento'}
        onConfirm={handleConfirmDeleteEvent}
        onCancel={() => setEventToDelete(null)}
        isDestructive
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Venue } from '../../types';
import {
  getAllVenues,
  createVenue,
  updateVenue,
  deleteVenue,
} from '../../lib/venues';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  Search,
  Save,
  X,
} from 'lucide-react';

export const VenuesManager: React.FC = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Modal de confirmación de eliminación
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState(false);

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const venuesData = await getAllVenues();
      setVenues(venuesData);
    } catch (err) {
      console.error('Error cargando sedes:', err);
      setNotification({ type: 'error', message: 'Error al cargar las sedes deportivas' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        setNotification({ type: 'success', message: 'Sede actualizada con éxito' });
      } else {
        await createVenue(venueForm);
        setNotification({ type: 'success', message: 'Nueva sede deportiva creada con éxito' });
      }
      setIsVenueModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error guardando sede:', err);
      setNotification({ type: 'error', message: err.message || 'Error al guardar la sede' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteVenue = async () => {
    if (!venueToDelete) return;
    setDeletingVenue(true);
    try {
      await deleteVenue(venueToDelete.id);
      setNotification({ type: 'success', message: `Sede "${venueToDelete.name}" eliminada` });
      setVenueToDelete(null);
      await loadData();
    } catch (err: any) {
      console.error('Error eliminando sede:', err);
      setNotification({ type: 'error', message: err.message || 'Error al eliminar la sede' });
    } finally {
      setDeletingVenue(false);
    }
  };

  const filteredVenues = venues.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.city && v.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Notificación flotante / banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border text-xs sm:text-sm font-semibold transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Sedes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <Building2 className="w-5 h-5 text-red-700" />
            <span>Sedes y Recintos Deportivos ({venues.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Alta y configuración de recintos multisede. La gestión de eventos específicos corresponde al Administrador de cada sede.
          </p>
        </div>

        <button
          id="btn-new-venue"
          onClick={handleOpenNewVenue}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-red-400" />
          <span>Nueva Sede</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar sede por nombre o ciudad..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
          />
        </div>
      </div>

      {/* Listado de Sedes */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVenues.length === 0 ? (
            <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-400 text-xs">
              No se encontraron sedes que coincidan con la búsqueda
            </div>
          ) : (
            filteredVenues.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-red-50 text-red-700">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-900">{v.name}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        v.active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {v.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {(v.city || v.state) && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{[v.city, v.state].filter(Boolean).join(', ')}</span>
                    </p>
                  )}

                  {v.address && (
                    <p className="text-[11px] text-slate-400 line-clamp-2">{v.address}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-slate-400">ID: {v.id}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditVenue(v)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                      title="Editar Sede"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setVenueToDelete(v)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar Sede"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
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
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
                <label htmlFor="venue-active-check" className="text-slate-700 font-medium cursor-pointer">
                  Sede activa para operaciones
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVenueModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : editingVenue ? 'Guardar Cambios' : 'Crear Sede'}
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
    </div>
  );
};

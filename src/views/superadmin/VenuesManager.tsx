import React, { useState, useEffect } from 'react';
import { Venue } from '../../types';
import {
  getAllVenues,
  createVenue,
  updateVenue,
  deleteVenue,
} from '../../lib/venues';
import { useTheme } from '../../context/ThemeContext';
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
  const { theme } = useTheme();
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
      const venuesData = await getAllVenues({ includeInactive: true });
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
    <div className="space-y-4">
      {/* Notificación flotante / banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between border text-xs sm:text-sm font-semibold transition-all ${
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
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra de Acciones y Búsqueda Limpia */}
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 shadow-xs'
            : 'bg-[#0F1626] border-slate-800 shadow-md'
        }`}
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar entre ${venues.length} sedes deportivas...`}
            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-xs font-medium focus:outline-hidden focus:border-red-500 transition-colors ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                : 'bg-[#0A0E17] border-slate-700 text-white placeholder-slate-500'
            }`}
          />
        </div>

        <button
          id="btn-new-venue"
          onClick={handleOpenNewVenue}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports transition-all shadow-md shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Nueva Sede</span>
        </button>
      </div>

      {/* Listado de Sedes */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredVenues.length === 0 ? (
            <div
              className={`col-span-full border border-dashed rounded-2xl p-10 text-center text-xs font-sports ${
                theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-400'
                  : 'bg-[#0F1626] border-slate-800 text-slate-400'
              }`}
            >
              No se encontraron sedes que coincidan con la búsqueda
            </div>
          ) : (
            filteredVenues.map((v) => (
              <div
                key={v.id}
                className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between space-y-3 group ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 shadow-xs hover:border-red-500/50 hover:shadow-md text-slate-900'
                    : 'bg-[#0F1626] border-slate-800 shadow-md hover:border-red-600/50 text-white'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          theme === 'light'
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : 'bg-red-600/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h3 className="font-extrabold text-sm font-sports tracking-wide">
                        {v.name}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black font-sports uppercase tracking-wider border shrink-0 ${
                        v.active
                          ? theme === 'light'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : theme === 'light'
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {v.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  {(v.city || v.state) && (
                    <p
                      className={`text-xs flex items-center gap-1 font-sans ${
                        theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{[v.city, v.state].filter(Boolean).join(', ')}</span>
                    </p>
                  )}

                  {v.address && (
                    <p
                      className={`text-[11px] line-clamp-2 font-sans ${
                        theme === 'light' ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      {v.address}
                    </p>
                  )}
                </div>

                <div
                  className={`pt-2.5 border-t flex items-center justify-between text-xs ${
                    theme === 'light' ? 'border-slate-100' : 'border-slate-800/80'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-400">ID: {v.id}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditVenue(v)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                          : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Editar Sede"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setVenueToDelete(v)}
                      className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#0F1626] border-slate-700 text-white'
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                theme === 'light' ? 'border-slate-100' : 'border-slate-800'
              }`}
            >
              <h3 className="text-base font-black tracking-wide font-sports flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-500" />
                <span>{editingVenue ? 'Editar Sede' : 'Nueva Sede'}</span>
              </h3>
              <button
                onClick={() => setIsVenueModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVenue} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 font-sports uppercase tracking-wider">
                  Nombre de la Sede *
                </label>
                <input
                  type="text"
                  required
                  value={venueForm.name}
                  onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                  placeholder="Ej. Estadio Teodoro Mariscal"
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-[#0A0E17] border-slate-700 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 font-sports uppercase tracking-wider">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={venueForm.city}
                    onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                    placeholder="Ej. Mazatlán"
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden ${
                      theme === 'light'
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-[#0A0E17] border-slate-700 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 font-sports uppercase tracking-wider">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={venueForm.state}
                    onChange={(e) => setVenueForm({ ...venueForm, state: e.target.value })}
                    placeholder="Ej. Sinaloa"
                    className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden ${
                      theme === 'light'
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-[#0A0E17] border-slate-700 text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 font-sports uppercase tracking-wider">
                  Dirección completa
                </label>
                <textarea
                  rows={2}
                  value={venueForm.address}
                  onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                  placeholder="Av. Justo Sierra s/n, Fracc. Estadio..."
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-[#0A0E17] border-slate-700 text-white'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="venue-active-check"
                  checked={venueForm.active}
                  onChange={(e) => setVenueForm({ ...venueForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
                />
                <label
                  htmlFor="venue-active-check"
                  className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                >
                  Sede activa para operaciones
                </label>
              </div>

              <div
                className={`pt-3 border-t flex items-center justify-end gap-2 ${
                  theme === 'light' ? 'border-slate-100' : 'border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsVenueModalOpen(false)}
                  className={`px-4 py-2 border font-bold rounded-xl cursor-pointer ${
                    theme === 'light'
                      ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black font-sports uppercase tracking-wider rounded-xl shadow-md cursor-pointer"
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

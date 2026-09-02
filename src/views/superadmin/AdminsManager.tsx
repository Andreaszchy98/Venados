import React, { useState, useEffect } from 'react';
import { UserProfile, Venue } from '../../types';
import { getAllUsers, assignAdminRole, revokeAdminRole } from '../../lib/auth';
import { getAllVenues } from '../../lib/venues';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import {
  ShieldCheck,
  Building2,
  UserPlus,
  Search,
  UserX,
  Edit2,
  Mail,
  CheckCircle2,
  X,
  AlertCircle,
  Users,
} from 'lucide-react';

export const AdminsManager: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de lista de administradores
  const [adminSearch, setAdminSearch] = useState('');

  // Búsqueda para asignar nuevo admin
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserToPromote, setSelectedUserToPromote] = useState<UserProfile | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Modal para editar venue de admin existente
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [editVenueId, setEditVenueId] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal de confirmación para revocar rol
  const [adminToRevoke, setAdminToRevoke] = useState<UserProfile | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Notificación
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allVenues] = await Promise.all([
        getAllUsers(),
        getAllVenues(),
      ]);
      setUsers(allUsers);
      setVenues(allVenues);
      if (allVenues.length > 0 && !selectedVenueId) {
        setSelectedVenueId(allVenues[0].id);
      }
    } catch (err: any) {
      console.error('Error cargando usuarios y sedes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Filtrar administradores activos (rol admin)
  const adminsList = users.filter((u) => u.role === 'admin');
  const filteredAdmins = adminsList.filter((a) => {
    const term = adminSearch.toLowerCase();
    const name = (a.displayName || '').toLowerCase();
    const email = (a.email || '').toLowerCase();
    const venue = (a.venueName || '').toLowerCase();
    return name.includes(term) || email.includes(term) || venue.includes(term);
  });

  // Usuarios disponibles para promover (no son superadmin ni admin actualmente)
  const candidateUsers = userSearchTerm.trim().length >= 2
    ? users.filter((u) => {
        if (u.role === 'superadmin' || u.role === 'admin') return false;
        const term = userSearchTerm.toLowerCase();
        const name = (u.displayName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(term) || email.includes(term);
      })
    : [];

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToPromote || !selectedVenueId) return;

    const targetVenue = venues.find((v) => v.id === selectedVenueId);
    if (!targetVenue) return;

    setAssigning(true);
    try {
      await assignAdminRole(selectedUserToPromote.uid, targetVenue.id, targetVenue.name);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === selectedUserToPromote.uid
            ? { ...u, role: 'admin', venueId: targetVenue.id, venueName: targetVenue.name }
            : u
        )
      );
      showNotification(
        'success',
        `Se asignó el rol de Administrador de "${targetVenue.name}" a ${selectedUserToPromote.displayName || selectedUserToPromote.email}.`
      );
      setSelectedUserToPromote(null);
      setUserSearchTerm('');
    } catch (err: any) {
      showNotification('error', `Error al asignar rol: ${err.message || 'No autorizado'}`);
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateAdminVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin || !editVenueId) return;

    const targetVenue = venues.find((v) => v.id === editVenueId);
    if (!targetVenue) return;

    setSavingEdit(true);
    try {
      await assignAdminRole(editingAdmin.uid, targetVenue.id, targetVenue.name);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editingAdmin.uid
            ? { ...u, venueId: targetVenue.id, venueName: targetVenue.name }
            : u
        )
      );
      showNotification(
        'success',
        `Sede actualizada a "${targetVenue.name}" para el administrador ${editingAdmin.displayName || editingAdmin.email}.`
      );
      setEditingAdmin(null);
    } catch (err: any) {
      showNotification('error', `Error al actualizar sede: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!adminToRevoke) return;
    setRevoking(true);
    try {
      await revokeAdminRole(adminToRevoke.uid);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === adminToRevoke.uid
            ? { ...u, role: 'aficionado', venueId: undefined, venueName: undefined }
            : u
        )
      );
      showNotification('success', `Rol de administrador revocado para ${adminToRevoke.displayName || adminToRevoke.email}.`);
      setAdminToRevoke(null);
    } catch (err: any) {
      showNotification('error', `Error al revocar rol: ${err.message}`);
    } finally {
      setRevoking(false);
    }
  };

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

      {/* Formulario para asignar Administrador a un usuario existente */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-2 bg-red-50 rounded-xl text-red-700">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Asignar Administrador de Sede
            </h2>
            <p className="text-xs text-slate-500">
              Busca una cuenta ya registrada por su correo y asígnale el mando de una sede específica.
            </p>
          </div>
        </div>

        <form onSubmit={handleAssignAdmin} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campo de Búsqueda de Usuario */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                1. Buscar usuario registrado por correo o nombre
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value);
                    if (selectedUserToPromote) setSelectedUserToPromote(null);
                  }}
                  placeholder="Escribe al menos 2 letras del correo o nombre..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              {/* Sugerencias desplegables */}
              {userSearchTerm.trim().length >= 2 && !selectedUserToPromote && (
                <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 z-10 relative">
                  {candidateUsers.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">
                      No se encontraron usuarios registrados con ese correo
                    </div>
                  ) : (
                    candidateUsers.map((u) => (
                      <button
                        type="button"
                        key={u.uid}
                        onClick={() => {
                          setSelectedUserToPromote(u);
                          setUserSearchTerm(u.email || u.displayName || '');
                        }}
                        className="w-full text-left p-2.5 hover:bg-red-50 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{u.displayName || 'Sin nombre'}</p>
                          <p className="text-slate-500 font-mono text-[11px]">{u.email}</p>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {u.role}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedUserToPromote && (
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-900">
                        {selectedUserToPromote.displayName || 'Usuario seleccionado'}
                      </span>
                      <span className="text-emerald-700 ml-1 font-mono text-[11px]">
                        ({selectedUserToPromote.email})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserToPromote(null);
                      setUserSearchTerm('');
                    }}
                    className="text-emerald-800 hover:text-emerald-900 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Selector de Sede */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2. Seleccionar Sede a Administrar
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <select
                  value={selectedVenueId}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-600 focus:outline-hidden bg-white"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city || 'Sede'})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                El usuario solo tendrá acceso al inventario, ventas y personal de esta sede.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!selectedUserToPromote || !selectedVenueId || assigning}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              {assigning ? 'Asignando mando...' : 'Confirmar Rol de Administrador'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Administradores Actuales */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-700" />
              <span>Administradores de Sede Activos ({adminsList.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cada administrador opera con permisos acotados exclusivamente a su sede asignada.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Filtrar por nombre, correo o sede..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-2xl">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No hay administradores registrados que coincidan</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Utiliza el formulario superior para asignar el rol a un usuario registrado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Administrador</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Sede Asignada</th>
                  <th className="px-4 py-3">ID de Sede</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-800 font-bold flex items-center justify-center text-xs shrink-0">
                          {(admin.displayName || admin.email || 'A')[0].toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">
                          {admin.displayName || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">
                      {admin.email || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        <Building2 className="w-3 h-3 text-red-600" />
                        {admin.venueName || 'Estadio Teodoro Mariscal'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                      {admin.venueId || 'venue-teodoro-mariscal'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingAdmin(admin);
                            setEditVenueId(admin.venueId || venues[0]?.id || '');
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Cambiar Sede Asignada"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAdminToRevoke(admin)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Revocar Rol de Admin"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Cambiar Sede de Administrador */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-600" />
                <span>Reasignar Sede</span>
              </h3>
              <button
                onClick={() => setEditingAdmin(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdminVenue} className="space-y-4 text-xs">
              <div>
                <p className="text-slate-500">
                  Administrador: <strong className="text-slate-800">{editingAdmin.displayName || editingAdmin.email}</strong>
                </p>
                <p className="text-slate-400 font-mono text-[11px]">{editingAdmin.email}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nueva Sede Asignada</label>
                <select
                  value={editVenueId}
                  onChange={(e) => setEditVenueId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden font-semibold bg-white"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city || 'Sede'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs"
                >
                  {savingEdit ? 'Guardando...' : 'Reasignar Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para revocar rol */}
      <ConfirmationModal
        isOpen={!!adminToRevoke}
        title="Revocar Rol de Administrador"
        message={`¿Deseas revocar el rol de Administrador a "${adminToRevoke?.displayName || adminToRevoke?.email}"? Pasará a ser un usuario estándar (aficionado) y perderá todo acceso operativo a la sede.`}
        confirmText={revoking ? 'Revocando...' : 'Revocar Administrador'}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setAdminToRevoke(null)}
        isDestructive
      />
    </div>
  );
};

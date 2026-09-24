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

  // Administradores asignados a sedes que no existen en el catálogo de venues
  const adminsWithInvalidVenues = adminsList.filter(
    (a) => a.venueId && !venues.some((v) => v.id === a.venueId)
  );

  const handleFixAllInvalidVenues = async () => {
    if (venues.length === 0) return;
    const defaultV = venues.find((v) => v.id === 'venue-teodoro-mariscal') || venues[0];
    setSavingEdit(true);
    try {
      for (const a of adminsWithInvalidVenues) {
        await assignAdminRole(a.uid, defaultV.id, defaultV.name);
      }
      setUsers((prev) =>
        prev.map((u) =>
          adminsWithInvalidVenues.some((inv) => inv.uid === u.uid)
            ? { ...u, venueId: defaultV.id, venueName: defaultV.name }
            : u
        )
      );
      showNotification(
        'success',
        `Se reasignaron ${adminsWithInvalidVenues.length} administradores a "${defaultV.name}".`
      );
    } catch (err: any) {
      showNotification('error', `Error al reasignar sedes: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

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
      <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-6 shadow-xl space-y-4 font-sports">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <div className="p-2 bg-red-600/20 rounded-xl text-red-400 border border-red-500/30">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
              Asignar Administrador de Sede
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Busca una cuenta ya registrada por su correo y asígnale el mando de una sede específica.
            </p>
          </div>
        </div>

        <form onSubmit={handleAssignAdmin} className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campo de Búsqueda de Usuario */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 font-sports uppercase tracking-wider">
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
                  className="w-full pl-9 pr-3 py-2 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              {/* Sugerencias desplegables */}
              {userSearchTerm.trim().length >= 2 && !selectedUserToPromote && (
                <div className="mt-1 bg-[#0F1626] border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800 z-10 relative">
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
                        className="w-full text-left p-2.5 hover:bg-slate-800 flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-white">{u.displayName || 'Sin nombre'}</p>
                          <p className="text-slate-400 font-mono text-[11px]">{u.email}</p>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {u.role}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedUserToPromote && (
                <div className="mt-2 p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold text-white">
                        {selectedUserToPromote.displayName || 'Usuario seleccionado'}
                      </span>
                      <span className="text-emerald-300 ml-1 font-mono text-[11px]">
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
                    className="text-emerald-300 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Selector de Sede */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 font-sports uppercase tracking-wider">
                2. Seleccionar Sede a Administrar
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <select
                  value={selectedVenueId}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs font-semibold text-white focus:ring-2 focus:ring-red-600 focus:outline-hidden cursor-pointer"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0A0E17] text-white">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black font-sports uppercase tracking-wider rounded-xl text-xs shadow-md shadow-red-950/40 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              {assigning ? 'Asignando mando...' : 'Confirmar Rol de Administrador'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Administradores Actuales */}
      <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden space-y-4 p-6 font-sports">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-500" />
              <span>Administradores de Sede Activos ({adminsList.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Cada administrador opera con permisos acotados exclusivamente a su sede asignada.
            </p>
          </div>

          <div className="relative w-full sm:w-64 font-sans">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Filtrar por nombre, correo o sede..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#0A0E17] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Banner de alerta si hay administradores asignados a sedes inexistentes como Estadio Chevron */}
        {adminsWithInvalidVenues.length > 0 && (
          <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 font-sans">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Atención:</strong> Se detectaron {adminsWithInvalidVenues.length} administrador(es) asignados a sedes no registradas en Superadmin (ej. Estadio Chevron).
              </span>
            </div>
            <button
              type="button"
              onClick={handleFixAllInvalidVenues}
              disabled={savingEdit}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black font-sports uppercase tracking-wider rounded-xl transition-all cursor-pointer text-xs shrink-0 shadow-md"
            >
              {savingEdit ? 'Reasignando...' : 'Reasignar a Estadio Teodoro Mariscal'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-700 rounded-2xl">
            <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-300">No hay administradores registrados que coincidan</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
              Utiliza el formulario superior para asignar el rol a un usuario registrado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0A0E17] border-b border-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Administrador</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Sede Asignada</th>
                  <th className="px-4 py-3">ID de Sede</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium font-sans">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.uid} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {(admin.displayName || admin.email || 'A')[0].toUpperCase()}
                        </div>
                        <span className="font-bold text-white">
                          {admin.displayName || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">
                      {admin.email || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      {venues.some((v) => v.id === admin.venueId) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0A0E17] text-white border border-slate-700">
                          <Building2 className="w-3 h-3 text-red-400" />
                          {admin.venueName || 'Estadio Teodoro Mariscal'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Esta sede no está registrada en el catálogo de Superadmin">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          {admin.venueName || admin.venueId || 'Estadio Chevron'} (No Registrada)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                      {admin.venueId || 'venue-teodoro-mariscal'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingAdmin(admin);
                            setEditVenueId(admin.venueId || venues[0]?.id || '');
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Cambiar Sede Asignada"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAdminToRevoke(admin)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F1626] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white font-sports">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-500" />
                <span>Reasignar Sede</span>
              </h3>
              <button
                onClick={() => setEditingAdmin(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdminVenue} className="space-y-4 text-xs font-sans">
              <div>
                <p className="text-slate-300">
                  Administrador: <strong className="text-white">{editingAdmin.displayName || editingAdmin.email}</strong>
                </p>
                <p className="text-slate-400 font-mono text-[11px]">{editingAdmin.email}</p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 font-sports uppercase tracking-wider">Nueva Sede Asignada</label>
                <select
                  value={editVenueId}
                  onChange={(e) => setEditVenueId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0E17] border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden font-semibold cursor-pointer"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0A0E17] text-white">
                      {v.name} ({v.city || 'Sede'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black font-sports uppercase tracking-wider rounded-xl shadow-md cursor-pointer"
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

import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, StadiumStand } from '../../types';
import { getVenueStaff, updateUserRoleAndDetails } from '../../lib/auth';
import { getStadiumStands } from '../../lib/stands';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Users,
  ChefHat,
  Bike,
  Ticket,
  Shield,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Store,
  MapPin,
  RefreshCw,
  X,
  Save,
  Check,
  Zap,
} from 'lucide-react';

interface PersonalAdminProps {
  user?: UserProfile;
}

export const PersonalAdmin: React.FC<PersonalAdminProps> = ({ user }) => {
  const venueId = user?.venueId || DEFAULT_VENUE_ID;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | UserRole>('todos');

  // Modal de edición de rol
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [modalRole, setModalRole] = useState<UserRole>('aficionado');
  const [modalStandId, setModalStandId] = useState<string>('');
  const [modalStandName, setModalStandName] = useState<string>('');
  const [modalAssignedZone, setModalAssignedZone] = useState<string>('Zona Central & Palcos');
  const [modalRunnerStatus, setModalRunnerStatus] = useState<'disponible' | 'en_entrega' | 'inactivo'>('disponible');
  const [savingRole, setSavingRole] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allStands] = await Promise.all([
        getVenueStaff(venueId),
        getStadiumStands(venueId).catch(() => []),
      ]);
      setUsers(allUsers);
      setStands(allStands);
    } catch (err) {
      console.error('Error cargando usuarios o puestos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [venueId]);

  const handleOpenModal = (user: UserProfile) => {
    setSelectedUser(user);
    setModalRole(user.role || 'aficionado');
    setModalStandId(user.standId || (stands[0]?.id || ''));
    const initialStand = stands.find((s) => s.id === user.standId) || stands[0];
    setModalStandName(user.standName || (initialStand ? initialStand.name : ''));
    setModalAssignedZone(user.assignedZone || 'Zona Central & Palcos');
    setModalRunnerStatus(user.runnerStatus || 'disponible');
  };

  const handleStandChange = (standId: string) => {
    setModalStandId(standId);
    const found = stands.find((s) => s.id === standId);
    if (found) {
      setModalStandName(found.name);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSavingRole(true);
    try {
      await updateUserRoleAndDetails(selectedUser.uid, {
        role: modalRole,
        venueId: venueId,
        standId: modalRole === 'concesionario' ? modalStandId : undefined,
        standName: modalRole === 'concesionario' ? modalStandName : undefined,
        assignedZone: modalRole === 'runner' ? modalAssignedZone : undefined,
        runnerStatus: modalRole === 'runner' ? modalRunnerStatus : undefined,
      });

      // Actualizar estado local
      setUsers((prev) =>
        prev.map((u) => {
          if (u.uid === selectedUser.uid) {
            return {
              ...u,
              role: modalRole,
              standId: modalRole === 'concesionario' ? modalStandId : undefined,
              standName: modalRole === 'concesionario' ? modalStandName : undefined,
              assignedZone: modalRole === 'runner' ? modalAssignedZone : undefined,
              runnerStatus: modalRole === 'runner' ? modalRunnerStatus : undefined,
            };
          }
          return u;
        })
      );

      setNotification({
        type: 'success',
        message: `El usuario ${selectedUser.displayName || selectedUser.email} ahora está declarado como ${
          modalRole === 'concesionario'
            ? `Concesionario (${modalStandName || 'Puesto asignado'})`
            : modalRole === 'runner'
            ? `Runner de Estadio (${modalAssignedZone})`
            : modalRole.toUpperCase()
        }.`,
      });

      setSelectedUser(null);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al actualizar rol: ${err.message || 'Intente nuevamente'}`,
      });
    } finally {
      setSavingRole(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'todos' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const countConcesionarios = users.filter((u) => u.role === 'concesionario').length;
  const countRunners = users.filter((u) => u.role === 'runner').length;
  const countTaquillas = users.filter((u) => u.role === 'taquilla').length;
  const countAficionados = users.filter((u) => u.role === 'aficionado' || !u.role).length;
  const countAdmins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-6">
      {/* Notificación de Éxito / Error */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas de Personal */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider font-sports">Concesionarios</span>
            <div className="p-1.5 rounded-lg bg-amber-950/50 text-amber-400 border border-amber-800/40">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-amber-400 font-scoreboard tracking-wide">{countConcesionarios}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Puestos de comida</p>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider font-sports">Runners Estadio</span>
            <div className="p-1.5 rounded-lg bg-blue-950/50 text-blue-400 border border-blue-800/40">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-blue-400 font-scoreboard tracking-wide">{countRunners}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Entregas en butaca</p>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider font-sports">Taquilla / Puertas</span>
            <div className="p-1.5 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/40">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-purple-400 font-scoreboard tracking-wide">{countTaquillas}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Control de acceso</p>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider font-sports">Aficionados</span>
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-white font-scoreboard tracking-wide">{countAficionados}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Clientes registrados</p>
        </div>

        <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider font-sports">Administradores</span>
            <div className="p-1.5 rounded-lg bg-red-950/50 text-red-400 border border-red-800/40">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-red-400 font-scoreboard tracking-wide">{countAdmins}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Acceso total</p>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros de Rol */}
      <div className="bg-[#0F1626] p-4 sm:p-5 rounded-2xl border border-slate-700/80 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-users-input"
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-[#141E34] border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-300 bg-[#141E34] hover:bg-[#1A2846] rounded-xl border border-slate-700 transition-all font-sports cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recargar
            </button>
          </div>
        </div>

        {/* Filtros de Pestañas de Roles */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          {[
            { id: 'todos', label: `Todos (${users.length})` },
            { id: 'concesionario', label: `Concesionarios (${countConcesionarios})` },
            { id: 'runner', label: `Runners (${countRunners})` },
            { id: 'taquilla', label: `Taquilla (${countTaquillas})` },
            { id: 'aficionado', label: `Aficionados (${countAficionados})` },
            { id: 'admin', label: `Admins (${countAdmins})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-black uppercase tracking-wider font-sports transition-all shrink-0 cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-red-700 text-white shadow-md border border-red-500'
                  : 'bg-[#141E34] text-slate-400 hover:text-white border border-slate-700/80 hover:bg-[#1A2846]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Directorio de Usuarios */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner message="Cargando directorio de usuarios..." />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-8 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-bold font-sports uppercase tracking-wider text-slate-300">No se encontraron usuarios con ese criterio</p>
          <p className="text-xs text-slate-400 mt-1">Prueba con otro término de búsqueda o filtro</p>
        </div>
      ) : (
        <div className="bg-[#0F1626] rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#141E34] text-slate-400 font-black uppercase text-[11px] tracking-wider border-b border-slate-700/80 font-sports">
                <tr>
                  <th className="py-3 px-4">Usuario / Aficionado</th>
                  <th className="py-3 px-4">Rol Declarado</th>
                  <th className="py-3 px-4">Puesto / Zona Asignada</th>
                  <th className="py-3 px-4">Estado Operativo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredUsers.map((u) => {
                  const role = u.role || 'aficionado';
                  return (
                    <tr key={u.uid} className="hover:bg-[#141E34]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt={u.displayName || 'Usuario'}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#141E34] text-slate-300 border border-slate-700 font-bold flex items-center justify-center shrink-0 text-xs font-scoreboard">
                              {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">
                              {u.displayName || 'Sin nombre registrado'}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {role === 'concesionario' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-950/70 text-amber-400 border border-amber-800/60 font-sports">
                            <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                            Concesionario
                          </span>
                        )}
                        {role === 'runner' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/60 font-sports">
                            <Bike className="w-3.5 h-3.5 text-blue-400" />
                            Runner Estadio
                          </span>
                        )}
                        {role === 'taquilla' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-950/70 text-purple-400 border border-purple-800/60 font-sports">
                            <Ticket className="w-3.5 h-3.5 text-purple-400" />
                            Taquilla / Puertas
                          </span>
                        )}
                        {role === 'admin' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-950/70 text-red-400 border border-red-800/60 font-sports">
                            <Shield className="w-3.5 h-3.5 text-red-400" />
                            Administrador
                          </span>
                        )}
                        {role === 'aficionado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700 font-sports">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Aficionado / Cliente
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {role === 'concesionario' && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {u.standName || (stands.find((s) => s.id === u.standId)?.name) || 'Puesto no asignado'}
                            </span>
                          </div>
                        )}
                        {role === 'runner' && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {u.assignedZone || 'Zona Central & Palcos'}
                            </span>
                          </div>
                        )}
                        {role !== 'concesionario' && role !== 'runner' && (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {role === 'runner' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              u.runnerStatus === 'disponible'
                                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                                : u.runnerStatus === 'en_entrega'
                                ? 'bg-amber-950/70 text-amber-400 border border-amber-800/60'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.runnerStatus === 'disponible'
                                  ? 'bg-emerald-500'
                                  : u.runnerStatus === 'en_entrega'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-400'
                              }`}
                            ></span>
                            {u.runnerStatus === 'disponible'
                              ? 'Disponible'
                              : u.runnerStatus === 'en_entrega'
                              ? 'En Entrega'
                              : 'Inactivo'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Activo</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          id={`edit-role-${u.uid}`}
                          onClick={() => handleOpenModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#141E34] hover:bg-[#1A2846] text-white border border-slate-700 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-sm font-sports cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-red-400" />
                          Declarar Rol
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para Declarar Rol de Usuario */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0F1626] w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-[#141E34] text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-600/30 border border-red-500/40 text-red-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base uppercase tracking-wider font-sports">Declarar Rol de Usuario</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Asignar funciones y puesto operativo en el estadio</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs sm:text-sm">
              {/* Resumen del Usuario */}
              <div className="p-3.5 bg-[#141E34] rounded-xl border border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0A0E17] text-white border border-slate-700 font-scoreboard text-lg font-black flex items-center justify-center">
                  {(selectedUser.displayName || selectedUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{selectedUser.displayName || 'Sin nombre'}</div>
                  <div className="text-xs text-slate-400">{selectedUser.email}</div>
                </div>
              </div>

              {/* Selector de Rol */}
              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-2 font-sports">
                  Selecciona el Rol Operativo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      role: 'aficionado' as UserRole,
                      label: 'Aficionado',
                      desc: 'Cliente regular (boletos y tienda)',
                      icon: User,
                      color: 'border-slate-700 hover:border-slate-600 bg-[#141E34]',
                    },
                    {
                      role: 'concesionario' as UserRole,
                      label: 'Concesionario',
                      desc: 'Manejo de puesto de comida & menú',
                      icon: ChefHat,
                      color: 'border-amber-800/60 hover:border-amber-700 bg-[#141E34] text-amber-400',
                    },
                    {
                      role: 'runner' as UserRole,
                      label: 'Runner de Estadio',
                      desc: 'Repartidor de pedidos en butaca',
                      icon: Bike,
                      color: 'border-blue-800/60 hover:border-blue-700 bg-[#141E34] text-blue-400',
                    },
                    {
                      role: 'taquilla' as UserRole,
                      label: 'Taquilla / Puertas',
                      desc: 'Escaneo y validación de QR',
                      icon: Ticket,
                      color: 'border-purple-800/60 hover:border-purple-700 bg-[#141E34] text-purple-400',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = modalRole === item.role;
                    return (
                      <button
                        type="button"
                        key={item.role}
                        onClick={() => setModalRole(item.role)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500/40 text-white'
                            : `${item.color} text-slate-300`
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-red-400' : 'text-slate-400'}`} />
                        <div>
                          <div className={`text-xs font-black uppercase tracking-wide font-sports ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {item.label}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opciones Específicas si se elige Concesionario */}
              {modalRole === 'concesionario' && (
                <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 font-sports">
                    <Store className="w-4 h-4 text-amber-400" />
                    Asignar Puesto de Alimentos en Estadio
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Puesto o Concesión Oficial
                    </label>
                    <select
                      id="select-stand-id"
                      value={modalStandId}
                      onChange={(e) => handleStandChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#141E34] border border-amber-800/70 text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      {stands.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.location})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-amber-300/80 mt-1">
                      Este usuario tendrá acceso al panel de comanda y control de disponibilidad de menú de este puesto.
                    </p>
                  </div>
                </div>
              )}

              {/* Opciones Específicas si se elige Runner */}
              {modalRole === 'runner' && (
                <div className="p-4 bg-blue-950/30 border border-blue-800/50 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-400 font-sports">
                    <Bike className="w-4 h-4 text-blue-400" />
                    Configuración de Runner de Estadio
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Zona Asignada para Entregas
                    </label>
                    <select
                      id="select-runner-zone"
                      value={modalAssignedZone}
                      onChange={(e) => setModalAssignedZone(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#141E34] border border-blue-800/70 text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Zona Central & Palcos">Zona Central & Palcos VIP</option>
                      <option value="Planta Baja - Pasillos Laterales">Planta Baja - Pasillos Laterales</option>
                      <option value="Bleachers & Zona Familiar">Bleachers & Zona Familiar</option>
                      <option value="Explanada & Puertas Principales">Explanada & Puertas Principales</option>
                      <option value="Todo el Estadio (Runner Móvil)">Todo el Estadio (Runner Móvil)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Estado Inicial de Disponibilidad
                    </label>
                    <select
                      id="select-runner-status"
                      value={modalRunnerStatus}
                      onChange={(e) => setModalRunnerStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-[#141E34] border border-blue-800/70 text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="disponible">🟢 Disponible para recibir entregas</option>
                      <option value="en_entrega">🟡 En Entrega activa</option>
                      <option value="inactivo">⚪ Inactivo / Fuera de turno</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="confirm-role-btn"
                  type="submit"
                  disabled={savingRole}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg border border-red-500 font-sports transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingRole ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Confirmar y Guardar Rol</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

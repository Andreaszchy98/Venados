import React from 'react';
import { UserProfile, UserRole } from '../../types';
import { RoleBadge } from './RoleBadge';
import { signOutUser, updateUserRole } from '../../lib/auth';
import { LogOut, User, RefreshCw } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onRoleChanged?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onOpenAuth, onRoleChanged }) => {
  const [switchingRole, setSwitchingRole] = React.useState(false);

  const handleRoleChange = async (newRole: UserRole) => {
    if (!user) return;
    setSwitchingRole(true);
    try {
      await updateUserRole(
        user.uid,
        newRole,
        user.venueId || 'venue-teodoro-mariscal',
        user.venueName || 'Estadio Teodoro Mariscal'
      );
      if (onRoleChanged) onRoleChanged();
    } catch (err) {
      console.error('Error changing role:', err);
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-700 to-red-600 flex items-center justify-center font-black text-white text-lg tracking-wider border border-red-500/40 shadow-inner">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  VXP
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block -mt-0.5">
                Venue Experience Platform
              </span>
            </div>
          </div>

          {/* User Controls / Auth */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Selector rápido de Rol para alternar entre Aficionado, Admin, Concesionario y Taquilla */}
                <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/90 py-1 px-2.5 rounded-lg border border-slate-700 text-xs">
                  <span className="text-slate-400 text-[11px]">Cambiar vista:</span>
                  <select
                    value={user.role}
                    disabled={switchingRole}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="bg-transparent text-white font-bold focus:outline-hidden cursor-pointer hover:text-red-300 transition-colors text-xs"
                    title="Alternar rol para explorar todos los módulos del negocio"
                  >
                    {user.role === 'superadmin' && (
                      <option value="superadmin" className="bg-slate-900 text-amber-300">
                        Superadmin (Gestión Global de Sedes)
                      </option>
                    )}
                    <option value="aficionado" className="bg-slate-900 text-white">
                      Aficionado (Boletos, Tienda, Comida)
                    </option>
                    <option value="admin" className="bg-slate-900 text-white">
                      Administrador (Ventas, Inventario, Envíos, Personal)
                    </option>
                    <option value="concesionario" className="bg-slate-900 text-white">
                      Concesionario (Comanda en Vivo)
                    </option>
                    <option value="runner" className="bg-slate-900 text-white">
                      Runner (Entregas en Butaca)
                    </option>
                    <option value="taquilla" className="bg-slate-900 text-white">
                      Taquilla (Control de Accesos)
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 pl-2 border-l border-slate-700">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-white font-semibold text-xs overflow-hidden">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Avatar'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                      {user.displayName || user.email}
                    </p>
                    <div className="mt-0.5">
                      <RoleBadge role={user.role} showIcon={false} />
                    </div>
                  </div>
                </div>

                <button
                  id="signout-btn"
                  onClick={() => signOutUser()}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 border border-slate-700 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="login-header-btn"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors uppercase tracking-wider"
              >
                <User className="w-4 h-4" /> Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

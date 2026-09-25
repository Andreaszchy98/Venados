import React, { useState } from 'react';
import { UserProfile, UserRole } from '../../types';
import { RoleBadge } from './RoleBadge';
import { signOutUser, updateUserRole } from '../../lib/auth';
import {
  LogOut,
  User,
  Globe,
  Sun,
  Moon,
  Sparkles,
  Loader2,
  X,
  Check,
  Building2,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onRoleChanged?: () => void;
  activeView?: UserRole | null;
  onActiveViewChange?: (newView: UserRole | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenAuth,
  onRoleChanged,
  activeView,
  onActiveViewChange,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { language, setLanguage, t, isTranslating } = useLanguage();
  const { theme, setTheme } = useTheme();

  const handleRoleChange = (newRole: UserRole) => {
    if (!user) return;
    if (onActiveViewChange) {
      // Si selecciona el rol original del usuario, quitar la simulación
      onActiveViewChange(newRole === user.role ? null : newRole);
    }
    setIsSidebarOpen(false);
  };

  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header
        className={`sticky top-0 z-40 backdrop-blur-md border-b shadow-md transition-colors duration-200 ${
          theme === 'light'
            ? 'bg-white/95 text-slate-900 border-slate-200 shadow-slate-200/50'
            : 'bg-[#0B0F19]/95 text-white border-slate-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            {/* Logo & Marca VXP */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center font-black text-white text-base sm:text-lg tracking-wider border border-red-400/40 shadow-md shadow-red-950/40 shrink-0 font-sports">
                V
              </div>
              <div className="min-w-0">
                <span
                  className={`font-extrabold text-base sm:text-lg tracking-tight font-sports block leading-tight ${
                    theme === 'light' ? 'text-slate-950' : 'text-white'
                  }`}
                >
                  VXP
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] block -mt-0.5 truncate ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {t('header.platform_name', 'Venue Experience Platform')}
                </span>
              </div>
            </div>

            {/* Controles de Usuario: Avatar interactivo para abrir la barra lateral */}
            <div className="flex items-center gap-2 shrink-0">
              {user ? (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  {/* Botón de Avatar con efecto hover para abrir el sidebar lateral */}
                  <button
                    type="button"
                    id="user-profile-avatar-btn"
                    onClick={() => setIsSidebarOpen(true)}
                    className={`flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-full sm:rounded-2xl border transition-all cursor-pointer group shadow-xs ${
                      theme === 'light'
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-900 hover:ring-2 hover:ring-red-500/30'
                        : 'bg-[#131A29] hover:bg-[#1C263B] border-slate-700 text-white hover:ring-2 hover:ring-red-500/40'
                    }`}
                    title="Toca para abrir ajustes de perfil, tema e idioma"
                    aria-label="Abrir ajustes de perfil"
                  >
                    {/* Imagen o Letra Inicial del Perfil */}
                    <div className="w-8 h-8 rounded-full border border-red-500/40 flex items-center justify-center font-bold text-xs overflow-hidden bg-gradient-to-tr from-red-600 to-amber-500 text-white shadow-xs shrink-0">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'Avatar'}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{userInitial}</span>
                      )}
                    </div>

                    {/* Nombre y Rol (visible en tablet/desktop) */}
                    <div className="hidden md:block text-left pr-1">
                      <p className="text-xs font-bold leading-tight truncate max-w-[120px]">
                        {user.displayName || user.email?.split('@')[0]}
                      </p>
                      <div className="mt-0.5 scale-90 origin-left">
                        <RoleBadge role={user.role} showIcon={false} />
                      </div>
                    </div>
                  </button>

                  {/* Botón rápido de Cerrar Sesión */}
                  <button
                    id="signout-btn"
                    type="button"
                    onClick={() => signOutUser()}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-300'
                        : 'bg-[#131A29] hover:bg-red-950/80 text-slate-300 hover:text-red-400 border-slate-700/80'
                    }`}
                    title={t('header.logout', 'Cerrar Sesión')}
                    aria-label="Cerrar Sesión"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Botón de acceso a ajustes para invitados */}
                  <button
                    type="button"
                    id="guest-settings-btn"
                    onClick={() => setIsSidebarOpen(true)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-[#131A29] hover:bg-[#1C263B] text-slate-200 border-slate-700'
                    }`}
                    title="Ajustes de idioma y tema"
                    aria-label="Ajustes de idioma y tema"
                  >
                    <Globe className="w-4 h-4 text-red-500" />
                  </button>

                  {/* Botón Iniciar Sesión */}
                  <button
                    id="login-header-btn"
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-900/30 transition-all uppercase tracking-wider cursor-pointer active:scale-95 shrink-0"
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('header.login', 'Iniciar Sesión')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop del Sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Barra Lateral (Sidebar Drawer) con Modo Oscuro/Claro y Selector de Idioma */}
      <aside
        id="profile-settings-sidebar"
        className={`fixed top-0 right-0 bottom-0 z-[130] w-84 max-w-[88vw] shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        } ${
          theme === 'light'
            ? 'bg-white text-slate-900 border-l border-slate-200'
            : 'bg-[#0B111E] text-white border-l border-slate-800'
        }`}
      >
        {/* Cabecera del Sidebar */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0E1526] border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <h3 className="text-sm sm:text-base font-black uppercase tracking-wider font-sports">
              {t('sidebar.title', 'Mi Cuenta y Ajustes')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-white hover:bg-slate-200 text-slate-500 border-slate-200'
                : 'bg-[#141C2E] hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
            }`}
            title="Cerrar panel"
            aria-label="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrolleable del Sidebar */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1 font-sans">
          {/* Tarjeta de Información del Usuario */}
          {user ? (
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-[#101728] border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl border-2 border-red-500 flex items-center justify-center font-black text-lg overflow-hidden bg-gradient-to-tr from-red-600 to-amber-500 text-white shadow-md shrink-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{userInitial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-extrabold text-sm truncate leading-tight ${
                    theme === 'light' ? 'text-slate-950' : 'text-white'
                  }`}>
                    {user.displayName || 'Aficionado'}
                  </p>
                  <p
                    className={`text-xs truncate ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {user.email || 'Sin correo asociado'}
                  </p>
                  <div className="mt-1.5">
                    <RoleBadge role={user.role} showIcon />
                  </div>
                </div>
              </div>

              {(user.venueName || user.venueId) && (
                <div
                  className={`pt-2 border-t flex items-center gap-2 text-[11px] ${
                    theme === 'light'
                      ? 'border-slate-200 text-slate-600'
                      : 'border-slate-800 text-slate-400'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="truncate">
                    {user.venueName === 'Estadio Chevron' || user.venueId === 'venue-chevron'
                      ? 'Estadio Teodoro Mariscal'
                      : user.venueName || 'Estadio Teodoro Mariscal'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`p-4 rounded-2xl border text-center space-y-2.5 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-[#101728] border-slate-800'
              }`}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-xs uppercase tracking-wide">
                  Navegación como Invitado
                </p>
                <p
                  className={`text-[11px] ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Inicia sesión para comprar boletos, guardar órdenes y acumular beneficios.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  onOpenAuth();
                }}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                Iniciar Sesión
              </button>
            </div>
          )}

          {/* SECCIÓN 1: MODO DE PANTALLA (DARK / LIGHT) */}
          <div className="space-y-2.5">
            <label
              className={`block text-[11px] font-black uppercase tracking-wider font-sports ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Modo de Pantalla
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Opción Dark */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-red-600/20 border-red-500 text-white shadow-md ring-2 ring-red-500/30'
                    : theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#101728] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-lg bg-red-600 text-white shadow-xs">
                    <Moon className="w-4 h-4" />
                  </div>
                  {theme === 'dark' && <Check className="w-4 h-4 text-red-400" />}
                </div>
                <div>
                  <p className="font-bold text-xs">Modo Oscuro</p>
                  <p className="text-[10px] opacity-75">Estadio Nocturno</p>
                </div>
              </button>

              {/* Opción Light */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-500/20 border-amber-500 text-slate-950 shadow-md ring-2 ring-amber-500/30'
                    : 'bg-[#101728] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-lg bg-amber-400 text-slate-950 shadow-xs">
                    <Sun className="w-4 h-4" />
                  </div>
                  {theme === 'light' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <div>
                  <p className="font-bold text-xs">Modo Claro</p>
                  <p className="text-[10px] opacity-75">Día Iluminado</p>
                </div>
              </button>
            </div>
          </div>

          {/* SECCIÓN 2: CAMBIO DE VISTA / ROL (EXCLUSIVO PARA ADMINISTRADORES DE SEDE) */}
          {user && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
              <label
                className={`block text-[11px] font-black uppercase tracking-wider font-sports ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Cambiar Vista del Sistema
              </label>
              <div
                className={`p-3 rounded-2xl border space-y-2 ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-[#101728] border-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-red-500">
                  <Layers className="w-4 h-4" />
                  <span>Explorar Módulos del Negocio</span>
                </div>
                <select
                  value={activeView || user.role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-hidden cursor-pointer transition-colors ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-[#141C2E] border-slate-700 text-white'
                  }`}
                  title="Simular vista de módulo"
                >
                  {user.role === 'superadmin' && (
                    <option value="superadmin">Superadmin (Gestión Global de Sedes)</option>
                  )}
                  <option value="admin">Administrador (Ventas, Inventario, Envíos)</option>
                  <option value="taquillera">Taquillera (POS Venta e Impresión de Boletos)</option>
                  <option value="taquilla">Taquilla (Control de Accesos y Puertas)</option>
                  <option value="aficionado">Aficionado (Boletos, Tienda, Comida)</option>
                  <option value="concesionario">Concesionario (Comanda en Vivo)</option>
                  <option value="runner">Runner (Entregas en Butaca)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Sidebar con botón de Cerrar Sesión */}
        <div
          className={`p-4 border-t shrink-0 space-y-2 ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0E1526] border-slate-800'
          }`}
        >
          {user && (
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                signOutUser();
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-red-500/40 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('header.logout', 'Cerrar Sesión')}</span>
            </button>
          )}
          <p
            className={`text-center text-[10px] ${
              theme === 'light' ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            VXP — Venue Experience Platform © 2026
          </p>
        </div>
      </aside>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, Venue } from '../../types';
import { RoleBadge } from './RoleBadge';
import { signOutUser } from '../../lib/auth';
import { HelpModal } from './HelpModal';
import { DEFAULT_VENUES, DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { subscribeVenues } from '../../lib/venues';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  LogOut,
  User,
  Sun,
  Moon,
  X,
  Check,
  Building2,
  ChevronRight,
  Layers,
  HelpCircle,
  MapPin,
  SlidersHorizontal,
  Lock,
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
  activeView,
  onActiveViewChange,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  // Determinar si el usuario tiene permiso para cambiar libremente de sede
  // Solo los aficionados o invitados sin sesión pueden seleccionar de qué sede ver eventos/boletos.
  // Usuarios operativos/administrativos (admin, taquillera, taquilla, concesionario, runner, superadmin asignado)
  // tienen su sede estrictamente restringida a la asignada en base de datos para no filtrar datos de otros estadios.
  const isAficionadoOrGuest = !user || user.role === 'aficionado';
  const assignedVenueId = user?.venueId || DEFAULT_VENUE_ID;

  // Gestión de sedes y estadio activo
  const [venues, setVenues] = useState<Venue[]>(DEFAULT_VENUES);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => {
    if (!isAficionadoOrGuest) {
      return assignedVenueId;
    }
    try {
      return localStorage.getItem('vxp_selected_venue_id') || user?.browsingVenueId || user?.venueId || DEFAULT_VENUE_ID;
    } catch {
      return user?.browsingVenueId || user?.venueId || DEFAULT_VENUE_ID;
    }
  });

  // Asegurar que si el rol cambia o el usuario inicia sesión como operativo, se fuerce su sede asignada
  useEffect(() => {
    if (!isAficionadoOrGuest) {
      if (selectedVenueId !== assignedVenueId) {
        setSelectedVenueId(assignedVenueId);
        try {
          localStorage.setItem('vxp_selected_venue_id', assignedVenueId);
        } catch {}
        window.dispatchEvent(new CustomEvent('vxp_venue_changed', { detail: assignedVenueId }));
      }
    }
  }, [isAficionadoOrGuest, assignedVenueId, selectedVenueId]);

  useEffect(() => {
    const unsubscribe = subscribeVenues((list) => {
      if (list && list.length > 0) {
        setVenues(list);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sincronizar selectedVenueId con eventos externos o cambios de usuario
  useEffect(() => {
    const onVenueChanged = (e: any) => {
      // Si el usuario no es aficionado, ignorar cualquier cambio externo de sede
      if (!isAficionadoOrGuest) {
        return;
      }
      const newVId = e.detail;
      if (newVId && newVId !== selectedVenueId) {
        setSelectedVenueId(newVId);
      }
    };
    const onOpenSettings = () => {
      setIsSidebarOpen(true);
    };
    window.addEventListener('vxp_venue_changed', onVenueChanged);
    window.addEventListener('vxp_open_settings', onOpenSettings);
    return () => {
      window.removeEventListener('vxp_venue_changed', onVenueChanged);
      window.removeEventListener('vxp_open_settings', onOpenSettings);
    };
  }, [selectedVenueId, isAficionadoOrGuest]);

  const handleSelectVenue = (venue: Venue) => {
    // Si no es aficionado ni invitado, bloquear terminantemente el cambio de sede
    if (!isAficionadoOrGuest) {
      return;
    }

    setSelectedVenueId(venue.id);
    try {
      localStorage.setItem('vxp_selected_venue_id', venue.id);
      if (venue.city) {
        localStorage.setItem('vxp_selected_city', venue.city);
      }
      window.dispatchEvent(new CustomEvent('vxp_venue_changed', { detail: venue.id }));
    } catch {}

    if (user?.uid) {
      try {
        updateDoc(doc(db, 'users', user.uid), {
          browsingVenueId: venue.id,
          browsingVenueName: venue.name,
          venueId: venue.id,
          venueName: venue.name,
        }).catch(() => {});
      } catch {}
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (!user) return;
    if (onActiveViewChange) {
      onActiveViewChange(newRole === user.role ? null : newRole);
    }
    setIsSidebarOpen(false);
  };

  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  const currentVenueObj = venues.find((v) => v.id === selectedVenueId) || venues[0];

  return (
    <>
      <header
        className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-md transition-colors duration-200 ${
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

            {/* Controles de Usuario / Ajustes de Cuenta, Tema y Sede */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {user ? (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  {/* Botón de Avatar para abrir popup de ajustes de cuenta, tema y sede */}
                  <button
                    type="button"
                    id="user-profile-avatar-btn"
                    onClick={() => setIsSidebarOpen(true)}
                    className={`flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full sm:rounded-2xl border transition-all cursor-pointer group shadow-xs ${
                      theme === 'light'
                        ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-900 hover:ring-2 hover:ring-red-500/30'
                        : 'bg-[#131A29] hover:bg-[#1C263B] border-slate-700 text-white hover:ring-2 hover:ring-red-500/40'
                    }`}
                    title="Ajustes de cuenta, tema y sede deportiva"
                    aria-label="Abrir ajustes de perfil y sede"
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

                    {/* Nombre y Sede Activa (visible en tablet/desktop) */}
                    <div className="hidden md:block text-left pr-1">
                      <p className="text-xs font-bold leading-tight truncate max-w-[130px]">
                        {user.displayName || user.email?.split('@')[0]}
                      </p>
                      <p className="text-[10px] text-red-500 font-semibold truncate max-w-[130px] flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span>{currentVenueObj?.name || 'Sede activa'}</span>
                      </p>
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
                  {/* Botón de acceso a ajustes y cambio de tema/sede para invitados */}
                  <button
                    type="button"
                    id="guest-settings-btn"
                    onClick={() => setIsSidebarOpen(true)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer shadow-xs ${
                      theme === 'light'
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-[#131A29] hover:bg-[#1C263B] text-slate-200 border-slate-700'
                    }`}
                    title="Ajustes de sede deportiva y tema visual"
                    aria-label="Ajustes de sede y tema"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs font-bold font-sports uppercase tracking-wider hidden sm:inline">
                      Ajustes & Sede
                    </span>
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

      {/* Backdrop del Popup Modal / Sidebar Drawer */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* POPUP / MODAL DRAWER: MI CUENTA, SEDE DEPORTIVA Y AJUSTES */}
      <aside
        id="profile-settings-sidebar"
        className={`fixed top-0 right-0 bottom-0 z-[130] w-88 max-w-[90vw] shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        } ${
          theme === 'light'
            ? 'bg-white text-slate-900 border-l border-slate-200'
            : 'bg-[#0B111E] text-white border-l border-slate-800'
        }`}
      >
        {/* Cabecera del Popup */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0E1526] border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
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

        {/* Contenido scrolleable del Popup */}
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
                  Inicia sesión para comprar boletos, guardar órdenes y pedidos.
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

          {/* SECCIÓN 1: SELECTOR DESPLEGABLE DE SEDE Y ESTADIO */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="sidebar-venue-selector"
                className={`block text-[11px] font-black uppercase tracking-wider font-sports flex items-center gap-1.5 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>Sede Deportiva / Estadio</span>
              </label>
              <div className="flex items-center gap-1.5">
                {!isAficionadoOrGuest && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Lock className="w-2.5 h-2.5" /> Fijo
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-bold">
                  {currentVenueObj?.city || 'Sinaloa'}
                </span>
              </div>
            </div>

            <div className="relative">
              <div
                className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                  !isAficionadoOrGuest
                    ? theme === 'light'
                      ? 'bg-slate-100/90 border-slate-300 text-slate-700 opacity-95 cursor-not-allowed'
                      : 'bg-[#0E1526] border-slate-700/70 text-slate-300 opacity-90 cursor-not-allowed'
                    : theme === 'light'
                    ? 'bg-slate-50 border-slate-300 text-slate-900 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20'
                    : 'bg-[#101728] border-slate-700 text-slate-100 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30'
                }`}
              >
                <Building2 className={`w-4 h-4 shrink-0 ${!isAficionadoOrGuest ? 'text-amber-500' : 'text-red-500'}`} />
                <select
                  id="sidebar-venue-selector"
                  value={isAficionadoOrGuest ? selectedVenueId : assignedVenueId}
                  disabled={!isAficionadoOrGuest}
                  onChange={(e) => {
                    if (!isAficionadoOrGuest) return;
                    const found = venues.find((v) => v.id === e.target.value);
                    if (found) {
                      handleSelectVenue(found);
                    }
                  }}
                  className={`w-full bg-transparent text-xs font-bold pr-7 focus:outline-hidden appearance-none ${
                    !isAficionadoOrGuest ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                  title={!isAficionadoOrGuest ? `Sede bloqueada: Asignado a ${currentVenueObj?.name}` : "Seleccionar estadio activo"}
                >
                  {venues.map((venue) => {
                    const team = (venue.id === DEFAULT_VENUE_ID || venue.name.toLowerCase().includes('teodoro'))
                      ? 'Venados de Mazatlán'
                      : (venue.teamName || 'Equipo Oficial');
                    const isAssignedToUser = venue.id === assignedVenueId;
                    return (
                      <option
                        key={venue.id}
                        value={venue.id}
                        disabled={!isAficionadoOrGuest && !isAssignedToUser}
                        className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101728] text-white font-medium'}
                      >
                        {venue.name} — {venue.city} ({team}) {!isAficionadoOrGuest && isAssignedToUser ? '🔒 [SEDE ASIGNADA]' : ''}
                      </option>
                    );
                  })}
                </select>
                {!isAficionadoOrGuest ? (
                  <Lock className="w-4 h-4 text-amber-500 absolute right-3 pointer-events-none" />
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 rotate-90 absolute right-3 pointer-events-none transition-colors ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                )}
              </div>
            </div>

            {/* Ficha descriptiva compacta de la sede seleccionada */}
            {currentVenueObj && (
              <div
                className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-600'
                    : 'bg-[#0E1526] border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold truncate text-slate-800 dark:text-slate-200">
                    {(currentVenueObj.id === DEFAULT_VENUE_ID || currentVenueObj.name.toLowerCase().includes('teodoro'))
                      ? 'Venados de Mazatlán'
                      : (currentVenueObj.teamName || 'Equipo Oficial')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                    Equipo Oficial
                  </span>
                </div>
                <span className="font-extrabold text-red-500 shrink-0">
                  {currentVenueObj.city}, {currentVenueObj.state}
                </span>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: MODO DE PANTALLA (DARK / LIGHT) */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
            <label
              className={`block text-[11px] font-black uppercase tracking-wider font-sports ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-300'
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

          {/* SECCIÓN 3: CAMBIO DE VISTA / ROL (EXCLUSIVO PARA ADMINISTRADORES DE SEDE) */}
          {user && (user.role === 'admin' || user.role === 'superadmin') && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
              <label
                className={`block text-[11px] font-black uppercase tracking-wider font-sports ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-300'
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

          {/* SECCIÓN 4: CENTRO DE AYUDA, GUÍA Y SOPORTE */}
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            {/* Si es aficionado o invitado, permitir ver la Guía de Selección de Sede */}
            {isAficionadoOrGuest && (
              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  window.dispatchEvent(new CustomEvent('vxp_open_venue_guide'));
                }}
                className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-900'
                    : 'bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-red-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <span className="block text-xs font-black uppercase font-sports">Guía de Selección de Sede</span>
                    <span className="block text-[10px] opacity-80">Ver cómo cambiar de estadio y recinto</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsHelpOpen(true);
              }}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-900'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="block text-xs font-black uppercase font-sports">Centro de Ayuda / FAQ</span>
                  <span className="block text-[10px] opacity-80">Preguntas frecuentes sobre boletos y pedidos</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </button>
          </div>
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

      {/* Modal de Ayuda y Preguntas Frecuentes */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        userDefaultName={user?.displayName || ''}
        userDefaultEmail={user?.email || ''}
      />
    </>
  );
};

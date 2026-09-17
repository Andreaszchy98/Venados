import React from 'react';
import { UserProfile, UserRole } from '../../types';
import { RoleBadge } from './RoleBadge';
import { signOutUser, updateUserRole } from '../../lib/auth';
import { LogOut, User, Globe, ChevronDown, Sun, Moon, Sparkles, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onRoleChanged?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onOpenAuth, onRoleChanged }) => {
  const [switchingRole, setSwitchingRole] = React.useState(false);
  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const { language, setLanguage, t, isTranslating } = useLanguage();
  const { theme, setTheme } = useTheme();

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
    <header className={`sticky top-0 z-40 backdrop-blur-md border-b shadow-md transition-colors duration-200 ${
      theme === 'light'
        ? 'bg-white/95 text-slate-900 border-slate-200 shadow-slate-200/50'
        : 'bg-[#0B0F19]/95 text-white border-slate-800/80'
    }`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-2 flex-nowrap relative">
          {/* Logo & Marca con Selector de Estilo */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink min-w-0 flex-nowrap">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center font-black text-white text-base sm:text-lg tracking-wider border border-red-400/40 shadow-md shadow-red-950/40 shrink-0">
              V
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 flex-nowrap">
                <span className={`font-extrabold text-sm sm:text-base md:text-lg tracking-tight flex items-center gap-1 font-sports shrink-0 ${
                  theme === 'light' ? 'text-slate-950' : 'text-white'
                }`}>
                  VXP
                </span>

                {/* Selector de estilo compacto Dark / Light */}
                <div
                  id="theme-selector-compact"
                  role="radiogroup"
                  aria-label="Selector de estilo de tema"
                  className={`inline-flex items-center p-0.5 rounded-md sm:rounded-lg border shadow-inner transition-colors shrink-0 ${
                    theme === 'light'
                      ? 'bg-slate-100 border-slate-300'
                      : 'bg-slate-900/90 border-slate-700/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`px-1 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded transition-all flex items-center gap-0.5 sm:gap-1 cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-red-600 text-white shadow-xs font-sports'
                        : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900 font-sports'
                        : 'text-slate-400 hover:text-white font-sports'
                    }`}
                    title="Estilo Dark (Estadio Nocturno)"
                    aria-checked={theme === 'dark'}
                  >
                    <Moon className="w-2.5 h-2.5 shrink-0" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`px-1 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded transition-all flex items-center gap-0.5 sm:gap-1 cursor-pointer ${
                      theme === 'light'
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs font-sports'
                        : 'text-slate-400 hover:text-white font-sports'
                    }`}
                    title="Estilo Light (Tonos Iluminados)"
                    aria-checked={theme === 'light'}
                  >
                    <Sun className="w-2.5 h-2.5 shrink-0" />
                    <span>Light</span>
                  </button>
                </div>
              </div>
              <span className={`text-[10px] sm:text-[11px] hidden sm:block -mt-0.5 truncate ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {t('header.platform_name', 'Venue Experience Platform')}
              </span>
            </div>
          </div>

          {/* User Controls & Idioma */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
            {/* Botón selector de idioma (ES / EN) con IA */}
            <div className="relative shrink-0">
              <button
                id="language-toggle-btn"
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className={`flex items-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-3 rounded-lg sm:rounded-xl border font-bold transition-all shadow-xs cursor-pointer ${
                  showLangMenu ? 'ring-2 ring-red-500/40' : ''
                } ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
                    : 'bg-[#131A29] hover:bg-[#1C263B] text-slate-100 border-slate-700/90'
                }`}
                title={t('header.language', 'Cambiar idioma / Switch language')}
                aria-label="Seleccionar idioma"
                aria-expanded={showLangMenu}
              >
                {isTranslating ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                <span className="tracking-wider text-xs flex items-center gap-1">
                  <span>{language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}</span>
                </span>
                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                  showLangMenu ? 'rotate-180' : ''
                } ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`} />
              </button>

              {showLangMenu && (
                <>
                  {/* Backdrop para cerrar al hacer clic afuera */}
                  <div
                    className="fixed inset-0 z-40 bg-black/10 cursor-default"
                    onClick={() => setShowLangMenu(false)}
                  />
                  <div className={`absolute right-0 top-full mt-2 w-56 border rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 shadow-slate-400/30 text-slate-900'
                      : 'bg-[#101624] border-slate-700 shadow-black/80 text-white'
                  }`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between text-[10px] uppercase font-bold tracking-wider ${
                      theme === 'light' ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'
                    }`}>
                      <span>{t('header.language', 'Idioma')}</span>
                      <span className="flex items-center gap-1 text-emerald-500 normal-case font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Gemini IA
                      </span>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <button
                        id="lang-option-es"
                        type="button"
                        onClick={() => {
                          setLanguage('es');
                          setShowLangMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          language === 'es'
                            ? theme === 'light'
                              ? 'bg-red-50 text-red-600 font-bold border border-red-200/60'
                              : 'bg-red-600/20 text-red-300 font-bold border border-red-500/30'
                            : theme === 'light'
                            ? 'text-slate-700 hover:bg-slate-100'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🇲🇽</span>
                          <div className="text-left">
                            <p className="font-bold leading-tight">Español</p>
                            <p className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Idioma original</p>
                          </div>
                        </div>
                        {language === 'es' && <span className="text-red-500 text-sm font-black">✓</span>}
                      </button>

                      <button
                        id="lang-option-en"
                        type="button"
                        onClick={() => {
                          setLanguage('en');
                          setShowLangMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          language === 'en'
                            ? theme === 'light'
                              ? 'bg-red-50 text-red-600 font-bold border border-red-200/60'
                              : 'bg-red-600/20 text-red-300 font-bold border border-red-500/30'
                            : theme === 'light'
                            ? 'text-slate-700 hover:bg-slate-100'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🇺🇸</span>
                          <div className="text-left">
                            <p className="font-bold leading-tight">English</p>
                            <p className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Auto AI translated</p>
                          </div>
                        </div>
                        {language === 'en' && <span className="text-red-500 text-sm font-black">✓</span>}
                      </button>
                    </div>

                    <div className={`mt-1 pt-1.5 px-3 py-1 border-t text-[10px] leading-tight ${
                      theme === 'light' ? 'border-slate-100 text-slate-500' : 'border-slate-800/80 text-slate-400'
                    }`}>
                      {isTranslating ? (
                        <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Traduciendo contenido con IA...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                          <span>Traducción en vivo para toda la app</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap">
                {/* Selector rápido de Rol para alternar entre Aficionado, Admin, Concesionario y Taquilla */}
                <div className={`hidden sm:flex items-center gap-1.5 py-1 px-2.5 rounded-xl border text-xs ${
                  theme === 'light'
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-[#131A29] border-slate-700/80 text-slate-400'
                }`}>
                  <span className={`text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('header.switch_view', 'Cambiar vista:')}
                  </span>
                  <select
                    value={user.role}
                    disabled={switchingRole}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className={`bg-transparent font-bold focus:outline-hidden cursor-pointer hover:text-red-500 transition-colors text-xs ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}
                    title="Alternar rol para explorar todos los módulos del negocio"
                  >
                    {user.role === 'superadmin' && (
                      <option value="superadmin" className={theme === 'light' ? 'bg-white text-amber-600' : 'bg-[#101624] text-amber-400'}>
                        {t('header.role.superadmin', 'Superadmin (Gestión Global de Sedes)')}
                      </option>
                    )}
                    <option value="aficionado" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101624] text-white'}>
                      {t('header.role.aficionado', 'Aficionado (Boletos, Tienda, Comida)')}
                    </option>
                    <option value="admin" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101624] text-white'}>
                      {t('header.role.admin', 'Administrador (Ventas, Inventario, Envíos, Personal)')}
                    </option>
                    <option value="concesionario" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101624] text-white'}>
                      {t('header.role.concesionario', 'Concesionario (Comanda en Vivo)')}
                    </option>
                    <option value="runner" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101624] text-white'}>
                      {t('header.role.runner', 'Runner (Entregas en Butaca)')}
                    </option>
                    <option value="taquilla" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101624] text-white'}>
                      {t('header.role.taquilla', 'Taquilla (Control de Accesos)')}
                    </option>
                  </select>
                </div>

                <div className={`flex items-center gap-2.5 pl-2 border-l ${
                  theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                }`}>
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-semibold text-xs overflow-hidden ${
                    theme === 'light'
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-[#131A29] border-slate-700 text-white'
                  }`}>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Avatar'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className={`w-4 h-4 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className={`text-xs font-semibold leading-tight truncate max-w-[120px] ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>
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
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-300'
                      : 'bg-[#131A29] hover:bg-red-950/80 text-slate-300 hover:text-red-400 border-slate-700/80'
                  }`}
                  title={t('header.logout', 'Cerrar Sesión')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="login-header-btn"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-md shadow-red-900/30 transition-all uppercase tracking-wider cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
              >
                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="hidden md:inline">{t('header.login', 'Iniciar Sesión')}</span>
                <span className="md:hidden">{t('header.login_short', 'Entrar')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};


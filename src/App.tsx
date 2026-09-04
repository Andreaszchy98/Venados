import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { syncUserProfile } from './lib/auth';
import { UserProfile, UserRole, VenueEvent } from './types';
import { Header } from './components/shared/Header';
import { AuthModal } from './components/shared/AuthModal';
import { AficionadoView } from './views/aficionado/AficionadoView';
import { AdminView } from './views/admin/AdminView';
import { TaquillaView } from './views/taquilla/TaquillaView';
import { ConcesionarioView } from './views/concesionario/ConcesionarioView';
import { RunnerView } from './views/runner/RunnerView';
import { SuperAdminView } from './views/superadmin/SuperAdminView';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import {
  Ticket,
  Shield,
  Layers,
  Sparkles,
  Users,
  CheckCircle2,
  Calendar,
  Boxes,
  Truck,
  Utensils,
  ShoppingBag,
  TrendingUp,
  ChefHat,
  Receipt,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_VENUE_ID, ensureDefaultVenueExists } from './lib/defaultVenue';
import { getUpcomingHeroEvents } from './lib/venueEvents';

function MainLayout() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  // Evento preseleccionado antes de iniciar sesión
  const [pendingEventId, setPendingEventId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pendingEventId');
    } catch {
      return null;
    }
  });

  // Eventos activos con póster para el fondo de bienvenida (cartelera previa al login)
  const [heroEvents, setHeroEvents] = useState<VenueEvent[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Cargar eventos con póster para el carrusel de fondo antes de iniciar sesión
  useEffect(() => {
    let isMounted = true;
    getUpcomingHeroEvents(DEFAULT_VENUE_ID, 6)
      .then((events) => {
        if (isMounted) {
          setHeroEvents(events);
        }
      })
      .catch((err) => {
        console.warn('Error al cargar eventos para el hero previo al login:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Ciclo automático de fondo: cada 4.5 segundos avanza a la siguiente imagen con fade suave
  useEffect(() => {
    if (heroEvents.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % heroEvents.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [heroEvents.length]);

  // Si el usuario autenticado tiene un rol distinto a aficionado, descartar pendingEventId
  useEffect(() => {
    if (userProfile && userProfile.role !== 'aficionado' && pendingEventId) {
      try {
        sessionStorage.removeItem('pendingEventId');
      } catch {}
      setPendingEventId(null);
    }
  }, [userProfile, pendingEventId]);

  const handleSelectHeroEvent = (eventId: string) => {
    try {
      sessionStorage.setItem('pendingEventId', eventId);
    } catch {}
    setPendingEventId(eventId);
    setIsAuthModalOpen(true);
  };

  const handleGenericLogin = () => {
    try {
      sessionStorage.removeItem('pendingEventId');
    } catch {}
    setPendingEventId(null);
    setIsAuthModalOpen(true);
  };

  const handleCloseAuthModal = (isSuccess?: boolean) => {
    if (!isSuccess) {
      try {
        sessionStorage.removeItem('pendingEventId');
      } catch {}
      setPendingEventId(null);
    }
    setIsAuthModalOpen(false);
  };

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        // Asegurar recinto con sesión activa
        ensureDefaultVenueExists();
        try {
          const profile = await syncUserProfile(currentUser);
          setUserProfile(profile);

          // Si el usuario ya tenía idioma preferido guardado en Firestore, sincronizarlo
          if (profile.language && profile.language !== language) {
            setLanguage(profile.language);
          }

          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubscribeUserDoc = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data.language && data.language !== language) {
                  setLanguage(data.language);
                }
                setUserProfile({
                  uid: currentUser.uid,
                  email: data.email || currentUser.email,
                  displayName: data.displayName || currentUser.displayName,
                  role: data.role || 'aficionado',
                  language: data.language,
                  photoURL: data.photoURL || currentUser.photoURL,
                  phoneNumber: data.phoneNumber || currentUser.phoneNumber,
                  standId: data.standId,
                  standName: data.standName,
                  assignedZone: data.assignedZone,
                  runnerStatus: data.runnerStatus,
                  venueId: data.venueId,
                  venueName: data.venueName,
                  createdAt: data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt,
                });
              }
            },
            (error) => {
              console.warn('Error en listener de perfil de usuario:', error);
            }
          );
        } catch (err) {
          console.error('Error syncing profile:', err);
        }
      } else {
        setUserProfile(null);
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = null;
        }
      }
      setLoadingAuth(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Barra de navegación superior con botón de idioma */}
      <Header
        user={userProfile}
        onOpenAuth={handleGenericLogin}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loadingAuth ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <LoadingSpinner message={t('hero.loading_session', 'Verificando sesión en Firebase...')} />
          </div>
        ) : !userProfile ? (
          /* Pantalla de Bienvenida cuando no hay sesión iniciada */
          <div className="max-w-5xl mx-auto space-y-8 py-6">
            {/* Banner Principal con Cartelera Dinámica o Hero Genérico */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950 via-red-900 to-slate-950 text-white p-8 sm:p-12 shadow-xl border border-red-800/40 text-center sm:text-left min-h-[380px] sm:min-h-[420px] flex flex-col justify-between">
              {/* Ciclo de imágenes de fondo con transición suave en CSS (opacity + transition) */}
              {heroEvents.length > 0 && (
                <div className="absolute inset-0 z-0 overflow-hidden">
                  {heroEvents.map((event, index) => {
                    const isActive = index === currentSlideIndex;
                    return (
                      <div
                        key={event.id}
                        id={`hero-poster-slide-${event.id}`}
                        onClick={() => handleSelectHeroEvent(event.id)}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out cursor-pointer ${
                          isActive ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'
                        }`}
                        title={`Clic para ver y comprar boletos para: ${event.name}`}
                      >
                        <img
                          src={event.posterUrl}
                          alt={event.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-center transform scale-100 hover:scale-105 transition-transform duration-700"
                        />
                        {/* Gradientes que aseguran alto contraste y legibilidad para el CTA y textos */}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-red-950/85 to-slate-950/70 pointer-events-none" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60 pointer-events-none" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resplandor luminoso decorativo de fondo */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none z-10" />

              {/* Contenido en primer plano (texto y CTA siempre visibles y por encima del ciclo) */}
              <div className="relative z-20 max-w-2xl space-y-4">
                {heroEvents.length > 0 && heroEvents[currentSlideIndex] ? (
                  <button
                    type="button"
                    onClick={() => handleSelectHeroEvent(heroEvents[currentSlideIndex].id)}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-red-100 transition-all cursor-pointer shadow-xs text-left"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-sm">
                      {heroEvents[currentSlideIndex].name}
                    </span>
                    <span className="text-amber-300 font-black text-[10px] uppercase bg-amber-400/20 px-1.5 py-0.5 rounded-sm shrink-0">
                      Ver Boletos
                    </span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 backdrop-blur-xs border border-white/20 text-red-100">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {t('hero.tag', 'Tu estadio, en un solo lugar')}
                  </div>
                )}

                <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight drop-shadow-sm">
                  {t('hero.title', 'Bienvenido a VXP')}
                </h1>

                <p className="text-sm sm:text-base text-red-100/90 leading-relaxed font-normal drop-shadow-xs">
                  {t(
                    'hero.subtitle',
                    'Boletos digitales, pedidos a tu asiento, tienda oficial y toda la experiencia de tu estadio, desde tu celular.'
                  )}
                </p>

                <div className="pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <button
                    id="hero-login-btn"
                    onClick={handleGenericLogin}
                    className="px-6 py-3 bg-white hover:bg-slate-100 text-red-900 font-extrabold text-sm rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    {t('hero.login_btn', 'Ingresar con Google o Correo')}
                  </button>

                  {heroEvents.length > 0 && heroEvents[currentSlideIndex] && (
                    <button
                      type="button"
                      id="hero-select-event-btn"
                      onClick={() => handleSelectHeroEvent(heroEvents[currentSlideIndex].id)}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-red-700/80 hover:bg-red-700 text-white font-bold text-sm rounded-xl border border-white/20 backdrop-blur-xs shadow-md transition-all cursor-pointer"
                    >
                      <Ticket className="w-4 h-4 text-amber-300" />
                      <span>Comprar para este evento</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Indicadores de paginación del ciclo de eventos si hay más de 1 */}
              {heroEvents.length > 1 && (
                <div className="relative z-20 mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                    En cartelera ({currentSlideIndex + 1}/{heroEvents.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {heroEvents.map((ev, idx) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlideIndex(idx);
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === currentSlideIndex
                            ? 'w-7 bg-white shadow-xs'
                            : 'w-2 bg-white/40 hover:bg-white/70'
                        }`}
                        aria-label={`Ver póster del evento ${ev.name}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tarjetas de arquitectura de Negocio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {t('features.store_food.title', 'Tienda & Alimentos')}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t(
                    'features.store_food.desc',
                    'Venta de uniformes oficiales, souvenirs y comanda Pickup Express sin filas en butaca.'
                  )}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {t('features.inventory.title', 'Gestión de Inventario')}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t(
                    'features.inventory.desc',
                    'Control de stock de tienda y almacén, ajuste de piezas, costos y alertas de stock mínimo.'
                  )}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {t('features.shipping.title', 'Logística de Envíos')}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t(
                    'features.shipping.desc',
                    'Despacho de pedidos, asignación de guías de transportistas (DHL, Estafeta) y tracking.'
                  )}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {t('features.sales.title', 'Auditoría de Ventas')}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t(
                    'features.sales.desc',
                    'Consolidación financiera y métricas de ingresos multicanal en tiempo real.'
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Vistas según el rol del usuario */
          <div>
            {userProfile.role === 'superadmin' && (
              <SuperAdminView user={userProfile} />
            )}
            {userProfile.role === 'aficionado' && (
              <AficionadoView
                user={userProfile}
                pendingEventId={pendingEventId}
                onClearPendingEvent={() => {
                  try {
                    sessionStorage.removeItem('pendingEventId');
                  } catch {}
                  setPendingEventId(null);
                }}
              />
            )}
            {userProfile.role === 'admin' && (
              <AdminView user={userProfile} />
            )}
            {userProfile.role === 'concesionario' && (
              <ConcesionarioView user={userProfile} />
            )}
            {userProfile.role === 'runner' && (
              <RunnerView user={userProfile} />
            )}
            {userProfile.role === 'taquilla' && (
              <TaquillaView user={userProfile} />
            )}
          </div>
        )}
      </main>

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuthModal}
      />

      {/* Pie de página discreto con soporte de traducción */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <p>{t('footer.copyright', 'VXP — Venue Experience Platform © 2026')}</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainLayout />
    </LanguageProvider>
  );
}


import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_VENUE_ID, ensureDefaultVenueExists } from './lib/defaultVenue';
import { DEFAULT_FALLBACK_EVENTS, getUpcomingHeroEvents } from './lib/venueEvents';

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
  const [heroEvents, setHeroEvents] = useState<VenueEvent[]>(() => {
    try {
      const cached = localStorage.getItem('vxp_cached_hero_events');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FALLBACK_EVENTS;
  });
  const [loadingHeroEvents, setLoadingHeroEvents] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('vxp_cached_hero_events');
      return !cached;
    } catch {
      return true;
    }
  });
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Cargar eventos con póster para el carrusel de fondo antes de iniciar sesión (todos los venues activos)
  useEffect(() => {
    let isMounted = true;
    getUpcomingHeroEvents(undefined, 6)
      .then((events) => {
        if (isMounted) {
          if (events && events.length > 0) {
            setHeroEvents(events);
            try {
              localStorage.setItem('vxp_cached_hero_events', JSON.stringify(events));
            } catch {}
          }
          setLoadingHeroEvents(false);
        }
      })
      .catch((err) => {
        console.warn('Error al cargar eventos para el hero previo al login:', err);
        if (isMounted) {
          setLoadingHeroEvents(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Ciclo automático de fondo y póster: exactamente cada 5 segundos avanza a la siguiente imagen con fade suave
  useEffect(() => {
    if (heroEvents.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % heroEvents.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroEvents.length, currentSlideIndex]);

  // Lista de módulos de negocio colapsados en un solo carrusel dinámico
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  const businessFeatures = useMemo(
    () => [
      {
        id: 'store_food',
        icon: ShoppingBag,
        colorBg: 'bg-red-50 text-red-700 border border-red-200/60',
        badgeColor: 'bg-red-100/80 text-red-800',
        badge: t('features.badge.store', 'Experiencia Fan & Alimentos'),
        title: t('features.store_food.title', 'Tienda & Alimentos'),
        desc: t(
          'features.store_food.desc',
          'Venta de uniformes oficiales, souvenirs y comanda Pickup Express sin filas en butaca.'
        ),
      },
      {
        id: 'inventory',
        icon: Boxes,
        colorBg: 'bg-blue-50 text-blue-700 border border-blue-200/60',
        badgeColor: 'bg-blue-100/80 text-blue-800',
        badge: t('features.badge.inventory', 'Operación & Almacén'),
        title: t('features.inventory.title', 'Gestión de Inventario'),
        desc: t(
          'features.inventory.desc',
          'Control de stock de tienda y almacén, ajuste de piezas, costos y alertas de stock mínimo.'
        ),
      },
      {
        id: 'shipping',
        icon: Truck,
        colorBg: 'bg-purple-50 text-purple-700 border border-purple-200/60',
        badgeColor: 'bg-purple-100/80 text-purple-800',
        badge: t('features.badge.shipping', 'Despacho & Rutas'),
        title: t('features.shipping.title', 'Logística de Envíos'),
        desc: t(
          'features.shipping.desc',
          'Despacho de pedidos, asignación de guías de transportistas (DHL, Estafeta) y tracking.'
        ),
      },
      {
        id: 'sales',
        icon: Receipt,
        colorBg: 'bg-amber-50 text-amber-700 border border-amber-200/60',
        badgeColor: 'bg-amber-100/80 text-amber-800',
        badge: t('features.badge.sales', 'Finanzas & Auditoría'),
        title: t('features.sales.title', 'Auditoría de Ventas'),
        desc: t(
          'features.sales.desc',
          'Consolidación financiera y métricas de ingresos multicanal en tiempo real.'
        ),
      },
    ],
    [t]
  );

  // Ciclo automático para el carrusel de módulos de negocio (cada 5 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % businessFeatures.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [businessFeatures.length, currentFeatureIndex]);

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
        {loadingAuth || (!userProfile && loadingHeroEvents && heroEvents.length === 0) ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <LoadingSpinner message={t('hero.loading_session', 'Cargando eventos y experiencia VXP...')} />
          </div>
        ) : !userProfile ? (
          /* Pantalla de Bienvenida con Cartelera Oficial e Imágenes (única pantalla de inicio) */
          <div className="max-w-5xl mx-auto space-y-8 py-6">
            {/* Banner Principal con Cartelera Dinámica */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-950 via-red-900 to-slate-950 text-white p-6 sm:p-10 lg:p-12 shadow-xl border border-red-800/40 text-center sm:text-left min-h-[400px] flex flex-col justify-between">
              {/* Fondo ambiental suave basado en el póster del evento activo */}
              {heroEvents.length > 0 && (
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                  {heroEvents.map((event, index) => {
                    const isActive = index === currentSlideIndex;
                    return (
                      <div
                        key={event.id}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <img
                          src={event.posterUrl}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover blur-3xl opacity-25 scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-red-950/60" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/40" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resplandor luminoso decorativo de fondo */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none z-10" />

              {/* Contenido en primer plano con grilla adaptable */}
              <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center py-2">
                {/* Columna izquierda: Información, textos y CTA */}
                <div className="lg:col-span-7 space-y-4 text-center sm:text-left">
                  {heroEvents[currentSlideIndex] && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectHeroEvent(heroEvents[currentSlideIndex].id)}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-red-100 transition-all cursor-pointer shadow-xs text-left"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-xs">
                          {heroEvents[currentSlideIndex].name}
                        </span>
                        <span className="text-amber-300 font-black text-[10px] uppercase bg-amber-400/20 px-1.5 py-0.5 rounded-sm shrink-0">
                          Ver Boletos
                        </span>
                      </button>
                      <span className="text-xs font-semibold text-amber-300/90 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
                        📅 {heroEvents[currentSlideIndex].date}
                      </span>
                    </div>
                  )}

                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight drop-shadow-sm">
                    {t('hero.title', 'Bienvenido a VXP')}
                  </h1>

                  <p className="text-sm sm:text-base text-red-100/90 leading-relaxed font-normal max-w-xl">
                    {t(
                      'hero.subtitle',
                      'Boletos digitales, pedidos a tu asiento, tienda oficial y toda la experiencia de tu estadio, desde tu celular.'
                    )}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <button
                      id="hero-login-btn"
                      onClick={handleGenericLogin}
                      className="px-6 py-3 bg-white hover:bg-slate-100 text-red-900 font-extrabold text-sm rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      {t('hero.login_btn', 'Ingresar con Google o Correo')}
                    </button>

                    {heroEvents[currentSlideIndex] && (
                      <button
                        type="button"
                        id="hero-select-event-btn"
                        onClick={() => handleSelectHeroEvent(heroEvents[currentSlideIndex].id)}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-red-700/90 hover:bg-red-700 text-white font-bold text-sm rounded-xl border border-white/20 backdrop-blur-xs shadow-md transition-all cursor-pointer"
                      >
                        <Ticket className="w-4 h-4 text-amber-300" />
                        <span>Comprar para este evento</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Columna derecha: Tarjeta del Póster Oficial Completo con Transición Suave (Crossfade) */}
                {heroEvents.length > 0 && (
                  <div className="lg:col-span-5 flex justify-center w-full">
                    <div
                      id="hero-featured-poster-card"
                      className="relative group w-full max-w-md rounded-2xl overflow-hidden border border-white/20 bg-slate-950/80 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-amber-400/60 p-2 backdrop-blur-md"
                    >
                      {/* Contenedor adaptativo: Aspecto 16/9 o 16/10 con crossfade suave de 1000ms */}
                      <div className="relative w-full aspect-16/9 sm:aspect-16/10 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                        {heroEvents.map((event, idx) => {
                          const isActive = idx === currentSlideIndex;
                          return (
                            <div
                              key={event.id}
                              onClick={() => handleSelectHeroEvent(event.id)}
                              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex items-center justify-center cursor-pointer ${
                                isActive
                                  ? 'opacity-100 z-10 pointer-events-auto'
                                  : 'opacity-0 z-0 pointer-events-none'
                              }`}
                              title={`Clic para ver y comprar boletos: ${event.name}`}
                            >
                              {/* Fondo difuminado a juego para rellenar bordes si el formato varía */}
                              <img
                                src={event.posterUrl}
                                alt=""
                                aria-hidden="true"
                                className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                                referrerPolicy="no-referrer"
                              />
                              {/* Imagen principal: object-contain para mostrarla 100% completa sin recortar */}
                              <img
                                src={event.posterUrl}
                                alt={event.name}
                                className="relative z-10 max-h-full max-w-full object-contain rounded-lg drop-shadow-xl"
                                referrerPolicy="no-referrer"
                              />
                              {/* Overlay al pasar el mouse */}
                              <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300 bg-red-700/95 px-3 py-1.5 rounded-lg w-fit shadow-md">
                                  <Ticket className="w-3.5 h-3.5 text-amber-300" />
                                  Comprar boletos para este evento
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Flechas de cambio rápido entre imágenes */}
                        {heroEvents.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentSlideIndex((prev) => (prev - 1 + heroEvents.length) % heroEvents.length);
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/65 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                              aria-label="Imagen anterior"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentSlideIndex((prev) => (prev + 1) % heroEvents.length);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/65 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                              aria-label="Siguiente imagen"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Pie de foto de la tarjeta con nombre y fecha con cambio suave */}
                      <div className="mt-2 px-2 py-0.5 relative h-6 overflow-hidden">
                        {heroEvents.map((event, idx) => {
                          const isActive = idx === currentSlideIndex;
                          return (
                            <div
                              key={event.id}
                              className={`absolute inset-0 flex items-center justify-between gap-2 text-xs transition-opacity duration-700 ease-in-out ${
                                isActive ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
                              }`}
                            >
                              <span className="font-bold text-white truncate max-w-[220px]">
                                {event.name}
                              </span>
                              <span className="text-amber-300 font-extrabold text-[11px] shrink-0 bg-amber-400/20 px-2 py-0.5 rounded-sm">
                                {event.date}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Indicadores de paginación del ciclo de eventos si hay más de 1 */}
              {heroEvents.length > 1 && (
                <div className="relative z-20 mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                      En cartelera ({currentSlideIndex + 1}/{heroEvents.length})
                    </span>
                    <span className="text-[10px] text-amber-300/80 font-medium hidden sm:inline">
                      • Cambia cada 5s
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {heroEvents.map((ev, idx) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlideIndex(idx);
                        }}
                        className={`h-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                          idx === currentSlideIndex
                            ? 'w-8 bg-amber-400 shadow-xs'
                            : 'w-2.5 bg-white/40 hover:bg-white/75'
                        }`}
                        aria-label={`Ver póster del evento ${ev.name}`}
                        title={`Ver ${ev.name}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Carrusel unificado colapsado de Módulos del Negocio (avanza cada 5s) */}
            <div
              id="business-features-carousel"
              className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 overflow-hidden transition-all"
            >
              {/* Contenedor del contenido con transición suave */}
              <div className="relative min-h-[96px] sm:min-h-[80px]">
                {businessFeatures.map((feat, idx) => {
                  const Icon = feat.icon;
                  const isActive = idx === currentFeatureIndex;
                  return (
                    <div
                      key={feat.id}
                      className={`transition-all duration-700 ease-in-out ${
                        isActive
                          ? 'opacity-100 translate-y-0 relative z-10 pointer-events-auto'
                          : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none z-0'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 sm:gap-4">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${feat.colorBg}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 space-y-1 pr-16 sm:pr-20">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${feat.badgeColor}`}
                            >
                              {feat.badge}
                            </span>
                            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                              {feat.title}
                            </h3>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Botones de navegación Anterior / Siguiente en la esquina superior derecha */}
                <div className="absolute top-0 right-0 z-20 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFeatureIndex(
                        (prev) => (prev - 1 + businessFeatures.length) % businessFeatures.length
                      )
                    }
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
                    aria-label="Módulo anterior"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFeatureIndex((prev) => (prev + 1) % businessFeatures.length)
                    }
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
                    aria-label="Siguiente módulo"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Barra inferior: Indicadores de posición y tiempo */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Módulos de la Plataforma ({currentFeatureIndex + 1}/{businessFeatures.length})
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">• Cambia cada 5s</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {businessFeatures.map((feat, idx) => (
                    <button
                      key={feat.id}
                      type="button"
                      onClick={() => setCurrentFeatureIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-500 cursor-pointer ${
                        idx === currentFeatureIndex
                          ? 'w-7 bg-red-600 shadow-xs'
                          : 'w-2 bg-slate-200 hover:bg-slate-300'
                      }`}
                      aria-label={`Ver módulo ${feat.title}`}
                      title={feat.title}
                    />
                  ))}
                </div>
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


import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { syncUserProfile } from './lib/auth';
import { UserProfile, UserRole, VenueEvent, HeroSlide, Venue } from './types';
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
  Store,
  Building2,
  MapPin,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_VENUE_ID, ensureDefaultVenueExists } from './lib/defaultVenue';
import { DEFAULT_FALLBACK_EVENTS, getHeroSlides } from './lib/venueEvents';
import { DEFAULT_STORE_PROMO_BANNER } from './lib/imageUtils';

function MainLayout() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  // Evento o pestaña preseleccionada antes de iniciar sesión
  const [pendingEventId, setPendingEventId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pendingEventId');
    } catch {
      return null;
    }
  });

  const [pendingView, setPendingView] = useState<'tienda' | 'boletos' | null>(() => {
    try {
      return (sessionStorage.getItem('pendingView') as any) || null;
    } catch {
      return null;
    }
  });

  // Diapositivas unificadas del Hero (eventos estelares y póster promocional de tienda oficial)
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() => {
    try {
      const cached = localStorage.getItem('vxp_cached_hero_slides');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'default-event-1',
        slideType: 'event',
        title: 'Temporada Regular Venados 2026',
        subtitle: 'vs Tomateros de Culiacán',
        venueId: DEFAULT_VENUE_ID,
        venueName: 'Estadio Teodoro Mariscal',
        imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
        dateBadge: '2026-10-15',
        badgeLabel: '🎟️ EVENTO DESTACADO',
        targetAction: 'ticket',
        eventId: 'default-event-1',
      },
      {
        id: `store-promo-${DEFAULT_VENUE_ID}`,
        slideType: 'store_promo',
        title: 'Tienda Oficial Venados Store',
        subtitle: 'Jerseys oficiales, gorras y souvenirs con entrega en tu butaca o envío a domicilio.',
        venueId: DEFAULT_VENUE_ID,
        venueName: 'Estadio Teodoro Mariscal',
        imageUrl: DEFAULT_STORE_PROMO_BANNER,
        dateBadge: 'TIENDA OFICIAL',
        badgeLabel: '🛍️ TIENDA OFICIAL',
        targetAction: 'store',
      },
    ];
  });
  const [loadingHeroEvents, setLoadingHeroEvents] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('vxp_cached_hero_slides');
      return !cached;
    } catch {
      return true;
    }
  });
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Ciudad seleccionada para la cartelera pública (por el momento solo Mazatlán)
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    try {
      return localStorage.getItem('vxp_selected_city') || 'Mazatlán';
    } catch {
      return 'Mazatlán';
    }
  });

  const handleSelectCity = (city: string) => {
    setSelectedCity(city);
    try {
      if (city) {
        localStorage.setItem('vxp_selected_city', city);
      } else {
        localStorage.removeItem('vxp_selected_city');
      }
    } catch {}
  };

  // Cargar slides (eventos y banners promocionales de tienda oficial) filtrados por ciudad para el hero
  useEffect(() => {
    let isMounted = true;
    setLoadingHeroEvents(true);
    getHeroSlides(undefined, 8, selectedCity)
      .then((slides) => {
        if (isMounted) {
          if (slides && slides.length > 0) {
            setHeroSlides(slides);
            setCurrentSlideIndex(0);
            try {
              localStorage.setItem('vxp_cached_hero_slides', JSON.stringify(slides));
            } catch {}
          }
          setLoadingHeroEvents(false);
        }
      })
      .catch((err) => {
        console.warn('Error al cargar slides para el hero:', err);
        if (isMounted) {
          setLoadingHeroEvents(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCity]);

  // Ciclo automático de fondo y póster: exactamente cada 5 segundos avanza a la siguiente imagen con fade suave
  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroSlides.length, currentSlideIndex]);

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

  // Si el usuario autenticado tiene un rol distinto a aficionado, descartar pendingEventId y pendingView
  useEffect(() => {
    if (userProfile && userProfile.role !== 'aficionado') {
      if (pendingEventId) {
        try {
          sessionStorage.removeItem('pendingEventId');
        } catch {}
        setPendingEventId(null);
      }
      if (pendingView) {
        try {
          sessionStorage.removeItem('pendingView');
        } catch {}
        setPendingView(null);
      }
    }
  }, [userProfile, pendingEventId, pendingView]);

  const handleSelectHeroSlide = (slide: HeroSlide) => {
    if (slide.targetAction === 'ticket' && slide.eventId) {
      try {
        sessionStorage.setItem('pendingEventId', slide.eventId);
        sessionStorage.removeItem('pendingView');
      } catch {}
      setPendingEventId(slide.eventId);
      setPendingView(null);
    } else if (slide.targetAction === 'store') {
      try {
        sessionStorage.setItem('pendingView', 'tienda');
        sessionStorage.removeItem('pendingEventId');
      } catch {}
      setPendingView('tienda');
      setPendingEventId(null);
    }
    setIsAuthModalOpen(true);
  };

  const handleSelectHeroEvent = (eventId: string) => {
    try {
      sessionStorage.setItem('pendingEventId', eventId);
      sessionStorage.removeItem('pendingView');
    } catch {}
    setPendingEventId(eventId);
    setPendingView(null);
    setIsAuthModalOpen(true);
  };

  const handleGenericLogin = () => {
    try {
      sessionStorage.removeItem('pendingEventId');
      sessionStorage.removeItem('pendingView');
    } catch {}
    setPendingEventId(null);
    setPendingView(null);
    setIsAuthModalOpen(true);
  };

  const handleCloseAuthModal = (isSuccess?: boolean) => {
    if (!isSuccess) {
      try {
        sessionStorage.removeItem('pendingEventId');
        sessionStorage.removeItem('pendingView');
      } catch {}
      setPendingEventId(null);
      setPendingView(null);
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {loadingAuth || (!userProfile && loadingHeroEvents && heroSlides.length === 0) ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <LoadingSpinner message={t('hero.loading_session', 'Cargando eventos y experiencia VXP...')} />
          </div>
        ) : !userProfile ? (
          /* Pantalla de Bienvenida con Cartelera Oficial e Imágenes (única pantalla de inicio) */
          <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 py-2 sm:py-6">
            {/* Barra de Selección de Ciudad */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center shrink-0 border border-red-100">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    Seleccionar Ciudad
                    <span className="text-[10px] font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full">
                      {selectedCity}
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Mostrando únicamente la cartelera oficial y eventos de {selectedCity}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto min-w-[240px]">
                  <select
                    id="public-landing-city-select"
                    value={selectedCity}
                    onChange={(e) => handleSelectCity(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600 appearance-none cursor-pointer"
                  >
                    <option value="Mazatlán">Mazatlán, Sinaloa</option>
                  </select>
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                </div>
              </div>
            </div>

            {/* Banner Principal con Cartelera Dinámica ajustada a todo lo ancho del recuadro color tinto */}
            <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-red-950 via-red-900 to-slate-950 text-white p-4 sm:p-6 lg:p-7 shadow-xl border border-red-800/40 flex flex-col justify-between space-y-4 sm:space-y-5">
              {/* Fondo ambiental suave basado en el póster/banner activo */}
              {heroSlides.length > 0 && (
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                  {heroSlides.map((slide, index) => {
                    const isActive = index === currentSlideIndex;
                    return (
                      <div
                        key={slide.id}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <img
                          src={slide.imageUrl}
                          alt=""
                          aria-hidden="true"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover blur-3xl opacity-20 scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-red-950/90 via-slate-950/80 to-red-950/60" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resplandor luminoso decorativo de fondo */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none z-10" />

              {/* Encabezado superior dentro del recuadro tinto */}
              <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                      Cartelera Oficial
                    </span>
                    <span className="text-xs text-red-200 font-semibold">
                      Mazatlán • Estadio Teodoro Mariscal
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight drop-shadow-sm text-white">
                    {t('hero.title', 'Bienvenido a VXP')}
                  </h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="hero-login-btn"
                    onClick={handleGenericLogin}
                    className="w-full sm:w-auto text-center px-5 py-2.5 bg-white hover:bg-slate-100 text-red-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
                  >
                    {t('hero.login_btn', 'Ingresar con Google o Correo')}
                  </button>
                </div>
              </div>

              {/* CARTELERA DE EVENTOS A TODO LO ANCHO DEL RECUADRO COLOR TINTO */}
              {heroSlides.length > 0 && (
                <div className="relative z-20 w-full">
                  <div
                    id="hero-featured-poster-card"
                    className="relative group w-full rounded-2xl overflow-hidden border border-white/20 bg-slate-950/90 shadow-2xl transition-all duration-300 hover:border-amber-400/60 backdrop-blur-md"
                  >
                    {/* Contenedor adaptativo panorámico que llena el 100% del ancho del recuadro */}
                    <div className="relative w-full aspect-16/9 sm:aspect-21/9 md:aspect-[2.4/1] min-h-[220px] sm:min-h-[280px] md:min-h-[340px] max-h-[460px] overflow-hidden bg-slate-950 flex items-center justify-center">
                      {heroSlides.map((slide, idx) => {
                        const isActive = idx === currentSlideIndex;
                        const isStore = slide.slideType === 'store_promo';
                        return (
                          <div
                            key={slide.id}
                            onClick={() => handleSelectHeroSlide(slide)}
                            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex items-center justify-center cursor-pointer ${
                              isActive
                                ? 'opacity-100 z-10 pointer-events-auto'
                                : 'opacity-0 z-0 pointer-events-none'
                            }`}
                            title={isStore ? `Clic para ver Tienda Oficial: ${slide.title}` : `Clic para ver y comprar boletos: ${slide.title}`}
                          >
                            {/* Fondo difuminado para rellenar marcos si el formato varía */}
                            <img
                              src={slide.imageUrl}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 w-full h-full object-cover blur-lg opacity-40 scale-105 pointer-events-none"
                              referrerPolicy="no-referrer"
                            />
                            {/* Imagen principal: se ajusta a lo ancho al 100% */}
                            <img
                              src={slide.imageUrl}
                              alt={slide.title}
                              className="relative z-10 w-full h-full object-cover md:object-contain drop-shadow-2xl"
                              referrerPolicy="no-referrer"
                            />

                            {/* Badge superior distintivo */}
                            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-md flex items-center gap-1.5 ${
                                isStore
                                  ? 'bg-amber-400 text-slate-950 font-black'
                                  : 'bg-red-700 text-white'
                              }`}>
                                {isStore ? (
                                  <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                                ) : (
                                  <Ticket className="w-3.5 h-3.5 text-white" />
                                )}
                                {isStore ? 'Tienda Oficial' : 'Cartelera Mazatlán'}
                              </span>

                              {slide.venueName && (
                                <span className="text-[10px] sm:text-xs font-bold text-white bg-black/60 border border-white/20 px-2.5 py-1 rounded-lg shadow-md backdrop-blur-md hidden xs:inline-flex items-center gap-1">
                                  🏟️ {slide.venueName}
                                </span>
                              )}

                              <span className="text-[10px] sm:text-xs font-bold text-amber-300 bg-black/70 border border-amber-400/30 px-2.5 py-1 rounded-lg shadow-md backdrop-blur-md">
                                {isStore ? '🛍️ OFICIAL & ENVÍOS' : `📅 ${slide.dateBadge}`}
                              </span>
                            </div>

                            {/* Franja de información inferior a lo ancho del cartel con llamada a la acción */}
                            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-12 pb-3.5 sm:pb-4 px-3.5 sm:px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
                              <div className="space-y-0.5 max-w-2xl">
                                <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                                  {slide.title}
                                </h2>
                                {slide.subtitle && (
                                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-1 sm:line-clamp-2 drop-shadow-xs">
                                    {slide.subtitle}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectHeroSlide(slide);
                                }}
                                className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap ${
                                  isStore
                                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                                    : 'bg-red-600 hover:bg-red-500 text-white'
                                }`}
                              >
                                {isStore ? (
                                  <>
                                    <ShoppingBag className="w-4 h-4 text-slate-950" />
                                    <span>Explorar Tienda Oficial</span>
                                  </>
                                ) : (
                                  <>
                                    <Ticket className="w-4 h-4 text-white" />
                                    <span>Comprar Boletos</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Flechas de navegación para recorrer la cartelera */}
                      {heroSlides.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentSlideIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
                            }}
                            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center border border-white/25 backdrop-blur-md transition-all transform hover:scale-110 cursor-pointer shadow-lg"
                            aria-label="Evento anterior"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentSlideIndex((prev) => (prev + 1) % heroSlides.length);
                            }}
                            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center border border-white/25 backdrop-blur-md transition-all transform hover:scale-110 cursor-pointer shadow-lg"
                            aria-label="Siguiente evento"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Indicadores de paginación del ciclo de cartelera y tienda */}
              {heroSlides.length > 1 && (
                <div className="relative z-20 pt-2 sm:pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider">
                      Cartelera Mazatlán ({currentSlideIndex + 1}/{heroSlides.length})
                    </span>
                    <span className="text-[10px] text-amber-300 font-medium hidden sm:inline">
                      • Cambia cada 5s
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {heroSlides.map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlideIndex(idx);
                        }}
                        className={`h-2 sm:h-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                          idx === currentSlideIndex
                            ? 'w-6 sm:w-8 bg-amber-400 shadow-xs'
                            : 'w-2 sm:w-2.5 bg-white/40 hover:bg-white/75'
                        }`}
                        aria-label={`Ver ${slide.title}`}
                        title={slide.title}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Carrusel unificado colapsado de Módulos del Negocio (avanza cada 5s) */}
            <div
              id="business-features-carousel"
              className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 lg:p-6 overflow-hidden transition-all"
            >
              {/* Contenedor del contenido con transición suave y altura adaptable */}
              <div className="relative min-h-[105px] xs:min-h-[92px] sm:min-h-[80px]">
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
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${feat.colorBg}`}
                        >
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="flex-1 space-y-1 pr-14 sm:pr-20">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span
                              className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${feat.badgeColor}`}
                            >
                              {feat.badge}
                            </span>
                            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm md:text-base">
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
                <div className="absolute top-0 right-0 z-20 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFeatureIndex(
                        (prev) => (prev - 1 + businessFeatures.length) % businessFeatures.length
                      )
                    }
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
                    aria-label="Módulo anterior"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentFeatureIndex((prev) => (prev + 1) % businessFeatures.length)
                    }
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-slate-200/80"
                    aria-label="Siguiente módulo"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              {/* Barra inferior: Indicadores de posición y tiempo */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Módulos de la Plataforma ({currentFeatureIndex + 1}/{businessFeatures.length})
                  </span>
                  <span className="text-[10px] text-slate-400 hidden xs:inline">• Cambia cada 5s</span>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5">
                  {businessFeatures.map((feat, idx) => (
                    <button
                      key={feat.id}
                      type="button"
                      onClick={() => setCurrentFeatureIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-500 cursor-pointer ${
                        idx === currentFeatureIndex
                          ? 'w-6 sm:w-7 bg-red-600 shadow-xs'
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
                initialTab={pendingView === 'tienda' ? 'tienda' : undefined}
                onClearPendingEvent={() => {
                  try {
                    sessionStorage.removeItem('pendingEventId');
                    sessionStorage.removeItem('pendingView');
                  } catch {}
                  setPendingEventId(null);
                  setPendingView(null);
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


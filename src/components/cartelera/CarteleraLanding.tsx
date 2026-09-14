import React, { useState, useEffect, useMemo } from 'react';
import { VenueEvent, Venue, EventType } from '../../types';
import { DEFAULT_VENUES, DEFAULT_VENUE_ID, DEFAULT_FALLBACK_EVENT } from '../../lib/defaultVenue';
import { subscribeVenues } from '../../lib/venues';
import { DEFAULT_FALLBACK_EVENTS } from '../../lib/venueEvents';
import { normalizeGoogleDriveImageUrl, getEventPosterPlaceholder } from '../../lib/imageUtils';
import { collection, query, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTheme } from '../../context/ThemeContext';
import {
  MapPin,
  Calendar,
  Clock,
  Ticket,
  ShoppingBag,
  Utensils,
  ChevronRight,
  ChevronDown,
  Info,
  X,
  Sparkles,
  Film,
  LogIn,
  Layers,
  Maximize2,
  Check,
} from 'lucide-react';

interface CarteleraLandingProps {
  onSelectEvent: (eventId: string) => void;
  onOpenAuth: (context?: 'login' | 'boletos' | 'tienda' | 'comida') => void;
  onSelectStore?: (type: 'tienda' | 'comida') => void;
  onSelectTab?: (tab: 'cartelera' | 'boletos' | 'tienda' | 'comida') => void;
  showBottomNav?: boolean;
}

export const CarteleraLanding: React.FC<CarteleraLandingProps> = ({
  onSelectEvent,
  onOpenAuth,
  onSelectStore,
  onSelectTab,
  showBottomNav = true,
}) => {
  const { theme } = useTheme();
  // Sedes disponibles
  const [venues, setVenues] = useState<Venue[]>(DEFAULT_VENUES);

  // 1. Selector de Ciudad (restaurado como estaba originalmente)
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    try {
      return localStorage.getItem('vxp_selected_city') || 'Mazatlán';
    } catch {
      return 'Mazatlán';
    }
  });

  // Selector de Sede/Estadio puntual ('todos' o venueId específico)
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => {
    try {
      return localStorage.getItem('vxp_selected_venue_id') || 'todos';
    } catch {
      return 'todos';
    }
  });

  // Control de apertura del menú desplegable unificado de ciudad y recinto
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Eventos de cartelera
  const [allEvents, setAllEvents] = useState<VenueEvent[]>(DEFAULT_FALLBACK_EVENTS);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Filtro por categoría deportiva o espectáculo
  const [selectedCategory, setSelectedCategory] = useState<'todos' | 'baseball' | 'football' | 'concert' | 'other'>('todos');

  // Modal de sinopsis / detalles del evento
  const [synopsisEvent, setSynopsisEvent] = useState<VenueEvent | null>(null);

  // Visor de imagen promocional completa a pantalla completa (lightbox)
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Fecha actual formateada para el recuadro de fecha
  const todayFormatted = useMemo(() => {
    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      };
      return new Intl.DateTimeFormat('es-MX', options).format(now);
    } catch {
      return 'Hoy';
    }
  }, []);

  // Escuchar sedes en tiempo real
  useEffect(() => {
    const unsubscribe = subscribeVenues((loadedVenues) => {
      if (loadedVenues && loadedVenues.length > 0) {
        setVenues(loadedVenues);
      }
    });
    return () => unsubscribe();
  }, []);

  // Lista única de ciudades disponibles calculadas a partir de las sedes
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    venues.forEach((v) => {
      if (v.city && v.city.trim().length > 0) {
        citySet.add(v.city.trim());
      }
    });
    if (citySet.size === 0) {
      citySet.add('Mazatlán');
    }
    return Array.from(citySet);
  }, [venues]);

  // Recintos pertenecientes a la ciudad seleccionada
  const venuesInCity = useMemo(() => {
    if (selectedCity === 'todas') return venues;
    return venues.filter((v) => (v.city || 'Mazatlán').toLowerCase() === selectedCity.toLowerCase());
  }, [venues, selectedCity]);

  // Manejar cambio de ciudad
  const handleCityChange = (newCity: string) => {
    setSelectedCity(newCity);
    try {
      localStorage.setItem('vxp_selected_city', newCity);
    } catch {}

    // Si la sede actual no pertenece a la nueva ciudad, reiniciar a 'todos'
    if (newCity !== 'todas') {
      const match = venues.filter((v) => (v.city || 'Mazatlán').toLowerCase() === newCity.toLowerCase());
      if (selectedVenueId !== 'todos' && !match.some((v) => v.id === selectedVenueId)) {
        setSelectedVenueId('todos');
        try {
          localStorage.setItem('vxp_selected_venue_id', 'todos');
        } catch {}
      }
    }
  };

  // Manejar cambio de sede dentro de la ciudad
  const handleSwitchVenue = (venueId: string) => {
    setSelectedVenueId(venueId);
    try {
      localStorage.setItem('vxp_selected_venue_id', venueId);
    } catch {}
  };

  // Resumen compacto de ubicación (Ciudad · Recinto) para el selector combinado
  const locationSummaryLabel = useMemo(() => {
    const cityName = selectedCity === 'todas' ? 'Todas las ciudades' : selectedCity;
    const venueObj = venues.find((v) => v.id === selectedVenueId);
    const venueName =
      selectedVenueId === 'todos' ? 'Todos los recintos' : venueObj?.name || 'Recinto';
    return `${cityName} · ${venueName}`;
  }, [selectedCity, selectedVenueId, venues]);

  // Escuchar todos los eventos activos en tiempo real
  useEffect(() => {
    setLoadingEvents(true);
    const q = query(collection(db, 'venueEvents'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docs = snapshot.docs.map((d) => {
            const data = d.data();
            const rawPoster = typeof data.posterUrl === 'string' ? data.posterUrl.trim() : '';
            return {
              id: d.id,
              ...data,
              posterUrl: normalizeGoogleDriveImageUrl(rawPoster) || getEventPosterPlaceholder(data.type || 'baseball'),
            } as VenueEvent;
          });
          setAllEvents(docs);
        } else {
          setAllEvents(DEFAULT_FALLBACK_EVENTS);
        }
        setLoadingEvents(false);
      },
      (err) => {
        console.warn('Error al escuchar eventos de cartelera:', err);
        setAllEvents(DEFAULT_FALLBACK_EVENTS);
        setLoadingEvents(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Eventos filtrados por Ciudad, Sede y Categoría
  const filteredEvents = useMemo(() => {
    // 1. Filtrar por activos
    let list = allEvents.filter((e) => e.active !== false && e.ticketsAvailable !== false);

    // Mapear venues para lookup rápido de ciudad y nombre
    const venueMap = new Map<string, Venue>();
    venues.forEach((v) => venueMap.set(v.id, v));

    // 2. Filtrar por ciudad si no es 'todas'
    if (selectedCity !== 'todas') {
      list = list.filter((e) => {
        const v = venueMap.get(e.venueId);
        const city = v?.city || (e.venueId === DEFAULT_VENUE_ID ? 'Mazatlán' : '');
        return city.toLowerCase() === selectedCity.toLowerCase();
      });
    }

    // 3. Filtrar por sede puntual si no es 'todos'
    if (selectedVenueId !== 'todos') {
      list = list.filter((e) => e.venueId === selectedVenueId);
    }

    // 4. Filtrar por categoría
    if (selectedCategory !== 'todos') {
      list = list.filter((e) => e.type === selectedCategory);
    }

    // Ordenar cronológicamente
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [allEvents, venues, selectedCity, selectedVenueId, selectedCategory]);

  // Generar descripción / sinopsis atractiva
  const getEventSynopsis = (ev: VenueEvent) => {
    const v = venues.find((item) => item.id === ev.venueId);
    const venueName = ev.venueName || v?.name || 'el recinto';
    if (ev.type === 'baseball') {
      return `Gran encuentro de la Liga Mexicana del Pacífico en ${venueName}. Vive toda la pasión del rey de los deportes con la novena de casa enfrentando a ${ev.opponent || 'su acérrimo rival'} en una jornada llena de adrenalina, música en vivo, gastronomía y fiesta en las gradas.`;
    }
    if (ev.type === 'football') {
      return `Emocionante partido de fútbol en ${venueName}. El equipo sale a defender la cancha con toda la garra frente a ${ev.opponent || 'un gran rival'}. Disfruta la experiencia al máximo nivel en compañía de toda tu afición.`;
    }
    if (ev.type === 'concert') {
      return `Una velada musical inolvidable en ${venueName} con producción de primer nivel, sonido de alta fidelidad y los mayores éxitos en vivo.`;
    }
    return `Espectáculo de primer nivel para toda la familia en ${venueName}. Garantiza tus lugares con anticipación y vive momentos inolvidables.`;
  };

  // Clasificación de evento
  const getEventRatingBadge = (type: EventType) => {
    switch (type) {
      case 'baseball':
      case 'football':
        return { label: 'A', bg: 'bg-emerald-700', text: 'Todo Público' };
      case 'concert':
        return { label: 'B', bg: 'bg-amber-600', text: 'Familiar' };
      default:
        return { label: 'A', bg: 'bg-emerald-700', text: 'Todo Público' };
    }
  };

  // Precio mínimo inicial
  const getMinPrice = (ev: VenueEvent) => {
    if (ev.priceTiers && ev.priceTiers.length > 0) {
      const prices = ev.priceTiers.map((t) => t.price);
      return Math.min(...prices);
    }
    return 150;
  };

  return (
    <div className={`min-h-screen px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 transition-colors ${
      theme === 'light' ? 'bg-[#F4F6F9] text-slate-900' : 'bg-[#0A0E17] text-slate-100'
    }`}>
      {/* 1. SELECTOR COMBINADO DE CIUDAD Y SEDE EN UNA SOLA FILA */}
      <div className="max-w-6xl mx-auto mb-3">
        <div
          id="barra-seleccion-ciudad"
          className={`flex items-center justify-between gap-2 sm:gap-4 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border transition-colors ${
            theme === 'light'
              ? 'bg-white border-slate-200 shadow-xs'
              : 'bg-[#101625] border-slate-800 shadow-sm'
          }`}
        >
          {/* Selector Combinado Desplegable: Ciudad · Sede */}
          <div className="relative min-w-0 flex-1 sm:flex-initial">
            <button
              id="combined-location-selector-btn"
              type="button"
              onClick={() => setIsLocationOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-98 max-w-full ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'
                  : 'bg-[#182032] hover:bg-[#202B42] border-slate-700 text-slate-100'
              }`}
              title="Filtrar por ciudad y recinto"
              aria-expanded={isLocationOpen}
              aria-haspopup="listbox"
            >
              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="truncate max-w-[130px] min-[390px]:max-w-[175px] sm:max-w-xs">
                {locationSummaryLabel}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                  isLocationOpen ? 'rotate-180 text-red-500' : theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
            </button>

            {/* Menú Desplegable con Ciudad y Sedes */}
            {isLocationOpen && (
              <>
                {/* Backdrop para cerrar al hacer clic afuera */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsLocationOpen(false)}
                />
                <div
                  role="listbox"
                  className={`absolute left-0 top-full mt-2 w-72 sm:w-84 max-w-[calc(100vw-36px)] rounded-2xl border z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 shadow-xl text-slate-900'
                      : 'bg-[#101625] border-slate-700 shadow-2xl text-slate-100'
                  }`}
                >
                  {/* Selector rápido de Ciudad */}
                  <div>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1 block mb-1.5 ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      1. Selecciona Ciudad
                    </span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => handleCityChange('todas')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          selectedCity === 'todas'
                            ? 'bg-red-600 text-white shadow-xs'
                            : theme === 'light'
                            ? 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                            : 'bg-[#182032] text-slate-300 hover:text-white border border-slate-700'
                        }`}
                      >
                        Todas
                      </button>
                      {availableCities.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleCityChange(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            selectedCity.toLowerCase() === c.toLowerCase()
                              ? 'bg-red-600 text-white shadow-xs'
                              : theme === 'light'
                              ? 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200'
                              : 'bg-[#182032] text-slate-300 hover:text-white border border-slate-700'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recintos de la Ciudad seleccionada */}
                  <div className={`border-t pt-2 ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1 block mb-1.5 ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      2. Selecciona Recinto ({selectedCity === 'todas' ? 'Todos' : selectedCity})
                    </span>
                    <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          handleSwitchVenue('todos');
                          setIsLocationOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          selectedVenueId === 'todos'
                            ? theme === 'light'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-red-600/20 text-red-300 border border-red-500/50'
                            : theme === 'light'
                            ? 'hover:bg-slate-100 text-slate-700'
                            : 'hover:bg-[#182032] text-slate-300'
                        }`}
                      >
                        <span>Todos los recintos</span>
                        {selectedVenueId === 'todos' && <Check className="w-3.5 h-3.5 text-red-500" />}
                      </button>

                      {venuesInCity.map((v) => {
                        const isSel = selectedVenueId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              handleSwitchVenue(v.id);
                              setIsLocationOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSel
                                ? theme === 'light'
                                  ? 'bg-red-50 text-red-700 border border-red-200 font-bold'
                                  : 'bg-red-600/20 text-red-300 border border-red-500/50 font-bold'
                                : theme === 'light'
                                ? 'hover:bg-slate-100 text-slate-700'
                                : 'hover:bg-[#182032] text-slate-300'
                            }`}
                          >
                            <span className="truncate">{v.name}</span>
                            {isSel && <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Información de eventos (alineado y sin desfase) */}
          <div className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl border text-xs ${
            theme === 'light'
              ? 'bg-slate-100 border-slate-200 text-slate-800'
              : 'bg-[#0A0E17]/60 border-slate-800/80 text-white'
          }`}>
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className={`font-extrabold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {filteredEvents.length}
            </span>
            <span className={`font-medium whitespace-nowrap ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
              {filteredEvents.length === 1 ? 'evento' : 'eventos'}
            </span>
            <span className={`text-[11px] hidden sm:inline ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>en cartelera</span>
          </div>
        </div>
      </div>

      {/* 2. FILA DE FILTRO DE DEPORTE COMPACTO CON FECHA INTEGRADA */}
      <div className="max-w-6xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-2.5">
        {/* Fecha y subtítulo ligeros integrados sin fondo pesado */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-extrabold capitalize flex items-center gap-1.5 ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}>
            <Calendar className="w-3.5 h-3.5 text-red-500" />
            {todayFormatted}
          </span>
          <span className={theme === 'light' ? 'text-slate-300' : 'text-slate-600'}>•</span>
          <span className={`text-[11px] font-black uppercase tracking-wider ${
            theme === 'light' ? 'text-amber-800' : 'text-amber-400/90'
          }`}>
            Cartelera Deportiva
          </span>
        </div>

        {/* Chips de filtro deportivo compactos (menor padding y altura) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'baseball', label: '⚾ Béisbol' },
            { id: 'football', label: '⚽ Fútbol' },
            { id: 'concert', label: '🎤 Conciertos' },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-xs'
                    : theme === 'light'
                    ? 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-xs'
                    : 'bg-[#101625] text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CARTELERA EN REJILLA VERTICAL DE PÓSTERS */}
      <main className="max-w-6xl mx-auto">
        {loadingEvents ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-semibold">Cargando cartelera de eventos...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className={`rounded-3xl p-10 border text-center space-y-3 max-w-md mx-auto my-12 shadow-xl ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#101625] border-slate-800'
          }`}>
            <Film className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>No hay eventos para este filtro</h3>
            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Prueba seleccionando otra ciudad, otro recinto o la categoría "Todos".
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('todos');
                setSelectedVenueId('todos');
                setSelectedCity('todas');
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md"
            >
              Ver todos los eventos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredEvents.map((ev) => {
              const rating = getEventRatingBadge(ev.type);
              const minPrice = getMinPrice(ev);
              const posterSrc =
                normalizeGoogleDriveImageUrl(ev.posterUrl) || getEventPosterPlaceholder(ev.type);
              const venueObj = venues.find((v) => v.id === ev.venueId);

              return (
                <div
                  key={ev.id}
                  className={`group flex flex-col justify-between rounded-2xl sm:rounded-3xl border overflow-hidden transition-all duration-300 ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 shadow-xs hover:border-red-500/80 hover:shadow-lg'
                      : 'bg-[#101625] border-slate-800/80 shadow-lg hover:border-red-500/80 hover:shadow-xl hover:shadow-red-950/20'
                  }`}
                >
                  {/* Cintillo de Recinto y Fecha sin invadir el arte del póster */}
                  <div className={`px-2.5 py-1.5 border-b flex items-center justify-between gap-1 text-[10px] ${
                    theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-[#0C121E] border-slate-800/80'
                  }`}>
                    <span className={`font-bold truncate max-w-[58%] flex items-center gap-1 ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                    }`}>
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="truncate">{ev.venueName || venueObj?.name || 'Estadio'}</span>
                    </span>
                    <span className={`font-black shrink-0 flex items-center gap-1 ${
                      theme === 'light' ? 'text-red-700' : 'text-amber-400'
                    }`}>
                      <Calendar className={`w-3 h-3 ${theme === 'light' ? 'text-red-600' : 'text-amber-400'}`} />
                      <span>{ev.date}</span>
                    </span>
                  </div>

                  {/* Contenedor de Imagen Promocional Completa (100% íntegra, sin recortes) */}
                  <div
                    onClick={() => onSelectEvent(ev.id)}
                    className="relative aspect-[16/10] sm:aspect-[16/10] w-full bg-[#060911] overflow-hidden cursor-pointer flex items-center justify-center group/poster"
                  >
                    {/* Fondo difuminado adaptativo con los colores del flyer */}
                    <img
                      src={posterSrc}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                    />

                    {/* Imagen promocional completa sin ningún recorte */}
                    <img
                      src={posterSrc}
                      alt={ev.name}
                      referrerPolicy="no-referrer"
                      className="relative z-10 max-h-full max-w-full object-contain p-1 group-hover/poster:scale-105 transition-transform duration-300 drop-shadow-md"
                    />

                    {/* Botón flotante para ver imagen en tamaño completo */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage({ url: posterSrc, title: ev.name });
                      }}
                      className="absolute bottom-1.5 right-1.5 z-20 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white/90 backdrop-blur-xs border border-white/20 transition-all opacity-80 sm:opacity-0 sm:group-hover/poster:opacity-100"
                      title="Ver imagen promocional completa"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Información del Evento debajo del Póster */}
                  <div className={`p-3 sm:p-4 space-y-2 flex-1 flex flex-col justify-between ${
                    theme === 'light' ? 'bg-white' : 'bg-[#101625]'
                  }`}>
                    <div>
                      {/* Título del Encuentro */}
                      <h3
                        onClick={() => onSelectEvent(ev.id)}
                        className={`text-xs sm:text-sm font-black line-clamp-2 leading-tight transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'text-slate-900 hover:text-red-600'
                            : 'text-white hover:text-red-400'
                        }`}
                        title={ev.name}
                      >
                        {ev.name}
                      </h3>

                      {/* Horario y Precio */}
                      <div className={`flex items-center justify-between gap-1 mt-2 pt-1 border-t text-[11px] sm:text-xs ${
                        theme === 'light' ? 'border-slate-200' : 'border-slate-800/60'
                      }`}>
                        <span className={`flex items-center gap-1 font-bold ${
                          theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                        }`}>
                          <Clock className={`w-3.5 h-3.5 shrink-0 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
                          <span>{ev.time || '20:00 hrs'}</span>
                        </span>
                        <span className={`font-black ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
                          Desde ${minPrice} MXN
                        </span>
                      </div>

                      {/* Clasificación e información (Badge + Link Sinopsis) */}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md ${rating.bg} text-white font-black text-[10px] sm:text-xs flex items-center justify-center shrink-0 shadow-xs`}
                          title={`Clasificación ${rating.label}: ${rating.text}`}
                        >
                          {rating.label}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSynopsisEvent(ev)}
                          className={`text-[11px] sm:text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                            theme === 'light' ? 'text-slate-500 hover:text-red-600' : 'text-slate-400 hover:text-amber-400'
                          }`}
                        >
                          <Info className="w-3 h-3" />
                          <span>Ver sinopsis</span>
                        </button>
                      </div>
                    </div>

                    {/* Botón de Selección directa */}
                    <button
                      type="button"
                      onClick={() => onSelectEvent(ev.id)}
                      className="w-full py-2 sm:py-2.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl sm:rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-950/40 transition-all cursor-pointer active:scale-98 mt-1"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Elegir Asientos</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TARJETAS PROMOCIONALES: ALIMENTOS EN BUTACA & TIENDA OFICIAL */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Promoción de Alimentos en Butaca */}
          <div
            onClick={() => (onSelectStore ? onSelectStore('comida') : onOpenAuth('comida'))}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101625] via-[#151D30] to-[#101625] border border-slate-800 p-5 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-400/60 shadow-xl transition-all"
          >
            <div className="space-y-1.5 z-10">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                🍿 Alimentos & Bebidas
              </span>
              <h4 className="text-base font-black text-white">Comanda sin filas en Butaca</h4>
              <p className="text-xs text-slate-300 line-clamp-2">
                Pide hot dogs, nachos, esquites y bebidas frías con entrega directa a tu asiento.
              </p>
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1 pt-1 group-hover:translate-x-1 transition-transform">
                <span>Ver menú de concesiones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Utensils className="w-8 h-8" />
            </div>
          </div>

          {/* Promoción de Tienda Oficial */}
          <div
            onClick={() => (onSelectStore ? onSelectStore('tienda') : onOpenAuth('tienda'))}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A121E] via-[#141B2D] to-[#101625] border border-slate-800 p-5 flex items-center justify-between gap-4 cursor-pointer hover:border-red-500/80 shadow-xl transition-all"
          >
            <div className="space-y-1.5 z-10">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-300 bg-red-900/40 px-2.5 py-0.5 rounded-full border border-red-700/40">
                🛍️ Tienda Oficial
              </span>
              <h4 className="text-base font-black text-white">Jerseys y Gorras Oficiales</h4>
              <p className="text-xs text-slate-300 line-clamp-2">
                Uniformes originales, souvenirs y gorras con envíos y recolección rápida.
              </p>
              <div className="text-xs font-bold text-red-400 flex items-center gap-1 pt-1 group-hover:translate-x-1 transition-transform">
                <span>Ir a la tienda oficial</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
              <ShoppingBag className="w-8 h-8" />
            </div>
          </div>
        </div>
      </main>

      {/* 4. MODAL FLOTANTE DE SINOPSIS DEL EVENTO */}
      {synopsisEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#101625] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => setSynopsisEvent(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#182032] hover:bg-[#202B42] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Cerrar ficha técnica"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Encabezado con imagen promocional completa */}
            <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
              <img
                src={
                  normalizeGoogleDriveImageUrl(synopsisEvent.posterUrl) ||
                  getEventPosterPlaceholder(synopsisEvent.type)
                }
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-110 pointer-events-none"
              />
              <img
                src={
                  normalizeGoogleDriveImageUrl(synopsisEvent.posterUrl) ||
                  getEventPosterPlaceholder(synopsisEvent.type)
                }
                alt={synopsisEvent.name}
                referrerPolicy="no-referrer"
                className="relative z-10 max-h-full max-w-full object-contain p-1 drop-shadow-xl"
              />
              <button
                type="button"
                onClick={() =>
                  setPreviewImage({
                    url:
                      normalizeGoogleDriveImageUrl(synopsisEvent.posterUrl) ||
                      getEventPosterPlaceholder(synopsisEvent.type),
                    title: synopsisEvent.name,
                  })
                }
                className="absolute bottom-2 right-2 z-20 p-2 rounded-xl bg-black/80 hover:bg-black text-white backdrop-blur-xs border border-white/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Ampliar imagen</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                {synopsisEvent.type === 'baseball'
                  ? 'Béisbol LMP'
                  : synopsisEvent.type === 'football'
                  ? 'Liga MX'
                  : synopsisEvent.type === 'concert'
                  ? 'Concierto'
                  : 'Espectáculo'}
              </span>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                {synopsisEvent.name}
              </h3>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                {synopsisEvent.venueName || 'Recinto Oficial'}
              </p>
            </div>

            {/* Ficha técnica y datos */}
            <div className="grid grid-cols-2 gap-2.5 bg-[#151D30] p-3 rounded-2xl border border-slate-800 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Fecha</span>
                <span className="font-extrabold text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  {synopsisEvent.date}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Horario</span>
                <span className="font-extrabold text-white flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {synopsisEvent.time || '20:00 hrs'}
                </span>
              </div>
            </div>

            {/* Sinopsis */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider text-slate-400">
                Sinopsis del Encuentro
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {getEventSynopsis(synopsisEvent)}
              </p>
            </div>

            {/* Precios por sección */}
            {synopsisEvent.priceTiers && synopsisEvent.priceTiers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <h4 className="text-xs font-black text-white uppercase tracking-wider text-slate-400">
                  Zonas y Precios Disponibles
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {synopsisEvent.priceTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-[#151D30] border border-slate-800 flex justify-between items-center"
                    >
                      <span className="text-slate-300 font-medium truncate pr-1">{tier.section}</span>
                      <span className="font-extrabold text-amber-400 shrink-0">${tier.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de acción: Seleccionar este evento */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  const id = synopsisEvent.id;
                  setSynopsisEvent(null);
                  onSelectEvent(id);
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 cursor-pointer transition-all active:scale-98"
              >
                <Ticket className="w-4 h-4" />
                <span>Comprar Boletos / Elegir Asientos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. VISOR MODAL DE IMAGEN PROMOCIONAL COMPLETA (LIGHTBOX) */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] w-full bg-[#080D18] border border-slate-700 rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center cursor-default"
          >
            <div className="w-full flex items-center justify-between pb-3 px-1 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white truncate max-w-[80%]">
                {previewImage.title}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full bg-[#151D30] hover:bg-[#202B42] text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full flex-1 flex items-center justify-center overflow-hidden py-3">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. BARRA DE NAVEGACIÓN INFERIOR FIJA */}
      {showBottomNav && (
        <nav
          id="cartelera-bottom-nav"
          aria-label="Navegación de la Cartelera"
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#0F172A]/98 backdrop-blur-xl border-t-2 border-red-600/80 shadow-[0_-10px_35px_rgba(0,0,0,0.85)]"
        >
          <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5 sm:py-2 text-center">
            {/* 1. Cartelera (Activo) */}
            <button
              type="button"
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-red-400 font-bold font-sports tracking-wider cursor-pointer"
            >
              <div className="p-1.5 rounded-xl bg-red-600 text-white shadow-md shadow-red-950/50 ring-1 ring-red-500/50">
                <Film className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-1 uppercase">
                Cartelera
              </span>
            </button>

            {/* 2. Alimentos */}
            <button
              type="button"
              onClick={() => {
                if (onSelectStore) onSelectStore('comida');
                else if (onSelectTab) onSelectTab('comida');
                else onOpenAuth('comida');
              }}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-white font-sports tracking-wider transition-colors cursor-pointer"
            >
              <div className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200">
                <Utensils className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-1 uppercase">
                Alimentos
              </span>
            </button>

            {/* 3. Tienda Oficial */}
            <button
              type="button"
              onClick={() => {
                if (onSelectStore) onSelectStore('tienda');
                else if (onSelectTab) onSelectTab('tienda');
                else onOpenAuth('tienda');
              }}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-white font-sports tracking-wider transition-colors cursor-pointer"
            >
              <div className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-1 uppercase">
                Tienda
              </span>
            </button>

            {/* 4. Mis Boletos */}
            <button
              type="button"
              onClick={() => {
                if (onSelectTab) onSelectTab('boletos');
                else onOpenAuth('boletos');
              }}
              className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-white font-sports tracking-wider transition-colors cursor-pointer"
            >
              <div className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200">
                <Ticket className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-tight mt-1 uppercase">
                Boletos
              </span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

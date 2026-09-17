import React, { useState, useEffect, useMemo } from 'react';
import { VenueEvent, Venue, EventType, UserProfile, EventPriceTier } from '../../types';
import { DEFAULT_VENUES, DEFAULT_VENUE_ID, DEFAULT_FALLBACK_EVENT } from '../../lib/defaultVenue';
import { subscribeVenues } from '../../lib/venues';
import { DEFAULT_FALLBACK_EVENTS } from '../../lib/venueEvents';
import { normalizeGoogleDriveImageUrl, getEventPosterPlaceholder } from '../../lib/imageUtils';
import { getOfficialPriceTiersForEvent } from '../../lib/seatMap';
import { purchaseTicketWithSaleRecord } from '../../lib/tickets';
import { SeatMapSelector } from '../../views/aficionado/SeatMapSelector';
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
  Zap,
  ArrowLeft,
  CheckCircle2,
  Minus,
  Plus,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

interface CarteleraLandingProps {
  user?: UserProfile;
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
  onSelectEvent?: (eventId: string) => void;
  onOpenAuth: (context?: 'login' | 'boletos' | 'tienda' | 'comida') => void;
  onSelectStore?: (type: 'tienda' | 'comida') => void;
  onSelectTab?: (tab: 'cartelera' | 'boletos' | 'tienda' | 'comida') => void;
  onTicketPurchased?: () => void;
  showBottomNav?: boolean;
}

export const CarteleraLanding: React.FC<CarteleraLandingProps> = ({
  user,
  initialEventId,
  onClearInitialEvent,
  onSelectEvent,
  onOpenAuth,
  onSelectStore,
  onSelectTab,
  onTicketPurchased,
  showBottomNav = true,
}) => {
  const { theme } = useTheme();
  // Sedes disponibles
  const [venues, setVenues] = useState<Venue[]>(DEFAULT_VENUES);

  // Evento activo para cargar el mapa interactivo de asientos en esta misma pantalla
  const [selectedMapEvent, setSelectedMapEvent] = useState<VenueEvent | null>(null);

  // Estados para compra rápida sin mapa
  const [quickBuyEvent, setQuickBuyEvent] = useState<VenueEvent | null>(null);
  const [quickBuyTier, setQuickBuyTier] = useState<EventPriceTier | null>(null);
  const [quickBuyQuantity, setQuickBuyQuantity] = useState<number>(1);
  const [quickBuyPayment, setQuickBuyPayment] = useState<'Efectivo / Taquilla' | 'Tarjeta en Línea' | 'Venados Pay'>('Efectivo / Taquilla');
  const [quickBuyLoading, setQuickBuyLoading] = useState<boolean>(false);
  const [quickBuySuccessMsg, setQuickBuySuccessMsg] = useState<string | null>(null);

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

  // Si se proporciona initialEventId, abrir automáticamente el mapa para ese evento
  useEffect(() => {
    if (initialEventId && allEvents.length > 0) {
      const match = allEvents.find((e) => e.id === initialEventId);
      if (match) {
        setSelectedMapEvent(match);
        onClearInitialEvent?.();
      }
    }
  }, [initialEventId, allEvents, onClearInitialEvent]);

  // Manejar apertura de compra rápida sin mapa
  const handleOpenQuickBuy = (ev: VenueEvent) => {
    setQuickBuyEvent(ev);
    const tiers = getOfficialPriceTiersForEvent(ev, ev.venueName);
    if (tiers && tiers.length > 0) {
      setQuickBuyTier(tiers[0]);
    } else {
      setQuickBuyTier({ section: 'General', price: 200 });
    }
    setQuickBuyQuantity(1);
    setQuickBuyPayment('Efectivo / Taquilla');
    setQuickBuySuccessMsg(null);
  };

  // Confirmar compra rápida
  const handleConfirmQuickBuy = async () => {
    if (!quickBuyEvent || !quickBuyTier) return;
    if (!user || !user.uid) {
      onOpenAuth('boletos');
      return;
    }

    try {
      setQuickBuyLoading(true);
      const stadiumName = quickBuyEvent.venueName || venues.find((v) => v.id === quickBuyEvent.venueId)?.name || 'Estadio Deportivo';
      const venueId = quickBuyEvent.venueId || DEFAULT_VENUE_ID;

      // Crear los boletos solicitados con asientos asignados automáticamente
      for (let i = 0; i < quickBuyQuantity; i++) {
        const rowChar = String.fromCharCode(65 + Math.floor(Math.random() * 4));
        const seatNum = Math.floor(Math.random() * 25) + 1;
        await purchaseTicketWithSaleRecord(
          {
            userId: user.uid,
            eventId: quickBuyEvent.id,
            venueId,
            matchTitle: quickBuyEvent.name,
            opponent: quickBuyEvent.opponent || quickBuyEvent.name,
            matchDate: quickBuyEvent.date,
            matchTime: quickBuyEvent.time || '20:00 hrs',
            stadium: stadiumName,
            section: quickBuyTier.section,
            row: `Fila ${rowChar}`,
            seat: `Asiento ${seatNum}`,
            price: quickBuyTier.price,
            gate: quickBuyEvent.gate || 'Puertas 1, 2 y 4',
          },
          quickBuyPayment,
          user.displayName || user.email || 'Aficionado'
        );
      }

      setQuickBuySuccessMsg(`¡Compra rápida de ${quickBuyQuantity} boleto(s) realizada con éxito!`);
      setTimeout(() => {
        setQuickBuyEvent(null);
        setQuickBuySuccessMsg(null);
        if (onSelectTab) {
          onSelectTab('boletos');
        } else if (onTicketPurchased) {
          onTicketPurchased();
        }
      }, 1100);
    } catch (err) {
      console.error('Error al realizar compra rápida:', err);
      alert('Ocurrió un error al procesar la compra rápida. Intenta de nuevo.');
    } finally {
      setQuickBuyLoading(false);
    }
  };

  return (
    <div className={`min-h-screen px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 transition-colors ${
      theme === 'light' ? 'bg-[#F4F6F9] text-slate-900' : 'bg-[#0A0E17] text-slate-100'
    }`}>
      {/* 0. VISTA DIRECTA DE MAPA INTERACTIVO DENTRO DE CARTELERA */}
      {selectedMapEvent ? (
        <div className="max-w-6xl mx-auto space-y-4">
          <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
          }`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedMapEvent(null)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-sports font-bold text-xs uppercase tracking-wider border transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-[#182032] hover:bg-[#202B42] text-slate-200 border-slate-700'
                }`}
              >
                <ArrowLeft className="w-4 h-4 text-red-500" />
                <span>Volver a Cartelera</span>
              </button>
              <div>
                <h2 className={`text-base sm:text-lg font-black font-sports uppercase tracking-wide ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>
                  {selectedMapEvent.name}
                </h2>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {selectedMapEvent.date} • {selectedMapEvent.time || '20:00 hrs'} • {selectedMapEvent.venueName || 'Estadio'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const ev = selectedMapEvent;
                setSelectedMapEvent(null);
                handleOpenQuickBuy(ev);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-sports font-black text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-amber-950/30 transition-all active:scale-98"
            >
              <Zap className="w-4 h-4" />
              <span>Comprar Rápido sin Mapa</span>
            </button>
          </div>

          <SeatMapSelector
            event={selectedMapEvent}
            user={user || { uid: '', email: '', displayName: 'Aficionado', role: 'aficionado' }}
            stadiumName={selectedMapEvent.venueName || venues.find((v) => v.id === selectedMapEvent.venueId)?.name || 'Estadio Deportivo'}
            onRequireAuth={() => onOpenAuth('boletos')}
            onPurchaseSuccess={(purchaseId, count) => {
              setSelectedMapEvent(null);
              if (onSelectTab) {
                onSelectTab('boletos');
              } else if (onTicketPurchased) {
                onTicketPurchased();
              }
            }}
            onCancel={() => setSelectedMapEvent(null)}
          />
        </div>
      ) : (
        <>
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
                    onClick={() => setSelectedMapEvent(ev)}
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
                        onClick={() => setSelectedMapEvent(ev)}
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

                    {/* Botones de Selección: Mapa interactivo y Compra Rápida sin mapa */}
                    <div className={`space-y-1.5 mt-2.5 pt-2 border-t transition-colors ${
                      theme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setSelectedMapEvent(ev)}
                        className="w-full py-2 px-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl font-sports font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-red-950/20 transition-all cursor-pointer active:scale-98 uppercase tracking-wider"
                        title="Seleccionar butacas específicas en el mapa interactivo del estadio"
                      >
                        <Ticket className="w-3.5 h-3.5 shrink-0" />
                        <span>Elegir en Mapa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenQuickBuy(ev)}
                        className={`w-full py-1.5 px-2.5 rounded-xl font-sports font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer active:scale-98 uppercase tracking-wider ${
                          theme === 'light'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                        }`}
                        title="Compra rápida sin abrir el mapa seleccionando zona y cantidad"
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>Compra Rápida</span>
                      </button>
                    </div>
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
            className={`group relative overflow-hidden rounded-3xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all duration-300 border shadow-md hover:shadow-xl ${
              theme === 'light'
                ? 'bg-[#FFFBEB] border-amber-300 hover:border-amber-400'
                : 'bg-[#101625] border-slate-800 hover:border-amber-400/60'
            }`}
          >
            <div className="space-y-1.5 z-10">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-block ${
                theme === 'light'
                  ? '!text-amber-950 bg-amber-200/80 border-amber-400 font-black'
                  : 'text-amber-300 bg-amber-400/20 border-amber-400/30'
              }`}>
                🍿 Alimentos & Bebidas
              </span>
              <h4 className={`text-base font-black tracking-tight ${
                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
              }`}>
                Comanda sin filas en Butaca
              </h4>
              <p className={`text-xs line-clamp-2 leading-relaxed ${
                theme === 'light' ? '!text-[#334155] text-slate-700' : 'text-slate-200'
              }`}>
                Pide hot dogs, nachos, esquites y bebidas frías con entrega directa a tu asiento.
              </p>
              <div className={`text-xs font-black flex items-center gap-1 pt-1 group-hover:translate-x-1 transition-transform ${
                theme === 'light' ? '!text-amber-900 text-amber-900' : 'text-amber-300'
              }`}>
                <span>Ver menú de concesiones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
              theme === 'light'
                ? 'bg-amber-200/90 border-amber-400 text-amber-950 shadow-sm'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}>
              <Utensils className="w-8 h-8" />
            </div>
          </div>

          {/* Promoción de Tienda Oficial */}
          <div
            onClick={() => (onSelectStore ? onSelectStore('tienda') : onOpenAuth('tienda'))}
            className={`group relative overflow-hidden rounded-3xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all duration-300 border shadow-md hover:shadow-xl ${
              theme === 'light'
                ? 'bg-[#FFF1F2] border-rose-300 hover:border-rose-400'
                : 'bg-[#151320] border-slate-800 hover:border-red-500/80'
            }`}
          >
            <div className="space-y-1.5 z-10">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-block ${
                theme === 'light'
                  ? '!text-rose-950 bg-rose-200/80 border-rose-400 font-black'
                  : 'text-red-200 bg-red-800/50 border-red-500/40'
              }`}>
                🛍️ Tienda Oficial
              </span>
              <h4 className={`text-base font-black tracking-tight ${
                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
              }`}>
                Jerseys y Gorras Oficiales
              </h4>
              <p className={`text-xs line-clamp-2 leading-relaxed ${
                theme === 'light' ? '!text-[#334155] text-slate-700' : 'text-slate-200'
              }`}>
                Uniformes originales, souvenirs y gorras con envíos y recolección rápida.
              </p>
              <div className={`text-xs font-black flex items-center gap-1 pt-1 group-hover:translate-x-1 transition-transform ${
                theme === 'light' ? '!text-rose-900 text-rose-900' : 'text-red-300'
              }`}>
                <span>Ir a la tienda oficial</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
              theme === 'light'
                ? 'bg-rose-200/90 border-rose-400 text-rose-950 shadow-sm'
                : 'bg-red-600/25 border-red-500/40 text-red-300'
            }`}>
              <ShoppingBag className="w-8 h-8" />
            </div>
          </div>
        </div>
      </main>
        </>
      )}

      {/* 4. MODAL FLOTANTE DE SINOPSIS DEL EVENTO */}
      {synopsisEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto border transition-colors ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#101625] border-slate-800 text-slate-100'
          }`}>
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => setSynopsisEvent(null)}
              className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                  : 'bg-[#182032] hover:bg-[#202B42] text-slate-400 hover:text-white'
              }`}
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
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                theme === 'light'
                  ? 'text-red-700 bg-red-50 border-red-200'
                  : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
              }`}>
                {synopsisEvent.type === 'baseball'
                  ? 'Béisbol LMP'
                  : synopsisEvent.type === 'football'
                  ? 'Liga MX'
                  : synopsisEvent.type === 'concert'
                  ? 'Concierto'
                  : 'Espectáculo'}
              </span>
              <h3 className={`text-base sm:text-lg font-black leading-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                {synopsisEvent.name}
              </h3>
              <p className={`text-xs font-medium flex items-center gap-1 ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                {synopsisEvent.venueName || 'Recinto Oficial'}
              </p>
            </div>

            {/* Ficha técnica y datos */}
            <div className={`grid grid-cols-2 gap-2.5 p-3 rounded-2xl border text-xs ${
              theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#151D30] border-slate-800'
            }`}>
              <div className="space-y-0.5">
                <span className={`text-[10px] font-bold block uppercase ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>Fecha</span>
                <span className={`font-extrabold flex items-center gap-1 ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  {synopsisEvent.date}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className={`text-[10px] font-bold block uppercase ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>Horario</span>
                <span className={`font-extrabold flex items-center gap-1 ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>
                  <Clock className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
                  {synopsisEvent.time || '20:00 hrs'}
                </span>
              </div>
            </div>

            {/* Sinopsis */}
            <div className="space-y-1.5">
              <h4 className={`text-xs font-black uppercase tracking-wider ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Sinopsis del Encuentro
              </h4>
              <p className={`text-xs leading-relaxed ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                {getEventSynopsis(synopsisEvent)}
              </p>
            </div>

            {/* Precios por sección */}
            {synopsisEvent.priceTiers && synopsisEvent.priceTiers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <h4 className={`text-xs font-black uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  Zonas y Precios Disponibles
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {synopsisEvent.priceTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border flex justify-between items-center ${
                        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#151D30] border-slate-800'
                      }`}
                    >
                      <span className={`font-medium truncate pr-1 ${
                        theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                      }`}>{tier.section}</span>
                      <span className={`font-extrabold shrink-0 ${
                        theme === 'light' ? 'text-red-600 font-black' : 'text-amber-400'
                      }`}>${tier.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de acción: Elegir en Mapa y Compra Rápida */}
            <div className="grid grid-cols-2 gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  const ev = synopsisEvent;
                  setSynopsisEvent(null);
                  setSelectedMapEvent(ev);
                }}
                className="py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-red-950/50 cursor-pointer transition-all active:scale-98"
              >
                <Ticket className="w-4 h-4" />
                <span>Elegir en Mapa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const ev = synopsisEvent;
                  setSynopsisEvent(null);
                  handleOpenQuickBuy(ev);
                }}
                className="py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/30 cursor-pointer transition-all active:scale-98"
              >
                <Zap className="w-4 h-4" />
                <span>Compra Rápida</span>
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

      {/* 5.5 MODAL DE COMPRA RÁPIDA SIN MAPA */}
      {quickBuyEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 border transition-colors ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#101625] border-slate-800 text-slate-100'
          }`}>
            {/* Cabecera */}
            <div className={`flex items-start justify-between gap-3 border-b pb-3 ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-800'
            }`}>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 w-fit ${
                  theme === 'light'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  <Zap className="w-3 h-3 text-amber-500" />
                  Compra Express Directa
                </span>
                <h3 className={`text-base font-black mt-1 line-clamp-1 ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>{quickBuyEvent.name}</h3>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {quickBuyEvent.date} • {quickBuyEvent.time || '20:00 hrs'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickBuyEvent(null)}
                disabled={quickBuyLoading}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensaje de éxito */}
            {quickBuySuccessMsg ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/40">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-sm font-black text-emerald-500">{quickBuySuccessMsg}</p>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Redirigiendo a tu cartera de boletos...
                </p>
              </div>
            ) : (
              <>
                {/* Selección de Zona / Sección */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-black uppercase tracking-wider block ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Selecciona Zona / Categoría:
                  </label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {getOfficialPriceTiersForEvent(quickBuyEvent, quickBuyEvent.venueName).map((tier, idx) => {
                      const isSelected = quickBuyTier?.section === tier.section;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setQuickBuyTier(tier)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                            isSelected
                              ? theme === 'light'
                                ? 'bg-amber-100/80 border-amber-400 text-amber-950 font-bold shadow-xs'
                                : 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-xs'
                              : theme === 'light'
                              ? 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                              : 'bg-[#151D30] border-slate-800 text-slate-200 hover:bg-[#1C2740]'
                          }`}
                        >
                          <span className="text-xs truncate font-medium">{tier.section}</span>
                          <span className={`text-xs font-black shrink-0 ${
                            theme === 'light' ? 'text-amber-700' : 'text-amber-400'
                          }`}>
                            ${tier.price} MXN
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cantidad de Boletos */}
                <div className={`flex items-center justify-between gap-4 p-3 rounded-2xl border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-[#0B101B] border-slate-800 text-white'
                }`}>
                  <div>
                    <span className={`text-xs font-bold block ${
                      theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                    }`}>Cantidad de Boletos</span>
                    <span className={`text-[11px] ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>Asientos juntos automáticos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickBuyQuantity((q) => Math.max(1, q - 1))}
                      disabled={quickBuyQuantity <= 1 || quickBuyLoading}
                      className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 ${
                        theme === 'light'
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      -
                    </button>
                    <span className={`w-6 text-center font-black text-sm ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>
                      {quickBuyQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuickBuyQuantity((q) => Math.min(8, q + 1))}
                      disabled={quickBuyQuantity >= 8 || quickBuyLoading}
                      className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 ${
                        theme === 'light'
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Método de Pago */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-black uppercase tracking-wider block ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Método de Pago:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Efectivo / Taquilla', 'Tarjeta Débito/Crédito', 'Transferencia SPEI'].map((met) => (
                      <button
                        key={met}
                        type="button"
                        onClick={() => setQuickBuyPayment(met)}
                        className={`p-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center leading-tight ${
                          quickBuyPayment === met
                            ? 'bg-red-600 text-white border-red-500'
                            : theme === 'light'
                            ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {met}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total a pagar */}
                <div className={`flex items-center justify-between pt-2 border-t ${
                  theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                }`}>
                  <span className={`text-xs font-bold ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}>Total a pagar:</span>
                  <span className={`text-lg font-black ${
                    theme === 'light' ? 'text-amber-600' : 'text-amber-400'
                  }`}>
                    ${(quickBuyTier?.price || 0) * quickBuyQuantity} MXN
                  </span>
                </div>

                {/* Botón de Confirmación */}
                <button
                  type="button"
                  onClick={handleConfirmQuickBuy}
                  disabled={quickBuyLoading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  {quickBuyLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Generando {quickBuyQuantity} boleto(s)...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Confirmar y Obtener Boletos</span>
                    </>
                  )}
                </button>

                {/* Opción alternativa: Ir al mapa interactivo */}
                <button
                  type="button"
                  onClick={() => {
                    const ev = quickBuyEvent;
                    setQuickBuyEvent(null);
                    setSelectedMapEvent(ev);
                  }}
                  className="w-full text-center text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer pt-1"
                >
                  ¿Prefieres elegir asientos específicos? <span className="text-red-400 underline">Abrir mapa interactivo</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. BARRA DE NAVEGACIÓN INFERIOR FIJA */}
      {showBottomNav && (
        <nav
          id="cartelera-bottom-nav"
          aria-label="Navegación de la Cartelera"
          className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t-2 transition-colors ${
            theme === 'light'
              ? 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]'
              : 'bg-[#0F172A]/98 border-red-600/80 shadow-[0_-10px_35px_rgba(0,0,0,0.85)]'
          }`}
        >
          <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5 sm:py-2 text-center">
            {/* 1. Cartelera (Activo) */}
            <button
              type="button"
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl font-sports tracking-wider cursor-pointer ${
                theme === 'light' ? 'text-red-600 font-black' : 'text-red-400 font-bold'
              }`}
            >
              <div className="p-1.5 rounded-xl bg-red-600 text-white shadow-md shadow-red-950/20 ring-1 ring-red-500/50">
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
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl font-sports tracking-wider transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-500 hover:text-slate-900 font-semibold'
                  : 'text-slate-400 hover:text-white font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${
                theme === 'light' ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}>
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
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl font-sports tracking-wider transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-500 hover:text-slate-900 font-semibold'
                  : 'text-slate-400 hover:text-white font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${
                theme === 'light' ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}>
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
              className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl font-sports tracking-wider transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-500 hover:text-slate-900 font-semibold'
                  : 'text-slate-400 hover:text-white font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${
                theme === 'light' ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}>
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

import React, { useState, useEffect, useMemo } from 'react';
import { Ticket, UserProfile, VenueEvent, EventPriceTier, Venue } from '../../types';
import { subscribeUserTickets, purchaseTicketWithSaleRecord } from '../../lib/tickets';
import {
  getActiveEventsForVenue,
  subscribeVenueEvents,
  getEventPosterPlaceholder,
  getVenueEventById,
} from '../../lib/venueEvents';
import { subscribeVenues, getAllVenues } from '../../lib/venues';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { TicketCard } from '../../components/shared/TicketCard';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { SeatMapSelector } from './SeatMapSelector';
import { useLanguage } from '../../context/LanguageContext';
import {
  Ticket as TicketIcon,
  PlusCircle,
  X,
  CheckCircle2,
  DollarSign,
  Calendar,
  MapPin,
  ShieldCheck,
  Clock,
  DoorOpen,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Building2,
  ChevronDown,
  Users,
  Grid,
} from 'lucide-react';

interface MisBoletosProps {
  user: UserProfile;
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
}

export const MisBoletos: React.FC<MisBoletosProps> = ({
  user,
  initialEventId,
  onClearInitialEvent,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'mis-boletos' | 'comprar'>('mis-boletos');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'activo' | 'usado'>('todos');

  // Sedes disponibles
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(user.venueId || DEFAULT_VENUE_ID);

  // Eventos activos en venta para la sede seleccionada
  const [activeEvents, setActiveEvents] = useState<VenueEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Selección de compra
  const [selectedEvent, setSelectedEvent] = useState<VenueEvent | null>(null);
  const [selectedTier, setSelectedTier] = useState<EventPriceTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo / Terminal física en Taquilla' | 'Tarjeta en Línea' | 'Venados Pay'>('Efectivo / Terminal física en Taquilla');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = useState<string | null>(null);
  const [showSeatMap, setShowSeatMap] = useState<boolean>(false);
  const [quickBuyEvent, setQuickBuyEvent] = useState<VenueEvent | null>(null);

  // Escuchar boletos del aficionado
  useEffect(() => {
    setLoadingTickets(true);
    const unsubscribe = subscribeUserTickets(
      user.uid,
      (updatedTickets) => {
        setTickets(updatedTickets);
        setLoadingTickets(false);
      },
      () => {
        setLoadingTickets(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Escuchar sedes en tiempo real
  useEffect(() => {
    setLoadingVenues(true);
    const unsubscribe = subscribeVenues(
      (venuesList) => {
        setVenues(venuesList);
        setLoadingVenues(false);
        if (venuesList.length > 0) {
          setSelectedVenueId((prev) => {
            if (prev && venuesList.some((v) => v.id === prev)) {
              return prev;
            }
            return user.venueId && venuesList.some((v) => v.id === user.venueId)
              ? user.venueId
              : venuesList[0].id;
          });
        }
      },
      () => {
        getAllVenues().then((venuesList) => {
          setVenues(venuesList);
          setLoadingVenues(false);
          if (venuesList.length > 0) {
            setSelectedVenueId((prev) => {
              if (prev && venuesList.some((v) => v.id === prev)) {
                return prev;
              }
              return venuesList[0].id;
            });
          }
        });
      }
    );

    return () => unsubscribe();
  }, [user.venueId]);

  // Escuchar eventos en tiempo real de la sede seleccionada
  useEffect(() => {
    if (!selectedVenueId) return;

    setLoadingEvents(true);
    const unsubscribe = subscribeVenueEvents(
      selectedVenueId,
      (events) => {
        // Filtrar solo los que están activos y con venta abierta
        const available = events.filter((e) => e.active && e.ticketsAvailable);
        setActiveEvents(available);
        setLoadingEvents(false);

        // Preseleccionar evento
        if (available.length > 0) {
          setSelectedEvent((prev) => {
            if (prev && available.some((ev) => ev.id === prev.id)) {
              return available.find((ev) => ev.id === prev.id) || available[0];
            }
            return available[0];
          });
        } else {
          setSelectedEvent(null);
          setSelectedTier(null);
        }
      },
      (err) => {
        console.warn('Error escuchando eventos de la sede seleccionada:', err);
        getActiveEventsForVenue(selectedVenueId).then((evs) => {
          setActiveEvents(evs);
          setLoadingEvents(false);
          if (evs.length > 0) {
            setSelectedEvent(evs[0]);
          } else {
            setSelectedEvent(null);
            setSelectedTier(null);
          }
        });
      }
    );

    return () => unsubscribe();
  }, [selectedVenueId]);

  // Sincronizar tiers al cambiar evento seleccionado
  useEffect(() => {
    if (selectedEvent && selectedEvent.priceTiers && selectedEvent.priceTiers.length > 0) {
      if (selectedTier && selectedEvent.priceTiers.some((t) => t.section === selectedTier.section)) {
        return;
      }
      setSelectedTier(selectedEvent.priceTiers[0]);
    } else {
      setSelectedTier(null);
    }
  }, [selectedEvent]);

  // Redirección directa al evento seleccionado antes de iniciar sesión (saltando cartelera interna)
  useEffect(() => {
    if (!initialEventId) return;

    let isMounted = true;

    async function routeToPendingEvent() {
      // 1. Buscar si ya está en los eventos cargados
      const inActive = activeEvents.find((e) => e.id === initialEventId);
      if (inActive) {
        setSelectedVenueId(inActive.venueId);
        setSelectedEvent(inActive);
        if (inActive.priceTiers && inActive.priceTiers.length > 0) {
          setSelectedTier(inActive.priceTiers[0]);
        }
        setActiveTab('comprar');
        setShowSeatMap(true);
        onClearInitialEvent?.();
        return;
      }

      // 2. Si activeEvents aún está cargando o pertenece a otra sede, cargarlo por ID
      try {
        const ev = await getVenueEventById(initialEventId);
        if (ev && isMounted) {
          setSelectedVenueId(ev.venueId);
          setSelectedEvent(ev);
          if (ev.priceTiers && ev.priceTiers.length > 0) {
            setSelectedTier(ev.priceTiers[0]);
          }
          setActiveTab('comprar');
          setShowSeatMap(true);
          onClearInitialEvent?.();
        }
      } catch (err) {
        console.warn('Error redirigiendo al evento pendiente:', err);
      }
    }

    routeToPendingEvent();

    return () => {
      isMounted = false;
    };
  }, [initialEventId, activeEvents, onClearInitialEvent]);

  const currentVenue = venues.find((v) => v.id === selectedVenueId) || null;
  const stadiumName = currentVenue ? currentVenue.name : 'Estadio Teodoro Mariscal';

  const handleSelectEvent = (event: VenueEvent) => {
    setSelectedEvent(event);
    if (event.priceTiers && event.priceTiers.length > 0) {
      setSelectedTier(event.priceTiers[0]);
    } else {
      setSelectedTier(null);
    }
  };

  const handleConfirmPurchase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedEvent || !selectedTier) return;

    setPurchasing(true);
    try {
      // Snapshot de los datos del evento al momento de la compra
      // NO queda como referencia viva para que no cambie si el admin edita el evento después
      await purchaseTicketWithSaleRecord(
        {
          userId: user.uid,
          venueId: selectedVenueId,
          eventId: selectedEvent.id,
          matchTitle: selectedEvent.name,
          opponent: selectedEvent.opponent || '',
          matchDate: selectedEvent.date,
          matchTime: selectedEvent.time || '20:00 hrs',
          stadium: stadiumName,
          section: selectedTier.section,
          row: 'Sección General',
          seat: `Asiento ${Math.floor(Math.random() * 80) + 1}`,
          price: selectedTier.price,
          gate: selectedEvent.gate || 'Puertas 1, 2, 4 y 8',
        },
        paymentMethod,
        user.displayName || user.email || 'Aficionado'
      );

      setPurchaseSuccessMsg(
        `¡Entrada adquirida con éxito para "${selectedEvent.name}" en sección "${selectedTier.section}" (${stadiumName})!`
      );
      setActiveTab('mis-boletos');
      setTimeout(() => setPurchaseSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Error al comprar boleto:', err);
    } finally {
      setPurchasing(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'todos') return true;
    return t.status === filter;
  });

  // Agrupación visual de boletos comprados juntos mediante purchaseId
  const groupedTickets = useMemo(() => {
    const groups: {
      key: string;
      purchaseId: string;
      tickets: Ticket[];
      matchTitle: string;
      matchDate: string;
      stadium: string;
    }[] = [];

    const map = new Map<string, Ticket[]>();
    const singles: Ticket[] = [];

    for (const t of filteredTickets) {
      if (t.purchaseId) {
        if (!map.has(t.purchaseId)) {
          map.set(t.purchaseId, []);
        }
        map.get(t.purchaseId)!.push(t);
      } else {
        singles.push(t);
      }
    }

    for (const [pId, tList] of map.entries()) {
      if (tList.length > 1) {
        groups.push({
          key: pId,
          purchaseId: pId,
          tickets: tList,
          matchTitle: tList[0]?.matchTitle || '',
          matchDate: tList[0]?.matchDate || '',
          stadium: tList[0]?.stadium || '',
        });
      } else {
        singles.push(...tList);
      }
    }

    return { groups, singles };
  }, [filteredTickets]);

  return (
    <div className="space-y-6">
      {/* Alerta de Éxito al Comprar */}
      {purchaseSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs sm:text-sm font-semibold animate-in fade-in duration-150">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{purchaseSuccessMsg}</span>
        </div>
      )}

      {/* Selector de Pestañas Superior: Mis Boletos vs Comprar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <TicketIcon className="w-5 h-5 text-red-700" />
            <span>{t('tickets.title', 'Boletos & Entradas al Estadio')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('tickets.qr_hint', 'Acceso digital con código QR de seguridad y compra de entradas para partidos programados.')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            id="tab-mis-boletos"
            onClick={() => setActiveTab('mis-boletos')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'mis-boletos'
                ? 'bg-white text-red-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('aficionado.tab.tickets', 'Mis Boletos')} ({tickets.length})
          </button>
          <button
            id="tab-comprar-boletos"
            onClick={() => setActiveTab('comprar')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'comprar'
                ? 'bg-red-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('tickets.buy_btn', 'Comprar Boleto')}</span>
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: MIS BOLETOS DIGITALES */}
      {activeTab === 'mis-boletos' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                onClick={() => setFilter('todos')}
                className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                  filter === 'todos'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('tickets.filter.all', 'Todos')} ({tickets.length})
              </button>
              <button
                onClick={() => setFilter('activo')}
                className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                  filter === 'activo'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('tickets.filter.active', 'Activos')} ({tickets.filter((t) => t.status === 'activo').length})
              </button>
              <button
                onClick={() => setFilter('usado')}
                className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                  filter === 'usado'
                    ? 'bg-white text-slate-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('tickets.filter.used', 'Utilizados')} ({tickets.filter((t) => t.status === 'usado').length})
              </button>
            </div>

            <button
              onClick={() => setActiveTab('comprar')}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t('tickets.buy_btn', 'Nueva Entrada')}</span>
            </button>
          </div>

          {/* Listado de Boletos */}
          {loadingTickets ? (
            <LoadingSpinner message="Cargando tus boletos desde Firestore..." />
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto">
                <TicketIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  No tienes boletos{' '}
                  {filter !== 'todos' ? `en estado "${filter}"` : 'disponibles'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Aquí se mostrarán tus pases de acceso con código QR dinámico para ingresar a los partidos del estadio.
                </p>
              </div>
              <button
                id="btn-comprar-primer-boleto"
                onClick={() => setActiveTab('comprar')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Comprar mi Primer Boleto
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grupos de Boletos de Compra Conjunta */}
              {groupedTickets.groups.map((grp) => (
                <div
                  key={grp.key}
                  className="bg-slate-50/80 p-4 rounded-3xl border border-slate-200 space-y-3 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                      <span className="font-black text-slate-900">
                        Compra Conjunta ({grp.tickets.length} entradas)
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[11px] text-slate-600 font-bold">
                        Ref: #{grp.purchaseId.slice(-7)}
                      </span>
                    </div>
                    <span className="text-slate-500 font-semibold">
                      {grp.matchTitle} • Total: ${grp.tickets.reduce((sum, t) => sum + (t.price || 0), 0)} MXN
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {grp.tickets.map((ticket) => (
                      <TicketCard key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Boletos Individuales */}
              {groupedTickets.singles.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: SECCIÓN COMPRAR BOLETO REAL */}
      {activeTab === 'comprar' && (
        <div className="space-y-6">
          {/* Selector de Sede / Recinto Deportivo */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <label
                  htmlFor="select-venue-tickets"
                  className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4 text-red-600" />
                  Sede o Recinto Deportivo
                </label>
                <p className="text-xs text-slate-500">
                  Selecciona la sede o estadio para consultar sus eventos próximos y comprar tus entradas
                </p>
              </div>

              {/* Selector dropdown estilizado */}
              <div className="relative min-w-[260px] sm:min-w-[320px]">
                <select
                  id="select-venue-tickets"
                  value={selectedVenueId}
                  onChange={(e) => setSelectedVenueId(e.target.value)}
                  disabled={loadingVenues || venues.length === 0}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-colors appearance-none cursor-pointer"
                >
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} — {venue.city}, {venue.state}
                    </option>
                  ))}
                </select>
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Tarjeta con detalles de la sede seleccionada */}
            {currentVenue && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-slate-900">{currentVenue.name}</span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    {currentVenue.address || `${currentVenue.city}, ${currentVenue.state}`}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {loadingEvents
                    ? 'Cargando cartelera...'
                    : `${activeEvents.length} ${
                        activeEvents.length === 1
                          ? 'evento próximo disponible'
                          : 'eventos próximos disponibles'
                      }`}
                </span>
              </div>
            )}
          </div>

          {loadingEvents ? (
            <LoadingSpinner message={`Consultando cartelera de eventos para ${stadiumName}...`} />
          ) : activeEvents.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-8 sm:p-12 text-center space-y-3">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">
                No hay eventos con venta abierta en {stadiumName}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                La administración de este recinto aún no ha publicado eventos activos o habilitado la taquilla. Puedes seleccionar otra sede en el menú superior para revisar otros partidos o espectáculos.
              </p>
              <button
                onClick={() => setActiveTab('mis-boletos')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Volver a Mis Boletos
              </button>
            </div>
          ) : showSeatMap && selectedEvent ? (
            /* VISTA DEL MAPA DE ASIENTOS REAL */
            <SeatMapSelector
              event={selectedEvent}
              user={user}
              stadiumName={stadiumName}
              onPurchaseSuccess={(purchaseId, count) => {
                setPurchaseSuccessMsg(
                  `¡Compra completada con éxito! Se emitieron ${count} entrada(s) con identificador de compra #${purchaseId.slice(-7)}.`
                );
                setShowSeatMap(false);
                setActiveTab('mis-boletos');
                setTimeout(() => setPurchaseSuccessMsg(null), 7000);
              }}
              onCancel={() => setShowSeatMap(false)}
            />
          ) : (
            <div className="space-y-6">
              {/* Encabezado de Cartelera */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-red-700">
                      Cartelera Oficial
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                    Próximos Partidos & Espectáculos en {stadiumName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Elige el evento para ingresar a la selección de butacas en el mapa interactivo del estadio.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    {activeEvents.length} eventos en venta
                  </span>
                </div>
              </div>

              {/* Grid de Cartelera de Eventos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeEvents.map((ev) => {
                  const minPrice =
                    ev.priceTiers && ev.priceTiers.length > 0
                      ? Math.min(...ev.priceTiers.map((t) => t.price))
                      : 0;
                  const posterSrc = ev.posterUrl || getEventPosterPlaceholder(ev.type);

                  return (
                    <div
                      key={ev.id}
                      className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Póster Promocional del Evento */}
                        <div className="relative aspect-4/3 sm:aspect-3/4 overflow-hidden bg-slate-900">
                          <img
                            src={posterSrc}
                            alt={ev.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-black/20" />

                          {/* Badges superiores */}
                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-700/90 backdrop-blur-xs text-white border border-red-500/50 shadow-xs">
                              {ev.type}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600/90 backdrop-blur-xs text-white border border-emerald-400/50 shadow-xs flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                              Venta Abierta
                            </span>
                          </div>

                          {/* Información superpuesta al pie del póster */}
                          <div className="absolute bottom-3 left-3 right-3 text-white space-y-1">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300">
                              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{ev.date}</span>
                              <span>•</span>
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{ev.time || '20:00 hrs'}</span>
                            </div>
                            <h4 className="text-base font-black text-white leading-snug line-clamp-2">
                              {ev.name}
                            </h4>
                          </div>
                        </div>

                        {/* Metadatos y detalles */}
                        <div className="p-4 space-y-3">
                          {ev.opponent && (
                            <p className="text-xs text-slate-600 font-medium">
                              Rival: <span className="font-bold text-slate-900">{ev.opponent}</span>
                            </p>
                          )}

                          <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1 truncate max-w-[170px]">
                              <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              <span className="truncate">{stadiumName}</span>
                            </span>
                            {ev.gate && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                                <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                                {ev.gate}
                              </span>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                            <span className="text-xs text-slate-500">Boletos desde</span>
                            <span className="text-lg font-black text-red-900">
                              ${minPrice} <span className="text-xs font-normal text-slate-500">MXN</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botón principal: Ver Boletos (Abre Mapa de Asientos) */}
                      <div className="p-4 pt-0 space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setShowSeatMap(true);
                          }}
                          className="w-full py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <TicketIcon className="w-4 h-4" />
                          <span>Ver Boletos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setSelectedTier(ev.priceTiers?.[0] || null);
                            setQuickBuyEvent(ev);
                          }}
                          className="w-full py-1 text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          O comprar rápido sin mapa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal de Compra Rápida sin mapa (opcional para usuarios rápidos) */}
              {quickBuyEvent && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-700 block">
                          Compra Rápida
                        </span>
                        <h3 className="text-base font-black text-slate-900 leading-tight">
                          {quickBuyEvent.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => setQuickBuyEvent(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">
                          Selecciona la sección
                        </label>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {quickBuyEvent.priceTiers && quickBuyEvent.priceTiers.length > 0 ? (
                            quickBuyEvent.priceTiers.map((tier, idx) => {
                              const isTierSelected = selectedTier?.section === tier.section;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTier(tier)}
                                  className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer text-xs ${
                                    isTierSelected
                                      ? 'border-red-600 bg-red-50 text-red-950 font-bold ring-1 ring-red-600'
                                      : 'border-slate-200 hover:border-slate-300 bg-white'
                                  }`}
                                >
                                  <span>{tier.section}</span>
                                  <span className="font-black text-red-900">${tier.price} MXN</span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-400">Sin secciones disponibles</p>
                          )}
                        </div>
                      </div>

                      {/* Método de pago */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">
                          Método de pago
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('Efectivo / Terminal física en Taquilla')}
                            className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                              paymentMethod === 'Efectivo / Terminal física en Taquilla'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                            }`}
                          >
                            💵 Taquilla
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('Tarjeta en Línea')}
                            className={`p-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                              paymentMethod === 'Tarjeta en Línea'
                                ? 'border-red-600 bg-red-50 text-red-950'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                            }`}
                          >
                            💳 En Línea
                          </button>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">Total:</span>
                        <span className="text-base font-black text-red-900">
                          ${selectedTier?.price || 0} MXN
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickBuyEvent(null);
                          setShowSeatMap(true);
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                      >
                        Ver Mapa
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleConfirmPurchase();
                          setQuickBuyEvent(null);
                        }}
                        disabled={purchasing || !selectedTier}
                        className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer text-center"
                      >
                        {purchasing ? 'Emitiendo...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

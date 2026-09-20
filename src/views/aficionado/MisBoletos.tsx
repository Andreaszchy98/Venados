import React, { useState, useEffect, useMemo } from 'react';
import { Ticket, UserProfile, VenueEvent, EventPriceTier, Venue } from '../../types';
import { subscribeUserTickets, purchaseTicketWithSaleRecord } from '../../lib/tickets';
import {
  getActiveEventsForVenue,
  subscribeVenueEvents,
  getEventPosterPlaceholder,
  getVenueEventById,
} from '../../lib/venueEvents';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { subscribeVenues, getAllVenues } from '../../lib/venues';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { getOfficialPriceTiersForEvent } from '../../lib/seatMap';
import { TicketCard } from '../../components/shared/TicketCard';
import { BoletoDetalle } from './BoletoDetalle';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { SeatMapSelector } from './SeatMapSelector';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
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
  ChevronRight,
  Users,
  Grid,
  QrCode,
  XCircle,
} from 'lucide-react';

interface MisBoletosProps {
  user: UserProfile;
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
  selectedVenueId?: string;
  onSelectVenue?: (venueId: string) => void;
  onRequireAuth?: () => void;
  onNavigateToCartelera?: () => void;
}

export const MisBoletos: React.FC<MisBoletosProps> = ({
  user,
  initialEventId,
  onClearInitialEvent,
  selectedVenueId: propSelectedVenueId,
  onSelectVenue,
  onRequireAuth,
  onNavigateToCartelera,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'mis-boletos' | 'comprar'>('mis-boletos');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'activo' | 'usado'>('todos');
  const [ticketVenueFilter, setTicketVenueFilter] = useState<string>('todas');

  // Sedes disponibles
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    propSelectedVenueId || user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID
  );

  // Sincronizar si la sede cambia desde la pantalla principal
  useEffect(() => {
    if (propSelectedVenueId && propSelectedVenueId !== selectedVenueId) {
      setSelectedVenueId(propSelectedVenueId);
    }
  }, [propSelectedVenueId]);

  // Eventos activos en venta para la sede seleccionada
  const [activeEvents, setActiveEvents] = useState<VenueEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Detalle de boleto a pantalla completa
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketSiblings, setSelectedTicketSiblings] = useState<Ticket[]>([]);
  const [selectedEventPoster, setSelectedEventPoster] = useState<VenueEvent | null>(null);

  // Obtener póster/evento del boleto en detalle
  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedEventPoster(null);
      return;
    }
    const ticket = tickets.find((t) => t.id === selectedTicketId);
    if (!ticket) return;

    const found = activeEvents.find((e) => e.id === ticket.eventId);
    if (found) {
      setSelectedEventPoster(found);
    } else if (ticket.eventId) {
      getVenueEventById(ticket.eventId).then((ev) => {
        if (ev) setSelectedEventPoster(ev);
      });
    }
  }, [selectedTicketId, tickets, activeEvents]);

  // Selección de compra (Exclusivo Tarjeta en Línea)
  const [selectedEvent, setSelectedEvent] = useState<VenueEvent | null>(null);
  const [selectedTier, setSelectedTier] = useState<EventPriceTier | null>(null);
  const [paymentMethod] = useState<'Tarjeta en Línea'>('Tarjeta en Línea');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = useState<string | null>(null);
  const [showSeatMap, setShowSeatMap] = useState<boolean>(false);
  const [quickBuyEvent, setQuickBuyEvent] = useState<VenueEvent | null>(null);

  // Escuchar boletos del aficionado
  useEffect(() => {
    if (!user || !user.uid) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
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
  }, [user?.uid]);

  // Escuchar sedes en tiempo real
  useEffect(() => {
    setLoadingVenues(true);
    const unsubscribe = subscribeVenues(
      (venuesList) => {
        setVenues(venuesList);
        setLoadingVenues(false);
        if (venuesList.length > 0) {
          setSelectedVenueId((prev) => {
            if (propSelectedVenueId && venuesList.some((v) => v.id === propSelectedVenueId)) {
              return propSelectedVenueId;
            }
            if (prev && venuesList.some((v) => v.id === prev)) {
              return prev;
            }
            const preferred = user.browsingVenueId || user.venueId;
            return preferred && venuesList.some((v) => v.id === preferred)
              ? preferred
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
              if (propSelectedVenueId && venuesList.some((v) => v.id === propSelectedVenueId)) {
                return propSelectedVenueId;
              }
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
  }, [user.browsingVenueId, user.venueId, propSelectedVenueId]);

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

    if (!user || !user.uid) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

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

  // Sedes dinámicas donde el usuario realmente tiene boletos registrados
  const userTicketVenues = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => {
      const vId = t.venueId || DEFAULT_VENUE_ID;
      const vName = t.stadium || venues.find((v) => v.id === vId)?.name || 'Estadio Deportivo';
      if (!map.has(vId)) {
        map.set(vId, vName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tickets, venues]);

  const filteredTickets = tickets.filter((t) => {
    const statusMatch = filter === 'todos' || t.status === filter;
    if (!statusMatch) return false;
    if (ticketVenueFilter !== 'todas') {
      return (t.venueId || DEFAULT_VENUE_ID) === ticketVenueFilter;
    }
    return true;
  });

  // Agrupación en Compras Compactas (1 sola fila por Compra Conjunta o boleto individual)
  const compactPurchases = useMemo(() => {
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

    const list: {
      key: string;
      purchaseId?: string;
      tickets: Ticket[];
      matchTitle: string;
      matchDate: string;
      matchTime?: string;
      stadium: string;
      totalPrice: number;
    }[] = [];

    // Agregar compras conjuntas
    for (const [pId, tList] of map.entries()) {
      list.push({
        key: pId,
        purchaseId: pId,
        tickets: tList,
        matchTitle: tList[0]?.matchTitle || 'Evento Deportivo',
        matchDate: tList[0]?.matchDate || '',
        matchTime: tList[0]?.matchTime,
        stadium: tList[0]?.stadium || 'Estadio',
        totalPrice: tList.reduce((sum, t) => sum + (t.price || 0), 0),
      });
    }

    // Agregar boletos individuales
    for (const t of singles) {
      list.push({
        key: t.id,
        purchaseId: t.purchaseId,
        tickets: [t],
        matchTitle: t.matchTitle || 'Evento Deportivo',
        matchDate: t.matchDate || '',
        matchTime: t.matchTime,
        stadium: t.stadium || 'Estadio',
        totalPrice: t.price || 0,
      });
    }

    return list;
  }, [filteredTickets]);

  // Formatear zona, fila y butacas combinadas en una sola línea (estilo Cinépolis)
  const formatSeatsLine = (ticketsList: Ticket[]) => {
    if (!ticketsList || ticketsList.length === 0) return { section: '', row: '', butacas: '' };

    const cleanSeat = (s: string) => (s || '').replace(/^(Butaca|Asiento)\s*/i, '').trim();

    if (ticketsList.length === 1) {
      const t = ticketsList[0];
      return {
        section: t.section,
        row: t.row.startsWith('Fila') ? t.row : `Fila ${t.row}`,
        butacas: `Butaca ${cleanSeat(t.seat)}`,
      };
    }

    const first = ticketsList[0];
    const sameSection = ticketsList.every((t) => t.section === first.section);
    const sameRow = ticketsList.every((t) => t.row === first.row);
    const seatNumbers = ticketsList.map((t) => cleanSeat(t.seat)).join(', ');

    if (sameSection && sameRow) {
      return {
        section: first.section,
        row: first.row.startsWith('Fila') ? first.row : `Fila ${first.row}`,
        butacas: `Butacas ${seatNumbers}`,
      };
    }

    if (sameSection) {
      const seats = ticketsList
        .map((t) => `F${t.row}: B${cleanSeat(t.seat)}`)
        .join(', ');
      return {
        section: first.section,
        row: 'Varias filas',
        butacas: seats,
      };
    }

    // Diferentes secciones
    const seats = ticketsList
      .map((t) => `${t.section} F${t.row}-B${cleanSeat(t.seat)}`)
      .join(', ');
    return {
      section: `${ticketsList.length} Secciones`,
      row: 'Múltiples',
      butacas: seats,
    };
  };

  // Determinar badge de estado combinado
  const getStatusBadge = (ticketsList: Ticket[]) => {
    const activeCount = ticketsList.filter((t) => t.status === 'activo').length;
    const usedCount = ticketsList.filter((t) => t.status === 'usado').length;
    const cancelledCount = ticketsList.filter((t) => t.status === 'cancelado').length;

    if (activeCount === ticketsList.length) {
      return {
        status: 'activo',
        label: 'Acceso Válido',
        Icon: CheckCircle2,
        badgeClass:
          theme === 'light'
            ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
            : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
        iconClass: 'text-emerald-600',
      };
    }

    if (usedCount === ticketsList.length) {
      return {
        status: 'usado',
        label: 'Utilizado',
        Icon: Clock,
        badgeClass:
          theme === 'light'
            ? 'bg-slate-200 text-slate-800 border-slate-300'
            : 'bg-slate-800 text-slate-300 border-slate-700',
        iconClass: 'text-slate-500',
      };
    }

    if (cancelledCount === ticketsList.length) {
      return {
        status: 'cancelado',
        label: 'Cancelado',
        Icon: XCircle,
        badgeClass:
          theme === 'light'
            ? 'bg-red-100 text-red-950 border-red-300'
            : 'bg-red-950/80 text-red-300 border-red-500/40',
        iconClass: 'text-red-500',
      };
    }

    // Uso parcial si hay una mezcla
    return {
      status: 'parcial',
      label: 'Parcialmente Utilizado',
      Icon: Clock,
      badgeClass:
        theme === 'light'
          ? 'bg-amber-100 text-amber-950 border-amber-300'
          : 'bg-amber-950/80 text-amber-300 border-amber-500/40',
      iconClass: 'text-amber-600',
    };
  };

  // Vista dedicada a pantalla completa para el boleto seleccionado
  if (selectedTicketId) {
    const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
    if (selectedTicket) {
      return (
        <BoletoDetalle
          ticket={selectedTicket}
          siblingTickets={selectedTicketSiblings.length > 0 ? selectedTicketSiblings : [selectedTicket]}
          event={selectedEventPoster}
          onBack={() => {
            setSelectedTicketId(null);
            setSelectedTicketSiblings([]);
          }}
          onSelectTicket={(newId) => {
            setSelectedTicketId(newId);
          }}
        />
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Éxito al Comprar */}
      {purchaseSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs sm:text-sm font-semibold animate-in fade-in duration-150">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{purchaseSuccessMsg}</span>
        </div>
      )}

      {/* Encabezado limpio y sin redundancias */}
      <div className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-md transition-colors ${
        theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
      }`}>
        <div className="flex items-center gap-2.5">
          <h2 className={`text-sm sm:text-base font-black flex items-center gap-2 tracking-wide font-sports uppercase ${
            theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
          }`}>
            <TicketIcon className="w-5 h-5 text-red-500 shrink-0" />
            <span>{activeTab === 'comprar' ? 'Partidos Disponibles' : 'Mis Boletos Comprados'}</span>
          </h2>

          <span
            id="info-counter-mis-boletos"
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-sports border ${
              theme === 'light' ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-[#141C2E] text-slate-300 border-slate-700'
            }`}
          >
            {tickets.length} {tickets.length === 1 ? 'boleto' : 'boletos'}
          </span>
        </div>

        <div>
          {activeTab === 'mis-boletos' ? (
            <button
              id="btn-action-comprar-boletos"
              type="button"
              onClick={() => {
                if (onNavigateToCartelera) {
                  onNavigateToCartelera();
                } else {
                  setActiveTab('comprar');
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-sports font-bold tracking-wider text-xs rounded-xl shadow-md shadow-red-950/40 transition-all cursor-pointer shrink-0 uppercase"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t('tickets.buy_tickets', 'Comprar Boletos')}</span>
            </button>
          ) : (
            <button
              id="btn-action-volver-mis-boletos"
              type="button"
              onClick={() => setActiveTab('mis-boletos')}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 font-sports font-bold tracking-wider text-xs rounded-xl border transition-all cursor-pointer shrink-0 uppercase ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-[#141C2E] hover:bg-[#1A253D] text-slate-200 border-slate-700'
              }`}
            >
              <TicketIcon className="w-3.5 h-3.5 text-red-500" />
              <span>{t('tickets.view_my_tickets', 'Ver Mis Boletos')}</span>
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: MIS BOLETOS DIGITALES */}
      {activeTab === 'mis-boletos' && (!user || !user.uid) && (
        <div className={`py-12 px-4 max-w-md mx-auto text-center space-y-5 p-6 sm:p-8 rounded-3xl border shadow-xl ${
          theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
        }`}>
          <div className="w-16 h-16 rounded-3xl bg-red-900/20 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto shadow-md">
            <TicketIcon className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className={`text-xl font-black font-sports tracking-wide uppercase ${
              theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
            }`}>
              Inicia sesión para ver tus boletos
            </h3>
            <p className={`text-xs sm:text-sm leading-relaxed ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Accede a tus entradas digitales con código QR para ingresar por torniquetes y consulta tus butacas asignadas.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              id="btn-login-boletos-guest"
              type="button"
              onClick={onRequireAuth}
              className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-sports font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/50 transition-colors cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comprar')}
              className={`w-full sm:w-auto px-6 py-3 font-sports font-bold text-xs uppercase tracking-wider rounded-xl border transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-[#141C2E] hover:bg-[#1A253D] text-slate-200 border-slate-700'
              }`}
            >
              Ver Cartelera de Boletos
            </button>
          </div>
        </div>
      )}

      {activeTab === 'mis-boletos' && user && user.uid && (
        <div className="space-y-4">
          {/* Barra de Filtros: Estado + Filtro desplegable de Sedes */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border shadow-xl ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}>
            <div className={`inline-flex rounded-xl p-1 border text-xs font-sports ${
              theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-[#0A0E17] border-slate-800'
            }`}>
              <button
                id="ticket-filter-all"
                onClick={() => setFilter('todos')}
                className={`px-3 py-1 font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider ${
                  filter === 'todos'
                    ? 'bg-red-600 text-white shadow-md'
                    : theme === 'light'
                    ? 'text-slate-700 hover:text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('tickets.filter.all', 'Todos')} ({tickets.length})
              </button>
              <button
                id="ticket-filter-active"
                onClick={() => setFilter('activo')}
                className={`px-3 py-1 font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider ${
                  filter === 'activo'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : theme === 'light'
                    ? 'text-slate-700 hover:text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('tickets.filter.active', 'Activos')} ({tickets.filter((t) => t.status === 'activo').length})
              </button>
              <button
                id="ticket-filter-used"
                onClick={() => setFilter('usado')}
                className={`px-3 py-1 font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider ${
                  filter === 'usado'
                    ? 'bg-slate-700 text-white shadow-md'
                    : theme === 'light'
                    ? 'text-slate-700 hover:text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('tickets.filter.used', 'Utilizados')} ({tickets.filter((t) => t.status === 'usado').length})
              </button>
            </div>

            {/* Filtro por sede como <select> simple con etiqueta "Ver boletos de:" */}
            <div className="flex items-center gap-2 text-xs">
              <label
                htmlFor="ticket-venue-filter-select"
                className={`font-sports font-bold uppercase tracking-wider shrink-0 ${
                  theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                }`}
              >
                Ver boletos de:
              </label>
              <div className="relative min-w-[170px] sm:min-w-[220px]">
                <select
                  id="ticket-venue-filter-select"
                  value={ticketVenueFilter}
                  onChange={(e) => setTicketVenueFilter(e.target.value)}
                  className={`w-full pl-3 pr-8 py-1.5 border rounded-xl text-xs font-sports font-bold focus:outline-none focus:ring-2 focus:ring-red-600 appearance-none cursor-pointer transition-colors ${
                    theme === 'light'
                      ? 'bg-slate-50 hover:bg-white border-slate-300 text-slate-900'
                      : 'bg-[#0A0E17] hover:bg-[#141C2E] border-slate-700 text-white'
                  }`}
                >
                  <option value="todas" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#0A0E17] text-white'}>
                    Todas las sedes ({tickets.length})
                  </option>
                  {userTicketVenues.map((v) => {
                    const count = tickets.filter((t) => (t.venueId || DEFAULT_VENUE_ID) === v.id).length;
                    return (
                      <option
                        key={v.id}
                        value={v.id}
                        className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#0A0E17] text-white'}
                      >
                        {v.name} ({count})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`} />
              </div>
            </div>
          </div>

          {/* Listado de Boletos */}
          {loadingTickets ? (
            <LoadingSpinner message="Cargando tus boletos desde Firestore..." />
          ) : filteredTickets.length === 0 ? (
            <div className={`border border-dashed rounded-3xl p-8 sm:p-12 text-center space-y-4 ${
              theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#0F1626] border-slate-700'
            }`}>
              <div className="w-14 h-14 rounded-2xl bg-red-900/20 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto">
                <TicketIcon className="w-7 h-7" />
              </div>
              <div>
                <h3 className={`text-base sm:text-lg font-black font-sports tracking-wide uppercase ${
                  theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                }`}>
                  {filter !== 'todos' ? `No tienes boletos en estado "${filter}"` : 'Aún no tienes boletos registrados'}
                </h3>
                <p className={`text-xs sm:text-sm max-w-md mx-auto mt-1 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  Elige tus partidos en cartelera y adquiere tus accesos digitales con código QR para ingresar a los torniquetes.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToCartelera) {
                      onNavigateToCartelera();
                    } else {
                      setActiveTab('comprar');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-sports font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/50 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Explorar Cartelera de Partidos</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {compactPurchases.map((purchase) => {
                const seats = formatSeatsLine(purchase.tickets);
                const badge = getStatusBadge(purchase.tickets);
                const BadgeIcon = badge.Icon;
                const isJoint = purchase.tickets.length > 1;

                return (
                  <button
                    key={purchase.key}
                    id={`compact-ticket-row-${purchase.key}`}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(purchase.tickets[0].id);
                      setSelectedTicketSiblings(purchase.tickets);
                    }}
                    className={`w-full p-3.5 sm:p-4 rounded-2xl border shadow-xs text-left flex items-center justify-between gap-3 sm:gap-4 transition-all cursor-pointer group ${
                      theme === 'light'
                        ? 'bg-white border-slate-200 hover:border-red-400 hover:bg-red-50/30 active:bg-red-100/50 text-slate-900'
                        : 'bg-[#0F1626] border-slate-700/80 hover:border-red-500/60 hover:bg-[#141C2E] active:bg-[#182338] text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      {/* Ícono / Miniatura de QR estilizada */}
                      <div
                        className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-transform group-hover:scale-105 ${
                          theme === 'light'
                            ? 'bg-slate-100 border-slate-300 text-slate-800'
                            : 'bg-[#0A0E17] border-slate-700 text-slate-200'
                        }`}
                      >
                        <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                        {isJoint && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-red-600 text-white shadow-xs font-sports leading-none">
                            x{purchase.tickets.length}
                          </span>
                        )}
                      </div>

                      {/* Bloque central de datos en 3 líneas */}
                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                        {/* 1. Nombre del evento (una sola línea con truncate) */}
                        <div className="flex items-center gap-2 min-w-0">
                          <h4
                            className={`text-xs sm:text-sm font-black font-sports truncate leading-tight ${
                              theme === 'light' ? 'text-slate-900' : 'text-white'
                            }`}
                            title={purchase.matchTitle}
                          >
                            {purchase.matchTitle}
                          </h4>
                          {isJoint && (
                            <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600/10 text-red-600 dark:bg-red-950/60 dark:text-red-300 font-sports shrink-0 border border-red-500/20">
                              {purchase.tickets.length} Boletos
                            </span>
                          )}
                        </div>

                        {/* 2. Fecha corta y sede */}
                        <p
                          className={`text-[11px] sm:text-xs truncate flex items-center gap-1.5 ${
                            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 font-semibold shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            {purchase.matchDate} {purchase.matchTime && `• ${purchase.matchTime}`}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {purchase.stadium}
                          </span>
                        </p>

                        {/* 3. Zona/sección, fila, y butacas combinadas en UNA sola línea */}
                        <p className="text-[11px] sm:text-xs font-bold flex items-center gap-1.5 flex-wrap truncate">
                          <span className={theme === 'light' ? 'text-slate-900' : 'text-white'}>
                            {seats.section}
                          </span>
                          <span className={theme === 'light' ? 'text-slate-300' : 'text-slate-600'}>•</span>
                          <span className={`font-mono ${theme === 'light' ? 'text-amber-800' : 'text-amber-400'}`}>
                            {seats.row}
                          </span>
                          <span className={theme === 'light' ? 'text-slate-300' : 'text-slate-600'}>•</span>
                          <span className={`font-mono ${theme === 'light' ? 'text-red-700' : 'text-red-400'}`}>
                            {seats.butacas}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Bloque derecho: Badge de estado y flecha para indicar interactividad */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border font-sports whitespace-nowrap ${badge.badgeClass}`}
                      >
                        <BadgeIcon className={`w-3 h-3 ${badge.iconClass} shrink-0`} />
                        <span>{badge.label}</span>
                      </span>

                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: SECCIÓN COMPRAR BOLETO REAL */}
      {activeTab === 'comprar' && (
        <div className="space-y-6">
          {loadingEvents ? (
            <LoadingSpinner message={`Consultando cartelera de eventos para ${stadiumName}...`} />
          ) : activeEvents.length === 0 ? (
            <div className={`border border-dashed rounded-3xl p-8 sm:p-12 text-center space-y-3 ${
              theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#0F1626] border-slate-700'
            }`}>
              <Calendar className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className={`text-base font-black font-sports tracking-wide uppercase ${
                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
              }`}>
                No hay eventos con venta abierta en {stadiumName}
              </h3>
              <p className={`text-xs max-w-md mx-auto ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                La administración de este recinto aún no ha publicado eventos activos o habilitado la taquilla. Puedes seleccionar otra sede en el menú superior para revisar otros partidos o espectáculos.
              </p>
              <button
                onClick={() => setActiveTab('mis-boletos')}
                className={`px-4 py-2 rounded-xl text-xs font-sports font-bold tracking-wider border transition-colors cursor-pointer uppercase ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-[#141C2E] hover:bg-[#1A253D] text-slate-200 border-slate-700'
                }`}
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
              onRequireAuth={onRequireAuth}
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
              {/* Grid de Cartelera de Eventos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeEvents.map((ev) => {
                  const minPrice =
                    ev.priceTiers && ev.priceTiers.length > 0
                      ? Math.min(...ev.priceTiers.map((t) => t.price))
                      : 0;
                  const posterSrc = normalizeGoogleDriveImageUrl(ev.posterUrl) || getEventPosterPlaceholder(ev.type);

                  return (
                    <div
                      key={ev.id}
                      className={`rounded-3xl border overflow-hidden shadow-xl transition-all flex flex-col justify-between group ${
                        theme === 'light'
                          ? 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                          : 'bg-[#0F1626] border-slate-700/80 text-white hover:border-slate-600'
                      }`}
                    >
                      <div>
                        {/* Póster Promocional del Evento (completo y sin recortes) */}
                        <div className="relative aspect-16/9 sm:aspect-16/10 overflow-hidden bg-slate-950 flex items-center justify-center">
                          {/* Fondo con blur ambiental para dar profundidad sin distorsión */}
                          <img
                            src={posterSrc}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                          {/* Imagen principal: object-contain para mostrarla 100% íntegra */}
                          <img
                            src={posterSrc}
                            alt={ev.name}
                            className="relative z-10 w-full h-full object-contain group-hover:scale-102 transition-transform duration-300 drop-shadow-md"
                            referrerPolicy="no-referrer"
                          />

                          {/* Badges superiores */}
                          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/90 backdrop-blur-xs text-white border border-red-500/50 shadow-xs font-sports">
                              {ev.type}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600/90 backdrop-blur-xs text-white border border-emerald-400/50 shadow-xs flex items-center gap-1 font-sports">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                              Venta Abierta
                            </span>
                          </div>
                        </div>

                        {/* Metadatos y detalles en el cuerpo de la tarjeta para no tapar el póster */}
                        <div className="p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-red-500 font-sports tracking-wider">
                            <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span>{ev.date}</span>
                            <span>•</span>
                            <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span>{ev.time || '20:00 hrs'}</span>
                          </div>

                          <h4 className={`text-base font-black leading-snug line-clamp-2 font-sports tracking-wide ${
                            theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                          }`}>
                            {ev.name}
                          </h4>

                          {ev.opponent && (
                            <p className={`text-xs font-medium ${
                              theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                            }`}>
                              Rival: <span className={`font-bold ${
                                theme === 'light' ? 'text-slate-950' : 'text-white'
                              }`}>{ev.opponent}</span>
                            </p>
                          )}

                          <div className={`flex items-center justify-between text-xs pt-0.5 ${
                            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            <span className="flex items-center gap-1 truncate max-w-[170px]">
                              <MapPin className={`w-3.5 h-3.5 shrink-0 ${
                                theme === 'light' ? 'text-amber-600' : 'text-amber-400'
                              }`} />
                              <span className="truncate">{stadiumName}</span>
                            </span>
                            {ev.gate && (
                              <span className={`flex items-center gap-1 text-[11px] shrink-0 ${
                                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                              }`}>
                                <DoorOpen className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-500'}`} />
                                {ev.gate}
                              </span>
                            )}
                          </div>

                          <div className={`pt-2 border-t flex items-baseline justify-between ${
                            theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                          }`}>
                            <span className={`text-xs font-sports uppercase tracking-wider ${
                              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                            }`}>
                              Boletos desde
                            </span>
                            <span className={`text-lg font-scoreboard font-bold ${
                              theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                            }`}>
                              ${minPrice} <span className={`text-xs font-normal ${
                                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                              }`}>MXN</span>
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
                          className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-sports font-bold tracking-wider uppercase shadow-lg shadow-red-950/50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <TicketIcon className="w-4 h-4" />
                          <span>Ver Boletos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEvent(ev);
                            const sanitizedTiers = getOfficialPriceTiersForEvent(ev, stadiumName);
                            const sanitizedEv = { ...ev, priceTiers: sanitizedTiers };
                            setSelectedTier(sanitizedTiers[0] || null);
                            setQuickBuyEvent(sanitizedEv);
                          }}
                          className={`w-full py-1 text-center text-[11px] font-sports font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                            theme === 'light'
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'text-slate-400 hover:text-white'
                          }`}
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
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-900'
                      : 'bg-[#0F1626] border-slate-700/80 text-white'
                  }`}>
                    <div className={`flex items-center justify-between pb-3 border-b ${
                      theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                    }`}>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-500 block font-sports">
                          Compra Rápida
                        </span>
                        <h3 className={`text-base font-black leading-tight font-sports tracking-wide ${
                          theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                        }`}>
                          {quickBuyEvent.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => setQuickBuyEvent(null)}
                        className={`p-1.5 rounded-xl cursor-pointer ${
                          theme === 'light'
                            ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className={`text-xs font-bold block mb-1.5 font-sports uppercase tracking-wider ${
                          theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                        }`}>
                          Selecciona la sección
                        </label>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {(() => {
                            const tiers = getOfficialPriceTiersForEvent(quickBuyEvent, stadiumName);
                            if (tiers.length === 0) {
                              return (
                                <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                  Sin secciones disponibles
                                </p>
                              );
                            }
                            return tiers.map((tier, idx) => {
                              const isTierSelected = selectedTier?.section === tier.section;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTier(tier)}
                                  className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer text-xs font-sports ${
                                    isTierSelected
                                      ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 font-bold ring-1 ring-red-500'
                                      : theme === 'light'
                                      ? 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-800'
                                      : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-300'
                                  }`}
                                >
                                  <span>{tier.section}</span>
                                  <span className={`font-scoreboard font-bold ${
                                    theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                                  }`}>${tier.price} MXN</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Método de pago (Exclusivo Tarjeta en Línea) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={`text-xs font-bold font-sports uppercase tracking-wider ${
                            theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                          }`}>
                            Método de pago
                          </label>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-sports">
                            SSL Seguro
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between font-sports ${
                          theme === 'light'
                            ? 'border-red-500 bg-red-50/70 text-red-900'
                            : 'border-red-500/50 bg-red-950/40 text-red-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">💳</span>
                            <div>
                              <p className="text-xs font-black uppercase">Tarjeta en Línea</p>
                              <p className={`text-[10px] font-sans ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                Visa, Mastercard, Amex
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                            Exclusivo
                          </span>
                        </div>
                      </div>

                      {/* Total */}
                      <div className={`p-3 rounded-2xl border flex items-center justify-between ${
                        theme === 'light'
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-[#0A0E17] border-slate-800'
                      }`}>
                        <span className={`text-xs font-bold font-sports uppercase tracking-wider ${
                          theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                        }`}>
                          Total:
                        </span>
                        <span className={`text-base font-scoreboard font-bold ${
                          theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>
                          ${selectedTier?.price || 0} MXN
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 font-sports uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickBuyEvent(null);
                          setShowSeatMap(true);
                        }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer text-center ${
                          theme === 'light'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-[#141C2E] hover:bg-[#1A253D] text-slate-200 border-slate-700'
                        }`}
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
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-950/50 transition-colors cursor-pointer text-center"
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

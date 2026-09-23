import React, { useState, useEffect, useMemo } from 'react';
import {
  StadiumStand,
  MenuItem,
  UserProfile,
  FoodOrderItem,
  OrderType,
  Ticket,
  Zone,
  VenueEvent,
  FoodOrder,
} from '../../types';
import { PurchaseSuccessModal } from '../../components/shared/PurchaseSuccessModal';
import { getStadiumStands, getMenuItemsByStand } from '../../lib/stands';
import { createFoodOrder } from '../../lib/foodOrders';
import { subscribeUserTickets } from '../../lib/tickets';
import { getZoneBySection, getZones } from '../../lib/zones';
import { cleanRowValue, cleanSeatValue, cleanSectionValue, formatDeliverySeat } from '../../lib/seatUtils';
import {
  getActiveOrderingEvent,
  getNextUpcomingEvent,
  subscribeVenueEventStatus,
  getEventPosterPlaceholder,
} from '../../lib/venueEvents';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { getVenueById } from '../../lib/venues';
import { useTheme } from '../../context/ThemeContext';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { CardPaymentModal } from '../../components/shared/CardPaymentModal';
import { DirectPaymentResult } from '../../lib/stripe';
import {
  Utensils,
  ShoppingBag,
  Clock,
  MapPin,
  Plus,
  Minus,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Store,
  Bike,
  Armchair,
  Ticket as TicketIcon,
  ChevronRight,
  X,
  AlertCircle,
  Calendar,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface MenuStandProps {
  user: UserProfile;
  onOrderSuccess?: () => void;
  onGoToTickets?: () => void;
  onRequireAuth?: () => void;
}

export const MenuStand: React.FC<MenuStandProps> = ({ user, onOrderSuccess, onGoToTickets, onRequireAuth }) => {
  const { theme } = useTheme();
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingStands, setLoadingStands] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>(() => {
    try {
      const saved = sessionStorage.getItem('vxp_food_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [placingOrder, setPlacingOrder] = useState(false);

  // Sincronizar carrito con sessionStorage para no perder progreso ante inicio de sesión
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem('vxp_food_cart', JSON.stringify(cart));
      } else {
        sessionStorage.removeItem('vxp_food_cart');
      }
    } catch (e) {
      console.warn('Error guardando carrito de comida:', e);
    }
  }, [cart]);

  // Verificación de ventana de pedidos activa
  const [checkingOrderingWindow, setCheckingOrderingWindow] = useState(true);
  const [activeOrderingEvent, setActiveOrderingEvent] = useState<VenueEvent | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<VenueEvent | null>(null);

  const checkOrderingWindow = async () => {
    setCheckingOrderingWindow(true);
    try {
      const vId = user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
      const active = await getActiveOrderingEvent(vId);
      setActiveOrderingEvent(active);
      const next = await getNextUpcomingEvent(vId);
      setUpcomingEvent(next);
    } catch (err) {
      console.error('Error al verificar pedidos activos:', err);
    } finally {
      setCheckingOrderingWindow(false);
    }
  };

  useEffect(() => {
    setCheckingOrderingWindow(true);
    const vId = user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
    const unsubscribe = subscribeVenueEventStatus(
      vId,
      (status) => {
        setActiveOrderingEvent(status.activeEvent);
        setUpcomingEvent(status.upcomingEvent);
        setCheckingOrderingWindow(false);
      },
      () => {
        setCheckingOrderingWindow(false);
      }
    );
    return () => unsubscribe();
  }, [user.browsingVenueId, user.venueId]);
  
  // Modal de confirmación y tipo de entrega
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('in-seat');
  const [foodPaymentMethod, setFoodPaymentMethod] = useState<'Efectivo / Terminal física' | 'Tarjeta en Línea' | 'Venados Pay'>('Tarjeta en Línea');
  
  // Datos de entrega in-seat
  const [userTickets, setUserTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [seatSection, setSeatSection] = useState<string>('');
  const [seatRow, setSeatRow] = useState<string>('');
  const [seatNumber, setSeatNumber] = useState<string>('');
  const [resolvedZone, setResolvedZone] = useState<Zone | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Éxito de orden
  const [lastPlacedOrder, setLastPlacedOrder] = useState<{
    code: string;
    type: OrderType;
    section?: string;
    row?: string;
    seat?: string;
    zoneName?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    cardBrand?: string;
    cardLast4?: string;
    authCode?: string;
    amount?: number;
  } | null>(null);

  const [currentVenueName, setCurrentVenueName] = useState<string>('Estadio Teodoro Mariscal');

  // Popup de confirmación oficial de pedido de comida
  const [completedFoodOrder, setCompletedFoodOrder] = useState<FoodOrder | null>(null);

  useEffect(() => {
    const fetchVenueInfo = async () => {
      const vId = user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
      try {
        const v = await getVenueById(vId);
        if (v?.name) {
          setCurrentVenueName(v.name);
        } else if (vId === DEFAULT_VENUE_ID) {
          setCurrentVenueName('Estadio Teodoro Mariscal');
        } else {
          setCurrentVenueName(vId);
        }
      } catch {
        // Fallback en caso de error
      }
    };
    fetchVenueInfo();
  }, [user.browsingVenueId, user.venueId]);

  useEffect(() => {
    const fetchStands = async () => {
      setLoadingStands(true);
      try {
        const vId = user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
        const data = await getStadiumStands(vId);
        setStands(data);
        if (data.length > 0) {
          setSelectedStand(data[0]);
        } else {
          setSelectedStand(null);
        }
      } catch (err) {
        console.error('Error fetching stands:', err);
      } finally {
        setLoadingStands(false);
      }
    };
    fetchStands();
  }, [user.browsingVenueId, user.venueId]);

  // Cargar tickets del aficionado
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeUserTickets(
      user.uid,
      (tickets) => {
        const activeTickets = tickets.filter((t) => t.status === 'activo');
        setUserTickets(activeTickets);
      },
      (err) => console.warn('Error fetching tickets for in-seat delivery:', err)
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  // Boletos válidos EXCLUSIVAMENTE para el partido actual y el recinto seleccionado
  // Se prohíbe explícitamente mostrar boletos de otro recinto o de partidos pasados/futuros
  const validCurrentMatchTickets = useMemo(() => {
    if (!userTickets || userTickets.length === 0) return [];
    if (!activeOrderingEvent) return []; // Si no hay un partido actual en curso en este recinto, no hay boletos válidos para el partido actual

    const targetVenueId = selectedStand?.venueId || user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID;
    const currentEventId = activeOrderingEvent.id;
    const currentEventName = (activeOrderingEvent.name || '').trim().toLowerCase();

    return userTickets.filter((t) => {
      // 1. Debe estar activo
      if (t.status !== 'activo') return false;

      // 2. Debe pertenecer al mismo recinto (nunca a otro estadio)
      const matchesVenue =
        (t.venueId && t.venueId === targetVenueId) ||
        (t.stadium && currentVenueName && t.stadium.toLowerCase().includes(currentVenueName.toLowerCase())) ||
        (targetVenueId === DEFAULT_VENUE_ID && (!t.venueId || t.venueId === DEFAULT_VENUE_ID));

      if (!matchesVenue) return false;

      // 3. Debe pertenecer estrictamente al partido actual de ese recinto (nunca a otro evento o fecha)
      const matchesEvent =
        t.eventId === currentEventId ||
        (t.matchTitle && currentEventName && t.matchTitle.toLowerCase() === currentEventName);

      return matchesEvent;
    });
  }, [userTickets, activeOrderingEvent, selectedStand, user.browsingVenueId, user.venueId, currentVenueName]);

  // Auto-seleccionar boleto válido del partido actual si existe
  useEffect(() => {
    if (validCurrentMatchTickets.length > 0) {
      const alreadySelected = validCurrentMatchTickets.find((t) => t.id === selectedTicketId);
      if (!alreadySelected) {
        const first = validCurrentMatchTickets[0];
        setSelectedTicketId(first.id);
        setSeatSection(cleanSectionValue(first.section));
        setSeatRow(cleanRowValue(first.row));
        setSeatNumber(cleanSeatValue(first.seat));
      }
    } else {
      setSelectedTicketId('');
    }
  }, [validCurrentMatchTickets]);

  // Resolver zona cuando cambie la sección
  useEffect(() => {
    if (!seatSection) {
      setResolvedZone(null);
      return;
    }
    const resolve = async () => {
      const zone = await getZoneBySection(seatSection);
      setResolvedZone(zone);
    };
    resolve();
  }, [seatSection]);

  useEffect(() => {
    if (!selectedStand) return;
    const fetchMenu = async () => {
      setLoadingMenu(true);
      try {
        const items = await getMenuItemsByStand(selectedStand.id);
        setMenuItems(items);
      } catch (err) {
        console.error('Error fetching menu items:', err);
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchMenu();
  }, [selectedStand]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            return { ...c, quantity: c.quantity + delta };
          }
          return c;
        })
        .filter((c) => c.quantity > 0);
    });
  };

  const total = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const totalCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    const found = validCurrentMatchTickets.find((t) => t.id === ticketId);
    if (found) {
      setSeatSection(cleanSectionValue(found.section));
      setSeatRow(cleanRowValue(found.row));
      setSeatNumber(cleanSeatValue(found.seat));
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0 || !selectedStand) return;
    setFormError(null);
    setIsCheckoutModalOpen(true);
  };

  const executeOrderPlacement = async (cardResult?: DirectPaymentResult) => {
    if (cart.length === 0 || !selectedStand) return;

    setPlacingOrder(true);
    setFormError(null);

    try {
      const foodItems: FoodOrderItem[] = cart.map((c) => ({
        itemId: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
      }));

      // Resolver zona final
      let zoneId: string | undefined = undefined;
      if (selectedOrderType === 'in-seat') {
        const zone = await getZoneBySection(seatSection);
        zoneId = zone?.id || 'zona-a';
      }

      const finalPaymentMethod = cardResult
        ? `Tarjeta en Línea (${cardResult.cardBrand.toUpperCase()} •••• ${cardResult.cardLast4})`
        : foodPaymentMethod;

      const order = await createFoodOrder({
        venueId: selectedStand.venueId || user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID,
        standId: selectedStand.id,
        standName: selectedStand.name,
        userId: user.uid,
        customerName: user.displayName || 'Aficionado Teodoro Mariscal',
        orderType: selectedOrderType,
        items: foodItems,
        total,
        paymentMethod: finalPaymentMethod,
        paymentStatus: cardResult ? 'pagado' : 'pendiente',
        paymentDetails: cardResult
          ? {
              paymentIntentId: cardResult.paymentIntentId,
              authCode: cardResult.authCode,
              cardBrand: cardResult.cardBrand,
              cardLast4: cardResult.cardLast4,
              amount: cardResult.amount,
              timestamp: cardResult.timestamp,
            }
          : undefined,
        section: selectedOrderType === 'in-seat' ? cleanSectionValue(seatSection) : undefined,
        row: selectedOrderType === 'in-seat' ? cleanRowValue(seatRow) : undefined,
        seat: selectedOrderType === 'in-seat' ? cleanSeatValue(seatNumber) : undefined,
        zoneId: zoneId,
      });

      setLastPlacedOrder({
        code: order.pickupCode,
        type: order.orderType,
        section: order.section,
        row: order.row,
        seat: order.seat,
        zoneName: resolvedZone?.name || 'Zona Asignada',
        paymentMethod: finalPaymentMethod,
        paymentStatus: order.paymentStatus || (cardResult ? 'pagado' : 'pendiente'),
        cardBrand: cardResult?.cardBrand,
        cardLast4: cardResult?.cardLast4,
        authCode: cardResult?.authCode,
        amount: total,
      });

      setCart([]);
      try {
        sessionStorage.removeItem('vxp_food_cart');
      } catch {}
      setIsCheckoutModalOpen(false);
      setIsCardModalOpen(false);
      setCompletedFoodOrder(order);
    } catch (err: any) {
      console.error('Error placing food order:', err);
      setFormError(err.message || 'Error al procesar el pedido. Intenta de nuevo.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (cart.length === 0 || !selectedStand) return;

    // Si el usuario no tiene sesión iniciada, solicitamos login manteniendo su carrito intacto
    if (!user || !user.uid) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (selectedOrderType === 'in-seat') {
      if (!seatSection.trim() || !seatRow.trim() || !seatNumber.trim()) {
        setFormError('Por favor indica tu Sección, Fila y Butaca para que el Runner pueda llevar tu pedido.');
        return;
      }
    }

    // Si el aficionado seleccionó pago con tarjeta, abrimos la pasarela de pago segura
    if (foodPaymentMethod === 'Tarjeta en Línea') {
      setIsCardModalOpen(true);
      return;
    }

    // Si seleccionó pago al recibir o efectivo
    await executeOrderPlacement();
  };

  const handleCardPaymentSuccess = async (result: DirectPaymentResult) => {
    await executeOrderPlacement(result);
  };

  if (checkingOrderingWindow) {
    return (
      <div className="py-16">
        <LoadingSpinner message="Verificando eventos y horarios de servicio en el estadio..." />
      </div>
    );
  }

  // Si no hay un evento próximo o si el evento más próximo ya finalizó:
  // Mostrar pantalla indicando que no hay eventos próximos para este recinto
  if (!activeOrderingEvent && !upcomingEvent) {
    return (
      <div className="py-10 max-w-lg mx-auto text-center space-y-6">
        <div className={`p-8 sm:p-10 rounded-3xl border shadow-sm text-center space-y-4 ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#101625] border-slate-800 text-white'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto shadow-xs">
            <Calendar className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              No hay eventos próximos para este recinto
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Actualmente no se tienen partidos o espectáculos programados próximamente en{' '}
              <strong className={theme === 'light' ? 'text-slate-900' : 'text-white'}>
                {currentVenueName}
              </strong>
              , o el encuentro más próximo ya ha finalizado. El servicio de entrega de comida a butacas y preparación en concesiones se habilitará para las próximas fechas del calendario.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onGoToTickets && (
              <button
                type="button"
                onClick={onGoToTickets}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                Ver Cartelera de Eventos
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Compacto de Alimentos (48px–56px): platillos y concesiones visibles de inmediato en el first fold */}
      <div className={`p-3 sm:px-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs transition-colors ${
        theme === 'light'
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-[#0F1626] border-slate-800 text-white'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Utensils className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black font-sports uppercase tracking-wide truncate">
              Alimentos & Bebidas • {currentVenueName}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {activeOrderingEvent
                ? `Evento en curso: ${activeOrderingEvent.name} • Entrega a butaca y pickup`
                : upcomingEvent
                ? `Menú oficial • Próximo: ${upcomingEvent.name}`
                : 'Pide a tu butaca o recoge con Pickup Express'}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border font-sports uppercase tracking-wider hidden sm:inline-flex items-center gap-1 ${
            activeOrderingEvent
              ? theme === 'light'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
              : theme === 'light'
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-amber-950/50 text-amber-300 border-amber-500/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${activeOrderingEvent ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {activeOrderingEvent ? 'Cocina Abierta' : 'Catálogo'}
          </span>
        </div>
      </div>

      {/* Banner de Confirmación de Pedido Reciente */}
      {lastPlacedOrder && (
        <div className={`p-5 rounded-2xl shadow-xl space-y-3 font-sports border ${
          theme === 'light'
            ? 'bg-white border-emerald-400 text-slate-900'
            : 'bg-[#0F1626] border-emerald-500/50 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <h3 className={`font-extrabold text-sm uppercase tracking-wider ${
                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
              }`}>
                ¡Orden Enviada a Cocina con Éxito!
              </h3>
            </div>
            <button
              onClick={() => setLastPlacedOrder(null)}
              className={`text-xs underline font-semibold cursor-pointer ${
                theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cerrar
            </button>
          </div>

          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
            theme === 'light'
              ? 'bg-emerald-50/60 border-emerald-200 text-slate-900'
              : 'bg-[#0A0E17] border-slate-700/80 text-white'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium uppercase ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                }`}>Modalidad:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase ${
                  theme === 'light'
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                }`}>
                  {lastPlacedOrder.type === 'in-seat' ? '🚴 Entrega a Butaca' : '⚡ Pickup Express'}
                </span>
              </div>
              <p className={`text-2xl font-black tracking-wider font-scoreboard mt-1 ${
                theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
              }`}>
                {lastPlacedOrder.code}
              </p>

              {lastPlacedOrder.cardLast4 ? (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>
                    Pagado con Tarjeta {lastPlacedOrder.cardBrand?.toUpperCase()} •••• {lastPlacedOrder.cardLast4}
                    {lastPlacedOrder.authCode ? ` (Auth: ${lastPlacedOrder.authCode})` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <span>💵 Pago al recibir: {lastPlacedOrder.paymentMethod || 'Efectivo / Terminal'}</span>
                </div>
              )}
            </div>

            <div className="text-xs font-sans">
              {lastPlacedOrder.type === 'in-seat' ? (
                <div className="space-y-0.5">
                  <p className={`font-bold font-sports ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    Destino: {formatDeliverySeat(lastPlacedOrder.section, lastPlacedOrder.row, lastPlacedOrder.seat)}
                  </p>
                  <p className={`text-[11px] ${
                    theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                  }`}>
                    {lastPlacedOrder.cardLast4
                      ? 'Tu pedido ya está pagado. El Runner de estadio te lo llevará directamente a tu asiento sin necesidad de cobrar.'
                      : 'Un Runner de estadio te lo llevará en cuanto la cocina lo tenga listo y te cobrará al entregar.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                    Pasa al mostrador cuando la pantalla o tu pestaña "Mis Pedidos" marque <strong className={theme === 'light' ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>LISTO</strong>.
                  </p>
                  {lastPlacedOrder.cardLast4 && (
                    <p className={`text-[11px] ${theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'}`}>
                      Tu pedido ya está pagado en línea. Solo muestra tu código <strong>{lastPlacedOrder.code}</strong> para recoger.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selector de Puestos del Estadio */}
      {loadingStands ? (
        <LoadingSpinner message="Localizando puestos de comida en el estadio..." />
      ) : stands.length === 0 ? (
        <div className={`p-8 sm:p-12 rounded-2xl border text-center font-sports shadow-sm space-y-4 ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0F1626] border-slate-700/80 text-white'
        }`}>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Store className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className={`text-base sm:text-lg font-black uppercase tracking-wide ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>
              Esta sede aún no tiene negocios de comida registrados
            </h3>
            <p className={`text-xs sm:text-sm font-sans leading-relaxed ${
              theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
            }`}>
              {currentVenueName
                ? `Actualmente no hay puestos o concesiones de alimentos y bebidas registrados para ${currentVenueName}. Pronto estarán disponibles para ordenar a tu butaca o recoger en mostrador express.`
                : 'Esta sede aún no cuenta con concesiones de alimentos y bebidas activas para ordenar.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 font-sports">
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              theme === 'light' ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <Store className="w-4 h-4 text-red-500" /> Concesiones & Puestos en Vivo
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stands.map((stand) => (
              <button
                key={stand.id}
                onClick={() => {
                  setSelectedStand(stand);
                  setCart([]);
                }}
                className={`p-3.5 rounded-xl text-left border transition-all flex items-start gap-3 cursor-pointer ${
                  selectedStand?.id === stand.id
                    ? theme === 'light'
                      ? 'bg-red-50/50 border-red-600 shadow-md ring-2 ring-red-600/30'
                      : 'bg-[#0F1626] border-red-600 shadow-xl ring-2 ring-red-600/30'
                    : theme === 'light'
                    ? 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs'
                    : 'bg-[#0F1626]/80 border-slate-700/80 hover:bg-[#0F1626] hover:border-slate-600 shadow-md'
                }`}
              >
                <img
                  src={stand.image}
                  alt={stand.name}
                  className={`w-12 h-12 rounded-lg object-cover shrink-0 ${
                    theme === 'light' ? 'bg-slate-100' : 'bg-[#0A0E17]'
                  }`}
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate tracking-wide ${
                    theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                  }`}>{stand.name}</p>
                  <p className={`text-[11px] flex items-center gap-1 mt-0.5 font-sans ${
                    theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-200'
                  }`}>
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="truncate">{stand.location}</span>
                  </p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-1 font-sans ${
                    theme === 'light' ? 'text-amber-800' : 'text-amber-400'
                  }`}>
                    <Clock className="w-3 h-3" /> ~{stand.estimatedWaitMinutes} min
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menú y Carrito */}
      {selectedStand && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2 font-sports">
          {/* Menú del puesto seleccionado */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`p-4 rounded-xl border shadow-md flex items-center justify-between ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#0F1626] border-slate-700/80 text-white'
            }`}>
              <div>
                <h3 className={`font-extrabold text-sm tracking-wide ${
                  theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                }`}>{selectedStand.name}</h3>
                <p className={`text-xs flex items-center gap-1 mt-0.5 font-sans ${
                  theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-200'
                }`}>
                  <MapPin className="w-3.5 h-3.5 text-red-500" /> {selectedStand.location}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                theme === 'light'
                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                  : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
              }`}>
                {selectedStand.categoryTag}
              </span>
            </div>

            {loadingMenu ? (
              <LoadingSpinner message="Cargando menú del puesto..." />
            ) : menuItems.length === 0 ? (
              <div className={`p-8 rounded-xl border text-center ${
                theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-600'
                  : 'bg-[#0F1626] border-slate-700/80 text-slate-400'
              }`}>
                No hay productos disponibles en este puesto en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-colors flex gap-3 justify-between ${
                      theme === 'light'
                        ? 'bg-white border-slate-200 text-slate-900 shadow-xs hover:border-slate-300'
                        : 'bg-[#0F1626] border-slate-700/80 text-white shadow-md hover:border-slate-600'
                    }`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold text-xs tracking-wide ${
                          theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                        }`}>{item.name}</h4>
                        {!item.available && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                            theme === 'light'
                              ? 'bg-red-100 text-red-950 border-red-300'
                              : 'bg-red-950 text-red-400 border-red-800'
                          }`}>
                            Agotado
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] line-clamp-2 leading-relaxed font-sans ${
                        theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-200'
                      }`}>
                        {item.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <span className={`text-xs font-black font-scoreboard ${
                          theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>
                          ${item.price.toLocaleString('es-MX')} <span className={`text-[10px] font-sans ${
                            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                          }`}>MXN</span>
                        </span>
                        {item.available && (
                          <button
                            onClick={() => addToCart(item)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1 transition-transform active:scale-95 uppercase tracking-wider cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        )}
                      </div>
                    </div>

                    <img
                      src={item.image}
                      alt={item.name}
                      className={`w-16 h-16 rounded-lg object-cover shrink-0 self-center ${
                        theme === 'light' ? 'bg-slate-100' : 'bg-[#0A0E17]'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de Comanda */}
          <div className={`p-5 rounded-2xl border shadow-xl space-y-4 h-fit sticky top-20 ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700/80'
            }`}>
              <div className={`flex items-center gap-2 font-extrabold text-sm uppercase tracking-wider ${
                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
              }`}>
                <ShoppingBag className="w-4 h-4 text-red-500" />
                <span>Comanda del Estadio</span>
              </div>
              <span className={`text-xs font-semibold ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>{totalCount} platillos</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Utensils className={`w-8 h-8 mx-auto ${
                  theme === 'light' ? 'text-slate-400' : 'text-slate-600'
                }`} />
                <p className={`text-xs font-semibold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>Selecciona platillos del menú</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div
                    key={c.item.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                      theme === 'light'
                        ? 'bg-slate-50 border-slate-200 text-slate-900'
                        : 'bg-[#0A0E17] border-slate-700/80 text-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate tracking-wide ${
                        theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                      }`}>{c.item.name}</p>
                      <p className={`text-[11px] font-scoreboard font-bold ${
                        theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                      }`}>
                        ${(c.item.price * c.quantity).toLocaleString('es-MX')} MXN
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 border rounded-md p-0.5 ${
                      theme === 'light'
                        ? 'bg-white border-slate-300 text-slate-900'
                        : 'bg-[#141C2E] border-slate-700 text-white'
                    }`}>
                      <button
                        onClick={() => updateCartQty(c.item.id, -1)}
                        className={`p-1 cursor-pointer ${
                          theme === 'light' ? 'text-slate-600 hover:text-red-600' : 'text-slate-400 hover:text-red-400'
                        }`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={`text-xs font-bold px-1 font-mono ${
                        theme === 'light' ? 'text-slate-900' : 'text-white'
                      }`}>{c.quantity}</span>
                      <button
                        onClick={() => updateCartQty(c.item.id, 1)}
                        className={`p-1 cursor-pointer ${
                          theme === 'light' ? 'text-slate-600 hover:text-emerald-600' : 'text-slate-400 hover:text-emerald-400'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={`pt-3 border-t space-y-3 ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700/80'
            }`}>
              <div className={`flex justify-between items-center text-sm font-black ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <span className="uppercase tracking-wider">Total:</span>
                <span className={`font-scoreboard text-lg font-bold ${
                  theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                }`}>${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={handleOpenCheckout}
                className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Continuar al Pedido</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Selección de Método de Entrega (Pickup vs In-Seat) & Método de Pago */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150 font-sports">
          <div className={`rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border overflow-hidden my-auto animate-in zoom-in-95 duration-150 ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}>
            {/* Header */}
            <div className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200 text-slate-900'
                : 'bg-[#0A0E17] border-slate-700/80 text-white'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-600/15 text-red-600 rounded-xl border border-red-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-black text-sm sm:text-base uppercase tracking-wider ${
                    theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                  }`}>Detalles y Pago del Pedido</h3>
                  <p className={`text-[11px] sm:text-xs font-sans ${
                    theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                  }`}>Puesto: {selectedStand?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-[#141C2E]'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-700 text-red-200 rounded-xl text-xs flex items-start gap-2 font-sans">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Modalidad de Entrega */}
              <div className="space-y-1.5">
                <label className={`block text-[11px] font-bold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-800' : '!text-[#E2E8F0] text-slate-200'
                }`}>
                  1. Modalidad de Entrega
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('in-seat')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedOrderType === 'in-seat'
                        ? theme === 'light'
                          ? 'border-red-600 bg-red-50 text-slate-900 shadow-xs'
                          : 'border-red-500 bg-red-950/40 text-white shadow-md'
                        : theme === 'light'
                        ? 'border-slate-300 hover:border-slate-400 bg-white text-slate-800'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${
                        selectedOrderType === 'in-seat'
                          ? 'bg-red-600 text-white'
                          : theme === 'light'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-[#141C2E] text-slate-400'
                      }`}>
                        <Bike className="w-4 h-4" />
                      </div>
                      {selectedOrderType === 'in-seat' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                      )}
                    </div>
                    <div>
                      <p className={`font-extrabold text-xs uppercase tracking-wide ${
                        theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                      }`}>Entrega a mi Asiento</p>
                      <p className={`text-[10px] mt-0.5 font-sans ${
                        theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                      }`}>Un Runner te lo lleva hasta tu butaca</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('pickup')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedOrderType === 'pickup'
                        ? theme === 'light'
                          ? 'border-amber-600 bg-amber-50 text-slate-900 shadow-xs'
                          : 'border-amber-500 bg-amber-950/40 text-white shadow-md'
                        : theme === 'light'
                        ? 'border-slate-300 hover:border-slate-400 bg-white text-slate-800'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${
                        selectedOrderType === 'pickup'
                          ? 'bg-amber-600 text-slate-950'
                          : theme === 'light'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-[#141C2E] text-slate-400'
                      }`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      {selectedOrderType === 'pickup' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      )}
                    </div>
                    <div>
                      <p className={`font-extrabold text-xs uppercase tracking-wide ${
                        theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                      }`}>Pickup Express</p>
                      <p className={`text-[10px] mt-0.5 font-sans ${
                        theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                      }`}>Recoges en la barra con tu código</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulario de Ubicación para In-Seat */}
              {selectedOrderType === 'in-seat' && (
                <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-[#0A0E17] border-slate-700/80 text-white'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider ${
                      theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                    }`}>
                      <Armchair className="w-4 h-4 text-red-500" /> ¿Dónde estás sentado?
                    </span>
                    {resolvedZone && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                        theme === 'light'
                          ? 'bg-sky-100 text-sky-950 border-sky-300'
                          : 'bg-sky-950 text-sky-400 border-sky-600/40'
                      }`}>
                        {resolvedZone.name}
                      </span>
                    )}
                  </div>

                  {validCurrentMatchTickets.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-1 font-sans">
                        <label className={`text-[11px] font-semibold flex items-center gap-1 ${
                          theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                        }`}>
                          <TicketIcon className="w-3 h-3 text-red-500" /> Boleto del partido actual:
                        </label>
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Partido en {currentVenueName}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {validCurrentMatchTickets.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTicketSelect(t.id)}
                            className={`w-full p-2 rounded-xl text-left text-xs border flex items-center justify-between transition-all cursor-pointer ${
                              selectedTicketId === t.id
                                ? theme === 'light'
                                ? 'bg-red-50 border-red-500 shadow-xs font-bold text-slate-900'
                                : 'bg-red-950/40 border-red-500 shadow-xs font-bold text-white'
                              : theme === 'light'
                              ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                              : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div>
                              <p className={`truncate font-semibold ${theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'}`}>{t.matchTitle}</p>
                              <p className={`text-[10px] font-sans ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                {formatDeliverySeat(t.section, t.row, t.seat)}
                              </p>
                            </div>
                            {selectedTicketId === t.id && (
                              <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={`p-2.5 rounded-xl border text-xs font-sans space-y-1 ${
                      theme === 'light'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                          {activeOrderingEvent
                            ? `Sin boleto para el partido actual en ${currentVenueName}`
                            : `Sin partido en juego en ${currentVenueName}`}
                        </span>
                      </div>
                      <p className="text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {activeOrderingEvent
                          ? `Tus boletos guardados no corresponden al encuentro actual (${activeOrderingEvent.name}). Si estás en el estadio con boleto impreso, ingresa tu butaca manualmente abajo.`
                          : `Solo se permite la entrega a butaca con el boleto del partido actual en este recinto. Puedes usar Pickup Express o ingresar tu asiento manualmente.`}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1 font-sans">
                    <div>
                      <label className={`text-[10px] font-bold uppercase font-sports ${
                        theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                      }`}>Sección *</label>
                      <input
                        type="text"
                        placeholder="Ej: 102"
                        value={seatSection}
                        onChange={(e) => {
                          setSeatSection(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className={`w-full px-2.5 py-2 border rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500 ${
                          theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                            : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-bold uppercase font-sports ${
                        theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                      }`}>Fila *</label>
                      <input
                        type="text"
                        placeholder="Ej: D"
                        value={seatRow}
                        onChange={(e) => {
                          setSeatRow(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className={`w-full px-2.5 py-2 border rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500 ${
                          theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                            : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-bold uppercase font-sports ${
                        theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                      }`}>Asiento *</label>
                      <input
                        type="text"
                        placeholder="Ej: 14"
                        value={seatNumber}
                        onChange={(e) => {
                          setSeatNumber(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className={`w-full px-2.5 py-2 border rounded-xl text-xs font-bold focus:outline-hidden focus:border-red-500 ${
                          theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                            : 'bg-[#141C2E] border-slate-700 text-white placeholder-slate-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Selector de Método de Pago */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`block text-[11px] font-bold uppercase tracking-wider ${
                    theme === 'light' ? 'text-slate-800' : '!text-[#E2E8F0] text-slate-200'
                  }`}>
                    2. Método de Pago
                  </label>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Pasarela SSL Segura
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFoodPaymentMethod('Tarjeta en Línea')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                      foodPaymentMethod === 'Tarjeta en Línea'
                        ? theme === 'light'
                          ? 'border-red-600 bg-red-50/80 text-red-950 shadow-sm ring-1 ring-red-600/30'
                          : 'border-red-500 bg-red-950/40 text-white shadow-sm ring-1 ring-red-500/30'
                        : theme === 'light'
                        ? 'border-slate-300 hover:border-slate-400 bg-white text-slate-800'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-600/15 text-red-500 border border-red-500/30">
                          Recomendado
                        </span>
                      </div>
                      {foodPaymentMethod === 'Tarjeta en Línea' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      )}
                    </div>
                    <div>
                      <p className={`font-extrabold text-xs leading-tight uppercase ${
                        theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                      }`}>
                        Tarjeta en Línea
                      </p>
                      <p className={`text-[10px] mt-0.5 font-sans ${
                        theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                      }`}>
                        Visa, Mastercard, Amex • Cobro directo
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFoodPaymentMethod('Efectivo / Terminal física')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      foodPaymentMethod === 'Efectivo / Terminal física'
                        ? theme === 'light'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                          : 'border-emerald-500 bg-emerald-950/40 text-white shadow-sm'
                        : theme === 'light'
                        ? 'border-slate-300 hover:border-slate-400 bg-white text-slate-800'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">💵</span>
                      {foodPaymentMethod === 'Efectivo / Terminal física' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      )}
                    </div>
                    <div>
                      <p className={`font-extrabold text-xs leading-tight uppercase ${
                        theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                      }`}>
                        Terminal o Efectivo
                      </p>
                      <p className={`text-[10px] mt-0.5 font-sans ${
                        theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                      }`}>
                        Pagas al recibir en butaca o barra
                      </p>
                    </div>
                  </button>
                </div>

                {foodPaymentMethod === 'Tarjeta en Línea' ? (
                  <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 font-sans border ${
                    theme === 'light'
                      ? 'bg-red-50/70 border-red-200 text-red-950'
                      : 'bg-red-950/20 border-red-500/30 text-red-200'
                  }`}>
                    <Lock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>
                      {selectedOrderType === 'in-seat'
                        ? 'Tu orden quedará pagada de inmediato. El runner la llevará a tu butaca sin necesidad de cobrarte al entregar.'
                        : 'Tu orden quedará pagada de inmediato. Solo muestra tu código en barra para retirar rápidamente.'}
                    </span>
                  </div>
                ) : (
                  <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 font-sans border ${
                    theme === 'light'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-[#0A0E17] border-emerald-500/50 text-emerald-300'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                    <span>
                      {selectedOrderType === 'in-seat'
                        ? 'El Runner llevará terminal física inalámbrica o cambio en efectivo para tu cobro.'
                        : 'Pagas directamente en la caja del puesto al recoger tus alimentos.'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 sm:p-5 border-t shrink-0 space-y-3 ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200 text-slate-900'
                : 'bg-[#0A0E17] border-slate-700/80 text-white'
            }`}>
              <div className={`flex justify-between items-center text-xs sm:text-sm font-extrabold ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <span className="uppercase tracking-wider">Total a Pagar ({totalCount} items):</span>
                <span className={`text-sm sm:text-base font-scoreboard font-bold ${
                  theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                }`}>${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className={`px-4 py-2.5 border text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                      : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  disabled={placingOrder}
                  onClick={handleConfirmOrder}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  {placingOrder ? (
                    'Procesando orden...'
                  ) : !user || !user.uid ? (
                    <>
                      <span>Iniciar Sesión para Continuar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : foodPaymentMethod === 'Tarjeta en Línea' ? (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pagar con Tarjeta (${total.toLocaleString('es-MX')} MXN)</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmar Pedido (Pagar al Recibir)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pasarela de Pago con Tarjeta en Línea (Stripe Direct Checkout) */}
      <CardPaymentModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        amount={total}
        concept={`${selectedStand?.name || 'Comida Estadio'} — ${
          selectedOrderType === 'in-seat'
            ? `Entrega a Butaca (${cleanSectionValue(seatSection) ? `Sec. ${cleanSectionValue(seatSection)}, Fila ${cleanRowValue(seatRow)}, Asiento ${cleanSeatValue(seatNumber)}` : 'Butaca'})`
            : 'Pick Up Express en Barra'
        } (${totalCount} platillos)`}
        customerName={user.displayName || user.email || 'Aficionado Teodoro Mariscal'}
        customerEmail={user.email || undefined}
        orderType="comida"
        metadata={{
          venueId: selectedStand?.venueId || user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID,
          standId: selectedStand?.id || '',
          standName: selectedStand?.name || '',
          orderType: selectedOrderType,
          itemsCount: String(totalCount),
          section: cleanSectionValue(seatSection) || '',
          row: cleanRowValue(seatRow) || '',
          seat: cleanSeatValue(seatNumber) || '',
        }}
        onSuccess={handleCardPaymentSuccess}
      />

      {/* Modal Popup de Confirmación Oficial de Pedido de Comida */}
      {completedFoodOrder && (
        <PurchaseSuccessModal
          isOpen={true}
          type="food"
          foodOrder={completedFoodOrder}
          onClose={() => {
            setCompletedFoodOrder(null);
            if (onOrderSuccess) onOrderSuccess();
          }}
          onNavigateToOrders={() => {
            setCompletedFoodOrder(null);
            if (onOrderSuccess) onOrderSuccess();
          }}
        />
      )}
    </div>
  );
};

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
  ChevronDown,
  X,
  AlertCircle,
  Calendar,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  Lock,
  Trash2,
  Maximize2,
} from 'lucide-react';

interface MenuStandProps {
  user: UserProfile;
  onOrderSuccess?: () => void;
  onGoToTickets?: () => void;
  onRequireAuth?: () => void;
}

interface StandCartItem {
  item: MenuItem;
  quantity: number;
  standId?: string;
  standName?: string;
  standLocation?: string;
}

type CartsByStand = Record<string, StandCartItem[]>;

const CARTS_STORAGE_KEY = 'vxp_food_carts_by_stand';
const SELECTED_STAND_KEY = 'vxp_food_selected_stand_id';

const loadCartsFromStorage = (): CartsByStand => {
  try {
    const raw = localStorage.getItem(CARTS_STORAGE_KEY) || sessionStorage.getItem(CARTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    // Migración retrocompatible del carrito plano previo
    const legacy = sessionStorage.getItem('vxp_food_cart');
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        const standId = parsedLegacy[0]?.item?.standId || 'legacy';
        return { [standId]: parsedLegacy };
      }
    }
  } catch (e) {
    console.warn('Error cargando carritos guardados por negocio:', e);
  }
  return {};
};

const saveCartsToStorage = (carts: CartsByStand) => {
  try {
    const serialized = JSON.stringify(carts);
    localStorage.setItem(CARTS_STORAGE_KEY, serialized);
    sessionStorage.setItem(CARTS_STORAGE_KEY, serialized);
  } catch (e) {
    console.warn('Error guardando carritos en storage:', e);
  }
};

export const MenuStand: React.FC<MenuStandProps> = ({ user, onOrderSuccess, onGoToTickets, onRequireAuth }) => {
  const { theme } = useTheme();
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingStands, setLoadingStands] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [previewDishImage, setPreviewDishImage] = useState<{
    src: string;
    title: string;
    category?: string;
    description?: string;
    price?: number;
  } | null>(null);
  
  // Carrito persistente indexado por standId
  const [cartsByStand, setCartsByStand] = useState<CartsByStand>(loadCartsFromStorage);

  // Carrito activo correspondiente al negocio actualmente seleccionado
  const cart = useMemo(() => {
    if (!selectedStand) return [];
    return cartsByStand[selectedStand.id] || [];
  }, [selectedStand, cartsByStand]);

  const [placingOrder, setPlacingOrder] = useState(false);

  // Sincronizar carrito activo con sessionStorage para compatibilidad con redirecciones
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem('vxp_food_cart', JSON.stringify(cart));
      } else {
        sessionStorage.removeItem('vxp_food_cart');
      }
    } catch (e) {
      console.warn('Error sincronizando carrito temporal:', e);
    }
  }, [cart]);

  const handleSelectStand = (stand: StadiumStand) => {
    setSelectedStand(stand);
    try {
      localStorage.setItem(SELECTED_STAND_KEY, stand.id);
      sessionStorage.setItem(SELECTED_STAND_KEY, stand.id);
    } catch {}
  };

  useEffect(() => {
    try {
      const targetDishId = sessionStorage.getItem('vxp_target_dish_id');
      if (targetDishId && stands.length > 0 && !selectedStand) {
        sessionStorage.removeItem('vxp_target_dish_id');
        setSelectedStand(stands[0]);
      }
    } catch {}
  }, [stands]);

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

  // Éxito de orden (soporta comandas de múltiples negocios)
  interface PlacedOrdersSummary {
    orders: FoodOrder[];
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
    totalAmount: number;
  }
  const [lastPlacedOrders, setLastPlacedOrders] = useState<PlacedOrdersSummary | null>(null);

  const [currentVenueName, setCurrentVenueName] = useState<string>('Estadio Teodoro Mariscal');

  // Popups y confirmaciones de pedidos de comida (soporta multi-negocio)
  const [completedFoodOrders, setCompletedFoodOrders] = useState<FoodOrder[]>([]);

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
          const savedStandId = localStorage.getItem(SELECTED_STAND_KEY) || sessionStorage.getItem(SELECTED_STAND_KEY);
          const found = savedStandId ? data.find((s) => s.id === savedStandId) : null;
          setSelectedStand(found || data[0]);
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
    if (!selectedStand) return;
    const standId = selectedStand.id;
    const standName = selectedStand.name;
    const standLocation = selectedStand.location;

    setCartsByStand((prev) => {
      const standCart = prev[standId] || [];
      const idx = standCart.findIndex((c) => c.item.id === item.id);
      let updatedStandCart: StandCartItem[];
      if (idx > -1) {
        updatedStandCart = standCart.map((c, i) => (i === idx ? { ...c, quantity: c.quantity + 1 } : c));
      } else {
        updatedStandCart = [...standCart, { item, quantity: 1, standId, standName, standLocation }];
      }
      const updated = { ...prev, [standId]: updatedStandCart };
      saveCartsToStorage(updated);
      return updated;
    });
  };

  const updateCartQty = (standId: string, itemId: string, delta: number) => {
    setCartsByStand((prev) => {
      const standCart = prev[standId] || [];
      const updatedStandCart = standCart
        .map((c) => {
          if (c.item.id === itemId) {
            return { ...c, quantity: c.quantity + delta };
          }
          return c;
        })
        .filter((c) => c.quantity > 0);
      const updated = { ...prev };
      if (updatedStandCart.length === 0) {
        delete updated[standId];
      } else {
        updated[standId] = updatedStandCart;
      }
      saveCartsToStorage(updated);
      return updated;
    });
  };

  const clearSingleStandCart = (standId: string) => {
    setCartsByStand((prev) => {
      const updated = { ...prev };
      delete updated[standId];
      saveCartsToStorage(updated);
      return updated;
    });
  };

  const clearAllCarts = () => {
    setCartsByStand({});
    saveCartsToStorage({});
  };

  // Comandas consolidadas agrupadas por puesto o negocio
  const standOrdersList = useMemo(() => {
    const list: {
      standId: string;
      standName: string;
      standLocation?: string;
      items: StandCartItem[];
      subtotal: number;
      count: number;
    }[] = [];

    for (const standId of Object.keys(cartsByStand)) {
      const items: StandCartItem[] = cartsByStand[standId] || [];
      if (items.length > 0) {
        const subtotal = items.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
        const count = items.reduce((sum, c) => sum + c.quantity, 0);
        const standInfo = stands.find((s) => s.id === standId);
        const standName = items[0]?.standName || standInfo?.name || 'Puesto Oficial';
        const standLocation = items[0]?.standLocation || standInfo?.location || '';
        list.push({ standId, standName, standLocation, items, subtotal, count });
      }
    }
    return list;
  }, [cartsByStand, stands]);

  // Totales consolidados de todos los negocios en la comanda única
  const total = useMemo(() => {
    return standOrdersList.reduce((sum, s) => sum + s.subtotal, 0);
  }, [standOrdersList]);

  const totalCount = useMemo(() => {
    return standOrdersList.reduce((sum, s) => sum + s.count, 0);
  }, [standOrdersList]);

  const totalStandsCount = standOrdersList.length;

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
    if (standOrdersList.length === 0) return;
    setFormError(null);
    setIsCheckoutModalOpen(true);
  };

  const executeOrderPlacement = async (cardResult?: DirectPaymentResult) => {
    if (standOrdersList.length === 0 || placingOrder) return;

    setFormError(null);
    setPlacingOrder(true);

    try {
      const finalPaymentMethod = cardResult
        ? `Tarjeta en Línea (${cardResult.cardBrand.toUpperCase()} •••• ${cardResult.cardLast4})`
        : foodPaymentMethod;

      const createdOrders: FoodOrder[] = [];

      // Procesar cada negocio de forma individual, dividiendo exactamente el pago y los platillos
      for (const standOrder of standOrdersList) {
        const foodItems: FoodOrderItem[] = standOrder.items.map((c) => ({
          itemId: c.item.id,
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity,
          notes: c.item.description || undefined,
        }));

        // Datos de pago específicos asignados a este negocio
        const standPaymentDetails = cardResult
          ? {
              paymentIntentId: cardResult.paymentIntentId,
              authCode: cardResult.authCode,
              cardBrand: cardResult.cardBrand,
              cardLast4: cardResult.cardLast4,
              amount: standOrder.subtotal, // DIVISIÓN EXACTA DEL PAGO PARA ESTE NEGOCIO
              timestamp: cardResult.timestamp,
            }
          : undefined;

        const standVenueId =
          standOrder.items[0]?.item?.venueId ||
          stands.find((s) => s.id === standOrder.standId)?.venueId ||
          user.browsingVenueId ||
          user.venueId ||
          DEFAULT_VENUE_ID;

        // Crear la orden en Firestore para este puesto
        const newOrder = await createFoodOrder({
          venueId: standVenueId,
          standId: standOrder.standId,
          standName: standOrder.standName,
          userId: user.uid,
          customerName: user.displayName || 'Aficionado',
          orderType: selectedOrderType,
          items: foodItems,
          total: standOrder.subtotal, // MONTO DIVIDIDO DE ESTE NEGOCIO
          paymentMethod: finalPaymentMethod,
          paymentStatus: cardResult ? 'pagado' : 'pendiente',
          paymentDetails: standPaymentDetails,
          section: selectedOrderType === 'in-seat' ? cleanSectionValue(seatSection) : undefined,
          row: selectedOrderType === 'in-seat' ? cleanRowValue(seatRow) : undefined,
          seat: selectedOrderType === 'in-seat' ? cleanSeatValue(seatNumber) : undefined,
          zoneId: resolvedZone?.id || 'zona-a',
        });

        if (newOrder) {
          createdOrders.push(newOrder);
        }
      }

      if (createdOrders.length > 0) {
        const primary = createdOrders[0];
        setLastPlacedOrders({
          orders: createdOrders,
          type: selectedOrderType,
          section: primary.section,
          row: primary.row,
          seat: primary.seat,
          zoneName: resolvedZone?.name || 'Zona Asignada',
          paymentMethod: finalPaymentMethod,
          paymentStatus: 'pagado',
          cardBrand: cardResult?.cardBrand,
          cardLast4: cardResult?.cardLast4,
          authCode: cardResult?.authCode,
          totalAmount: total,
        });
        setCompletedFoodOrders(createdOrders);
      }

      // Vaciar todos los carritos tras éxito
      setCartsByStand({});
      saveCartsToStorage({});
      try {
        sessionStorage.removeItem('vxp_food_cart');
      } catch {}

      setIsCheckoutModalOpen(false);
      setIsCardModalOpen(false);
      setPlacingOrder(false);
    } catch (err: any) {
      console.error('Error placing multi-business food orders:', err);
      setFormError('Hubo un error al procesar las comandas de los negocios. Por favor intenta de nuevo.');
      setPlacingOrder(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (standOrdersList.length === 0) return;

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
      {/* Banner de Confirmación de Pedido Reciente */}
      {lastPlacedOrders && (
        <div className={`p-5 rounded-2xl shadow-xl space-y-3 font-sports border ${
          theme === 'light'
            ? 'bg-white border-emerald-400 text-slate-900'
            : 'bg-[#0F1626] border-emerald-500/50 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <h3 className={`font-extrabold text-sm uppercase tracking-wider ${
                  theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                }`}>
                  {lastPlacedOrders.orders.length > 1
                    ? `¡${lastPlacedOrders.orders.length} Órdenes Creadas y Divididas con Éxito!`
                    : '¡Orden Enviada a Cocina con Éxito!'}
                </h3>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
                  Compra unificada procesada • Total: ${lastPlacedOrders.totalAmount.toLocaleString('es-MX')} MXN {lastPlacedOrders.cardLast4 ? `(Tarjeta ${lastPlacedOrders.cardBrand?.toUpperCase()} •••• ${lastPlacedOrders.cardLast4})` : `(${lastPlacedOrders.paymentMethod || 'Efectivo'})`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompletedFoodOrders(lastPlacedOrders.orders)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Ver Comprobantes
              </button>
              <button
                onClick={() => setLastPlacedOrders(null)}
                className={`text-xs underline font-semibold cursor-pointer ${
                  theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>

          {/* Tarjetas individuales por cada negocio con su código y monto dividido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {lastPlacedOrders.orders.map((ord, idx) => (
              <div
                key={ord.id}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  theme === 'light'
                    ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                    : 'bg-[#0A0E17] border-slate-700/80 text-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      Puesto #{idx + 1}
                    </span>
                    <span className="text-xs font-scoreboard font-bold text-emerald-700 dark:text-emerald-400">
                      ${ord.total.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                  <h4 className="font-extrabold text-xs truncate" title={ord.standName}>
                    {ord.standName}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-sans line-clamp-1 mt-0.5">
                    {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-emerald-200/70 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">Código Retiro:</span>
                  <span className="font-scoreboard font-black text-sm text-emerald-700 dark:text-emerald-400 tracking-wider">
                    {ord.pickupCode}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className={`p-3 rounded-xl text-xs font-sans border ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#121929] border-slate-800 text-slate-300'
          }`}>
            {lastPlacedOrders.type === 'in-seat' ? (
              <p>
                🚴 <strong>Entrega a Butaca:</strong> Destino {formatDeliverySeat(lastPlacedOrders.section, lastPlacedOrders.row, lastPlacedOrders.seat)}. Los runners del estadio te llevarán los pedidos de cada concesionario directamente a tu asiento.
              </p>
            ) : (
              <p>
                ⚡ <strong>Pickup Express:</strong> Presenta el código de retiro correspondiente en la barra de cada concesionario para retirar tus alimentos en cuanto su estado marque <strong>LISTO</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selector Discreto de Puestos / Concesionarios (Estilo Dropdown como los selectores del sistema) */}
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
        <div className="flex items-center gap-2.5 font-sports">
          {/* Selector Discreto tipo dropdown (idéntico al selector de estadio) */}
          <div className="relative inline-flex items-center shrink-0">
            <label htmlFor="concession-stand-selector" className="sr-only">
              Seleccionar puesto o concesionario
            </label>
            <div
              className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 border rounded-xl transition-all group cursor-pointer shadow-xs ${
                theme === 'light'
                  ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-[#101625] hover:bg-[#182032] border-slate-700 text-slate-200'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <select
                id="concession-stand-selector"
                value={selectedStand?.id || ''}
                onChange={(e) => {
                  const s = stands.find((st) => st.id === e.target.value);
                  if (s) {
                    handleSelectStand(s);
                  }
                }}
                className={`bg-transparent text-[11px] sm:text-xs font-bold pr-5 focus:outline-none cursor-pointer appearance-none truncate max-w-[210px] sm:max-w-xs ${
                  theme === 'light' ? 'text-slate-900' : 'text-slate-200'
                }`}
                title="Cambiar puesto seleccionado"
              >
                {stands.map((stand) => {
                  const standCartCount = (cartsByStand[stand.id] || []).reduce((sum, c) => sum + c.quantity, 0);
                  return (
                    <option
                      key={stand.id}
                      value={stand.id}
                      className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#101625] text-white font-medium'}
                    >
                      {stand.name} • {stand.location} (~{stand.estimatedWaitMinutes} min){standCartCount > 0 ? ` • [${standCartCount} en carrito]` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                className={`w-3.5 h-3.5 absolute right-2 pointer-events-none transition-colors ${
                  theme === 'light' ? 'text-slate-500 group-hover:text-slate-800' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Menú y Carrito */}
      {selectedStand && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sports">
          {/* Menú del puesto seleccionado (Platillos grandes y visibles sin scroll) */}
          <div className="lg:col-span-2 space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between group shadow-md ${
                      item.available
                        ? theme === 'light'
                          ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg'
                          : 'bg-[#0F1626] border-slate-700/80 hover:border-slate-600 hover:shadow-xl'
                        : theme === 'light'
                        ? 'bg-slate-100/80 border-slate-200 opacity-60'
                        : 'bg-[#0A0E17]/80 border-slate-800 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Imagen Prominente del Platillo (Completa, sin recortes) */}
                      <div
                        className="relative h-44 sm:h-52 w-full bg-slate-950 overflow-hidden group/img cursor-pointer flex items-center justify-center"
                        onClick={() => {
                          const resolvedImg =
                            normalizeGoogleDriveImageUrl(item.image) ||
                            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80';
                          setPreviewDishImage({
                            src: resolvedImg,
                            title: item.name,
                            category: item.category,
                            description: item.description,
                            price: item.price,
                          });
                        }}
                        title="Clic para ver foto ampliada"
                      >
                        {/* Fondo desenfocado de ambientación para rellenar los bordes con suavidad */}
                        <img
                          src={
                            normalizeGoogleDriveImageUrl(item.image) ||
                            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80'
                          }
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-25 select-none pointer-events-none"
                        />

                        {/* Imagen Principal Completa (object-contain para mostrar 100% de la foto) */}
                        <img
                          src={
                            normalizeGoogleDriveImageUrl(item.image) ||
                            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80'
                          }
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="relative z-10 w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300 drop-shadow-md"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80';
                          }}
                        />

                        {/* Botón para ver en grande */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const resolvedImg =
                              normalizeGoogleDriveImageUrl(item.image) ||
                              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80';
                            setPreviewDishImage({
                              src: resolvedImg,
                              title: item.name,
                              category: item.category,
                              description: item.description,
                              price: item.price,
                            });
                          }}
                          className="absolute bottom-2.5 right-2.5 p-1.5 bg-black/80 hover:bg-red-600 border border-white/20 rounded-lg text-white shadow-lg opacity-0 group-hover/img:opacity-100 sm:group-hover:opacity-100 transition-all z-20 flex items-center gap-1 text-[10px] font-sports font-bold tracking-wider cursor-pointer"
                          title="Ver imagen completa"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">AMPLIAR</span>
                        </button>

                        {/* Badges superiores sobre la imagen */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
                          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider font-sports border border-white/20">
                            {item.category}
                          </span>
                          {item.prepTimeMinutes && (
                            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-white/20">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {item.prepTimeMinutes} min
                            </span>
                          )}
                        </div>

                        {!item.available && (
                          <div className="absolute top-2.5 right-2.5 z-20">
                            <span className="px-2.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black uppercase tracking-wider border border-white/20 shadow-md">
                              Agotado
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info del Platillo */}
                      <div className="p-3.5 space-y-1.5">
                        <h4
                          className={`font-black text-sm tracking-wide line-clamp-1 ${
                            theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                          }`}
                        >
                          {item.name}
                        </h4>
                        {item.description && (
                          <p
                            className={`text-xs line-clamp-2 leading-relaxed font-sans ${
                              theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                            }`}
                          >
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Precio y Botón Agregar */}
                    <div className="p-3.5 pt-0 flex items-center justify-between gap-2 border-t border-transparent mt-2">
                      <div>
                        <span
                          className={`text-base sm:text-lg font-black font-scoreboard ${
                            theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                          }`}
                        >
                          ${item.price.toLocaleString('es-MX')}
                        </span>
                        <span
                          className={`text-[10px] font-sans ml-1 ${
                            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          MXN
                        </span>
                      </div>

                      {item.available && (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-black font-sports rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 uppercase tracking-wider cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de Comanda General Unificado */}
          <div className={`p-5 rounded-2xl border shadow-xl space-y-4 h-fit sticky top-20 ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0F1626] border-slate-700/80 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700/80'
            }`}>
              <div className={`flex items-center gap-2 font-extrabold text-sm uppercase tracking-wider min-w-0 ${
                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
              }`}>
                <ShoppingBag className="w-4 h-4 text-red-500 shrink-0" />
                <span className="truncate">Carrito General de Comida</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {totalStandsCount > 0 ? `${totalStandsCount} ${totalStandsCount === 1 ? 'puesto' : 'puestos'} • ` : ''}
                  {totalCount} {totalCount === 1 ? 'artículo' : 'artículos'}
                </span>
                {totalCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllCarts}
                    className="text-[10px] text-red-500 hover:text-red-400 underline font-sans cursor-pointer ml-1"
                    title="Vaciar todo el carrito"
                  >
                    Vaciar
                  </button>
                )}
              </div>
            </div>

            {standOrdersList.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Utensils className={`w-8 h-8 mx-auto ${
                  theme === 'light' ? 'text-slate-400' : 'text-slate-600'
                }`} />
                <p className={`text-xs font-semibold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}>Tu comanda unificada está vacía</p>
                <p className={`text-[11px] font-sans px-2 leading-relaxed ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Selecciona y agrega platillos de cualquiera de los puestos del estadio. ¡Puedes comprar de diferentes negocios en una sola compra y el pago se dividirá automáticamente!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {standOrdersList.map((standGroup) => {
                  const isCurrentStand = selectedStand?.id === standGroup.standId;
                  return (
                    <div
                      key={standGroup.standId}
                      className={`p-2.5 rounded-xl border space-y-2 transition-all ${
                        isCurrentStand
                          ? theme === 'light'
                            ? 'bg-slate-50 border-red-200'
                            : 'bg-[#0D1424] border-red-500/30'
                          : theme === 'light'
                          ? 'bg-slate-50/70 border-slate-200'
                          : 'bg-[#0A0E17] border-slate-800'
                      }`}
                    >
                      {/* Cabecera del Puesto */}
                      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Store className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className={`font-extrabold text-xs truncate ${
                            theme === 'light' ? 'text-slate-900' : 'text-white'
                          }`} title={standGroup.standName}>
                            {standGroup.standName}
                          </span>
                          {!isCurrentStand && (
                            <button
                              type="button"
                              onClick={() => {
                                const found = stands.find((s) => s.id === standGroup.standId);
                                if (found) handleSelectStand(found);
                              }}
                              className="text-[10px] text-red-500 hover:underline shrink-0 font-semibold cursor-pointer"
                              title="Ver menú de este puesto"
                            >
                              (Ver menú)
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-scoreboard font-bold text-emerald-600 dark:text-emerald-400">
                            ${standGroup.subtotal.toLocaleString('es-MX')} MXN
                          </span>
                          <button
                            type="button"
                            onClick={() => clearSingleStandCart(standGroup.standId)}
                            className="p-0.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title={`Eliminar comanda de ${standGroup.standName}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Platillos de este puesto */}
                      <div className="space-y-1.5">
                        {standGroup.items.map((c) => (
                          <div
                            key={c.item.id}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border text-xs ${
                              theme === 'light'
                                ? 'bg-white border-slate-200 text-slate-900'
                                : 'bg-[#121929] border-slate-700/60 text-white'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold truncate text-[11px] ${
                                theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                              }`}>{c.item.name}</p>
                              <p className={`text-[10px] font-scoreboard font-bold ${
                                theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                              }`}>
                                ${(c.item.price * c.quantity).toLocaleString('es-MX')} MXN
                              </p>
                            </div>
                            <div className={`flex items-center gap-0.5 border rounded-md p-0.5 ${
                              theme === 'light'
                                ? 'bg-slate-50 border-slate-300 text-slate-900'
                                : 'bg-[#141C2E] border-slate-700 text-white'
                            }`}>
                              <button
                                onClick={() => updateCartQty(standGroup.standId, c.item.id, -1)}
                                className={`p-1 cursor-pointer ${
                                  theme === 'light' ? 'text-slate-600 hover:text-red-600' : 'text-slate-400 hover:text-red-400'
                                }`}
                                title="Quitar uno"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className={`text-[11px] font-bold px-1 font-mono ${
                                theme === 'light' ? 'text-slate-900' : 'text-white'
                              }`}>{c.quantity}</span>
                              <button
                                onClick={() => updateCartQty(standGroup.standId, c.item.id, 1)}
                                className={`p-1 cursor-pointer ${
                                  theme === 'light' ? 'text-slate-600 hover:text-emerald-600' : 'text-slate-400 hover:text-emerald-400'
                                }`}
                                title="Agregar uno más"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Desglose de división cuando hay más de un negocio */}
            {totalStandsCount > 1 && (
              <div className={`p-2.5 rounded-xl border text-[10.5px] font-sans space-y-1 ${
                theme === 'light' ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              }`}>
                <span className="font-bold block uppercase tracking-wider text-[9.5px]">División de Pago por Negocio:</span>
                <div className="space-y-0.5">
                  {standOrdersList.map((st) => (
                    <div key={st.standId} className="flex justify-between items-center">
                      <span className="truncate pr-1">• {st.standName}:</span>
                      <span className="font-scoreboard font-bold">${st.subtotal.toLocaleString('es-MX')} MXN</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-amber-200/50 dark:border-amber-500/20">
                  ⚡ 1 solo pago: El cobro se dividirá automáticamente y cada negocio recibirá su propia comanda.
                </p>
              </div>
            )}

            <div className={`pt-3 border-t space-y-3 ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700/80'
            }`}>
              <div className={`flex justify-between items-center text-sm font-black ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <span className="uppercase tracking-wider">Total Consolidado:</span>
                <span className={`font-scoreboard text-lg font-bold ${
                  theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                }`}>${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <button
                disabled={totalCount === 0}
                onClick={handleOpenCheckout}
                className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Comprar Todo en 1 Sola Compra</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra flotante móvil para continuar con el pedido sin scrollear */}
      {totalCount > 0 && (
        <div className="lg:hidden fixed bottom-20 left-3 right-3 z-30 animate-in slide-in-from-bottom-4 duration-200 font-sports">
          <div className={`p-3 rounded-2xl border shadow-2xl flex items-center justify-between gap-3 ${
            theme === 'light'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-[#101728] text-white border-slate-700'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center font-black text-xs text-white shrink-0">
                {totalCount}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-slate-400 truncate">
                  Comanda General • {totalStandsCount} {totalStandsCount === 1 ? 'negocio' : 'negocios'}
                </p>
                <p className="text-sm font-black font-scoreboard text-emerald-400">
                  ${total.toLocaleString('es-MX')} MXN
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenCheckout}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <span>Comprar Todo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Selección de Método de Entrega (Pickup vs In-Seat) & Método de Pago */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150 font-sports">
          <div className={`rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl border overflow-hidden my-auto animate-in zoom-in-95 duration-150 ${
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
                  }`}>Detalles y Pago de Comanda Unificada</h3>
                  <p className={`text-[11px] sm:text-xs font-sans ${
                    theme === 'light' ? 'text-slate-600' : '!text-[#E2E8F0] text-slate-300'
                  }`}>
                    {totalStandsCount} {totalStandsCount === 1 ? 'negocio' : 'negocios en comanda'} • {totalCount} {totalCount === 1 ? 'artículo' : 'artículos en total'}
                  </p>
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

              {/* Resumen Unificado de Negocios y División del Pago */}
              <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200 text-slate-900'
                  : 'bg-[#0A0E17] border-slate-700/80 text-white'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
                  }`}>
                    <ShoppingBag className="w-3.5 h-3.5 text-red-500" />
                    Resumen del Pedido por Negocio
                  </span>
                  <span className="text-xs font-scoreboard font-black text-emerald-600 dark:text-emerald-400">
                    Total: ${total.toLocaleString('es-MX')} MXN
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {standOrdersList.map((st) => (
                    <div
                      key={st.standId}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                        theme === 'light'
                          ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
                          : 'bg-[#121929] border-slate-800 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold border-b border-slate-100 dark:border-slate-800/80 pb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Store className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{st.standName}</span>
                          {st.standLocation && (
                            <span className="text-[10px] text-slate-500 font-normal truncate hidden sm:inline">
                              • {st.standLocation}
                            </span>
                          )}
                        </div>
                        <span className="font-scoreboard text-emerald-600 dark:text-emerald-400 shrink-0">
                          ${st.subtotal.toLocaleString('es-MX')} MXN
                        </span>
                      </div>
                      <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 font-sans">
                        {st.items.map((i) => (
                          <div key={i.item.id} className="flex justify-between items-center">
                            <span>{i.quantity}x {i.item.name}</span>
                            <span className="font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              ${(i.item.price * i.quantity).toLocaleString('es-MX')} MXN
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Explicación de la división automática */}
                <div className={`p-2.5 rounded-xl border text-[11px] font-sans flex items-start gap-2 ${
                  theme === 'light'
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                }`}>
                  <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Compra única con división automática:</strong>
                    <span>
                      Pagarás todo en una sola exhibición por un total de <strong>${total.toLocaleString('es-MX')} MXN</strong>. Al confirmarse el pago, el sistema creará automáticamente <strong>{totalStandsCount} {totalStandsCount === 1 ? 'orden de pedido' : 'órdenes de pedido independientes'}</strong> (una para cada negocio) y dividirá el dinero para que a cada concesionario le corresponda exactamente su cantidad.
                    </span>
                  </div>
                </div>
              </div>

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
        concept={`Comanda Unificada (${totalStandsCount} ${totalStandsCount === 1 ? 'negocio' : 'negocios'}: ${standOrdersList.map((s) => s.standName).join(', ')}) — ${
          selectedOrderType === 'in-seat'
            ? `Entrega a Butaca (${cleanSectionValue(seatSection) ? `Sec. ${cleanSectionValue(seatSection)}, Fila ${cleanRowValue(seatRow)}, Asiento ${cleanSeatValue(seatNumber)}` : 'Butaca'})`
            : 'Pick Up Express en Barra'
        } (${totalCount} platillos)`}
        customerName={user.displayName || user.email || 'Aficionado Teodoro Mariscal'}
        customerEmail={user.email || undefined}
        orderType="comida"
        metadata={{
          venueId: user.browsingVenueId || user.venueId || DEFAULT_VENUE_ID,
          standsCount: String(totalStandsCount),
          standsBreakdown: standOrdersList.map((s) => `${s.standName}: $${s.subtotal}`).join(' | '),
          orderType: selectedOrderType,
          itemsCount: String(totalCount),
          section: cleanSectionValue(seatSection) || '',
          row: cleanRowValue(seatRow) || '',
          seat: cleanSeatValue(seatNumber) || '',
        }}
        onSuccess={handleCardPaymentSuccess}
      />

      {/* Modal Popup de Confirmación Oficial de Pedido de Comida */}
      {completedFoodOrders.length > 0 && (
        <PurchaseSuccessModal
          isOpen={true}
          type="food"
          foodOrders={completedFoodOrders}
          onClose={() => {
            setCompletedFoodOrders([]);
            if (onOrderSuccess) onOrderSuccess();
          }}
          onNavigateToOrders={() => {
            setCompletedFoodOrders([]);
            if (onOrderSuccess) onOrderSuccess();
          }}
        />
      )}

      {/* Modal Lightbox de Vista Completa de Imagen del Platillo */}
      {previewDishImage && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewDishImage(null)}
        >
          <div
            className={`relative max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl border ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#0F1626] border-slate-700 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewDishImage(null)}
              className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors cursor-pointer"
              title="Cerrar vista previa"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative w-full h-72 sm:h-96 bg-black flex items-center justify-center overflow-hidden">
              <img
                src={previewDishImage.src}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-30 select-none pointer-events-none"
              />
              <img
                src={previewDishImage.src}
                alt={previewDishImage.title}
                className="relative z-10 max-h-full max-w-full object-contain p-2"
              />
            </div>

            <div className="p-5 font-sports space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="px-2.5 py-0.5 rounded-full bg-red-600/20 text-red-500 border border-red-500/30 text-[10px] font-black uppercase tracking-wider">
                  {previewDishImage.category || 'Alimentos & Bebidas'}
                </span>
                {typeof previewDishImage.price === 'number' && (
                  <span className="text-xl font-black font-scoreboard text-emerald-500">
                    ${previewDishImage.price.toLocaleString('es-MX')} MXN
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-wide">
                {previewDishImage.title}
              </h3>
              {previewDishImage.description && (
                <p className="text-xs sm:text-sm font-sans text-slate-300 leading-relaxed">
                  {previewDishImage.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

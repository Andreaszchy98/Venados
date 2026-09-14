import React, { useState, useEffect } from 'react';
import {
  StadiumStand,
  MenuItem,
  UserProfile,
  FoodOrderItem,
  OrderType,
  Ticket,
  Zone,
  VenueEvent,
} from '../../types';
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
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
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
} from 'lucide-react';

interface MenuStandProps {
  user: UserProfile;
  onOrderSuccess?: () => void;
  onGoToTickets?: () => void;
  onRequireAuth?: () => void;
}

export const MenuStand: React.FC<MenuStandProps> = ({ user, onOrderSuccess, onGoToTickets, onRequireAuth }) => {
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
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('in-seat');
  const [foodPaymentMethod, setFoodPaymentMethod] = useState<'Efectivo / Terminal física' | 'Tarjeta en Línea' | 'Venados Pay'>('Efectivo / Terminal física');
  
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
  } | null>(null);

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

  // Cargar tickets del aficionado para autocompletar butaca
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeUserTickets(
      user.uid,
      (tickets) => {
        const activeTickets = tickets.filter((t) => t.status === 'activo');
        setUserTickets(activeTickets);
        if (activeTickets.length > 0 && !selectedTicketId) {
          const first = activeTickets[0];
          setSelectedTicketId(first.id);
          setSeatSection(first.section);
          setSeatRow(first.row);
          setSeatNumber(first.seat);
        }
      },
      (err) => console.warn('Error fetching tickets for in-seat delivery:', err)
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user.uid]);

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
    const found = userTickets.find((t) => t.id === ticketId);
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

      const order = await createFoodOrder({
        standId: selectedStand.id,
        standName: selectedStand.name,
        userId: user.uid,
        customerName: user.displayName || 'Aficionado Teodoro Mariscal',
        orderType: selectedOrderType,
        items: foodItems,
        total,
        paymentMethod: foodPaymentMethod,
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
      });

      setCart([]);
      try {
        sessionStorage.removeItem('vxp_food_cart');
      } catch {}
      setIsCheckoutModalOpen(false);
      if (onOrderSuccess) onOrderSuccess();
    } catch (err: any) {
      console.error('Error placing food order:', err);
      setFormError(err.message || 'Error al procesar el pedido. Intenta de nuevo.');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (checkingOrderingWindow) {
    return (
      <div className="py-16">
        <LoadingSpinner message="Verificando eventos y horarios de servicio en el estadio..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Modo Catálogo si no hay evento en vivo */}
      {!activeOrderingEvent && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <Utensils className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">Catálogo y Menús de Concesiones</span>
              <span className="text-amber-200/80 text-[11px]">
                Explora los puestos y precios de alimentos del estadio. Los envíos de runners a butaca operan durante los horarios de partidos.
              </span>
            </div>
          </div>
          {upcomingEvent && (
            <span className="text-[11px] font-bold text-amber-300 bg-amber-400/15 px-3 py-1.5 rounded-xl border border-amber-400/20 shrink-0">
              Próximo evento: {upcomingEvent.name}
            </span>
          )}
        </div>
      )}

      {/* Banner Principal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-900 via-red-800 to-amber-900 text-white p-6 sm:p-8 border border-red-700/50 shadow-lg">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-xs border border-white/20 text-amber-200">
            <Sparkles className="w-3.5 h-3.5" /> Entrega a Butaca & Pickup Express • Estadio Teodoro Mariscal
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Pide Alimentos y Bebidas Directo a tu Asiento
          </h2>
          <p className="text-xs sm:text-sm text-red-100/90 max-w-2xl leading-relaxed">
            Ordena mariscos, tacos de asada, hamburguesas, botanas o cerveza de barril. Elige recibirlo con un <strong>Runner en tu butaca</strong> o recogerlo con tu <strong>Código Express</strong> sin hacer filas.
          </p>
        </div>
      </div>

      {/* Banner de Confirmación de Pedido Reciente */}
      {lastPlacedOrder && (
        <div className="p-5 bg-[#0F1626] border border-emerald-500/50 text-white rounded-2xl shadow-xl space-y-3 font-sports">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                ¡Orden Enviada a Cocina con Éxito!
              </h3>
            </div>
            <button
              onClick={() => setLastPlacedOrder(null)}
              className="text-xs text-slate-400 hover:text-white underline font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0E17] p-3.5 rounded-xl border border-slate-700/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium uppercase">Modalidad:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 uppercase">
                  {lastPlacedOrder.type === 'in-seat' ? '🚴 Entrega a Butaca' : '⚡ Pickup Express'}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-400 tracking-wider font-scoreboard mt-1">
                {lastPlacedOrder.code}
              </p>
            </div>

            <div className="text-xs text-slate-300 font-sans">
              {lastPlacedOrder.type === 'in-seat' ? (
                <div className="space-y-0.5">
                  <p className="font-bold text-white font-sports">
                    Destino: {formatDeliverySeat(lastPlacedOrder.section, lastPlacedOrder.row, lastPlacedOrder.seat)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Un Runner de estadio te lo llevará en cuanto la cocina lo tenga listo.
                  </p>
                </div>
              ) : (
                <p>
                  Pasa al mostrador cuando la pantalla o tu pestaña "Mis Pedidos" marque <strong className="text-emerald-400">LISTO</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selector de Puestos del Estadio */}
      {loadingStands ? (
        <LoadingSpinner message="Localizando puestos de comida en el estadio..." />
      ) : (
        <div className="space-y-4 font-sports">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
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
                    ? 'bg-[#0F1626] border-red-600 shadow-xl ring-2 ring-red-600/30'
                    : 'bg-[#0F1626]/80 border-slate-700/80 hover:bg-[#0F1626] hover:border-slate-600 shadow-md'
                }`}
              >
                <img
                  src={stand.image}
                  alt={stand.name}
                  className="w-12 h-12 rounded-lg object-cover bg-[#0A0E17] shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate tracking-wide">{stand.name}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-sans">
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="truncate">{stand.location}</span>
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 mt-1 font-sans">
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
            <div className="bg-[#0F1626] p-4 rounded-xl border border-slate-700/80 shadow-md flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white tracking-wide">{selectedStand.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-sans">
                  <MapPin className="w-3.5 h-3.5 text-red-500" /> {selectedStand.location}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/40 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                {selectedStand.categoryTag}
              </span>
            </div>

            {loadingMenu ? (
              <LoadingSpinner message="Cargando menú del puesto..." />
            ) : menuItems.length === 0 ? (
              <div className="bg-[#0F1626] p-8 rounded-xl border border-slate-700/80 text-center text-slate-400">
                No hay productos disponibles en este puesto en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0F1626] p-3.5 rounded-xl border border-slate-700/80 shadow-md hover:border-slate-600 transition-colors flex gap-3 justify-between"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-white tracking-wide">{item.name}</h4>
                        {!item.available && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded uppercase">
                            Agotado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-sans">
                        {item.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-400 font-scoreboard">
                          ${item.price.toLocaleString('es-MX')} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
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
                      className="w-16 h-16 rounded-lg object-cover bg-[#0A0E17] shrink-0 self-center"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de Comanda */}
          <div className="bg-[#0F1626] p-5 rounded-2xl border border-slate-700/80 shadow-xl space-y-4 h-fit sticky top-20 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
              <div className="flex items-center gap-2 font-extrabold text-sm text-white uppercase tracking-wider">
                <ShoppingBag className="w-4 h-4 text-red-500" />
                <span>Comanda del Estadio</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">{totalCount} platillos</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Utensils className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selecciona platillos del menú</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center justify-between gap-2 p-2 bg-[#0A0E17] rounded-lg border border-slate-700/80 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate tracking-wide">{c.item.name}</p>
                      <p className="text-[11px] text-emerald-400 font-scoreboard">
                        ${(c.item.price * c.quantity).toLocaleString('es-MX')} MXN
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#141C2E] border border-slate-700 rounded-md p-0.5">
                      <button
                        onClick={() => updateCartQty(c.item.id, -1)}
                        className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-white px-1 font-mono">{c.quantity}</span>
                      <button
                        onClick={() => updateCartQty(c.item.id, 1)}
                        className="p-1 text-slate-400 hover:text-emerald-400 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-700/80 space-y-3">
              <div className="flex justify-between items-center text-sm font-black text-white">
                <span className="uppercase tracking-wider">Total:</span>
                <span className="text-emerald-400 font-scoreboard text-lg">${total.toLocaleString('es-MX')} MXN</span>
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
          <div className="bg-[#0F1626] rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-700/80 overflow-hidden my-auto animate-in zoom-in-95 duration-150 text-white">
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-700/80 bg-[#0A0E17] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-950 text-red-500 rounded-xl border border-red-800/40">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm sm:text-base uppercase tracking-wider">Detalles y Pago del Pedido</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-sans">Puesto: {selectedStand?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-[#141C2E] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-700 text-red-300 rounded-xl text-xs flex items-start gap-2 font-sans">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Modalidad de Entrega */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  1. Modalidad de Entrega
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('in-seat')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedOrderType === 'in-seat'
                        ? 'border-red-500 bg-red-950/40 shadow-md text-white'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${selectedOrderType === 'in-seat' ? 'bg-red-600 text-white' : 'bg-[#141C2E] text-slate-400'}`}>
                        <Bike className="w-4 h-4" />
                      </div>
                      {selectedOrderType === 'in-seat' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-white uppercase tracking-wide">Entrega a mi Asiento</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Un Runner te lo lleva hasta tu butaca</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('pickup')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedOrderType === 'pickup'
                        ? 'border-amber-500 bg-amber-950/40 shadow-md text-white'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${selectedOrderType === 'pickup' ? 'bg-amber-600 text-slate-950' : 'bg-[#141C2E] text-slate-400'}`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      {selectedOrderType === 'pickup' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-white uppercase tracking-wide">Pickup Express</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Recoges en la barra con tu código</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulario de Ubicación para In-Seat */}
              {selectedOrderType === 'in-seat' && (
                <div className="bg-[#0A0E17] p-3.5 sm:p-4 rounded-2xl border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <Armchair className="w-4 h-4 text-red-500" /> ¿Dónde estás sentado?
                    </span>
                    {resolvedZone && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-400 border border-sky-600/40 uppercase">
                        {resolvedZone.name}
                      </span>
                    )}
                  </div>

                  {userTickets.length > 0 && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mb-1 font-sans">
                        <TicketIcon className="w-3 h-3 text-red-500" /> Usar ubicación de tu boleto activo:
                      </label>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {userTickets.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTicketSelect(t.id)}
                            className={`w-full p-2 rounded-xl text-left text-xs border flex items-center justify-between transition-all cursor-pointer ${
                              selectedTicketId === t.id
                                ? 'bg-red-950/40 border-red-500 shadow-xs font-bold text-white'
                                : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div>
                              <p className="truncate font-semibold">{t.matchTitle}</p>
                              <p className="text-[10px] text-slate-400 font-sans">
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
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1 font-sans">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase font-sports">Sección *</label>
                      <input
                        type="text"
                        placeholder="Ej: 102"
                        value={seatSection}
                        onChange={(e) => {
                          setSeatSection(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className="w-full px-2.5 py-2 bg-[#141C2E] border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase font-sports">Fila *</label>
                      <input
                        type="text"
                        placeholder="Ej: D"
                        value={seatRow}
                        onChange={(e) => {
                          setSeatRow(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className="w-full px-2.5 py-2 bg-[#141C2E] border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase font-sports">Asiento *</label>
                      <input
                        type="text"
                        placeholder="Ej: 14"
                        value={seatNumber}
                        onChange={(e) => {
                          setSeatNumber(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className="w-full px-2.5 py-2 bg-[#141C2E] border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Selector de Método de Pago */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  2. Método de Pago
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFoodPaymentMethod('Efectivo / Terminal física')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      foodPaymentMethod === 'Efectivo / Terminal física'
                        ? 'border-emerald-500 bg-emerald-950/40 shadow-xs'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">💵</span>
                      {foodPaymentMethod === 'Efectivo / Terminal física' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-white leading-tight uppercase">
                        Efectivo / Terminal física
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
                        Paga al recibir en tu butaca o en la barra
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFoodPaymentMethod('Tarjeta en Línea')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      foodPaymentMethod === 'Tarjeta en Línea'
                        ? 'border-red-500 bg-red-950/40 shadow-xs'
                        : 'border-slate-700 hover:border-slate-600 bg-[#0A0E17]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">💳</span>
                      {foodPaymentMethod === 'Tarjeta en Línea' && (
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-white leading-tight uppercase">
                        Tarjeta en Línea
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
                        Visa, Mastercard, Amex
                      </p>
                    </div>
                  </button>
                </div>

                {foodPaymentMethod === 'Efectivo / Terminal física' && (
                  <div className="p-2.5 bg-[#0A0E17] border border-emerald-500/50 rounded-xl text-[11px] text-emerald-300 font-medium flex items-center gap-2 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
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
            <div className="p-4 sm:p-5 border-t border-slate-700/80 bg-[#0A0E17] shrink-0 space-y-3">
              <div className="flex justify-between items-center text-xs sm:text-sm font-extrabold text-white">
                <span className="uppercase tracking-wider">Total a Pagar ({totalCount} items):</span>
                <span className="text-emerald-400 text-sm sm:text-base font-scoreboard">${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="px-4 py-2.5 bg-[#141C2E] border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  disabled={placingOrder}
                  onClick={handleConfirmOrder}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  {placingOrder ? (
                    'Enviando orden a cocina...'
                  ) : !user || !user.uid ? (
                    <>
                      <span>Iniciar Sesión para Confirmar Pedido</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Confirmar y Enviar Pedido</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

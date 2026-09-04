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
import { getActiveOrderingEvent, getNextUpcomingEvent } from '../../lib/venueEvents';
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
}

export const MenuStand: React.FC<MenuStandProps> = ({ user, onOrderSuccess, onGoToTickets }) => {
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingStands, setLoadingStands] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Verificación de ventana de pedidos activa
  const [checkingOrderingWindow, setCheckingOrderingWindow] = useState(true);
  const [activeOrderingEvent, setActiveOrderingEvent] = useState<VenueEvent | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<VenueEvent | null>(null);

  const checkOrderingWindow = async () => {
    setCheckingOrderingWindow(true);
    try {
      const vId = user.venueId || DEFAULT_VENUE_ID;
      const active = await getActiveOrderingEvent(vId);
      setActiveOrderingEvent(active);
      if (!active) {
        const next = await getNextUpcomingEvent(vId);
        setUpcomingEvent(next);
      }
    } catch (err) {
      console.error('Error al verificar pedidos activos:', err);
    } finally {
      setCheckingOrderingWindow(false);
    }
  };

  useEffect(() => {
    checkOrderingWindow();
  }, [user.venueId]);
  
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
        const data = await getStadiumStands();
        setStands(data);
        if (data.length > 0) {
          setSelectedStand(data[0]);
        }
      } catch (err) {
        console.error('Error fetching stands:', err);
      } finally {
        setLoadingStands(false);
      }
    };
    fetchStands();
  }, []);

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
      setSeatSection(found.section);
      setSeatRow(found.row);
      setSeatNumber(found.seat);
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0 || !selectedStand) return;
    setFormError(null);
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (cart.length === 0 || !selectedStand) return;

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
        section: selectedOrderType === 'in-seat' ? seatSection.trim() : undefined,
        row: selectedOrderType === 'in-seat' ? seatRow.trim() : undefined,
        seat: selectedOrderType === 'in-seat' ? seatNumber.trim() : undefined,
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

  if (!activeOrderingEvent) {
    return (
      <div className="space-y-6">
        {/* Banner Fuera de Horario */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 border border-slate-700/60 shadow-lg">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Clock className="w-3.5 h-3.5" /> Fuera de Horario de Evento
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Servicio de Alimentos No Disponible
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              No hay ningún evento en curso en este momento. Los pedidos de comida y bebida solo están disponibles durante el horario de eventos en el estadio.
            </p>
          </div>
        </div>

        {/* Tarjeta Explicativa con Próximo Evento */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs text-center space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <Utensils className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              Cocinas y Concesiones en Pausa
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
              No hay ningún evento en curso en este momento. Los pedidos de comida y bebida solo están disponibles durante el horario de eventos.
            </p>
          </div>

          {upcomingEvent ? (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/80 to-orange-50/50 rounded-2xl border border-amber-200 text-left space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Próximo Evento Programado
                </span>
              </div>
              <div className="flex gap-4 items-center">
                {upcomingEvent.posterUrl && (
                  <img
                    src={upcomingEvent.posterUrl}
                    alt={upcomingEvent.name}
                    className="w-16 h-20 object-cover rounded-xl border border-amber-200 shadow-xs shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                    {upcomingEvent.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Fecha: <strong className="text-slate-800">{upcomingEvent.date}</strong> ({upcomingEvent.time || '20:00 hrs'})
                  </p>
                  <p className="text-xs text-amber-900 mt-1.5 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>
                      Los pedidos abren:{' '}
                      {(() => {
                        const opens = upcomingEvent.orderingOpensAt;
                        if (!opens) return '2 horas antes del evento';
                        try {
                          const d = new Date(opens);
                          return (
                            d.toLocaleDateString('es-MX', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            }) +
                            ' a las ' +
                            d.toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) +
                            ' hrs'
                          );
                        } catch {
                          return '2 horas antes del evento';
                        }
                      })()}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
              No hay eventos futuros programados inmediatamente en el calendario de la sede.
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onGoToTickets && (
              <button
                onClick={onGoToTickets}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>Ver Cartelera y Comprar Boletos</span>
              </button>
            )}
            <button
              onClick={checkOrderingWindow}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>Comprobar de Nuevo</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            * La compra de boletos para cualquier partido o concierto sigue disponible en todo momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <h3 className="font-extrabold text-sm text-emerald-900">
                ¡Orden Enviada a Cocina con Éxito!
              </h3>
            </div>
            <button
              onClick={() => setLastPlacedOrder(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline font-semibold"
            >
              Cerrar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Modalidad:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  {lastPlacedOrder.type === 'in-seat' ? '🚴 Entrega a Butaca' : '⚡ Pickup Express'}
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700 tracking-wider font-mono mt-1">
                {lastPlacedOrder.code}
              </p>
            </div>

            <div className="text-xs text-slate-600">
              {lastPlacedOrder.type === 'in-seat' ? (
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900">
                    Destino: Sección {lastPlacedOrder.section}, Fila {lastPlacedOrder.row}, Asiento {lastPlacedOrder.seat}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Un Runner de estadio te lo llevará en cuanto la cocina lo tenga listo.
                  </p>
                </div>
              ) : (
                <p>
                  Pasa al mostrador cuando la pantalla o tu pestaña "Mis Pedidos" marque <strong>LISTO</strong>.
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-red-700" /> Concesiones & Puestos en Vivo
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
                className={`p-3.5 rounded-xl text-left border transition-all flex items-start gap-3 ${
                  selectedStand?.id === stand.id
                    ? 'bg-white border-red-700 shadow-md ring-2 ring-red-700/20'
                    : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <img
                  src={stand.image}
                  alt={stand.name}
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{stand.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-red-600 shrink-0" />
                    <span className="truncate">{stand.location}</span>
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 mt-1">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Menú del puesto seleccionado */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">{selectedStand.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-red-600" /> {selectedStand.location}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {selectedStand.categoryTag}
              </span>
            </div>

            {loadingMenu ? (
              <LoadingSpinner message="Cargando menú del puesto..." />
            ) : menuItems.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                No hay productos disponibles en este puesto en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors flex gap-3 justify-between"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-slate-900">{item.name}</h4>
                        {!item.available && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                            Agotado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-xs font-black text-red-900">
                          ${item.price.toLocaleString('es-MX')} MXN
                        </span>
                        {item.available && (
                          <button
                            onClick={() => addToCart(item)}
                            className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 transition-transform active:scale-95"
                          >
                            <Plus className="w-3 h-3" /> Agregar
                          </button>
                        )}
                      </div>
                    </div>

                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0 self-center"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito de Comanda */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 h-fit sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                <ShoppingBag className="w-4 h-4 text-red-700" />
                <span>Comanda del Estadio</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">{totalCount} platillos</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Utensils className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">Selecciona platillos del menú</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{c.item.name}</p>
                      <p className="text-[11px] text-red-800 font-semibold">
                        ${(c.item.price * c.quantity).toLocaleString('es-MX')} MXN
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5">
                      <button
                        onClick={() => updateCartQty(c.item.id, -1)}
                        className="p-1 text-slate-600 hover:text-red-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-1">{c.quantity}</span>
                      <button
                        onClick={() => updateCartQty(c.item.id, 1)}
                        className="p-1 text-slate-600 hover:text-red-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-sm font-black text-slate-900">
                <span>Total:</span>
                <span className="text-red-900">${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={handleOpenCheckout}
                className="w-full py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-700 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">Detalles y Pago del Pedido</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">Puesto: {selectedStand?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Modalidad de Entrega */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  1. Modalidad de Entrega
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('in-seat')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedOrderType === 'in-seat'
                        ? 'border-red-700 bg-red-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${selectedOrderType === 'in-seat' ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Bike className="w-4 h-4" />
                      </div>
                      {selectedOrderType === 'in-seat' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-700"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900">Entrega a mi Asiento</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Un Runner te lo lleva hasta tu butaca</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderType('pickup')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      selectedOrderType === 'pickup'
                        ? 'border-amber-700 bg-amber-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${selectedOrderType === 'pickup' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      {selectedOrderType === 'pickup' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-700"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900">Pickup Express</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Recoges en la barra con tu código</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulario de Ubicación para In-Seat */}
              {selectedOrderType === 'in-seat' && (
                <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Armchair className="w-4 h-4 text-red-700" /> ¿Dónde estás sentado?
                    </span>
                    {resolvedZone && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {resolvedZone.name}
                      </span>
                    )}
                  </div>

                  {userTickets.length > 0 && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mb-1">
                        <TicketIcon className="w-3 h-3 text-red-600" /> Usar ubicación de tu boleto activo:
                      </label>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto">
                        {userTickets.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTicketSelect(t.id)}
                            className={`w-full p-2 rounded-xl text-left text-xs border flex items-center justify-between transition-all cursor-pointer ${
                              selectedTicketId === t.id
                                ? 'bg-white border-red-700 shadow-xs font-bold text-slate-900'
                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <div>
                              <p className="truncate font-semibold">{t.matchTitle}</p>
                              <p className="text-[10px] text-slate-400">
                                Sección {t.section} • Fila {t.row} • Butaca {t.seat}
                              </p>
                            </div>
                            {selectedTicketId === t.id && (
                              <CheckCircle2 className="w-4 h-4 text-red-700 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Sección *</label>
                      <input
                        type="text"
                        placeholder="Ej: 102"
                        value={seatSection}
                        onChange={(e) => {
                          setSeatSection(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Fila *</label>
                      <input
                        type="text"
                        placeholder="Ej: D"
                        value={seatRow}
                        onChange={(e) => {
                          setSeatRow(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Asiento *</label>
                      <input
                        type="text"
                        placeholder="Ej: 14"
                        value={seatNumber}
                        onChange={(e) => {
                          setSeatNumber(e.target.value);
                          setSelectedTicketId('');
                        }}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Selector de Método de Pago */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  2. Método de Pago
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFoodPaymentMethod('Efectivo / Terminal física')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      foodPaymentMethod === 'Efectivo / Terminal física'
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">💵</span>
                      {foodPaymentMethod === 'Efectivo / Terminal física' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-slate-900 leading-tight">
                        Efectivo / Terminal física
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Paga al recibir en tu butaca o en la barra
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFoodPaymentMethod('Tarjeta en Línea')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      foodPaymentMethod === 'Tarjeta en Línea'
                        ? 'border-red-700 bg-red-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">💳</span>
                      {foodPaymentMethod === 'Tarjeta en Línea' && (
                        <span className="w-2 h-2 rounded-full bg-red-700"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-slate-900 leading-tight">
                        Tarjeta en Línea
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Visa, Mastercard, Amex
                      </p>
                    </div>
                  </button>
                </div>

                {foodPaymentMethod === 'Efectivo / Terminal física' && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 animate-pulse"></span>
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
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 shrink-0 space-y-3">
              <div className="flex justify-between items-center text-xs sm:text-sm font-extrabold text-slate-900">
                <span>Total a Pagar ({totalCount} items):</span>
                <span className="text-red-900 text-sm sm:text-base font-black">${total.toLocaleString('es-MX')} MXN</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  disabled={placingOrder}
                  onClick={handleConfirmOrder}
                  className="flex-1 py-3 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {placingOrder ? (
                    'Enviando orden a cocina...'
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

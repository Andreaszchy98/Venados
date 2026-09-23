import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  Ticket,
  FoodOrder,
  MerchOrder,
  VenueEvent,
} from '../../types';
import { subscribeUserTickets } from '../../lib/tickets';
import { subscribeUserFoodOrders } from '../../lib/foodOrders';
import { subscribeUserMerchOrders } from '../../lib/logistics';
import { getVenueEventById } from '../../lib/venueEvents';
import { formatDeliverySeat, cleanRowValue, cleanSeatValue } from '../../lib/seatUtils';
import { BoletoDetalle } from './BoletoDetalle';
import { FoodOrderDetalle } from './FoodOrderDetalle';
import { MerchOrderDetalle } from './MerchOrderDetalle';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ShoppingBag,
  Ticket as TicketIcon,
  Utensils,
  Package,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building,
  CreditCard,
  Bike,
  PackageCheck,
  XCircle,
  Sparkles,
  Inbox,
} from 'lucide-react';

interface MisComprasProps {
  user: UserProfile;
  onOpenAuth?: () => void;
  onNavigateToBuyTickets?: () => void;
  onNavigateToFood?: () => void;
  onNavigateToStore?: () => void;
}

type UnifiedPurchaseItem =
  | {
      id: string;
      type: 'ticket';
      createdAt: string;
      dateObj: Date;
      isActive: boolean;
      mainTicket: Ticket;
      siblingTickets: Ticket[];
      matchTitle: string;
      matchDate: string;
      matchTime?: string;
      stadium: string;
      totalPrice: number;
      seatsSummary: string;
      statusBadge: {
        label: string;
        className: string;
        Icon: any;
      };
    }
  | {
      id: string;
      type: 'food';
      createdAt: string;
      dateObj: Date;
      isActive: boolean;
      order: FoodOrder;
      totalPrice: number;
    }
  | {
      id: string;
      type: 'merch';
      createdAt: string;
      dateObj: Date;
      isActive: boolean;
      order: MerchOrder;
      totalPrice: number;
    };

export const MisCompras: React.FC<MisComprasProps> = ({
  user,
  onOpenAuth,
  onNavigateToBuyTickets,
  onNavigateToFood,
  onNavigateToStore,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();

  // Pestañas estilo Cinépolis: "activas" vs "pasadas"
  const [activeTab, setActiveTab] = useState<'activas' | 'pasadas'>('activas');

  // Estados de datos en tiempo real
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [merchOrders, setMerchOrders] = useState<MerchOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados para vistas de detalle dedicadas
  const [selectedTicket, setSelectedTicket] = useState<{
    ticket: Ticket;
    siblings: Ticket[];
  } | null>(null);
  const [selectedEventPoster, setSelectedEventPoster] = useState<VenueEvent | null>(null);
  const [selectedFoodOrder, setSelectedFoodOrder] = useState<FoodOrder | null>(null);
  const [selectedMerchOrder, setSelectedMerchOrder] = useState<MerchOrder | null>(null);

  // Escuchar póster del evento si se abre un boleto
  useEffect(() => {
    if (!selectedTicket) {
      setSelectedEventPoster(null);
      return;
    }
    const t = selectedTicket.ticket;
    if (t.eventId) {
      getVenueEventById(t.eventId)
        .then((ev) => {
          if (ev) setSelectedEventPoster(ev);
        })
        .catch(() => {});
    }
  }, [selectedTicket]);

  // Suscripciones en tiempo real a boletos, alimentos y tienda
  useEffect(() => {
    if (!user || !user.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 3) setLoading(false);
    };

    // 1. Boletos en tiempo real
    const unsubTickets = subscribeUserTickets(
      user.uid,
      (updatedTickets) => {
        setTickets(updatedTickets);
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    // 2. Alimentos en tiempo real
    const unsubFood = subscribeUserFoodOrders(
      user.uid,
      (updatedFoods) => {
        setFoodOrders(updatedFoods);
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    // 3. Mercancía en tiempo real
    const unsubMerch = subscribeUserMerchOrders(
      user.uid,
      (updatedMerch) => {
        setMerchOrders(updatedMerch);
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    return () => {
      unsubTickets();
      unsubFood();
      unsubMerch();
    };
  }, [user?.uid]);

  // Helper para verificar si la fecha del evento es hoy o a futuro
  const isDateTodayOrFuture = (dateStr?: string) => {
    if (!dateStr) return true;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Soportar fechas en formato YYYY-MM-DD o variantes
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const evDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
        return evDate.getTime() >= today.getTime();
      }

      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(23, 59, 59, 999);
        return parsed.getTime() >= today.getTime();
      }
      return true;
    } catch {
      return true;
    }
  };

  // Construir lista unificada con formato uniforme
  const unifiedItems = useMemo(() => {
    const list: UnifiedPurchaseItem[] = [];

    // --- 1. PROCESAR BOLETOS (Agrupados por purchaseId o individuales) ---
    const ticketGroups = new Map<string, Ticket[]>();
    const singleTickets: Ticket[] = [];

    for (const t of tickets) {
      if (t.purchaseId) {
        if (!ticketGroups.has(t.purchaseId)) {
          ticketGroups.set(t.purchaseId, []);
        }
        ticketGroups.get(t.purchaseId)!.push(t);
      } else {
        singleTickets.push(t);
      }
    }

    // Grupos con purchaseId
    for (const [pId, tList] of ticketGroups.entries()) {
      const first = tList[0];
      const hasActive = tList.some((t) => t.status === 'activo');
      const isEventFuture = isDateTodayOrFuture(first?.matchDate);
      const isActive = hasActive && isEventFuture;

      const seatsSummary =
        tList.length === 1
          ? `${first.section} • Fila ${cleanRowValue(first.row)}, Butaca ${cleanSeatValue(first.seat)}`
          : `${tList.length} Boletos • ${first.section} • Asientos: ${tList.map((t) => cleanSeatValue(t.seat)).join(', ')}`;

      const statusBadge = isActive
        ? {
            label: 'Acceso Válido',
            className:
              theme === 'light'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
            Icon: CheckCircle2,
          }
        : {
            label: tList.every((t) => t.status === 'cancelado') ? 'Cancelado' : 'Utilizado',
            className:
              theme === 'light'
                ? 'bg-slate-200 text-slate-800 border-slate-300'
                : 'bg-slate-800 text-slate-400 border-slate-700',
            Icon: Clock,
          };

      const dateObj = new Date(first.createdAt || first.matchDate || Date.now());

      list.push({
        id: `ticket-group-${pId}`,
        type: 'ticket',
        createdAt: first.createdAt || new Date().toISOString(),
        dateObj,
        isActive,
        mainTicket: first,
        siblingTickets: tList,
        matchTitle: first.matchTitle || 'Evento Deportivo',
        matchDate: first.matchDate || '',
        matchTime: first.matchTime,
        stadium: first.stadium || 'Estadio Teodoro Mariscal',
        totalPrice: tList.reduce((sum, t) => sum + (t.price || 0), 0),
        seatsSummary,
        statusBadge,
      });
    }

    // Boletos sueltos
    for (const t of singleTickets) {
      const isActive = t.status === 'activo' && isDateTodayOrFuture(t.matchDate);
      const seatsSummary = `${t.section} • Fila ${cleanRowValue(t.row)}, Butaca ${cleanSeatValue(t.seat)}`;

      const statusBadge = isActive
        ? {
            label: 'Acceso Válido',
            className:
              theme === 'light'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
            Icon: CheckCircle2,
          }
        : {
            label: t.status === 'cancelado' ? 'Cancelado' : 'Utilizado',
            className:
              theme === 'light'
                ? 'bg-slate-200 text-slate-800 border-slate-300'
                : 'bg-slate-800 text-slate-400 border-slate-700',
            Icon: Clock,
          };

      const dateObj = new Date(t.createdAt || t.matchDate || Date.now());

      list.push({
        id: `ticket-${t.id}`,
        type: 'ticket',
        createdAt: t.createdAt || new Date().toISOString(),
        dateObj,
        isActive,
        mainTicket: t,
        siblingTickets: [t],
        matchTitle: t.matchTitle || 'Evento Deportivo',
        matchDate: t.matchDate || '',
        matchTime: t.matchTime,
        stadium: t.stadium || 'Estadio Teodoro Mariscal',
        totalPrice: t.price || 0,
        seatsSummary,
        statusBadge,
      });
    }

    // --- 2. PROCESAR PEDIDOS DE COMIDA ---
    for (const order of foodOrders) {
      const isActive = order.status !== 'entregado' && order.status !== 'cancelado';
      const dateObj = new Date(order.createdAt || Date.now());

      list.push({
        id: `food-${order.id}`,
        type: 'food',
        createdAt: order.createdAt || new Date().toISOString(),
        dateObj,
        isActive,
        order,
        totalPrice: order.total || 0,
      });
    }

    // --- 3. PROCESAR COMPRAS DE TIENDA ---
    for (const order of merchOrders) {
      const isActive = order.status !== 'entregado' && order.status !== 'cancelado';
      const dateObj = new Date(order.createdAt || Date.now());

      list.push({
        id: `merch-${order.id}`,
        type: 'merch',
        createdAt: order.createdAt || new Date().toISOString(),
        dateObj,
        isActive,
        order,
        totalPrice: order.total || 0,
      });
    }

    // Ordenar toda la lista cronológicamente descendente (lo más nuevo arriba)
    return list.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [tickets, foodOrders, merchOrders, theme]);

  // Filtrar según pestaña activa (Cinépolis)
  const activeItems = useMemo(
    () => unifiedItems.filter((item) => item.isActive),
    [unifiedItems]
  );

  const pastItems = useMemo(
    () => unifiedItems.filter((item) => !item.isActive),
    [unifiedItems]
  );

  const displayedItems = activeTab === 'activas' ? activeItems : pastItems;

  // Badges y utilidades para comida con contraste WCAG AA en Modo Claro y Oscuro
  const getFoodStatusBadge = (order: FoodOrder) => {
    switch (order.status) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-amber-100 dark:bg-amber-950/70 text-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-500/50">
            Recibido
          </span>
        );
      case 'preparando':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase animate-pulse transition-colors bg-sky-100 dark:bg-sky-950/60 text-sky-950 dark:text-sky-300 border border-sky-400 dark:border-sky-500/40">
            Preparando
          </span>
        );
      case 'listo':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase animate-pulse transition-colors bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-500/40">
            {order.orderType === 'in-seat' ? 'Runner Asignado' : '¡Listo para recoger!'}
          </span>
        );
      case 'en-camino':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase animate-pulse transition-colors bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-300 border border-blue-400 dark:border-blue-500/40">
            🚴 En camino
          </span>
        );
      case 'entregado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-500/40">
            Entregado
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-rose-100 dark:bg-rose-950/60 text-rose-950 dark:text-rose-300 border border-rose-400 dark:border-rose-500/40">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            {order.status}
          </span>
        );
    }
  };

  // Badges y utilidades para tienda con contraste WCAG AA en Modo Claro y Oscuro
  const getMerchStatusBadge = (status: MerchOrder['status']) => {
    switch (status) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40">
            Pendiente Empaque
          </span>
        );
      case 'empacado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-sky-100 dark:bg-sky-950/60 text-sky-950 dark:text-sky-300 border border-sky-400 dark:border-sky-500/40">
            Empacado
          </span>
        );
      case 'en_transito':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase animate-pulse transition-colors bg-purple-100 dark:bg-purple-950/60 text-purple-950 dark:text-purple-300 border border-purple-400 dark:border-purple-500/40">
            En Tránsito
          </span>
        );
      case 'entregado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-500/40">
            Entregado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase transition-colors bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  // Vistas de detalle a pantalla completa
  if (selectedTicket) {
    return (
      <BoletoDetalle
        ticket={selectedTicket.ticket}
        siblingTickets={selectedTicket.siblings}
        event={selectedEventPoster}
        onBack={() => setSelectedTicket(null)}
      />
    );
  }

  if (selectedFoodOrder) {
    return (
      <FoodOrderDetalle
        order={selectedFoodOrder}
        onBack={() => setSelectedFoodOrder(null)}
      />
    );
  }

  if (selectedMerchOrder) {
    return (
      <MerchOrderDetalle
        order={selectedMerchOrder}
        onBack={() => setSelectedMerchOrder(null)}
      />
    );
  }

  // Estado si no está autenticado
  if (!user || !user.uid) {
    return (
      <div className="py-12 px-4 max-w-md mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-red-900/30 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-950/40">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white font-sports uppercase tracking-wider">
            Inicia sesión para ver tus compras
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
            Consulta en un solo lugar tus boletos oficiales para eventos, tus pedidos de comida entregados por Runners a tu butaca y tus compras en la tienda oficial.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAuth}
          className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-red-950/50 transition-all cursor-pointer font-sports"
        >
          Iniciar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sports max-w-4xl mx-auto">
      {/* Encabezado Principal y Pestañas estilo Cinépolis (Activas vs Pasadas) con soporte Dark/Light */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b transition-colors ${
        theme === 'light' ? 'border-slate-200' : 'border-slate-800'
      }`}>
        <div>
          <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-wider flex items-center gap-2.5 ${
            theme === 'light' ? 'text-slate-950' : 'text-white'
          }`}>
            <ShoppingBag className="w-6 h-6 text-red-500" />
            <span>Mis Compras</span>
          </h2>
          <p className={`text-xs font-sans mt-0.5 ${
            theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-400'
          }`}>
            Historial unificado de boletos, comida en estadio y mercancía oficial
          </p>
        </div>

        {/* Selector de Pestañas Cinépolis: Activas vs Pasadas */}
        <div className={`inline-flex rounded-2xl border p-1.5 text-xs font-bold self-start sm:self-center shadow-inner transition-colors ${
          theme === 'light' ? 'bg-slate-200/80 border-slate-300' : 'bg-[#0A0E17] border-slate-800'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('activas')}
            className={`px-5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === 'activas'
                ? 'bg-red-600 text-white shadow-lg shadow-red-950/40 font-black'
                : theme === 'light'
                ? 'text-slate-700 hover:text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Activas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'activas'
                  ? 'bg-black/30 text-white'
                  : theme === 'light'
                  ? 'bg-slate-300 text-slate-900'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {activeItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pasadas')}
            className={`px-5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === 'pasadas'
                ? 'bg-red-600 text-white shadow-lg shadow-red-950/40 font-black'
                : theme === 'light'
                ? 'text-slate-700 hover:text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pasadas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'pasadas'
                  ? 'bg-black/30 text-white'
                  : theme === 'light'
                  ? 'bg-slate-300 text-slate-900'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {pastItems.length}
            </span>
          </button>
        </div>
      </div>

      {/* Lista Unificada */}
      {loading ? (
        <LoadingSpinner message="Consultando tus compras y boletos..." />
      ) : displayedItems.length === 0 ? (
        <div className={`border rounded-3xl p-12 text-center space-y-4 transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-600 shadow-xs'
            : 'bg-[#0F1626] border-slate-800 text-slate-400 shadow-xl'
        }`}>
          <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto shadow-inner ${
            theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#0A0E17] border-slate-800 text-slate-500'
          }`}>
            <Inbox className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className={`text-base font-extrabold uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>
              {activeTab === 'activas'
                ? 'No tienes compras ni boletos activos'
                : 'No tienes compras pasadas'}
            </h3>
            <p className={`text-xs font-sans max-w-sm mx-auto ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              {activeTab === 'activas'
                ? 'Tus próximos accesos al estadio, pedidos de comida en butaca o envíos de tienda aparecerán aquí automáticamente.'
                : 'El historial de eventos pasados o pedidos entregados se archivará en esta sección.'}
            </p>
          </div>

          {activeTab === 'activas' && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              {onNavigateToBuyTickets && (
                <button
                  type="button"
                  onClick={onNavigateToBuyTickets}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <TicketIcon className="w-3.5 h-3.5" />
                  <span>Comprar Boletos</span>
                </button>
              )}
              {onNavigateToFood && (
                <button
                  type="button"
                  onClick={onNavigateToFood}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Pedir Comida</span>
                </button>
              )}
              {onNavigateToStore && (
                <button
                  type="button"
                  onClick={onNavigateToStore}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 border ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Ir a la Tienda</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedItems.map((item) => {
            // ==================== TARJETA: BOLETO DE EVENTO ====================
            if (item.type === 'ticket') {
              const { statusBadge } = item;
              const StatusIcon = statusBadge.Icon;

              return (
                <div
                  key={item.id}
                  onClick={() =>
                    setSelectedTicket({
                      ticket: item.mainTicket,
                      siblings: item.siblingTickets,
                    })
                  }
                  role="button"
                  tabIndex={0}
                  className={`group rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 relative overflow-hidden hover:border-red-500/50 ${
                    theme === 'light'
                      ? 'bg-white hover:bg-slate-50 border-slate-300'
                      : 'bg-[#0F1626] hover:bg-[#141D32] border-slate-700/80'
                  }`}
                >
                  {/* Borde izquierdo rojo para identificar boletos */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-red-500 to-red-700" />

                  {/* Encabezado: Badge Tipo + Título + Fecha a la izquierda, Total + Estatus a la derecha */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-1.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/60 text-red-950 dark:text-red-300 border border-red-300 dark:border-red-500/40">
                          <TicketIcon className="w-3 h-3" />
                          <span>
                            {item.siblingTickets.length > 1
                              ? `${item.siblingTickets.length} Boletos`
                              : 'Boleto Digital'}
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-800 dark:text-slate-300 font-semibold font-sans flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-red-500" />
                          {item.matchDate} {item.matchTime ? `• ${item.matchTime}` : ''}
                        </span>
                      </div>
                      <h3
                        className={`font-extrabold text-sm sm:text-base tracking-wide transition-colors ${
                          theme === 'light'
                            ? 'text-slate-950 hover:text-red-600'
                            : 'text-white hover:text-red-300'
                        }`}
                      >
                        {item.matchTitle || 'Boleto de Acceso'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      <span className="text-sm sm:text-base font-black text-emerald-800 dark:text-emerald-400 font-scoreboard">
                        ${item.totalPrice.toLocaleString('es-MX')}{' '}
                        <span className="text-[10px] text-slate-700 dark:text-slate-400 font-sans font-bold">MXN</span>
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 hidden xs:inline">•</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${statusBadge.className}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusBadge.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Asiento y Recinto Deportivo */}
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs px-3.5 py-2.5 rounded-xl border ml-1.5 bg-slate-100/90 dark:bg-[#0A0E17] border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span
                        className={`font-bold font-sports ${
                          theme === 'light' ? 'text-slate-950' : 'text-white'
                        }`}
                      >
                        {item.seatsSummary}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold font-sans flex items-center gap-1">
                      <span className={theme === 'light' ? 'text-slate-900' : 'text-slate-300'}>
                        {item.stadium}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all ml-1" />
                    </div>
                  </div>
                </div>
              );
            }

            // ==================== TARJETA: PEDIDO DE COMIDA ====================
            if (item.type === 'food') {
              const { order } = item;
              const formattedLocation = formatDeliverySeat(order.section, order.row, order.seat);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedFoodOrder(order)}
                  role="button"
                  tabIndex={0}
                  className={`group rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 relative overflow-hidden hover:border-amber-500/50 ${
                    theme === 'light'
                      ? 'bg-white hover:bg-slate-50 border-slate-300'
                      : 'bg-[#0F1626] hover:bg-[#141D32] border-slate-700/80'
                  }`}
                >
                  {/* Borde izquierdo ámbar/naranja para identificar comida */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-amber-500 to-amber-700" />

                  {/* Encabezado: Código + Stand + Fecha a la izquierda, Total + Estatus a la derecha */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pl-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 bg-red-600 text-white font-scoreboard font-black text-sm sm:text-base rounded-xl shadow-md shrink-0">
                        {order.pickupCode}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40">
                            <Utensils className="w-3 h-3" />
                            <span>Alimentos</span>
                          </span>
                          <span className="text-[11px] text-slate-800 dark:text-slate-300 font-semibold flex items-center gap-1 font-sans">
                            <Clock className="w-3 h-3 text-red-500" />
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            • {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3
                          className={`font-extrabold text-sm sm:text-base transition-colors mt-0.5 tracking-wide ${
                            theme === 'light'
                              ? 'text-slate-950 hover:text-amber-700'
                              : 'text-white hover:text-amber-300'
                          }`}
                        >
                          {order.standName}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      <span className="text-sm sm:text-base font-black text-emerald-800 dark:text-emerald-400 font-scoreboard">
                        ${order.total.toLocaleString('es-MX')}{' '}
                        <span className="text-[10px] text-slate-700 dark:text-slate-400 font-sans font-bold">MXN</span>
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 hidden xs:inline">•</span>
                      {getFoodStatusBadge(order)}
                    </div>
                  </div>

                  {/* Modalidad de Entrega */}
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs px-3.5 py-2.5 rounded-xl border ml-1.5 bg-slate-100/90 dark:bg-[#0A0E17] border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.orderType === 'in-seat' ? (
                        <>
                          <Bike className="w-4 h-4 text-red-500" />
                          <span
                            className={`font-bold uppercase tracking-wider text-[11px] ${
                              theme === 'light' ? 'text-slate-950' : 'text-white'
                            }`}
                          >
                            Entrega a Butaca:
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded border ${
                              theme === 'light'
                                ? 'text-red-950 bg-red-100 border-red-300'
                                : 'text-red-300 bg-red-950/60 border-red-800/60'
                            }`}
                          >
                            {formattedLocation}
                          </span>
                        </>
                      ) : (
                        <>
                          <PackageCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span
                            className={`font-bold ${
                              theme === 'light' ? 'text-slate-950' : 'text-slate-100'
                            }`}
                          >
                            Pickup Express en mostrador
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-[11px] font-sans flex items-center gap-1.5 font-semibold">
                      <span className={theme === 'light' ? 'text-slate-800' : 'text-slate-300'}>
                        {order.items.reduce((s, i) => s + i.quantity, 0)} artículos
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all ml-1" />
                    </div>
                  </div>

                  {/* Platillos resumen */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-900 dark:text-slate-200 pl-2">
                    {order.items.slice(0, 3).map((i, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5">
                        <span className="font-black text-white bg-red-600 px-1.5 py-0.2 rounded text-[10px] font-mono">
                          {i.quantity}x
                        </span>
                        <span
                          className={`font-bold ${
                            theme === 'light' ? 'text-slate-950' : 'text-white'
                          }`}
                        >
                          {i.name}
                        </span>
                      </span>
                    ))}
                    {order.items.length > 3 && (
                      <span className="text-[11px] text-slate-700 dark:text-slate-400 font-semibold italic">
                        +{order.items.length - 3} más...
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // ==================== TARJETA: COMPRA DE TIENDA ====================
            if (item.type === 'merch') {
              const { order } = item;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedMerchOrder(order)}
                  role="button"
                  tabIndex={0}
                  className={`group rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 relative overflow-hidden hover:border-blue-500/50 ${
                    theme === 'light'
                      ? 'bg-white hover:bg-slate-50 border-slate-300'
                      : 'bg-[#0F1626] hover:bg-[#141D32] border-slate-700/80'
                  }`}
                >
                  {/* Borde izquierdo azul para identificar mercancía */}
                  <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-blue-500 to-blue-700" />

                  {/* Encabezado: ID + Tipo de Entrega a la izquierda, Total + Estatus a la derecha */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pl-1.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40">
                          <Package className="w-3 h-3" />
                          <span>Tienda Oficial</span>
                        </span>
                        <span className="font-scoreboard text-xs font-bold px-2 py-0.5 rounded border bg-slate-200 dark:bg-[#0A0E17] text-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                          ID: {order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-800 dark:text-slate-300 font-semibold font-sans">
                          • {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3
                        className={`font-extrabold text-sm sm:text-base transition-colors mt-1 tracking-wide ${
                          theme === 'light'
                            ? 'text-slate-950 hover:text-blue-700'
                            : 'text-white hover:text-blue-300'
                        }`}
                      >
                        {order.shippingType === 'domicilio'
                          ? 'Envío a Domicilio'
                          : 'Retiro en Tienda Estadio'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      <span className="text-sm sm:text-base font-black text-emerald-800 dark:text-emerald-400 font-scoreboard">
                        ${order.total.toLocaleString('es-MX')}{' '}
                        <span className="text-[10px] text-slate-700 dark:text-slate-400 font-sans font-bold">MXN</span>
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 hidden xs:inline">•</span>
                      {getMerchStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Modalidad y Destino */}
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs px-3.5 py-2.5 rounded-xl border ml-1.5 bg-slate-100/90 dark:bg-[#0A0E17] border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.shippingType === 'domicilio' ? (
                        <>
                          <Truck className="w-4 h-4 text-blue-500" />
                          <span
                            className={`font-bold font-sans ${
                              theme === 'light' ? 'text-slate-950' : 'text-slate-100'
                            }`}
                          >
                            {order.carrier || 'Paquetería'}:
                          </span>
                          {order.trackingNumber ? (
                            <span className="font-mono font-bold px-2 py-0.5 rounded border text-red-950 dark:text-red-300 bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-800/60">
                              #{order.trackingNumber}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 italic font-sans font-semibold">
                              Asignando transportista...
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Building className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span
                            className={`font-bold ${
                              theme === 'light' ? 'text-slate-950' : 'text-slate-100'
                            }`}
                          >
                            Retiro en Tienda Oficial Teodoro Mariscal
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-[11px] font-semibold font-sans flex items-center gap-1">
                      {order.shippingAddress && (
                        <span className={theme === 'light' ? 'text-slate-800' : 'text-slate-300'}>
                          📍 {order.shippingAddress.city}, {order.shippingAddress.state}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all ml-1" />
                    </div>
                  </div>

                  {/* Artículos resumen */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-900 dark:text-slate-200 pl-2">
                    {order.items.slice(0, 2).map((item, idx) => {
                      const itemName =
                        item.name ||
                        (item as any)?.product?.name ||
                        (item as any)?.product?.title ||
                        (item as any)?.title ||
                        (item as any)?.productName ||
                        'Artículo Oficial';
                      return (
                        <span key={idx} className="inline-flex items-center gap-1.5">
                          <span className="font-black text-white bg-red-600 px-1.5 py-0.2 rounded text-[10px] font-mono">
                            {item.quantity}x
                          </span>
                          <span
                            className={`font-bold truncate max-w-[200px] ${
                              theme === 'light' ? 'text-slate-950' : 'text-white'
                            }`}
                          >
                            {itemName}
                          </span>
                        </span>
                      );
                    })}
                    {order.items.length > 2 && (
                      <span className="text-[11px] text-slate-700 dark:text-slate-400 font-semibold italic">
                        +{order.items.length - 2} más...
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  StadiumStand,
  MenuItem,
  FoodOrder,
  FoodOrderStatus,
  MenuItemCategory,
  VenueEvent,
} from '../../types';
import {
  getStadiumStands,
  getMenuItemsByStand,
  toggleMenuItemAvailability,
  saveMenuItem,
  deleteMenuItem,
} from '../../lib/stands';
import {
  listenToStandFoodOrders,
  advanceFoodOrderStatus,
  assignRunnerToOrder,
} from '../../lib/foodOrders';
import { getRunnersForStand } from '../../lib/auth';
import {
  getActiveOrderingEvent,
  getNextUpcomingEvent,
  subscribeVenueEventStatus,
  getEventPosterPlaceholder,
} from '../../lib/venueEvents';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { formatDeliverySeat } from '../../lib/seatUtils';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ConfirmationModal } from '../../components/shared/ConfirmationModal';
import {
  Utensils,
  Clock,
  CheckCircle2,
  Bell,
  AlertCircle,
  Plus,
  Edit3,
  Store,
  ChefHat,
  Eye,
  RefreshCw,
  X,
  Save,
  Trash2,
  Image as ImageIcon,
  Check,
  Search,
  SlidersHorizontal,
  Flame,
  Calendar,
  AlertTriangle,
  Bike,
  Mail,
  DollarSign,
  Receipt,
  Printer,
  ShieldCheck,
  TrendingUp,
  Package,
  Users,
  FileText,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { SendToHostEmailModal } from '../../components/shared/SendToHostEmailModal';
import {
  HostEmailPayload,
  buildFoodOrderHostEmail,
} from '../../lib/orderEmailService';

const PRESET_FOOD_IMAGES = [
  {
    name: 'Tacos de Asada',
    url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    category: 'comida',
  },
  {
    name: 'Aguachile / Mariscos',
    url: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
    category: 'comida',
  },
  {
    name: 'Hamburguesa con Queso',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    category: 'comida',
  },
  {
    name: 'Hot Dog / Dogo Estadio',
    url: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80',
    category: 'snack',
  },
  {
    name: 'Nachos con Queso y Jalapeño',
    url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80',
    category: 'snack',
  },
  {
    name: 'Cerveza de Barril Bien Fría',
    url: 'https://images.unsplash.com/photo-1608270119293-1b9195b45265?w=600&auto=format&fit=crop&q=80',
    category: 'cerveza',
  },
  {
    name: 'Refresco / Bebida con Hielo',
    url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
    category: 'bebida',
  },
  {
    name: 'Churros & Postre Caliente',
    url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&auto=format&fit=crop&q=80',
    category: 'snack',
  },
];

export type ConcesionarioTab = 'comanda' | 'menu' | 'ventas' | 'logistica';

interface ConcesionarioViewProps {
  user: UserProfile;
}

export const ConcesionarioView: React.FC<ConcesionarioViewProps> = ({ user }) => {
  const targetVenueId = user.venueId || DEFAULT_VENUE_ID;
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [allVenueStands, setAllVenueStands] = useState<StadiumStand[]>([]);
  const [activeTab, setActiveTab] = useState<ConcesionarioTab>('comanda');

  // Comanda en tiempo real y runners del negocio
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [runners, setRunners] = useState<UserProfile[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estados para Corte de Caja y Filtros de Ventas
  const [isCorteModalOpen, setIsCorteModalOpen] = useState(false);
  const [ventasSearch, setVentasSearch] = useState('');
  const [ventasFilter, setVentasFilter] = useState<'todos' | 'pagado' | 'pendiente'>('todos');

  // Ref para contar cambios de órdenes y sonido de alerta en cocina
  const prevOrdersCountRef = React.useRef<number>(0);
  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const venueDisplayName =
    user.venueName ||
    (targetVenueId === 'venue-tomateros'
      ? 'Estadio Tomateros'
      : targetVenueId === 'venue-encanto'
      ? 'Estadio El Encanto'
      : 'Estadio Teodoro Mariscal');

  useEffect(() => {
    if (selectedStand) {
      getRunnersForStand(selectedStand.id, targetVenueId)
        .then((list) => setRunners(list))
        .catch(() => {});
    }
  }, [selectedStand, targetVenueId]);

  const handleAssignRunner = async (orderId: string, runnerUid: string) => {
    setActionLoading(orderId);
    try {
      const selectedRunner = runners.find((r) => r.uid === runnerUid);
      const runnerName = selectedRunner?.displayName || 'Runner';
      await assignRunnerToOrder(orderId, runnerUid, runnerName);
    } catch (err: any) {
      console.error('Error asignando runner:', err);
      alert(err.message || 'No se pudo asignar el runner a la orden');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtros de menú
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('todos');

  // Modal para agregar / editar producto al menú
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalPayload, setEmailModalPayload] = useState<HostEmailPayload | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 90,
    category: 'comida',
    prepTimeMinutes: 5,
    available: true,
    image: PRESET_FOOD_IMAGES[0].url,
  });
  const [savingItem, setSavingItem] = useState(false);

  // Modal para confirmar eliminación
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Verificación de ventana de evento activo en la sede
  const [activeEvent, setActiveEvent] = useState<VenueEvent | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<VenueEvent | null>(null);
  const [checkingEvent, setCheckingEvent] = useState(true);

  const checkEventStatus = async () => {
    setCheckingEvent(true);
    try {
      const active = await getActiveOrderingEvent(targetVenueId);
      setActiveEvent(active);
      const next = await getNextUpcomingEvent(targetVenueId);
      setUpcomingEvent(next);
    } catch (err) {
      console.error('Error checking active ordering event in ConcesionarioView:', err);
    } finally {
      setCheckingEvent(false);
    }
  };

  useEffect(() => {
    setCheckingEvent(true);
    const unsubscribe = subscribeVenueEventStatus(
      targetVenueId,
      (status) => {
        setActiveEvent(status.activeEvent);
        setUpcomingEvent(status.upcomingEvent);
        setCheckingEvent(false);
      },
      () => {
        setCheckingEvent(false);
      }
    );
    return () => unsubscribe();
  }, [targetVenueId]);

  // Cargar negocios pertenecientes estrictamente a la sede actual
  useEffect(() => {
    const fetchStands = async () => {
      setLoading(true);
      try {
        const data = await getStadiumStands(targetVenueId);
        setAllVenueStands(data);

        if (data.length > 0) {
          // Asignar el stand correspondiente al concesionario estrictamente en esta sede
          let matched: StadiumStand | undefined = undefined;
          if (user.standId) {
            matched = data.find(
              (s) => s.id === user.standId && (s.venueId || DEFAULT_VENUE_ID) === targetVenueId
            );
          }
          if (!matched && user.uid) {
            matched = data.find(
              (s) => s.ownerId === user.uid && (s.venueId || DEFAULT_VENUE_ID) === targetVenueId
            );
          }
          // Si el usuario es administrador o superadmin explorando la vista simulada de concesionario,
          // permitir seleccionar o visualizar el primer puesto de esta sede
          if (!matched && (user.role === 'admin' || user.role === 'superadmin')) {
            matched = data[0];
          }

          setSelectedStand(matched || null);
        } else {
          setSelectedStand(null);
        }
      } catch (err) {
        console.error('Error fetching stands for venue:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStands();
  }, [user.uid, user.standId, targetVenueId, user.role]);

  // Escuchar órdenes en tiempo real con AISLAMIENTO ESTRICTO DE NEGOCIO Y SEDE
  useEffect(() => {
    if (!selectedStand) {
      setOrders([]);
      return;
    }

    const standVenue = selectedStand.venueId || targetVenueId;

    const unsubscribe = listenToStandFoodOrders(
      selectedStand.id,
      (liveOrders) => {
        // Doble verificación inmutable de seguridad: solo órdenes que correspondan a este stand y a esta sede
        const strictlyIsolated = liveOrders.filter(
          (o) =>
            o.standId === selectedStand.id &&
            (o.venueId || DEFAULT_VENUE_ID) === standVenue
        );

        if (strictlyIsolated.length > prevOrdersCountRef.current && prevOrdersCountRef.current > 0) {
          playNotificationSound();
        }
        prevOrdersCountRef.current = strictlyIsolated.length;

        setOrders(strictlyIsolated);
      },
      (err) => {
        console.warn('Error escuchando órdenes del puesto en tiempo real:', err);
      },
      standVenue
    );

    const loadMenu = async () => {
      const items = await getMenuItemsByStand(selectedStand.id);
      setMenuItems(items);
    };
    loadMenu();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedStand, targetVenueId]);

  const handleAdvanceStatus = async (orderId: string, nextStatus: FoodOrderStatus) => {
    setActionLoading(orderId);
    try {
      await advanceFoodOrderStatus(orderId, nextStatus);
    } catch (err) {
      console.error('Error advancing status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAvailability = async (itemId: string, current: boolean) => {
    try {
      await toggleMenuItemAvailability(itemId, !current);
      setMenuItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, available: !current } : i))
      );
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setFormData({
      name: '',
      description: '',
      price: 95,
      category: 'comida',
      prepTimeMinutes: 5,
      available: true,
      image: PRESET_FOOD_IMAGES[0].url,
    });
    setIsMenuModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setIsEditing(true);
    setFormData({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      prepTimeMinutes: item.prepTimeMinutes || 5,
      available: item.available,
      image: item.image || PRESET_FOOD_IMAGES[0].url,
    });
    setIsMenuModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStand || !formData.name || !formData.price) return;
    setSavingItem(true);
    try {
      await saveMenuItem({
        ...formData,
        standId: selectedStand.id,
      } as any);
      setIsMenuModalOpen(false);
      const updated = await getMenuItemsByStand(selectedStand.id);
      setMenuItems(updated);
    } catch (err) {
      console.error('Error saving menu item:', err);
      alert('Error al guardar platillo. Asegúrate de tener permisos sobre este puesto.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete || !selectedStand) return;
    setDeletingItem(true);
    try {
      await deleteMenuItem(itemToDelete.id);
      setMenuItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting menu item:', err);
      alert('Error al eliminar el platillo');
    } finally {
      setDeletingItem(false);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pendiente');
  const preparingOrders = orders.filter((o) => o.status === 'preparando');
  const readyOrders = orders.filter((o) => o.status === 'listo');
  const inTransitOrders = orders.filter((o) => o.status === 'en-camino');
  const completedOrders = orders.filter((o) => o.status === 'entregado');

  const paidOrders = orders.filter((o) => o.paymentStatus === 'pagado' || o.status === 'entregado');
  const totalTodayRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const commissionRate = selectedStand?.commissionRate ?? 15;
  const stadiumCommissionAmount = Math.round((totalTodayRevenue * commissionRate) / 100);
  const netVendorRevenue = totalTodayRevenue - stadiumCommissionAmount;
  const averageTicket = paidOrders.length > 0 ? Math.round(totalTodayRevenue / paidOrders.length) : 0;

  const cardRevenue = paidOrders
    .filter((o) => o.paymentMethod?.toLowerCase().includes('tarjeta') || o.paymentDetails)
    .reduce((sum, o) => sum + o.total, 0);

  const cashRevenue = paidOrders
    .filter((o) => !o.paymentMethod?.toLowerCase().includes('tarjeta') && !o.paymentDetails)
    .reduce((sum, o) => sum + o.total, 0);

  const filteredSalesOrders = orders.filter((order) => {
    const matchesSearch =
      order.customerName.toLowerCase().includes(ventasSearch.toLowerCase()) ||
      order.pickupCode.toLowerCase().includes(ventasSearch.toLowerCase()) ||
      order.id.toLowerCase().includes(ventasSearch.toLowerCase());
    const matchesFilter =
      ventasFilter === 'todos' ||
      (ventasFilter === 'pagado' && (order.paymentStatus === 'pagado' || order.status === 'entregado')) ||
      (ventasFilter === 'pendiente' && order.paymentStatus === 'pendiente' && order.status !== 'entregado');
    return matchesSearch && matchesFilter;
  });

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchesCat =
      menuCategoryFilter === 'todos' || item.category === menuCategoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header del Operador de Concesión Deportivo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 font-sports">
              <Store className="w-3 h-3" />
              <span>Sede: {venueDisplayName}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Aislamiento Estricto Activo</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2 font-sports">
            <ChefHat className="w-6 h-6 text-amber-400" />
            <span>{selectedStand ? selectedStand.name : 'Operación de Concesiones & Negocio'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span>📍 {selectedStand ? selectedStand.location : venueDisplayName}</span>
            {selectedStand && (
              <>
                <span>•</span>
                <span>Comisión Estadio: {commissionRate}%</span>
                <span>•</span>
                <span>ID Negocio: <strong className="text-slate-300 font-mono text-[11px]">{selectedStand.id}</strong></span>
              </>
            )}
          </p>
        </div>

        {/* Información fija o selector de puesto si es admin */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {(user.role === 'admin' || user.role === 'superadmin') && allVenueStands.length > 1 && (
            <div className="flex items-center gap-2 bg-[#0F1626] px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-md">
              <span className="text-[10px] text-slate-400 font-bold uppercase font-sports">Cambiar Local:</span>
              <select
                value={selectedStand?.id || ''}
                onChange={(e) => {
                  const s = allVenueStands.find((st) => st.id === e.target.value);
                  if (s) setSelectedStand(s);
                }}
                className="bg-[#141C2E] border border-slate-600 text-white rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {allVenueStands.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedStand && (
            <div className="flex items-center gap-2.5 bg-[#0F1626] px-4 py-2 rounded-2xl border border-slate-700/80 shadow-md">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-white leading-none font-sports uppercase tracking-wider">{selectedStand.name}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{selectedStand.location}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Si el concesionario no tiene puesto vinculado en esta sede */}
      {!loading && !selectedStand && (
        <div className="p-8 bg-[#0F1626] border border-amber-500/40 rounded-3xl text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40 shadow-inner">
            <Store className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-black text-white font-sports uppercase tracking-wider">
              Negocio No Vinculado en {venueDisplayName}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tu cuenta de concesionario no tiene asignado un negocio comercial en <strong>{venueDisplayName}</strong>. Para garantizar la estricta seguridad del negocio y evitar que veas pedidos de otros locales u otras sedes, un administrador debe vincular tu negocio en el módulo <strong>"Personal y Accesos"</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Banner de Estado de Evento en Sede */}
      {!checkingEvent && !activeEvent && (
        <div className="p-4 sm:p-5 bg-[#0F1626] border border-amber-500/40 rounded-2xl sm:rounded-3xl shadow-lg space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-red-600 to-amber-500" />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-black text-sm font-sports uppercase tracking-wide">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Sin Evento Deportivo Activo en este Momento</span>
            </div>
            <button
              onClick={checkEventStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#141C2E] hover:bg-[#1A253D] text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Actualizar estado</span>
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            La recepción de nuevos pedidos de comida y bebida por parte de aficionados está pausada hasta que inicie la ventana del próximo evento programado en el estadio. Puedes seguir administrando los platillos, precios y disponibilidad de tu menú en la pestaña <strong className="text-white">"Control de Menú"</strong>.
          </p>
          {upcomingEvent && (
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 bg-[#141C2E] p-3.5 rounded-2xl border border-slate-700/80 shadow-xs">
                {(() => {
                  const posterSrc =
                    normalizeGoogleDriveImageUrl(upcomingEvent.posterUrl) ||
                    getEventPosterPlaceholder(upcomingEvent.type || 'baseball');
                  return (
                    <div className="w-24 sm:w-28 h-16 sm:h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shadow-xs shrink-0 relative flex items-center justify-center">
                      <img
                        src={posterSrc}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-xs opacity-40 scale-110 pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <img
                        src={posterSrc}
                        alt={upcomingEvent.name}
                        className="relative z-10 max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = getEventPosterPlaceholder(
                            upcomingEvent.type || 'baseball'
                          );
                        }}
                      />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-black uppercase tracking-wider font-sports">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Próximo Partido Programado</span>
                  </div>
                  <h4 className="font-black text-sm sm:text-base text-white leading-snug font-sports tracking-wide">
                    {upcomingEvent.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                    <span>
                      Fecha: <strong className="text-white">{upcomingEvent.date}</strong> ({upcomingEvent.time || '20:00 hrs'})
                    </span>
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Apertura pedidos:{' '}
                      {(() => {
                        const opens = upcomingEvent.orderingOpensAt;
                        if (!opens) return '2h antes';
                        try {
                          return (
                            new Date(opens).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) + ' hrs'
                          );
                        } catch {
                          return '2h antes';
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!checkingEvent && activeEvent && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl shadow-lg flex items-center justify-between flex-wrap gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-center gap-3">
            {(() => {
              const posterSrc =
                normalizeGoogleDriveImageUrl(activeEvent.posterUrl) ||
                getEventPosterPlaceholder(activeEvent.type || 'baseball');
              return (
                <div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-950 border border-emerald-500/40 shadow-xs shrink-0 relative flex items-center justify-center">
                  <img
                    src={posterSrc}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-xs opacity-40 scale-110 pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  <img
                    src={posterSrc}
                    alt={activeEvent.name}
                    className="relative z-10 max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = getEventPosterPlaceholder(
                        activeEvent.type || 'baseball'
                      );
                    }}
                  />
                </div>
              );
            })()}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <p className="text-xs font-black text-emerald-200 font-sports uppercase tracking-wider">
                  PARTIDO EN JUEGO: {activeEvent.name}
                </p>
              </div>
              <p className="text-[11px] text-emerald-300 font-medium mt-0.5">
                Ventana de pedidos abierta en el estadio hasta las{' '}
                {(() => {
                  if (!activeEvent.orderingClosesAt) return 'finalizar el juego';
                  try {
                    return (
                      new Date(activeEvent.orderingClosesAt).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }) + ' hrs'
                    );
                  } catch {
                    return 'cierre del evento';
                  }
                })()}
              </p>
            </div>
          </div>
          <button
            onClick={checkEventStatus}
            className="text-xs text-emerald-300 hover:text-white underline font-bold cursor-pointer"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* Tarjetas KPI de Cocina y Ventas del Negocio */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#0F1626] border border-amber-500/50 rounded-2xl p-4 shadow-lg">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-400 font-sports">1. Por Preparar</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{pendingOrders.length}</p>
        </div>

        <div className="bg-[#0F1626] border border-blue-500/50 rounded-2xl p-4 shadow-lg">
          <p className="text-[11px] font-black uppercase tracking-wider text-blue-400 font-sports">2. En Cocina</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{preparingOrders.length}</p>
        </div>

        <div className="bg-[#0F1626] border border-emerald-500/50 rounded-2xl p-4 shadow-lg">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 font-sports">3. Listos / En Camino</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{readyOrders.length + inTransitOrders.length}</p>
        </div>

        <div className="bg-[#0F1626] border border-slate-700/80 text-white rounded-2xl p-4 shadow-lg">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sports">Ventas del Puesto</p>
          <p className="text-xl sm:text-2xl font-black mt-1 text-emerald-400 font-scoreboard">${totalTodayRevenue.toLocaleString('es-MX')} MXN</p>
        </div>
      </div>

      {/* 4 Pestañas de Gestión Completa del Negocio */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('comanda')}
          className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2 font-sports cursor-pointer shrink-0 ${
            activeTab === 'comanda'
              ? 'bg-red-700 text-white shadow-lg shadow-red-950/40 border border-red-500/50'
              : 'bg-[#101625] text-slate-300 hover:bg-[#162035] border border-slate-700/80 hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Comanda en Vivo ({pendingOrders.length + preparingOrders.length + readyOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2 font-sports cursor-pointer shrink-0 ${
            activeTab === 'menu'
              ? 'bg-red-700 text-white shadow-lg shadow-red-950/40 border border-red-500/50'
              : 'bg-[#101625] text-slate-300 hover:bg-[#162035] border border-slate-700/80 hover:text-white'
          }`}
        >
          <Utensils className="w-4 h-4 text-red-400" />
          <span>Menú e Inventario ({menuItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ventas')}
          className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2 font-sports cursor-pointer shrink-0 ${
            activeTab === 'ventas'
              ? 'bg-red-700 text-white shadow-lg shadow-red-950/40 border border-red-500/50'
              : 'bg-[#101625] text-slate-300 hover:bg-[#162035] border border-slate-700/80 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Administración de Ventas</span>
        </button>

        <button
          onClick={() => setActiveTab('logistica')}
          className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2 font-sports cursor-pointer shrink-0 ${
            activeTab === 'logistica'
              ? 'bg-red-700 text-white shadow-lg shadow-red-950/40 border border-red-500/50'
              : 'bg-[#101625] text-slate-300 hover:bg-[#162035] border border-slate-700/80 hover:text-white'
          }`}
        >
          <Bike className="w-4 h-4 text-blue-400" />
          <span>Logística & Entregas ({runners.length} runners)</span>
        </button>
      </div>

      {/* Vista de Comanda en Vivo */}
      {activeTab === 'comanda' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-12 text-center text-slate-400 space-y-2 shadow-lg">
              <ChefHat className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-base font-black text-white font-sports uppercase tracking-wider">No hay pedidos registrados en este puesto</p>
              <p className="text-xs text-slate-400">Los pedidos que hagan los aficionados aparecerán aquí automáticamente en tiempo real con alerta sonora y visual.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => {
                const isPending = order.status === 'pendiente';
                const isPreparing = order.status === 'preparando';
                const isReady = order.status === 'listo';
                const isDelivered = order.status === 'entregado';

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border p-4.5 shadow-lg flex flex-col justify-between space-y-3 transition-all relative overflow-hidden ${
                      isReady
                        ? 'bg-[#0c1c1a] border-emerald-500/80 ring-2 ring-emerald-500/30'
                        : isPreparing
                        ? 'bg-[#0e172a] border-blue-500/70'
                        : isPending
                        ? 'bg-[#1a1412] border-amber-500/80 animate-pulse'
                        : 'bg-[#0F1626] border-slate-700/80 opacity-70'
                    }`}
                  >
                    <div>
                      {/* Código de Retiro & Modalidad */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-scoreboard text-2xl font-black text-amber-400 bg-[#0A0E17] px-3 py-0.5 rounded-xl shadow-inner border border-amber-500/40 tracking-wider">
                            {order.pickupCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider font-sports ${
                              order.orderType === 'in-seat'
                                ? 'bg-purple-900/60 text-purple-300 border border-purple-500/50'
                                : 'bg-amber-900/60 text-amber-300 border border-amber-500/50'
                            }`}
                          >
                            {order.orderType === 'in-seat' ? '🚴 Butaca' : '⚡ Pickup'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Cliente y Ubicación */}
                      <div className="pt-2.5 space-y-0.5">
                        <p className="font-black text-xs text-white font-sports tracking-wide">{order.customerName}</p>
                        {order.orderType === 'in-seat' ? (
                          <p className="text-[11px] font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded-lg border border-red-500/40 inline-block font-sports">
                            📍 {formatDeliverySeat(order.section, order.row, order.seat)}
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-400">Retiro Express en mostrador</span>
                        )}
                      </div>

                      {/* Selector de Runner para Entregas a Butaca */}
                      {order.orderType === 'in-seat' && !isDelivered && (
                        <div className="bg-[#0A0E17] p-2.5 rounded-xl border border-blue-500/40 space-y-1.5 mt-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-black text-blue-400 font-sports flex items-center gap-1.5 uppercase">
                              <Bike className="w-3.5 h-3.5 text-blue-400" /> Asignar Runner de Entrega:
                            </span>
                            {order.runnerId && (
                              <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/50 uppercase">
                                ✓ {order.runnerName || 'Asignado'}
                              </span>
                            )}
                          </div>

                          <select
                            id={`select-runner-${order.id}`}
                            value={order.runnerId || ''}
                            onChange={(e) => handleAssignRunner(order.id, e.target.value)}
                            disabled={actionLoading === order.id}
                            className="w-full px-3 py-2 bg-[#141C2E] border border-blue-800/70 text-white rounded-xl text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm font-sans"
                          >
                            <option value="">-- Asignar Runner para Despacho --</option>
                            {runners.length === 0 ? (
                              <option value="" disabled>No hay runners asignados a este negocio</option>
                            ) : (
                              runners.map((r) => (
                                <option key={r.uid} value={r.uid}>
                                  🚴 {r.displayName || 'Runner'} {r.runnerStatus ? `(${r.runnerStatus})` : ''}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      {/* Lista de platillos */}
                      <div className="mt-3 bg-[#0A0E17]/90 p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between items-center font-bold text-slate-200">
                            <span>
                              <span className="text-red-400 font-black">{i.quantity}x</span> {i.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-semibold">${i.price * i.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botones de Cambio de Estado Rápido */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span>Total: <strong className="text-emerald-400 font-scoreboard text-base">${order.total} MXN</strong></span>
                        {order.paymentStatus === 'pagado' || order.paymentDetails || (order.paymentMethod && order.paymentMethod.toLowerCase().includes('tarjeta')) ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            💳 Tarjeta Acreditada
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[10px] font-medium">
                            💵 Cobro en Entrega
                          </span>
                        )}
                      </div>

                      {isPending && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'preparando')}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer font-sports"
                        >
                          Iniciar Preparación en Cocina
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'listo')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sports"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>
                            {order.orderType === 'in-seat'
                              ? '¡Listo en Barra para Runner!'
                              : '¡Listo para Retiro de Aficionado!'}
                          </span>
                        </button>
                      )}

                      {isReady && order.orderType === 'pickup' && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'entregado')}
                          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sports"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Entregar al Aficionado (Pickup)</span>
                        </button>
                      )}

                      {isReady && order.orderType === 'in-seat' && (
                        <div className="p-2 bg-purple-950/70 text-purple-300 border border-purple-500/40 rounded-xl text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span>Listo en barra • Esperando que un Runner lo tome</span>
                        </div>
                      )}

                      {order.status === 'en-camino' && (
                        <div className="p-2 bg-blue-950/70 text-blue-300 border border-blue-500/40 rounded-xl text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                          <span className="animate-pulse">🚴</span>
                          <span>En camino con Runner hacia Butaca {order.seat}</span>
                        </div>
                      )}

                      {isDelivered && (
                        <div className="text-center text-[11px] font-bold text-slate-400 py-1.5 bg-[#0A0E17] rounded-xl border border-slate-800">
                          ✓ Pedido Entregado
                        </div>
                      )}

                      {/* Botón de Enviar copia de la orden al correo del anfitrión */}
                      <button
                        type="button"
                        onClick={() => {
                          const payload = buildFoodOrderHostEmail([order], selectedStand, 'Estadio Teodoro Mariscal');
                          setEmailModalPayload(payload);
                          setIsEmailModalOpen(true);
                        }}
                        className="w-full py-1.5 px-2 bg-slate-900/80 hover:bg-red-950/40 border border-slate-700/80 hover:border-red-600/50 text-slate-300 hover:text-red-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Enviar orden al correo del anfitrión / cocina"
                      >
                        <Mail className="w-3 h-3 text-red-400" />
                        <span>Enviar al correo del anfitrión / cocina</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista de Control de Menú */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          {/* Barra superior de acciones y filtros */}
          <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-base text-white flex items-center gap-2 font-sports uppercase tracking-wide">
                  <span>Menú de {selectedStand?.name || 'Mi Negocio'}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                    {menuItems.length} {menuItems.length === 1 ? 'producto' : 'productos'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Agrega nuevos productos con foto, edita precios, gestiona disponibilidad o elimina artículos de tu menú.
                </p>
              </div>

              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0 font-sports border border-red-500/50"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Platillo / Bebida</span>
              </button>
            </div>

            {/* Búsqueda y Filtros por Categoría */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-800">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en mi menú..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#141C2E] border border-slate-700 rounded-xl focus:bg-[#1A253D] focus:outline-none focus:border-red-500 font-medium text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'comida', label: 'Comidas' },
                  { id: 'bebida', label: 'Bebidas' },
                  { id: 'cerveza', label: 'Cervezas' },
                  { id: 'snack', label: 'Snacks' },
                  { id: 'combo', label: 'Combos' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setMenuCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer font-sports ${
                      menuCategoryFilter === cat.id
                        ? 'bg-red-700 text-white shadow-md border border-red-500/50'
                        : 'bg-[#141C2E] text-slate-300 hover:bg-[#1C2842] border border-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grilla de Platillos */}
          {filteredMenuItems.length === 0 ? (
            <div className="bg-[#0F1626] p-12 text-center rounded-2xl border border-slate-700/80 space-y-3 shadow-lg">
              <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-sm text-white font-sports uppercase tracking-wide">
                  {menuSearch || menuCategoryFilter !== 'todos'
                    ? 'No se encontraron platillos con esos filtros'
                    : 'Aún no tienes platillos registrados en tu menú'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {menuSearch || menuCategoryFilter !== 'todos'
                    ? 'Prueba modificando la búsqueda o seleccionando otra categoría.'
                    : 'Haz clic en "Nuevo Platillo" para comenzar a recibir órdenes de los aficionados.'}
                </p>
              </div>
              {!menuSearch && menuCategoryFilter === 'todos' && (
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md inline-flex items-center gap-1.5 cursor-pointer font-sports border border-red-500/50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear mi Primer Platillo</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-[#0F1626] rounded-2xl border overflow-hidden shadow-lg flex flex-col justify-between transition-all ${
                    item.available
                      ? 'border-slate-700/80 hover:border-slate-600'
                      : 'border-slate-800 opacity-60 bg-[#0C121F]'
                  }`}
                >
                  <div>
                    {/* Imagen del Platillo (Completa, sin recortes) */}
                    <div className="relative h-40 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                      <img
                        src={normalizeGoogleDriveImageUrl(item.image) || PRESET_FOOD_IMAGES[0].url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-25 select-none pointer-events-none"
                      />
                      <img
                        src={normalizeGoogleDriveImageUrl(item.image) || PRESET_FOOD_IMAGES[0].url}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="relative z-10 w-full h-full object-contain p-2 drop-shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PRESET_FOOD_IMAGES[0].url;
                        }}
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider font-sports border border-slate-700/60">
                          {item.category}
                        </span>
                        {item.prepTimeMinutes && (
                          <span className="px-2 py-0.5 rounded-lg bg-[#0F1626]/90 backdrop-blur-xs text-slate-200 text-[10px] font-bold flex items-center gap-1 shadow-xs border border-slate-700/60">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {item.prepTimeMinutes} min
                          </span>
                        )}
                      </div>

                      {/* Badge de disponibilidad en foto */}
                      <div className="absolute top-2 right-2 z-20">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase shadow-md font-sports ${
                            item.available
                              ? 'bg-emerald-600 text-white border border-emerald-400/50'
                              : 'bg-red-700 text-white border border-red-500/50'
                          }`}
                        >
                          {item.available ? 'En Menú' : 'Agotado'}
                        </span>
                      </div>
                    </div>

                    {/* Contenido descriptivo */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-black text-sm text-white leading-tight font-sports tracking-wide">
                          {item.name}
                        </h4>
                        <span className="font-black text-base text-amber-400 whitespace-nowrap font-scoreboard">
                          ${item.price} <span className="text-[10px] font-semibold text-slate-400">MXN</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                        {item.description || 'Sin descripción detallada.'}
                      </p>
                    </div>
                  </div>

                  {/* Acciones del Platillo (Disponibilidad, Editar, Eliminar) */}
                  <div className="p-4 pt-0 border-t border-slate-800/80 mt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleAvailability(item.id, item.available)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex-1 text-center font-sports ${
                        item.available
                          ? 'bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/80 border border-emerald-500/40'
                          : 'bg-amber-950/70 text-amber-300 hover:bg-amber-900/80 border border-amber-500/40'
                      }`}
                    >
                      {item.available ? '✓ Disponible' : '⚠️ Activar Venta'}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        title="Editar platillo o foto"
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setItemToDelete(item)}
                        title="Eliminar de mi menú"
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vista de Administración de Ventas & Corte de Caja */}
      {activeTab === 'ventas' && (
        <div className="space-y-6">
          {/* Tarjetas de Métricas Financieras del Negocio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0F1626] border border-emerald-500/50 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <DollarSign className="w-16 h-16 text-emerald-400" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sports">Ventas Brutas Cobradas</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-scoreboard">
                ${totalTodayRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400">MXN</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{paidOrders.length} transacciones exitosas</span>
              </p>
            </div>

            <div className="bg-[#0F1626] border border-blue-500/50 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <TrendingUp className="w-16 h-16 text-blue-400" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sports">Ticket Promedio</p>
              <p className="text-2xl sm:text-3xl font-black text-blue-400 mt-1 font-scoreboard">
                ${averageTicket.toLocaleString('es-MX')} <span className="text-xs text-slate-400">MXN</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Promedio por comanda despachada
              </p>
            </div>

            <div className="bg-[#0F1626] border border-amber-500/50 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Receipt className="w-16 h-16 text-amber-400" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sports">Comisión Estadio ({commissionRate}%)</p>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-scoreboard">
                -${stadiumCommissionAmount.toLocaleString('es-MX')} <span className="text-xs text-slate-400">MXN</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Canon operativo del recinto deportivo
              </p>
            </div>

            <div className="bg-[#0F1626] border border-purple-500/50 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Store className="w-16 h-16 text-purple-400" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-sports">Ingreso Neto Negocio ({100 - commissionRate}%)</p>
              <p className="text-2xl sm:text-3xl font-black text-purple-400 mt-1 font-scoreboard">
                ${netVendorRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400">MXN</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Utilidad líquida exclusiva del concesionario
              </p>
            </div>
          </div>

          {/* Desglose por Método de Pago & Botón de Corte de Caja */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-sports flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Tarjeta en Línea / Stripe</span>
              </h3>
              <p className="text-2xl font-black text-white font-scoreboard">
                ${cardRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400">MXN</span>
              </p>
              <p className="text-xs text-slate-400">
                Pagos procesados y verificados digitalmente a través de la pasarela Stripe y Venados Pay.
              </p>
            </div>

            <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-sports flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Efectivo & Terminal Presencial</span>
              </h3>
              <p className="text-2xl font-black text-white font-scoreboard">
                ${cashRevenue.toLocaleString('es-MX')} <span className="text-xs text-slate-400">MXN</span>
              </p>
              <p className="text-xs text-slate-400">
                Cobros presenciales registrados en mostrador de comida o recibidos por runners en butaca.
              </p>
            </div>

            <div className="bg-[#0F1626] border border-amber-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-3 bg-gradient-to-br from-[#0F1626] to-[#172033]">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-sports flex items-center gap-2">
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Corte de Caja Oficial</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Genera el reporte fiscal y de auditoría del turno actual para conciliación con la administración del estadio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCorteModalOpen(true)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all font-sports cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Generar Corte de Caja</span>
              </button>
            </div>
          </div>

          {/* Tabla de Auditoría de Comandas del Negocio */}
          <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white font-sports uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-400" />
                  <span>Auditoría de Comandas del Negocio</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registro exclusivo de órdenes vinculadas a este puesto y sede ({orders.length} totales)
                </p>
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, código..."
                    value={ventasSearch}
                    onChange={(e) => setVentasSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#141C2E] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <select
                  value={ventasFilter}
                  onChange={(e) => setVentasFilter(e.target.value as any)}
                  className="bg-[#141C2E] border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="todos">Todos los pagos</option>
                  <option value="pagado">Pagados</option>
                  <option value="pendiente">Pendientes</option>
                </select>
              </div>
            </div>

            {filteredSalesOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold">No se encontraron comandas con los filtros aplicados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#141C2E] text-slate-400 text-[10px] font-black uppercase font-sports tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Platillos</th>
                      <th className="py-2.5 px-3">Método</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredSalesOrders.map((order) => {
                      const isPaid = order.paymentStatus === 'pagado' || order.status === 'entregado';
                      return (
                        <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400 font-mono">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 font-scoreboard font-bold text-amber-400 text-sm whitespace-nowrap">
                            {order.pickupCode}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-sports ${
                              order.orderType === 'in-seat'
                                ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40'
                                : 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                            }`}>
                              {order.orderType === 'in-seat' ? '🚴 Butaca' : '⚡ Pickup'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                            {order.customerName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}>
                            {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                            {order.paymentDetails ? `Tarjeta ${order.paymentDetails.cardBrand || ''} ****${order.paymentDetails.cardLast4 || ''}` : order.paymentMethod || 'Efectivo'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-sports ${
                              isPaid
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {isPaid ? '✓ Pagado' : '⏳ Pendiente'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-scoreboard font-black text-sm text-emerald-400 whitespace-nowrap">
                            ${order.total} MXN
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vista de Logística & Entregas */}
      {activeTab === 'logistica' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0F1626] border border-amber-500/50 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-400 font-sports">Entregas en Mostrador</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">
                {orders.filter((o) => o.orderType === 'pickup').length}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">Pickup Express con código en pantalla</p>
            </div>

            <div className="bg-[#0F1626] border border-purple-500/50 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-black uppercase tracking-wider text-purple-400 font-sports">Entregas en Butaca</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">
                {orders.filter((o) => o.orderType === 'in-seat').length}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">Despachadas por Runners del estadio</p>
            </div>

            <div className="bg-[#0F1626] border border-blue-500/50 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-black uppercase tracking-wider text-blue-400 font-sports">Runners Vinculados</p>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">
                {runners.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">Personal disponible para entrega en butaca</p>
            </div>

            <div className="bg-[#0F1626] border border-emerald-500/50 rounded-2xl p-5 shadow-lg">
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 font-sports">Comandas en Camino</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-scoreboard">
                {inTransitOrders.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">En ruta hacia la butaca del aficionado</p>
            </div>
          </div>

          {/* Runners Disponibles en este Puesto */}
          <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-black text-white font-sports uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span>Equipo de Runners Asignados</span>
            </h3>
            {runners.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <Bike className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs">No hay runners vinculados directamente a este puesto en {venueDisplayName}.</p>
                <p className="text-[11px] text-slate-500">Un administrador puede asignar runners a tu puesto o zona desde el módulo Personal y Accesos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {runners.map((r) => (
                  <div key={r.uid} className="bg-[#141C2E] border border-slate-700/80 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black font-sports shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{r.displayName || r.email}</p>
                      <p className="text-[10px] text-slate-400 truncate">{r.assignedZone || 'Zona General'}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase font-sports ${
                        r.runnerStatus === 'disponible'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : r.runnerStatus === 'en_entrega'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {r.runnerStatus || 'disponible'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cola de Entregas Activas en Butaca */}
          <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-black text-white font-sports uppercase tracking-wider flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-400" />
              <span>Monitoreo de Despacho a Butacas en Vivo</span>
            </h3>

            {orders.filter((o) => o.orderType === 'in-seat' && o.status !== 'entregado' && o.status !== 'cancelado').length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-white">Todas las entregas en butaca están al día</p>
                <p className="text-[11px] text-slate-400">Las nuevas órdenes in-seat aparecerán aquí para seguimiento logístico.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders
                  .filter((o) => o.orderType === 'in-seat' && o.status !== 'entregado' && o.status !== 'cancelado')
                  .map((order) => (
                    <div key={order.id} className="bg-[#141C2E] border border-purple-500/40 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-scoreboard text-lg font-bold text-amber-400">{order.pickupCode}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-500/40 uppercase font-black font-sports">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white">{order.customerName}</p>
                      <p className="text-[11px] text-red-300 font-sports">📍 {formatDeliverySeat(order.section, order.row, order.seat)}</p>
                      <div className="text-[11px] text-slate-300">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Runner: <strong className="text-white">{order.runnerId ? runners.find((r) => r.uid === order.runnerId)?.displayName || 'Asignado' : 'Sin asignar'}</strong></span>
                        <span className="font-scoreboard text-emerald-400 font-bold">${order.total} MXN</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0F1626] w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/90 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150 text-white">
            <div className="bg-[#141C2E] text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-700/80">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-700 rounded-xl border border-red-500/40">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base font-sports uppercase tracking-wider">
                    {isEditing ? 'Editar Platillo del Menú' : 'Nuevo Platillo / Bebida'}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-amber-400 font-medium">
                    Puesto: {selectedStand?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs sm:text-sm">
              {/* Sección de Fotografía */}
              <div className="space-y-2">
                <label className="block font-black text-slate-300 font-sports uppercase tracking-wider text-xs">Foto del Platillo o Bebida</label>

                {/* Previsualización actual */}
                <div className="flex items-center gap-3 p-2 bg-[#141C2E] border border-slate-700 rounded-xl">
                  <div className="w-16 h-16 rounded-lg bg-slate-900 overflow-hidden shrink-0 border border-slate-700">
                    <img
                      src={formData.image || PRESET_FOOD_IMAGES[0].url}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PRESET_FOOD_IMAGES[0].url;
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white">Vista Previa de Imagen</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Selecciona una foto rápida de la galería abajo o pega una URL personalizada.
                    </p>
                  </div>
                </div>

                {/* Galería de fotos rápidas preconfiguradas */}
                <div>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block mb-1.5 font-sports">
                    Fotos Rápidas del Estadio
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_FOOD_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, image: preset.url })}
                        className={`relative rounded-lg overflow-hidden h-12 border transition-all cursor-pointer group ${
                          formData.image === preset.url
                            ? 'border-red-500 ring-2 ring-red-500/40'
                            : 'border-slate-700 hover:border-slate-500 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-0 bg-slate-950/60 text-[9px] font-bold text-white flex items-end p-1 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                          {preset.name}
                        </span>
                        {formData.image === preset.url && (
                          <div className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input de URL Personalizada */}
                <div>
                  <input
                    type="url"
                    value={formData.image || ''}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="O pega una URL de imagen externa (https://...)"
                    className="w-full p-2 bg-[#141C2E] border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-red-500 placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Nombre del Producto */}
              <div>
                <label className="block font-black text-slate-300 font-sports uppercase tracking-wider text-xs mb-1">Nombre del Platillo / Bebida *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Tacos de Asada Mazatlán, Cerveza Pacífica Doble"
                  className="w-full p-2.5 bg-[#141C2E] border border-slate-700 rounded-xl font-bold text-white focus:outline-none focus:border-red-500 placeholder-slate-500"
                />
              </div>

              {/* Precio, Categoría y Tiempo de Preparación */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-black text-slate-300 font-sports uppercase tracking-wider text-xs mb-1">Precio (MXN) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#141C2E] border border-slate-700 rounded-xl font-black text-amber-400 font-scoreboard text-base focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-300 font-sports uppercase tracking-wider text-xs mb-1">Categoría</label>
                  <select
                    value={formData.category || 'comida'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as MenuItemCategory })}
                    className="w-full p-2.5 bg-[#141C2E] border border-slate-700 rounded-xl font-semibold text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="comida">Comida</option>
                    <option value="bebida">Bebida</option>
                    <option value="cerveza">Cerveza</option>
                    <option value="snack">Snack</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black text-slate-300 font-sports uppercase tracking-wider text-xs mb-1">Tiempo Prep.</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.prepTimeMinutes || 5}
                    onChange={(e) => setFormData({ ...formData, prepTimeMinutes: Number(e.target.value) })}
                    placeholder="Minutos"
                    className="w-full p-2.5 bg-[#141C2E] border border-slate-700 rounded-xl font-semibold text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block font-black text-slate-300 font-sports uppercase tracking-wider text-xs mb-1">Descripción e Ingredientes</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej. 3 tacos en tortilla de harina con guacamole artesanal, salsa verde y cebolla asada."
                  className="w-full p-2.5 bg-[#141C2E] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 placeholder-slate-500"
                />
              </div>

              {/* Switch de disponibilidad inmediata */}
              <div className="flex items-center justify-between p-3 bg-[#141C2E] border border-slate-700 rounded-xl">
                <div>
                  <p className="font-black text-white font-sports uppercase tracking-wider text-xs">Disponible para Venta Inmediata</p>
                  <p className="text-[10px] text-slate-400">Si se activa, los aficionados podrán ordenarlo de inmediato en el estadio.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.available ?? true}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-xl font-bold text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2 bg-red-700 hover:bg-red-600 text-white font-black uppercase tracking-wider rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-sports border border-red-500/50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingItem ? 'Guardando...' : isEditing ? 'Actualizar Platillo' : 'Guardar en Menú'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar platillo */}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteItem}
        isLoading={deletingItem}
        title="¿Eliminar este platillo de tu menú?"
        message="Esta acción no se puede deshacer y el platillo dejará de estar disponible para los aficionados en el estadio."
        itemName={itemToDelete ? `${itemToDelete.name} ($${itemToDelete.price} MXN)` : undefined}
        confirmText="Eliminar Platillo"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal de Envío de Orden al Correo del Anfitrión */}
      {emailModalPayload && (
        <SendToHostEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setEmailModalPayload(null);
          }}
          emailPayload={emailModalPayload}
        />
      )}

      {/* Modal de Corte de Caja Oficial del Negocio */}
      {isCorteModalOpen && selectedStand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0F1626] w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-500/50 overflow-hidden flex flex-col max-h-[92vh] my-auto text-white animate-in zoom-in-95 duration-150">
            <div className="bg-[#141C2E] p-4 sm:p-5 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base font-sports uppercase tracking-wider">
                    Corte de Caja Oficial
                  </h3>
                  <p className="text-[11px] text-amber-300 font-medium">
                    {selectedStand.name} • {venueDisplayName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCorteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              <div className="bg-[#141C2E] p-4 rounded-xl border border-slate-700 space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Fecha & Hora de Emisión:</span>
                  <strong className="text-white">{new Date().toLocaleString('es-MX')}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Operador Responsable:</span>
                  <strong className="text-white">{user.displayName || user.email}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Sede Deportiva:</span>
                  <strong className="text-white">{venueDisplayName}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Local Comercial:</span>
                  <strong className="text-white">{selectedStand.name} ({selectedStand.location})</strong>
                </div>
              </div>

              {/* Desglose Monetario */}
              <div className="bg-[#141C2E] p-4 rounded-xl border border-slate-700 space-y-2.5">
                <h4 className="font-black text-amber-400 font-sports uppercase tracking-wide text-xs">
                  Resumen de Movimientos del Negocio
                </h4>
                <div className="flex justify-between text-slate-300">
                  <span>Comandas Cobradas:</span>
                  <strong className="text-white font-scoreboard text-sm">{paidOrders.length}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Cobros Tarjeta en Línea / Stripe:</span>
                  <span className="text-white font-scoreboard">${cardRevenue.toLocaleString('es-MX')} MXN</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Cobros Efectivo / Presencial:</span>
                  <span className="text-white font-scoreboard">${cashRevenue.toLocaleString('es-MX')} MXN</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-black text-white">
                  <span>Ventas Brutas Totales:</span>
                  <span className="text-emerald-400 font-scoreboard text-base">${totalTodayRevenue.toLocaleString('es-MX')} MXN</span>
                </div>
                <div className="flex justify-between text-xs text-amber-300">
                  <span>Comisión Retenida Estadio ({commissionRate}%):</span>
                  <span className="font-scoreboard">-${stadiumCommissionAmount.toLocaleString('es-MX')} MXN</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-black text-purple-300">
                  <span>Ingreso Líquido Negocio ({100 - commissionRate}%):</span>
                  <span className="font-scoreboard text-base text-purple-400">${netVendorRevenue.toLocaleString('es-MX')} MXN</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
                ✓ Documento de conciliación oficial verificado para auditoría entre la administración de la sede y el concesionario.
              </div>
            </div>

            <div className="p-4 bg-[#141C2E] border-t border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCorteModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-xl font-bold text-slate-300 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.print();
                  } catch {}
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-wider rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer font-sports"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

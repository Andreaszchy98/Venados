import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  StadiumStand,
  MenuItem,
  FoodOrder,
  FoodOrderStatus,
  MenuItemCategory,
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
} from '../../lib/foodOrders';
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
} from 'lucide-react';

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

interface ConcesionarioViewProps {
  user: UserProfile;
}

export const ConcesionarioView: React.FC<ConcesionarioViewProps> = ({ user }) => {
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [activeTab, setActiveTab] = useState<'comanda' | 'menu'>('comanda');

  // Comanda en tiempo real
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtros de menú
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('todos');

  // Modal para agregar / editar producto al menú
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
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

  useEffect(() => {
    const fetchStands = async () => {
      setLoading(true);
      try {
        const data = await getStadiumStands();
        if (data.length > 0) {
          // Asignar el stand correspondiente al concesionario (por standId o por ownerId)
          const matched =
            data.find((s) => s.id === user.standId) ||
            data.find((s) => s.ownerId === user.uid) ||
            data[0];
          setSelectedStand(matched);
        }
      } catch (err) {
        console.error('Error fetching stands:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStands();
  }, [user.uid, user.standId]);

  // Escuchar órdenes en tiempo real para el puesto
  useEffect(() => {
    if (!selectedStand) return;

    const unsubscribe = listenToStandFoodOrders(
      selectedStand.id,
      (liveOrders) => {
        setOrders(liveOrders);
      },
      (err) => {
        console.warn('Error escuchando órdenes del puesto en tiempo real:', err);
      }
    );

    const loadMenu = async () => {
      const items = await getMenuItemsByStand(selectedStand.id);
      setMenuItems(items);
    };
    loadMenu();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedStand]);

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
  const completedOrders = orders.filter((o) => o.status === 'entregado');

  const totalTodayRevenue = orders
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

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
      {/* Header del Operador de Concesión */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-700" />
            <span>Operación de Cocina & Concesiones</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Puesto Concesionario
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Comanda express en vivo, despacho de pedidos y control de disponibilidad de menú
          </p>
        </div>

        {/* Información fija del Puesto Asignado */}
        {selectedStand && (
          <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs">
            <div className="p-1.5 bg-amber-100 text-amber-900 rounded-lg">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 leading-none">{selectedStand.name}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{selectedStand.location}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tarjetas KPI de Cocina */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-amber-800">1. Pendientes por Preparar</p>
          <p className="text-2xl font-black text-amber-950 mt-1">{pendingOrders.length}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-blue-800">2. En Cocina / Preparando</p>
          <p className="text-2xl font-black text-blue-950 mt-1">{preparingOrders.length}</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-emerald-800">3. Listos para Retiro</p>
          <p className="text-2xl font-black text-emerald-950 mt-1">{readyOrders.length}</p>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-400">Total Facturado Puesto</p>
          <p className="text-xl font-black mt-1">${totalTodayRevenue.toLocaleString('es-MX')} MXN</p>
        </div>
      </div>

      {/* Pestañas de Comanda vs Gestión de Menú */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('comanda')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'comanda'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Comanda en Vivo ({pendingOrders.length + preparingOrders.length + readyOrders.length} activas)</span>
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'menu'
              ? 'bg-red-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Control de Menú ({menuItems.length} platillos)</span>
        </button>
      </div>

      {/* Vista de Comanda en Vivo */}
      {activeTab === 'comanda' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
              <ChefHat className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No hay pedidos registrados en este puesto</p>
              <p className="text-xs">Los pedidos que hagan los aficionados aparecerán aquí automáticamente en tiempo real.</p>
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
                    className={`rounded-2xl border p-4.5 shadow-xs flex flex-col justify-between space-y-3 transition-all ${
                      isReady
                        ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                        : isPreparing
                        ? 'bg-blue-50/70 border-blue-300'
                        : isPending
                        ? 'bg-amber-50/70 border-amber-300 animate-pulse'
                        : 'bg-white border-slate-200 opacity-60'
                    }`}
                  >
                    <div>
                      {/* Código de Retiro & Modalidad */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xl font-black text-slate-900 bg-white px-3 py-1 rounded-xl shadow-xs border border-slate-200">
                            {order.pickupCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              order.orderType === 'in-seat'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {order.orderType === 'in-seat' ? '🚴 Butaca' : '⚡ Pickup'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Cliente y Ubicación */}
                      <div className="pt-2 space-y-0.5">
                        <p className="font-black text-xs text-slate-900">{order.customerName}</p>
                        {order.orderType === 'in-seat' ? (
                          <p className="text-[11px] font-bold text-red-900 bg-red-50/80 px-2 py-0.5 rounded border border-red-200/60">
                            📍 Sec: {order.section || '-'} • Fila: {order.row || '-'} • Butaca: {order.seat || '-'}
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-500">Retiro Express en mostrador</span>
                        )}
                      </div>

                      {/* Lista de platillos */}
                      <div className="mt-3 bg-white/90 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between items-center font-bold text-slate-800">
                            <span>
                              <span className="text-red-700 font-black">{i.quantity}x</span> {i.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-semibold">${i.price * i.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botones de Cambio de Estado Rápido */}
                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span>Total: ${order.total} MXN</span>
                        <span className="capitalize text-[11px] text-slate-600 font-medium">Estado: {order.status}</span>
                      </div>

                      {isPending && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'preparando')}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          Iniciar Preparación en Cocina
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'listo')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Entregar al Aficionado (Pickup)</span>
                        </button>
                      )}

                      {isReady && order.orderType === 'in-seat' && (
                        <div className="p-2 bg-purple-100/90 text-purple-950 border border-purple-300 rounded-xl text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-700" />
                          <span>Listo en barra • Esperando que un Runner lo tome</span>
                        </div>
                      )}

                      {order.status === 'en-camino' && (
                        <div className="p-2 bg-blue-100 text-blue-950 border border-blue-300 rounded-xl text-[11px] font-bold text-center flex items-center justify-center gap-1.5">
                          <span className="animate-pulse">🚴</span>
                          <span>En camino con Runner hacia Butaca {order.seat}</span>
                        </div>
                      )}

                      {isDelivered && (
                        <div className="text-center text-[11px] font-bold text-slate-500 py-1 bg-slate-100 rounded-lg">
                          ✓ Pedido Entregado
                        </div>
                      )}
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
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <span>Menú de {selectedStand?.name || 'Mi Negocio'}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {menuItems.length} {menuItems.length === 1 ? 'producto' : 'productos'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Agrega nuevos productos con foto, edita precios, gestiona disponibilidad o elimina artículos de tu menú.
                </p>
              </div>

              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Platillo / Bebida</span>
              </button>
            </div>

            {/* Búsqueda y Filtros por Categoría */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-100">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en mi menú..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-red-600 font-medium"
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
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      menuCategoryFilter === cat.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-800">
                  {menuSearch || menuCategoryFilter !== 'todos'
                    ? 'No se encontraron platillos con esos filtros'
                    : 'Aún no tienes platillos registrados en tu menú'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {menuSearch || menuCategoryFilter !== 'todos'
                    ? 'Prueba modificando la búsqueda o seleccionando otra categoría.'
                    : 'Haz clic en "Nuevo Platillo" para comenzar a recibir órdenes de los aficionados.'}
                </p>
              </div>
              {!menuSearch && menuCategoryFilter === 'todos' && (
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-2 px-4 py-2 bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
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
                  className={`bg-white rounded-2xl border overflow-hidden shadow-xs flex flex-col justify-between transition-all ${
                    item.available
                      ? 'border-slate-200 hover:shadow-sm'
                      : 'border-slate-300 opacity-70 bg-slate-50'
                  }`}
                >
                  <div>
                    {/* Imagen del Platillo */}
                    <div className="relative h-36 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={item.image || PRESET_FOOD_IMAGES[0].url}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PRESET_FOOD_IMAGES[0].url;
                        }}
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase tracking-wide">
                          {item.category}
                        </span>
                        {item.prepTimeMinutes && (
                          <span className="px-2 py-0.5 rounded-lg bg-white/90 backdrop-blur-xs text-slate-800 text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {item.prepTimeMinutes} min
                          </span>
                        )}
                      </div>

                      {/* Badge de disponibilidad en foto */}
                      <div className="absolute top-2 right-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold tracking-wide uppercase shadow-xs ${
                            item.available
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {item.available ? 'En Menú' : 'Agotado'}
                        </span>
                      </div>
                    </div>

                    {/* Contenido descriptivo */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                          {item.name}
                        </h4>
                        <span className="font-black text-sm text-red-900 whitespace-nowrap">
                          ${item.price} <span className="text-[10px] font-semibold text-slate-500">MXN</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                        {item.description || 'Sin descripción detallada.'}
                      </p>
                    </div>
                  </div>

                  {/* Acciones del Platillo (Disponibilidad, Editar, Eliminar) */}
                  <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleAvailability(item.id, item.available)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex-1 text-center ${
                        item.available
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      {item.available ? '✓ Disponible' : '⚠️ Marcar Disponible'}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        title="Editar platillo o foto"
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setItemToDelete(item)}
                        title="Eliminar de mi menú"
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
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

      {/* Modal para Agregar o Editar Platillo */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-600 rounded-lg">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm">
                    {isEditing ? 'Editar Platillo del Menú' : 'Nuevo Platillo / Bebida'}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    Puesto: {selectedStand?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs sm:text-sm">
              {/* Sección de Fotografía */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Foto del Platillo o Bebida</label>

                {/* Previsualización actual */}
                <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
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
                    <p className="text-[11px] font-bold text-slate-800">Vista Previa de Imagen</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      Selecciona una foto rápida de la galería abajo o pega una URL personalizada.
                    </p>
                  </div>
                </div>

                {/* Galería de fotos rápidas preconfiguradas */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
                            ? 'border-red-600 ring-2 ring-red-600/30'
                            : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute inset-0 bg-slate-900/40 text-[9px] font-bold text-white flex items-end p-1 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
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
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700"
                  />
                </div>
              </div>

              {/* Nombre del Producto */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Platillo / Bebida *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Tacos de Asada Mazatlán, Cerveza Pacífica Doble"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Precio, Categoría y Tiempo de Preparación */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio (MXN) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={formData.category || 'comida'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as MenuItemCategory })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="comida">Comida</option>
                    <option value="bebida">Bebida</option>
                    <option value="cerveza">Cerveza</option>
                    <option value="snack">Snack</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tiempo Prep.</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.prepTimeMinutes || 5}
                    onChange={(e) => setFormData({ ...formData, prepTimeMinutes: Number(e.target.value) })}
                    placeholder="Minutos"
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción e Ingredientes</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej. 3 tacos en tortilla de harina con guacamole artesanal, salsa verde y cebolla asada."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              {/* Switch de disponibilidad inmediata */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <p className="font-bold text-slate-800">Disponible para Venta Inmediata</p>
                  <p className="text-[10px] text-slate-500">Si se activa, los aficionados podrán ordenarlo de inmediato.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.available ?? true}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
    </div>
  );
};

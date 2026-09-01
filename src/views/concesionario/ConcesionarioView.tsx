import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  StadiumStand,
  MenuItem,
  FoodOrder,
  FoodOrderStatus,
} from '../../types';
import {
  getStadiumStands,
  getMenuItemsByStand,
  toggleMenuItemAvailability,
  saveMenuItem,
} from '../../lib/stands';
import {
  listenToStandFoodOrders,
  advanceFoodOrderStatus,
} from '../../lib/foodOrders';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Utensils,
  Clock,
  CheckCircle2,
  Bell,
  AlertCircle,
  Plus,
  Edit2,
  Store,
  ChefHat,
  Eye,
  RefreshCw,
  X,
  Save,
} from 'lucide-react';

interface ConcesionarioViewProps {
  user: UserProfile;
}

export const ConcesionarioView: React.FC<ConcesionarioViewProps> = ({ user }) => {
  const [stands, setStands] = useState<StadiumStand[]>([]);
  const [selectedStand, setSelectedStand] = useState<StadiumStand | null>(null);
  const [activeTab, setActiveTab] = useState<'comanda' | 'menu'>('comanda');

  // Comanda en tiempo real
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal para agregar producto al menú
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 90,
    category: 'comida',
    available: true,
  });

  useEffect(() => {
    const fetchStands = async () => {
      setLoading(true);
      try {
        const data = await getStadiumStands();
        setStands(data);
        if (data.length > 0) {
          // Si el usuario tiene un standId específico, seleccionarlo
          const matched = data.find((s) => s.ownerId === user.uid) || data[0];
          setSelectedStand(matched);
        }
      } catch (err) {
        console.error('Error fetching stands:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStands();
  }, [user.uid]);

  // Escuchar órdenes en tiempo real para el puesto
  useEffect(() => {
    if (!selectedStand) return;

    const unsubscribe = listenToStandFoodOrders(
      selectedStand.id,
      (liveOrders) => {
        setOrders(liveOrders);
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

  const handleSaveNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStand || !newItem.name || !newItem.price) return;
    try {
      await saveMenuItem({
        ...newItem,
        standId: selectedStand.id,
      } as any);
      setIsMenuModalOpen(false);
      const updated = await getMenuItemsByStand(selectedStand.id);
      setMenuItems(updated);
    } catch (err) {
      console.error('Error saving menu item:', err);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pendiente');
  const preparingOrders = orders.filter((o) => o.status === 'preparando');
  const readyOrders = orders.filter((o) => o.status === 'listo');
  const completedOrders = orders.filter((o) => o.status === 'entregado');

  const totalTodayRevenue = orders
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + o.total, 0);

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

        {/* Selector de puesto (si gestiona varios) */}
        {stands.length > 1 && (
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-slate-500" />
            <select
              value={selectedStand?.id || ''}
              onChange={(e) => {
                const found = stands.find((s) => s.id === e.target.value);
                if (found) setSelectedStand(found);
              }}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            >
              {stands.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.location})
                </option>
              ))}
            </select>
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
                      {/* Código de Retiro */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <span className="font-mono text-xl font-black text-slate-900 bg-white px-3 py-1 rounded-xl shadow-xs border border-slate-200">
                          {order.pickupCode}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Cliente */}
                      <div className="pt-2">
                        <p className="font-black text-xs text-slate-900">{order.customerName}</p>
                        <span className="text-[10px] text-slate-500">ID: {order.id.slice(0, 8)}</span>
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
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                        >
                          Iniciar Preparación en Cocina
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'listo')}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>¡Listo para Entrega en Barra!</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          disabled={actionLoading === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'entregado')}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Entregar al Aficionado</span>
                        </button>
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
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Menú Activo: {selectedStand?.name}
              </h3>
              <p className="text-xs text-slate-500">
                Habilita o agota platillos instantáneamente con un solo clic.
              </p>
            </div>

            <button
              onClick={() => setIsMenuModalOpen(true)}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Platillo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border shadow-xs flex items-start justify-between gap-3 ${
                  item.available
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-100 border-slate-300 opacity-60'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-900">{item.name}</h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{item.description}</p>
                  <p className="text-xs font-black text-red-900 pt-1">${item.price} MXN</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAvailability(item.id, item.available)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      item.available
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800'
                        : 'bg-red-100 text-red-800 hover:bg-emerald-100 hover:text-emerald-800'
                    }`}
                  >
                    {item.available ? 'Disponible' : 'Agotado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para agregar platillo */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Agregar Platillo al Menú</h3>
              <button onClick={() => setIsMenuModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewItem} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre del Platillo o Bebida</label>
                <input
                  type="text"
                  required
                  value={newItem.name || ''}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Ej. Tacos de Asada Mazatlán"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio (MXN)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newItem.price || 0}
                    onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={newItem.category || 'comida'}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="comida">Comida</option>
                    <option value="bebida">Bebida</option>
                    <option value="snack">Snack</option>
                    <option value="cerveza">Cerveza</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={newItem.description || ''}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Ej. 3 tacos en tortilla de harina con guacamole y salsa"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Platillo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

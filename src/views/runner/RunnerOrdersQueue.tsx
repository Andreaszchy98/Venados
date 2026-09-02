import React, { useState, useEffect } from 'react';
import { UserProfile, FoodOrder, Zone } from '../../types';
import { listenToStandFoodOrders, claimInSeatOrder, deliverInSeatOrder } from '../../lib/foodOrders';
import { getZones } from '../../lib/zones';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Bike,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Utensils,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Armchair,
  Check,
  Package,
  Store,
} from 'lucide-react';

interface RunnerOrdersQueueProps {
  user: UserProfile;
}

export const RunnerOrdersQueue: React.FC<RunnerOrdersQueueProps> = ({ user }) => {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>(user.zoneId || 'todos');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'disponibles' | 'en_curso' | 'completadas'>('disponibles');

  useEffect(() => {
    // Cargar zonas
    getZones().then((z) => setZones(z)).catch(() => {});

    // Escuchar órdenes de comida en tiempo real
    setLoading(true);
    const unsubscribe = listenToStandFoodOrders(
      null,
      (liveOrders) => {
        setOrders(liveOrders);
        setLoading(false);
      },
      (err) => {
        console.warn('Error escuchando órdenes en runner:', err);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Actualizar filtro por defecto si el usuario tiene zoneId
  useEffect(() => {
    if (user.zoneId) {
      setSelectedZoneFilter(user.zoneId);
    }
  }, [user.zoneId]);

  const handleClaimOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await claimInSeatOrder(orderId, user.uid, user.displayName || 'Runner Venados');
      setActiveTab('en_curso');
    } catch (err: any) {
      console.error('Error al tomar pedido:', err);
      alert(err.message || 'No se pudo tomar el pedido. Es posible que otro runner lo haya tomado.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeliverOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await deliverInSeatOrder(orderId, user.uid);
    } catch (err: any) {
      console.error('Error al marcar pedido como entregado:', err);
      alert(err.message || 'Error al completar la entrega');
    } finally {
      setActionLoading(null);
    }
  };

  // 1. Órdenes in-seat disponibles en zona: status === 'listo', orderType === 'in-seat', sin runnerId
  const availableOrders = orders.filter((o) => {
    if (o.orderType !== 'in-seat') return false;
    if (o.status !== 'listo') return false;
    if (o.runnerId) return false;
    if (selectedZoneFilter !== 'todos' && o.zoneId && o.zoneId !== selectedZoneFilter) return false;
    return true;
  });

  // 2. Órdenes asignadas al runner en curso: runnerId === user.uid && status === 'en-camino'
  const myActiveDeliveries = orders.filter((o) => {
    return o.orderType === 'in-seat' && o.runnerId === user.uid && o.status === 'en-camino';
  });

  // 3. Órdenes entregadas por este runner hoy: runnerId === user.uid && status === 'entregado'
  const myCompletedDeliveries = orders.filter((o) => {
    return o.orderType === 'in-seat' && o.runnerId === user.uid && o.status === 'entregado';
  });

  const currentZoneName =
    zones.find((z) => z.id === selectedZoneFilter)?.name ||
    user.assignedZone ||
    (selectedZoneFilter === 'todos' ? 'Todas las Zonas' : 'Zona Asignada');

  return (
    <div className="space-y-6">
      {/* Selector de Zona y Métricas del Runner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Cobertura Operativa
            </span>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mt-0.5">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>Zona Activa: {currentZoneName}</span>
            </h2>
          </div>

          {/* Filtro de Zonas del Estadio */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Filtrar por Zona:</label>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-red-700 cursor-pointer"
            >
              <option value="todos">Todas las Zonas del Estadio</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Badges de Conteo Rápido */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('disponibles')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'disponibles'
                ? 'bg-purple-50 border-purple-300 shadow-xs ring-2 ring-purple-400/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <p className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
              <span>Disponibles en Zona</span>
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>
            </p>
            <p className="text-2xl font-black text-purple-950 mt-0.5">{availableOrders.length}</p>
          </button>

          <button
            onClick={() => setActiveTab('en_curso')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'en_curso'
                ? 'bg-blue-50 border-blue-300 shadow-xs ring-2 ring-blue-400/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <p className="text-[11px] font-bold text-blue-900">Mis Entregas en Curso</p>
            <p className="text-2xl font-black text-blue-950 mt-0.5">{myActiveDeliveries.length}</p>
          </button>

          <button
            onClick={() => setActiveTab('completadas')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'completadas'
                ? 'bg-emerald-50 border-emerald-300 shadow-xs ring-2 ring-emerald-400/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <p className="text-[11px] font-bold text-emerald-900">Completadas Hoy</p>
            <p className="text-2xl font-black text-emerald-950 mt-0.5">{myCompletedDeliveries.length}</p>
          </button>
        </div>
      </div>

      {/* Vistas según Tab activo */}
      {loading ? (
        <LoadingSpinner message="Consultando comanda de entregas a butaca..." />
      ) : activeTab === 'disponibles' ? (
        /* SECCIÓN 1: DISPONIBLES EN MI ZONA */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" /> Pedidos Listos en Barra para Tomar ({availableOrders.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Auto-actualización en vivo</span>
          </div>

          {availableOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-2">
              <Bike className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No hay pedidos pendientes de entrega en esta zona</p>
              <p className="text-xs">Cuando un puesto marque una orden in-seat como "Listo", aparecerá aquí de inmediato para que la tomes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableOrders.map((order) => {
                const zoneMatch = zones.find((z) => z.id === order.zoneId);
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border-2 border-purple-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Header de la tarjeta */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-black text-purple-900 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                            {order.pickupCode}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                            Listo en Barra
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Origen: Puesto */}
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <Store className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Recoger en: <strong className="text-slate-900">{order.standName}</strong></span>
                      </div>

                      {/* Destino: Butaca en Estadio */}
                      <div className="bg-red-50/70 border border-red-200/80 p-3 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-red-900">
                          <span className="flex items-center gap-1.5">
                            <Armchair className="w-4 h-4 text-red-700" />
                            <span>Llevar a Asiento</span>
                          </span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-red-200">
                            {zoneMatch?.name || 'Zona del Estadio'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-900 font-black pt-1">
                          <span>Sección: <strong className="text-red-800">{order.section || '-'}</strong></span>
                          <span>•</span>
                          <span>Fila: <strong className="text-red-800">{order.row || '-'}</strong></span>
                          <span>•</span>
                          <span>Butaca: <strong className="text-red-800">{order.seat || '-'}</strong></span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Cliente: <strong>{order.customerName}</strong>
                        </p>
                      </div>

                      {/* Contenido de la orden */}
                      <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1 text-slate-700">
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-semibold">
                            <span><strong className="text-red-700">{i.quantity}x</strong> {i.name}</span>
                            <span className="text-slate-500">${i.price * i.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botón para tomar pedido */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        disabled={actionLoading === order.id}
                        onClick={() => handleClaimOrder(order.id)}
                        className="w-full py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <Bike className="w-4 h-4" />
                        <span>{actionLoading === order.id ? 'Tomando pedido...' : 'Tomar Pedido para Entrega'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'en_curso' ? (
        /* SECCIÓN 2: MIS ENTREGAS EN CURSO */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-blue-600" /> Pedidos Asignados a Mí en Camino ({myActiveDeliveries.length})
            </h3>
          </div>

          {myActiveDeliveries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No tienes entregas activas en este momento</p>
              <p className="text-xs">Ve a la pestaña "Disponibles en Zona" para tomar un nuevo pedido listo en barra.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myActiveDeliveries.map((order) => {
                const zoneMatch = zones.find((z) => z.id === order.zoneId);
                return (
                  <div
                    key={order.id}
                    className="bg-blue-50/50 rounded-3xl border-2 border-blue-400 p-5 shadow-md flex flex-col justify-between space-y-4 animate-in fade-in"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xl font-black text-blue-950 bg-white px-3 py-1 rounded-xl shadow-xs border border-blue-200">
                            {order.pickupCode}
                          </span>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-600 text-white animate-pulse">
                            🚴 EN CAMINO A BUTACA
                          </span>
                        </div>
                        <span className="text-xs font-bold text-blue-900">
                          ${order.total.toLocaleString('es-MX')} MXN
                        </span>
                      </div>

                      {/* Recogido en puesto */}
                      <div className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-blue-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Origen:</p>
                        <p className="font-extrabold text-slate-900">{order.standName}</p>
                      </div>

                      {/* Destino Asiento */}
                      <div className="bg-white p-4 rounded-2xl border-2 border-red-500 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-red-700 uppercase flex items-center gap-1.5">
                            <Armchair className="w-4 h-4" /> Entregar en:
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-900">
                            {zoneMatch?.name || 'Zona Asignada'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center pt-1">
                          <div className="bg-red-50 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-red-800 uppercase block">Sección</span>
                            <span className="text-lg font-black text-red-950">{order.section || '-'}</span>
                          </div>
                          <div className="bg-red-50 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-red-800 uppercase block">Fila</span>
                            <span className="text-lg font-black text-red-950">{order.row || '-'}</span>
                          </div>
                          <div className="bg-red-50 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-red-800 uppercase block">Asiento</span>
                            <span className="text-lg font-black text-red-950">{order.seat || '-'}</span>
                          </div>
                        </div>

                        <div className="pt-1 text-xs text-slate-700">
                          Aficionado: <strong className="text-slate-900">{order.customerName}</strong>
                        </div>
                      </div>

                      {/* Platillos a entregar */}
                      <div className="bg-white/80 p-3 rounded-xl border border-blue-200 text-xs space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Artículos en la charola:</p>
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-bold text-slate-800">
                            <span><span className="text-red-700 font-black">{i.quantity}x</span> {i.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botón de Entrega Exitosa */}
                    <div className="pt-2">
                      <button
                        disabled={actionLoading === order.id}
                        onClick={() => handleDeliverOrder(order.id)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{actionLoading === order.id ? 'Marcando...' : 'Marcar como Entregado en Asiento'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SECCIÓN 3: COMPLETADAS HOY */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Historial de Entregas Realizadas Hoy ({myCompletedDeliveries.length})
            </h3>
          </div>

          {myCompletedDeliveries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-2">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Aún no has completado entregas en este turno</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myCompletedDeliveries.map((order) => (
                <div
                  key={order.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">
                        {order.standName} • Código {order.pickupCode}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Entregado en Sección {order.section || '-'}, Fila {order.row || '-'}, Butaca {order.seat || '-'} ({order.customerName})
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-slate-900 block">${order.total} MXN</span>
                    <span className="text-[10px] text-slate-400">{new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

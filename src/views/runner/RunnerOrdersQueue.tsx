import React, { useState, useEffect } from 'react';
import { UserProfile, FoodOrder, Zone } from '../../types';
import { listenToStandFoodOrders, claimInSeatOrder, deliverInSeatOrder } from '../../lib/foodOrders';
import { getZones } from '../../lib/zones';
import { cleanRowValue, cleanSeatValue, cleanSectionValue, formatDeliverySeat, isGeneralAdmissionRow } from '../../lib/seatUtils';
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
      {/* Selector de Zona y Métricas del Runner Deportivo */}
      <div className="bg-[#0F1626] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-700/80 shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-blue-500 to-emerald-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30 mb-1 font-sports">
              <span>Logística & Despacho a Butacas</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 font-sports tracking-wide">
              <MapPin className="w-4 h-4 text-red-500" />
              <span>Zona Operativa: {currentZoneName}</span>
            </h2>
          </div>

          {/* Filtro de Zonas del Estadio */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-300 font-sports uppercase tracking-wider">Zona Estadio:</label>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
              className="px-3 py-2 bg-[#141C2E] border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-red-500 cursor-pointer shadow-inner"
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

        {/* Marcador Rápido Deportivo */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('disponibles')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'disponibles'
                ? 'bg-purple-950/60 border-purple-500/80 shadow-lg ring-1 ring-purple-500/40'
                : 'bg-[#12192A] border-slate-800 hover:border-purple-500/40 hover:bg-[#162035]'
            }`}
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-purple-400 flex items-center justify-between font-sports">
              <span>Listos en Barra</span>
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{availableOrders.length}</p>
          </button>

          <button
            onClick={() => setActiveTab('en_curso')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'en_curso'
                ? 'bg-blue-950/60 border-blue-500/80 shadow-lg ring-1 ring-blue-500/40'
                : 'bg-[#12192A] border-slate-800 hover:border-blue-500/40 hover:bg-[#162035]'
            }`}
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-400 font-sports">En Ruta / Despacho</p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{myActiveDeliveries.length}</p>
          </button>

          <button
            onClick={() => setActiveTab('completadas')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'completadas'
                ? 'bg-emerald-950/60 border-emerald-500/80 shadow-lg ring-1 ring-emerald-500/40'
                : 'bg-[#12192A] border-slate-800 hover:border-emerald-500/40 hover:bg-[#162035]'
            }`}
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 font-sports">Entregadas Hoy</p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{myCompletedDeliveries.length}</p>
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
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 font-sports">
              <Sparkles className="w-4 h-4 text-purple-400" /> Pedidos Listos en Barra para Tomar ({availableOrders.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Feed en tiempo real</span>
          </div>

          {availableOrders.length === 0 ? (
            <div className="bg-[#0F1626] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
              <Bike className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">No hay pedidos pendientes de entrega en esta zona</p>
              <p className="text-xs text-slate-400">Cuando un puesto marque una orden in-seat como "Listo", aparecerá aquí de inmediato para que la tomes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableOrders.map((order) => {
                const zoneMatch = zones.find((z) => z.id === order.zoneId);
                return (
                  <div
                    key={order.id}
                    className="bg-[#0F1626] rounded-2xl border border-purple-500/40 p-5 shadow-lg hover:border-purple-400 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Header de la tarjeta */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-black text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded-xl border border-purple-600/50">
                            {order.pickupCode}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-sports">
                            Listo en Barra
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Origen: Puesto */}
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                        <Store className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Recoger en: <strong className="text-white">{order.standName}</strong></span>
                      </div>

                      {/* Destino: Butaca en Estadio */}
                      <div className="bg-[#141C2E] border border-red-500/40 p-3.5 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-black text-red-400 font-sports uppercase tracking-wide">
                          <span className="flex items-center gap-1.5">
                            <Armchair className="w-4 h-4 text-red-500" />
                            <span>Llevar a Butaca</span>
                          </span>
                          <span className="text-[10px] bg-red-950/80 text-red-300 px-2 py-0.5 rounded border border-red-600/40 font-bold">
                            {zoneMatch?.name || 'Zona Estadio'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 bg-[#0D1424] p-2 rounded-xl border border-slate-800 text-center font-mono">
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Sección</span>
                            <span className="text-xs font-black text-white">{cleanSectionValue(order.section) || '-'}</span>
                          </div>
                          <div className="border-x border-slate-800">
                            <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">
                              {isGeneralAdmissionRow(order.row) ? 'Zona' : 'Fila'}
                            </span>
                            <span className="text-xs font-black text-amber-400">{cleanRowValue(order.row) || '-'}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Asiento</span>
                            <span className="text-xs font-black text-red-400">{cleanSeatValue(order.seat) || '-'}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium">
                          Cliente: <strong className="text-white">{order.customerName}</strong>
                        </p>
                      </div>

                      {/* Contenido de la orden */}
                      <div className="bg-[#12192A] p-3 rounded-xl text-xs space-y-1 text-slate-300 border border-slate-800">
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-semibold">
                            <span><strong className="text-red-400">{i.quantity}x</strong> {i.name}</span>
                            <span className="text-emerald-400 font-bold">${i.price * i.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botón para tomar pedido */}
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        disabled={actionLoading === order.id}
                        onClick={() => handleClaimOrder(order.id)}
                        className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-sports active:scale-98"
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
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5 font-sports">
              <Bike className="w-4 h-4 text-blue-400" /> Pedidos Asignados en Ruta ({myActiveDeliveries.length})
            </h3>
          </div>

          {myActiveDeliveries.length === 0 ? (
            <div className="bg-[#0F1626] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">No tienes entregas activas en este momento</p>
              <p className="text-xs text-slate-400">Ve a la pestaña "Listos en Barra" para tomar un nuevo pedido.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myActiveDeliveries.map((order) => {
                const zoneMatch = zones.find((z) => z.id === order.zoneId);
                return (
                  <div
                    key={order.id}
                    className="bg-[#0F1626] rounded-2xl sm:rounded-3xl border-2 border-blue-500/80 p-5 shadow-xl flex flex-col justify-between space-y-4 animate-in fade-in relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-amber-400 to-red-500" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xl font-black text-white bg-blue-950/80 px-3 py-1 rounded-xl shadow-xs border border-blue-500/50">
                            {order.pickupCode}
                          </span>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-600 text-white animate-pulse uppercase tracking-wider font-sports">
                            🚴 EN RUTA A BUTACA
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-400 font-mono">
                          ${order.total.toLocaleString('es-MX')} MXN
                        </span>
                      </div>

                      {/* Recogido en puesto */}
                      <div className="text-xs text-slate-300 bg-[#141C2E] p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase font-sports">Puesto de Origen:</p>
                        <p className="font-black text-white">{order.standName}</p>
                      </div>

                      {/* Destino Asiento */}
                      <div className="bg-[#141C2E] p-4 rounded-2xl border-2 border-red-600/70 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-red-400 uppercase flex items-center gap-1.5 font-sports">
                            <Armchair className="w-4 h-4" /> Entregar en Butaca:
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40">
                            {zoneMatch?.name || 'Zona Asignada'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                          <div className="bg-[#0B101D] p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block font-sports">Sección</span>
                            <span className="text-base sm:text-lg font-black text-white">{cleanSectionValue(order.section) || '-'}</span>
                          </div>
                          <div className="bg-[#0B101D] p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block font-sports">
                              {isGeneralAdmissionRow(order.row) ? 'Zona' : 'Fila'}
                            </span>
                            <span className="text-base sm:text-lg font-black text-amber-400">{cleanRowValue(order.row) || '-'}</span>
                          </div>
                          <div className="bg-[#0B101D] p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block font-sports">Asiento</span>
                            <span className="text-base sm:text-lg font-black text-red-400">{cleanSeatValue(order.seat) || '-'}</span>
                          </div>
                        </div>

                        <div className="pt-1 text-xs text-slate-300">
                          Aficionado: <strong className="text-white">{order.customerName}</strong>
                        </div>
                      </div>

                      {/* Platillos a entregar */}
                      <div className="bg-[#12192A] p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 font-sports">Artículos en la charola:</p>
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-bold text-slate-200">
                            <span><span className="text-red-400 font-black">{i.quantity}x</span> {i.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botón de Entrega Exitosa */}
                    <div className="pt-2">
                      <button
                        disabled={actionLoading === order.id}
                        onClick={() => handleDeliverOrder(order.id)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-sports active:scale-98"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{actionLoading === order.id ? 'Marcando...' : 'Confirmar Entrega en Asiento'}</span>
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
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-sports">
              <Check className="w-4 h-4 text-emerald-400" /> Historial de Entregas Realizadas Hoy ({myCompletedDeliveries.length})
            </h3>
          </div>

          {myCompletedDeliveries.length === 0 ? (
            <div className="bg-[#0F1626] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
              <Clock className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">Aún no has completado entregas en este turno</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {myCompletedDeliveries.map((order) => (
                <div
                  key={order.id}
                  className="bg-[#0F1626] p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <p className="font-black text-white">
                        {order.standName} • Código #{order.pickupCode}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Entregado en {formatDeliverySeat(order.section, order.row, order.seat)} ({order.customerName})
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-emerald-400 block font-mono">${order.total} MXN</span>
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

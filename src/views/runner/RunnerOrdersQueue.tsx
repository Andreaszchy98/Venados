import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, FoodOrder, SeatSection } from '../../types';
import { listenToStandFoodOrders, claimInSeatOrder, deliverInSeatOrder, collectOrderPayment } from '../../lib/foodOrders';
import { buildMariscalSectionsData } from '../../lib/seatMap';
import { TeodoroMariscalStadiumMap } from '../../components/stadiumMaps/TeodoroMariscalStadiumMap';
import { cleanRowValue, cleanSeatValue, cleanSectionValue, formatDeliverySeat, isGeneralAdmissionRow } from '../../lib/seatUtils';
import { RunnerQrScannerModal } from './RunnerQrScannerModal';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { inferVenueIdAndName } from '../../lib/venues';
import { INITIAL_STANDS } from '../../lib/stands';
import {
  Bike,
  MapPin,
  Clock,
  CheckCircle2,
  Utensils,
  Armchair,
  Check,
  Store,
  CreditCard,
  Map,
  X,
  DollarSign,
  User,
  Volume2,
  QrCode,
} from 'lucide-react';

interface RunnerOrdersQueueProps {
  user: UserProfile;
}

export const RunnerOrdersQueue: React.FC<RunnerOrdersQueueProps> = ({ user }) => {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'disponibles' | 'en_curso' | 'completadas'>('en_curso');

  // Estado para Modal de Mapa Interactivo del Estadio
  const [mapModalOrder, setMapModalOrder] = useState<FoodOrder | null>(null);

  // Estado para Modal de Cobro Presencial (Efectivo / Terminal)
  const [collectingOrder, setCollectingOrder] = useState<FoodOrder | null>(null);

  // Estado para Modal de Escáner QR de Confirmación de Entrega
  const [qrScanningOrder, setQrScanningOrder] = useState<FoodOrder | null>(null);

  // Generar datos estáticos de secciones para el mapa
  const [mapSections] = useState<SeatSection[]>(() => {
    return buildMariscalSectionsData('venue-teodoro-mariscal').map((s, idx) => ({
      ...s,
      id: `sec-${idx}`,
    }));
  });

  // Ref para contar cambios de órdenes y emitir sonido de alerta
  const prevOrdersCountRef = useRef<number>(0);

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  // Resolver la sede asignada del runner para aislamiento estricto
  const { venueId: targetVenueId, venueName: targetVenueName } = inferVenueIdAndName(
    user.venueId || user.browsingVenueId,
    user.venueName || user.browsingVenueName
  );

  useEffect(() => {
    // Escuchar órdenes de comida en tiempo real del negocio y sede asignados
    setLoading(true);
    const unsubscribe = listenToStandFoodOrders(
      user.standId || null,
      (liveOrders) => {
        // Filtrar órdenes in-seat pertinentes para este runner de manera estricta
        // Si el runner tiene standId asignado, solo de ese negocio; si no, exclusivamente de su sede
        const relevantOrders = liveOrders.filter((o) => {
          let orderVenue = o.venueId;
          if (!orderVenue) {
            const standMatch = INITIAL_STANDS.find((s) => s.id === o.standId || s.name === o.standName);
            orderVenue = standMatch?.venueId || DEFAULT_VENUE_ID;
          }
          const matchVenue = orderVenue === targetVenueId;
          const matchStand = user.standId ? o.standId === user.standId : true;
          return matchVenue && matchStand;
        });

        // Si llegaron nuevas órdenes, emitir chime
        if (relevantOrders.length > prevOrdersCountRef.current && prevOrdersCountRef.current > 0) {
          playNotificationSound();
        }
        prevOrdersCountRef.current = relevantOrders.length;

        setOrders(relevantOrders);
        setLoading(false);
      },
      (err) => {
        console.warn('Error escuchando órdenes en runner:', err);
        setLoading(false);
      },
      targetVenueId
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user.standId, targetVenueId]);

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

  const handleConfirmCollectPayment = async (orderId: string, method: 'efectivo' | 'terminal') => {
    setActionLoading(orderId);
    try {
      await collectOrderPayment(orderId, method);
      setCollectingOrder(null);
    } catch (err: any) {
      alert(err.message || 'Error al registrar el cobro');
    } finally {
      setActionLoading(null);
    }
  };

  // 1. Órdenes in-seat disponibles para el negocio (status === 'listo', sin runnerId)
  const availableOrders = orders.filter((o) => {
    if (o.orderType !== 'in-seat') return false;
    if (o.status !== 'listo') return false;
    if (o.runnerId) return false;
    if (user.standId && o.standId && o.standId !== user.standId) return false;
    return true;
  });

  // 2. Órdenes asignadas al negocio/runner en curso
  const myActiveDeliveries = orders.filter((o) => {
    if (o.orderType !== 'in-seat') return false;
    if (o.status !== 'en-camino' && o.status !== 'listo') return false;
    if (user.standId && o.standId && o.standId !== user.standId) return false;
    return true;
  });

  // 3. Órdenes entregadas hoy
  const myCompletedDeliveries = orders.filter((o) => {
    if (o.orderType !== 'in-seat') return false;
    if (o.status !== 'entregado') return false;
    if (user.standId && o.standId && o.standId !== user.standId) return false;
    return true;
  });

  const isOrderPaid = (o: FoodOrder) => {
    if (o.paymentStatus === 'pagado') return true;
    if (o.paymentDetails) return true;
    if (o.paymentMethod && (o.paymentMethod.toLowerCase().includes('tarjeta') || o.paymentMethod.toLowerCase().includes('online') || o.paymentMethod.toLowerCase().includes('pasarela'))) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Selector de Zona y Métricas del Runner Deportivo */}
      <div className="bg-[#0F1626] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-700/80 shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-blue-500 to-emerald-500" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30 mb-1 font-sports">
              <Volume2 className="w-3 h-3 text-red-400 animate-pulse" />
              <span>Despacho de Alimentos a Butaca</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 font-sports tracking-wide">
              <Store className="w-4 h-4 text-amber-400" />
              <span>Negocio: {user.standName || 'Todos los Negocios'}</span>
            </h2>
          </div>
        </div>

        {/* Marcador Rápido Deportivo */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('en_curso')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'en_curso'
                ? 'bg-blue-950/60 border-blue-500/80 shadow-lg ring-1 ring-blue-500/40'
                : 'bg-[#12192A] border-slate-800 hover:border-blue-500/40 hover:bg-[#162035]'
            }`}
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-400 flex items-center justify-between font-sports">
              <span>Órdenes de Entrega</span>
              {myActiveDeliveries.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              )}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{myActiveDeliveries.length}</p>
          </button>

          <button
            onClick={() => setActiveTab('disponibles')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'disponibles'
                ? 'bg-purple-950/60 border-purple-500/80 shadow-lg ring-1 ring-purple-500/40'
                : 'bg-[#12192A] border-slate-800 hover:border-purple-500/40 hover:bg-[#162035]'
            }`}
          >
            <p className="text-[11px] font-black uppercase tracking-wider text-purple-400 font-sports">Listos en Barra</p>
            <p className="text-2xl sm:text-3xl font-black text-white mt-1 font-scoreboard">{availableOrders.length}</p>
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
        <LoadingSpinner message="Sincronizando comanda de entregas a butaca..." />
      ) : activeTab === 'en_curso' ? (
        /* SECCIÓN 1: MIS ENTREGAS EN CURSO */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5 font-sports">
              <Bike className="w-4 h-4 text-blue-400" /> Órdenes Asignadas para Entrega a Butaca ({myActiveDeliveries.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Asignación Directa</span>
          </div>

          {myActiveDeliveries.length === 0 ? (
            <div className="bg-[#0F1626] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">No tienes entregas activas en este momento</p>
              <p className="text-xs text-slate-400">Las nuevas comandas in-seat enviadas por tu negocio aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myActiveDeliveries.map((order) => {
                const paid = isOrderPaid(order);

                return (
                  <div
                    key={order.id}
                    className="bg-[#0F1626] rounded-2xl sm:rounded-3xl border-2 border-blue-500/80 p-5 shadow-xl flex flex-col justify-between space-y-4 animate-in fade-in relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-amber-400 to-red-500" />
                    
                    <div className="space-y-3">
                      {/* Encabezado del Pedido */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xl font-black text-white bg-blue-950/80 px-3 py-1 rounded-xl shadow-xs border border-blue-500/50">
                            #{order.pickupCode}
                          </span>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-600 text-white animate-pulse uppercase tracking-wider font-sports">
                            🚴 EN RUTA
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-400 font-mono text-base">
                          ${order.total.toLocaleString('es-MX')} MXN
                        </span>
                      </div>

                      {/* Aficionado / Cliente que solicita */}
                      <div className="bg-[#141C2E] p-3 rounded-xl border border-slate-700/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400 font-sports">Cliente Solicitante</span>
                            <span className="text-xs font-black text-white">{order.customerName || 'Aficionado Venados'}</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono font-semibold">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Destino Asiento con Botón Ver Mapa */}
                      <div className="bg-[#141C2E] p-4 rounded-2xl border-2 border-red-600/70 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-red-400 uppercase flex items-center gap-1.5 font-sports">
                            <Armchair className="w-4 h-4" /> Entregar en Asiento:
                          </span>
                          
                          {/* Botón Ver Mapa */}
                          <button
                            type="button"
                            onClick={() => setMapModalOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer font-sports active:scale-95"
                          >
                            <Map className="w-3.5 h-3.5" />
                            <span>Ver Mapa</span>
                          </button>
                        </div>

                        {/* Bloque de Sección, Fila y Asiento */}
                        <div className="grid grid-cols-3 gap-2 text-center font-mono">
                          <div className="bg-[#0B101D] p-2 rounded-xl border border-slate-800 shadow-inner">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block font-sports">Sección</span>
                            <span className="text-base sm:text-xl font-black text-white">{cleanSectionValue(order.section) || '-'}</span>
                          </div>
                          <div className="bg-[#0B101D] p-2 rounded-xl border border-slate-800 shadow-inner">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block font-sports">
                              {isGeneralAdmissionRow(order.row) ? 'Zona' : 'Fila'}
                            </span>
                            <span className="text-base sm:text-xl font-black text-amber-400">{cleanRowValue(order.row) || '-'}</span>
                          </div>
                          <div className="bg-[#0B101D] p-2 rounded-xl border border-slate-800 shadow-inner">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block font-sports">Asiento</span>
                            <span className="text-base sm:text-xl font-black text-red-400">{cleanSeatValue(order.seat) || '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Platillos Ordenados */}
                      <div className="bg-[#12192A] p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase font-sports flex items-center justify-between">
                          <span>Platillos a entregar:</span>
                          <span className="text-slate-400 font-mono">{order.items.length} artículos</span>
                        </p>
                        {order.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-bold text-slate-200">
                            <span><span className="text-red-400 font-black">{i.quantity}x</span> {i.name}</span>
                            <span className="text-slate-400 font-mono">${i.price * i.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Estatus de Pago y Botón de Cobro */}
                      <div className="bg-[#0B101D] p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase font-sports">Estado del Pago</span>
                          <span className="text-xs font-black text-white font-mono">${order.total} MXN</span>
                        </div>

                        {paid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 font-black text-xs uppercase tracking-wide font-sports shadow-sm">
                            <CreditCard className="w-4 h-4 text-emerald-400" />
                            <span>(PAGADO CON PASARELA)</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCollectingOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer font-sports active:scale-95 border border-amber-400/50"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Cobrar ${order.total}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Botón de Entrega por Escaneo QR */}
                    <div className="pt-2">
                      <button
                        disabled={actionLoading === order.id}
                        onClick={() => setQrScanningOrder(order)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-sports active:scale-98"
                      >
                        <QrCode className="w-4 h-4 text-amber-300" />
                        <span>{actionLoading === order.id ? 'Verificando...' : 'Escanear QR de Entrega'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'disponibles' ? (
        /* SECCIÓN 2: DISPONIBLES EN BARRA */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 font-sports">
              <Utensils className="w-4 h-4 text-purple-400" /> Comandas Listas en Barra ({availableOrders.length})
            </h3>
          </div>

          {availableOrders.length === 0 ? (
            <div className="bg-[#0F1626] border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
              <Bike className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">No hay comandas pendientes en barra</p>
              <p className="text-xs text-slate-400">Cuando tu negocio despache una orden in-seat, se agregará automáticamente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableOrders.map((order) => {
                const paid = isOrderPaid(order);

                return (
                  <div
                    key={order.id}
                    className="bg-[#0F1626] rounded-2xl border border-purple-500/40 p-5 shadow-lg hover:border-purple-400 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="font-mono text-lg font-black text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded-xl border border-purple-600/50">
                          #{order.pickupCode}
                        </span>
                        <span className="text-xs font-black text-white font-mono">${order.total} MXN</span>
                      </div>

                      <div className="text-xs font-medium text-slate-300">
                        Cliente: <strong className="text-white">{order.customerName}</strong>
                      </div>

                      <div className="bg-[#141C2E] border border-slate-700 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                        <span>Sec: <strong>{cleanSectionValue(order.section)}</strong></span>
                        <span>Fila: <strong>{cleanRowValue(order.row)}</strong></span>
                        <span>Seat: <strong>{cleanSeatValue(order.seat)}</strong></span>
                        <button
                          type="button"
                          onClick={() => setMapModalOrder(order)}
                          className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold uppercase font-sports hover:bg-amber-500 hover:text-slate-950 transition-colors"
                        >
                          Mapa
                        </button>
                      </div>

                      <div className="text-xs font-bold text-slate-300">
                        {paid ? (
                          <span className="text-emerald-400">✓ PAGADO</span>
                        ) : (
                          <span className="text-amber-400">💵 COBRAR ${order.total}</span>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={actionLoading === order.id}
                      onClick={() => handleClaimOrder(order.id)}
                      className="w-full py-2.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer font-sports"
                    >
                      <Bike className="w-4 h-4" />
                      <span>{actionLoading === order.id ? 'Iniciando...' : 'Tomar para Entrega'}</span>
                    </button>
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

      {/* MODAL DESPLEGABLE CON EL MAPA DEL ESTADIO PARA LA ORDEN SELECCIONADA */}
      {mapModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#0F1420] border-2 border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-white">
            {/* Cabecera con datos de la ubicación exacta */}
            <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-600 p-4 sm:p-5 flex items-center justify-between border-b border-red-500/40">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/40 text-amber-300 border border-white/20 font-sports mb-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>Ubicación de Entrega a Butaca • {targetVenueName}</span>
                </div>
                <h3 className="text-base sm:text-xl font-black font-sports uppercase tracking-wide flex items-center gap-2">
                  <span>Sección: {cleanSectionValue(mapModalOrder.section) || 'General'}</span>
                  <span>•</span>
                  <span>Fila: {cleanRowValue(mapModalOrder.row) || '-'}</span>
                  <span>•</span>
                  <span>Asiento: {cleanSeatValue(mapModalOrder.seat) || '-'}</span>
                </h3>
                <p className="text-xs text-white/90 font-medium mt-0.5">
                  Cliente: <strong>{mapModalOrder.customerName}</strong> • Pedido #{mapModalOrder.pickupCode}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMapModalOrder(null)}
                className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mapa Interactivo con la Sección Destino Resaltada */}
            <div className="p-4 overflow-y-auto flex-1 bg-[#0A0E17]">
              <div className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between">
                <span>📍 La Sección {cleanSectionValue(mapModalOrder.section)} aparece resaltada a color. El resto del estadio está deshabilitado.</span>
                <span className="text-[10px] uppercase tracking-wider font-sports bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black">
                  Sección Destino
                </span>
              </div>

              <div className="bg-[#0B101D] p-3 rounded-2xl border border-slate-800 shadow-inner">
                <TeodoroMariscalStadiumMap
                  sections={mapSections}
                  activeSectionNumber={cleanSectionValue(mapModalOrder.section)}
                  activeZoneFilter={null}
                  onSelectSection={() => {}}
                  highlightOnlyActiveSection={true}
                />
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 bg-[#12192A] border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-semibold hidden sm:inline-block">
                Usa los botones de Zoom (+) y (-) para acercarte a los pasillos del mapa.
              </span>
              <button
                type="button"
                onClick={() => setMapModalOrder(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer font-sports"
              >
                Cerrar Mapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA REGISTRAR COBRO PRESENCIAL (EFECTIVO O TERMINAL) */}
      {collectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0F1420] border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black font-sports uppercase tracking-wide">
                  Registrar Cobro al Entregar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCollectingOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#141C2E] p-4 rounded-2xl border border-slate-700 space-y-2">
              <p className="text-xs text-slate-300">
                Cliente: <strong className="text-white">{collectingOrder.customerName}</strong>
              </p>
              <p className="text-xs text-slate-300">
                Ubicación: <strong className="text-amber-300">{formatDeliverySeat(collectingOrder.section, collectingOrder.row, collectingOrder.seat)}</strong>
              </p>
              <p className="text-xl font-black text-emerald-400 font-mono pt-1">
                Total a Cobrar: ${collectingOrder.total} MXN
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-300 font-sports uppercase">
                Selecciona la Forma de Cobro Aplicada:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmCollectPayment(collectingOrder.id, 'efectivo')}
                  className="p-4 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/80 hover:bg-emerald-900 text-emerald-200 text-center font-bold transition-all cursor-pointer shadow-md active:scale-95 space-y-1"
                >
                  <span className="block text-2xl">💵</span>
                  <span className="block text-xs font-sports uppercase font-black">Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmCollectPayment(collectingOrder.id, 'terminal')}
                  className="p-4 rounded-2xl bg-blue-950/80 border-2 border-blue-500/80 hover:bg-blue-900 text-blue-200 text-center font-bold transition-all cursor-pointer shadow-md active:scale-95 space-y-1"
                >
                  <span className="block text-2xl">💳</span>
                  <span className="block text-xs font-sports uppercase font-black">Terminal Tarjeta</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCollectingOrder(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ESCÁNER QR PARA CONFIRMAR ENTREGA */}
      {qrScanningOrder && (
        <RunnerQrScannerModal
          order={qrScanningOrder}
          onClose={() => setQrScanningOrder(null)}
          onDeliverySuccess={handleDeliverOrder}
        />
      )}
    </div>
  );
};

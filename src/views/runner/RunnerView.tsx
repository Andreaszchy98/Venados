import React, { useState, useEffect } from 'react';
import { UserProfile, MerchOrder } from '../../types';
import { getAllMerchOrders, updateOrderStatus } from '../../lib/logistics';
import { updateRunnerStatus } from '../../lib/auth';
import { RunnerOrdersQueue } from './RunnerOrdersQueue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Bike,
  MapPin,
  Clock,
  CheckCircle2,
  ShoppingBag,
  Utensils,
  Sparkles,
} from 'lucide-react';

interface RunnerViewProps {
  user: UserProfile;
}

export const RunnerView: React.FC<RunnerViewProps> = ({ user }) => {
  const [currentStatus, setCurrentStatus] = useState<'disponible' | 'en_entrega' | 'inactivo'>(
    user.runnerStatus || 'disponible'
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState<'alimentos' | 'tienda'>('alimentos');

  // Pedidos de Mercancía
  const [merchOrders, setMerchOrders] = useState<MerchOrder[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const loadMerch = async () => {
      try {
        const data = await getAllMerchOrders();
        setMerchOrders(data);
      } catch (err) {
        console.warn('Error cargando pedidos merch:', err);
      }
    };
    loadMerch();
  }, []);

  const handleStatusChange = async (newStatus: 'disponible' | 'en_entrega' | 'inactivo') => {
    setUpdatingStatus(true);
    try {
      await updateRunnerStatus(user.uid, newStatus);
      setCurrentStatus(newStatus);
    } catch (err) {
      console.error('Error actualizando estado de runner:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAdvanceMerchStatus = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await updateOrderStatus(orderId, 'entregado');
      setMerchOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'entregado' } : o))
      );
    } catch (err) {
      console.error('Error entregando mercancía:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Estado del Runner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-600/30 text-blue-300 border border-blue-500/40">
              <Bike className="w-3.5 h-3.5" />
              Runner Oficial • Estadio Teodoro Mariscal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {user.displayName || 'Runner Venados'}
            </h1>
            <div className="flex items-center gap-4 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                Zona Asignada: <strong>{user.assignedZone || 'Todas las Zonas'}</strong>
              </span>
              <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Turno en Curso
              </span>
            </div>
          </div>

          {/* Selector de Estado Operativo */}
          <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Tu Estado en Vivo:
            </div>
            <div className="flex items-center gap-2">
              {[
                { id: 'disponible', label: '🟢 Disponible', bg: 'bg-emerald-600 text-white' },
                { id: 'en_entrega', label: '🟡 En Entrega', bg: 'bg-amber-600 text-white' },
                { id: 'inactivo', label: '⚪ Fuera de Turno', bg: 'bg-slate-600 text-white' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleStatusChange(st.id as any)}
                  disabled={updatingStatus}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentStatus === st.id
                      ? `${st.bg} shadow-md scale-105`
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas: Alimentos vs Mercancía */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('alimentos')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'alimentos'
              ? 'bg-red-800 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          Comandas a Butaca (In-Seat Delivery)
        </button>

        <button
          onClick={() => setActiveTab('tienda')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'tienda'
              ? 'bg-red-800 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Entregas de Tienda Oficial ({merchOrders.filter((m) => m.shippingType === 'tienda').length})
        </button>
      </div>

      {/* Tab 1: Comandas de Alimentos con cola de Runners en tiempo real */}
      {activeTab === 'alimentos' && (
        <RunnerOrdersQueue user={user} />
      )}

      {/* Tab 2: Entregas de Tienda Oficial en Estadio */}
      {activeTab === 'tienda' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-red-700" />
              Entregas de Mercancía en Estadio
            </h3>
            <span className="text-xs text-slate-500">Retiro en tienda o entrega en butaca</span>
          </div>

          <div className="divide-y divide-slate-100">
            {merchOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No hay entregas de mercancía pendientes.
              </div>
            ) : (
              merchOrders.map((order) => (
                <div key={order.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Pedido #{order.id.slice(0, 7)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          order.status === 'entregado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Cliente: <strong>{order.customerName}</strong> ({order.customerEmail})
                    </div>
                    <div className="text-xs text-slate-700 mt-0.5">
                      {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')} • ${order.total} MXN
                    </div>
                  </div>

                  {order.status !== 'entregado' && (
                    <button
                      onClick={() => handleAdvanceMerchStatus(order.id)}
                      disabled={actionLoading === order.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all self-start sm:self-auto cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Entregar a Cliente
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

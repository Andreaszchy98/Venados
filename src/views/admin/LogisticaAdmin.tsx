import React, { useState, useEffect } from 'react';
import { MerchOrder, MerchOrderStatus, CarrierCompany, UserProfile } from '../../types';
import { getAllMerchOrders, updateOrderStatus } from '../../lib/logistics';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Edit,
  Save,
  Send,
  Building,
} from 'lucide-react';

interface LogisticaAdminProps {
  user?: UserProfile;
}

export const LogisticaAdmin: React.FC<LogisticaAdminProps> = ({ user }) => {
  const venueId = user?.venueId || DEFAULT_VENUE_ID;
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MerchOrder | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // Campos de edición de guía
  const [carrier, setCarrier] = useState<CarrierCompany>('DHL Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [newStatus, setNewStatus] = useState<MerchOrderStatus>('pendiente');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getAllMerchOrders(venueId);
      setOrders(data);
    } catch (err) {
      console.error('Error fetching logistics orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [venueId]);

  const handleSelectOrder = (order: MerchOrder) => {
    setSelectedOrder(order);
    setCarrier(order.carrier || 'DHL Express');
    setTrackingNumber(order.trackingNumber || '');
    setNewStatus(order.status);
  };

  const handleUpdateLogistics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSavingStatus(true);
    try {
      await updateOrderStatus(selectedOrder.id, newStatus, carrier, trackingNumber);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      console.error('Error updating order:', err);
    } finally {
      setSavingStatus(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.trackingNumber && o.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'Todos' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = orders.filter((o) => o.status === 'pendiente').length;
  const packedCount = orders.filter((o) => o.status === 'empacado').length;
  const inTransitCount = orders.filter((o) => o.status === 'en_transito').length;
  const deliveredCount = orders.filter((o) => o.status === 'entregado').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wider font-sports uppercase flex items-center gap-2">
          <Truck className="w-6 h-6 text-red-500" />
          Logística de Envíos & Despacho de Pedidos
        </h2>
        <p className="text-xs text-slate-400 mt-0.5 font-body">
          Control de preparación de paquetes, asignación de guías de transportistas y entregas en estadio
        </p>
      </div>

      {/* KPI de Pipeline de Envíos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          onClick={() => setStatusFilter('pendiente')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'pendiente'
              ? 'bg-amber-950/60 border-amber-500/80 text-amber-300 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
              : 'bg-[#0F1626] border-slate-700/80 text-slate-400 hover:border-slate-600 shadow-md'
          }`}
        >
          <p className="text-xs font-sports uppercase tracking-wider font-bold">1. Pendientes</p>
          <p className="text-2xl font-scoreboard font-bold text-white mt-1">{pendingCount} <span className="text-sm font-sports uppercase text-slate-400 font-normal">órdenes</span></p>
        </button>

        <button
          onClick={() => setStatusFilter('empacado')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'empacado'
              ? 'bg-blue-950/60 border-blue-500/80 text-blue-300 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/50'
              : 'bg-[#0F1626] border-slate-700/80 text-slate-400 hover:border-slate-600 shadow-md'
          }`}
        >
          <p className="text-xs font-sports uppercase tracking-wider font-bold">2. Empacados</p>
          <p className="text-2xl font-scoreboard font-bold text-white mt-1">{packedCount} <span className="text-sm font-sports uppercase text-slate-400 font-normal">órdenes</span></p>
        </button>

        <button
          onClick={() => setStatusFilter('en_transito')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'en_transito'
              ? 'bg-purple-950/60 border-purple-500/80 text-purple-300 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
              : 'bg-[#0F1626] border-slate-700/80 text-slate-400 hover:border-slate-600 shadow-md'
          }`}
        >
          <p className="text-xs font-sports uppercase tracking-wider font-bold">3. En Tránsito</p>
          <p className="text-2xl font-scoreboard font-bold text-white mt-1">{inTransitCount} <span className="text-sm font-sports uppercase text-slate-400 font-normal">envíos</span></p>
        </button>

        <button
          onClick={() => setStatusFilter('entregado')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'entregado'
              ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
              : 'bg-[#0F1626] border-slate-700/80 text-slate-400 hover:border-slate-600 shadow-md'
          }`}
        >
          <p className="text-xs font-sports uppercase tracking-wider font-bold">4. Entregados</p>
          <p className="text-2xl font-scoreboard font-bold text-white mt-1">{deliveredCount} <span className="text-sm font-sports uppercase text-slate-400 font-normal">órdenes</span></p>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-[#0F1626] p-4 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, correo o número de guía..."
            className="w-full pl-9 pr-3 py-2 bg-[#0A0E17] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500 font-body"
          />
        </div>

        <button
          onClick={() => setStatusFilter('Todos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold font-sports uppercase tracking-wider transition-colors cursor-pointer ${
            statusFilter === 'Todos'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-[#1E293B] text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}
        >
          Ver Todas ({orders.length})
        </button>
      </div>

      {/* Lista de Órdenes */}
      {loading ? (
        <LoadingSpinner message="Consultando despacho de pedidos..." />
      ) : filteredOrders.length === 0 ? (
        <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-12 text-center text-slate-400 font-body">
          No hay órdenes registradas con este filtro.
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-5 shadow-lg hover:border-slate-600 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                    ID: {order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 font-body">• {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-sports uppercase tracking-wider ${
                    order.status === 'pendiente' ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40' :
                    order.status === 'empacado' ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40' :
                    order.status === 'en_transito' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40' :
                    'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <h4 className="font-bold text-sm text-white font-body">{order.customerName}</h4>
                  <span className="text-xs text-slate-400 font-body">{order.customerEmail} • Tel: {order.customerPhone || 'N/A'}</span>
                </div>

                {/* Resumen de Artículos */}
                <div className="text-xs text-slate-300 bg-[#0A0E17] p-2.5 rounded-xl border border-slate-800 font-body">
                  <strong className="text-white font-sports uppercase tracking-wider">Contenido ({order.items.length} productos):</strong>{' '}
                  {order.items.map((i) => `${i.quantity}x ${i.name} (${i.size || 'Unitalla'})`).join(' • ')}
                </div>

                {/* Dirección o Entrega en Tienda */}
                {order.shippingType === 'domicilio' && order.shippingAddress ? (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 font-body">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>{order.shippingAddress.street}, {order.shippingAddress.neighborhood}, {order.shippingAddress.city}, C.P. {order.shippingAddress.zipCode}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-300 flex items-center gap-1 font-sports uppercase tracking-wider font-semibold">
                    <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Entrega en Tienda Oficial del Estadio Teodoro Mariscal</span>
                  </p>
                )}
              </div>

              {/* Columna derecha: Logística & Botón de Gestión */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800">
                <div className="text-right space-y-1">
                  <span className="text-2xl font-scoreboard font-bold text-white block">${order.total.toLocaleString('es-MX')} <span className="text-sm font-sports uppercase text-red-400 font-normal">MXN</span></span>
                  <div className="text-[11px] text-slate-400 font-sports uppercase tracking-wider">
                    Transporte: <strong className="text-slate-200">{order.carrier || 'No asignado'}</strong>
                  </div>
                  {order.trackingNumber && (
                    <div className="font-mono text-[11px] font-bold text-amber-400">
                      Guía: {order.trackingNumber}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSelectOrder(order)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-sports uppercase tracking-wider rounded-xl shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Gestionar Envío / Guía</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Asignación de Guía y Estado */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0F1626] w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-[#0A0E17] text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm font-sports uppercase tracking-wider text-white">Gestionar Despacho de Orden</h3>
                <span className="font-mono text-[11px] sm:text-xs text-red-400">ID: {selectedOrder.id}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateLogistics} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto text-xs sm:text-sm">
              <div>
                <label className="block font-sports uppercase tracking-wider font-bold text-slate-300 mb-1">Estado del Despacho</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MerchOrderStatus)}
                  className="w-full p-2.5 border border-slate-700/80 rounded-xl font-sports uppercase tracking-wider bg-[#0A0E17] text-white text-xs sm:text-sm focus:outline-hidden focus:border-red-500"
                >
                  <option value="pendiente" className="bg-[#0A0E17] text-white">Pendiente de Empaque</option>
                  <option value="empacado" className="bg-[#0A0E17] text-white">Empacado / Listo para Salir</option>
                  <option value="en_transito" className="bg-[#0A0E17] text-white">En Tránsito con Paquetería</option>
                  <option value="entregado" className="bg-[#0A0E17] text-white">Entregado al Cliente</option>
                  <option value="cancelado" className="bg-[#0A0E17] text-white">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block font-sports uppercase tracking-wider font-bold text-slate-300 mb-1">Empresa Transportista / Modalidad</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as CarrierCompany)}
                  className="w-full p-2.5 border border-slate-700/80 rounded-xl font-sports uppercase tracking-wider bg-[#0A0E17] text-white text-xs sm:text-sm focus:outline-hidden focus:border-red-500"
                >
                  <option value="DHL Express" className="bg-[#0A0E17] text-white">DHL Express</option>
                  <option value="Estafeta" className="bg-[#0A0E17] text-white">Estafeta</option>
                  <option value="Paquetexpress" className="bg-[#0A0E17] text-white">Paquetexpress</option>
                  <option value="Mensajería Local Mazatlán" className="bg-[#0A0E17] text-white">Mensajería Local Mazatlán</option>
                  <option value="Recoger en Tienda Estadio" className="bg-[#0A0E17] text-white">Recoger en Tienda Estadio Teodoro Mariscal</option>
                </select>
              </div>

              <div>
                <label className="block font-sports uppercase tracking-wider font-bold text-slate-300 mb-1">Número de Guía o Código de Rastreo</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Ej. DHL-892183920 o LOCAL-MZT-441"
                  className="w-full p-2.5 bg-[#0A0E17] border border-slate-700/80 rounded-xl font-mono font-bold text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 border border-slate-700 rounded-xl font-bold font-sports uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold font-sports uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" />
                  {savingStatus ? 'Actualizando...' : 'Guardar y Notificar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

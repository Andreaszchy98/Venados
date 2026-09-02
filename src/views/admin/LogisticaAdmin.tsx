import React, { useState, useEffect } from 'react';
import { MerchOrder, MerchOrderStatus, CarrierCompany } from '../../types';
import { getAllMerchOrders, updateOrderStatus } from '../../lib/logistics';
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

export const LogisticaAdmin: React.FC = () => {
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
      const data = await getAllMerchOrders();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching logistics orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Truck className="w-6 h-6 text-red-700" />
          Logística de Envíos & Despacho de Pedidos
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Control de preparación de paquetes, asignación de guías de transportistas y entregas en estadio
        </p>
      </div>

      {/* KPI de Pipeline de Envíos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          onClick={() => setStatusFilter('pendiente')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'pendiente' ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <p className="text-[11px] font-semibold opacity-90">1. Pendientes</p>
          <p className="text-xl font-black mt-1">{pendingCount} órdenes</p>
        </button>

        <button
          onClick={() => setStatusFilter('empacado')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'empacado' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <p className="text-[11px] font-semibold opacity-90">2. Empacados</p>
          <p className="text-xl font-black mt-1">{packedCount} órdenes</p>
        </button>

        <button
          onClick={() => setStatusFilter('en_transito')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'en_transito' ? 'bg-purple-600 text-white border-purple-700 shadow-md' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <p className="text-[11px] font-semibold opacity-90">3. En Tránsito</p>
          <p className="text-xl font-black mt-1">{inTransitCount} envíos</p>
        </button>

        <button
          onClick={() => setStatusFilter('entregado')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'entregado' ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <p className="text-[11px] font-semibold opacity-90">4. Entregados</p>
          <p className="text-xl font-black mt-1">{deliveredCount} órdenes</p>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, correo o número de guía..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-600"
          />
        </div>

        <button
          onClick={() => setStatusFilter('Todos')}
          className={`px-3 py-2 rounded-xl text-xs font-bold ${
            statusFilter === 'Todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Ver Todas ({orders.length})
        </button>
      </div>

      {/* Lista de Órdenes */}
      {loading ? (
        <LoadingSpinner message="Consultando despacho de pedidos..." />
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          No hay órdenes registradas con este filtro.
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    ID: {order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500">• {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    order.status === 'pendiente' ? 'bg-amber-100 text-amber-800' :
                    order.status === 'empacado' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'en_transito' ? 'bg-purple-100 text-purple-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <h4 className="font-black text-sm text-slate-900">{order.customerName}</h4>
                  <span className="text-xs text-slate-500">{order.customerEmail} • Tel: {order.customerPhone || 'N/A'}</span>
                </div>

                {/* Resumen de Artículos */}
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  <strong>Contenido ({order.items.length} productos):</strong>{' '}
                  {order.items.map((i) => `${i.quantity}x ${i.name} (${i.size || 'Unitalla'})`).join(' • ')}
                </div>

                {/* Dirección o Entrega en Tienda */}
                {order.shippingType === 'domicilio' && order.shippingAddress ? (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{order.shippingAddress.street}, {order.shippingAddress.neighborhood}, {order.shippingAddress.city}, C.P. {order.shippingAddress.zipCode}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-800 flex items-center gap-1 font-semibold">
                    <Building className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Entrega en Tienda Oficial del Estadio Teodoro Mariscal</span>
                  </p>
                )}
              </div>

              {/* Columna derecha: Logística & Botón de Gestión */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                <div className="text-right space-y-1">
                  <span className="text-base font-black text-slate-900">${order.total.toLocaleString('es-MX')} MXN</span>
                  <div className="text-[11px] text-slate-500">
                    Transporte: <strong>{order.carrier || 'No asignado'}</strong>
                  </div>
                  {order.trackingNumber && (
                    <div className="font-mono text-[11px] font-bold text-red-800">
                      Guía: {order.trackingNumber}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSelectOrder(order)}
                  className="px-4 py-2 bg-slate-900 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-xs sm:text-sm">Gestionar Despacho de Orden</h3>
                <span className="font-mono text-[11px] sm:text-xs text-red-300">ID: {selectedOrder.id}</span>
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
                <label className="block font-bold text-slate-700 mb-1">Estado del Despacho</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MerchOrderStatus)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600"
                >
                  <option value="pendiente">Pendiente de Empaque</option>
                  <option value="empacado">Empacado / Listo para Salir</option>
                  <option value="en_transito">En Tránsito con Paquetería</option>
                  <option value="entregado">Entregado al Cliente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Empresa Transportista / Modalidad</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value as CarrierCompany)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white text-slate-800 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600"
                >
                  <option value="DHL Express">DHL Express</option>
                  <option value="Estafeta">Estafeta</option>
                  <option value="Paquetexpress">Paquetexpress</option>
                  <option value="Mensajería Local Mazatlán">Mensajería Local Mazatlán</option>
                  <option value="Recoger en Tienda Estadio">Recoger en Tienda Estadio Teodoro Mariscal</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Número de Guía o Código de Rastreo</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Ej. DHL-892183920 o LOCAL-MZT-441"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer text-xs"
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

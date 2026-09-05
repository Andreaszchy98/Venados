import React, { useState, useEffect } from 'react';
import { FoodOrder, MerchOrder, UserProfile } from '../../types';
import { getUserFoodOrders } from '../../lib/foodOrders';
import { getUserMerchOrders } from '../../lib/logistics';
import { normalizeGoogleDriveImageUrl, getDefaultProductPlaceholder } from '../../lib/imageUtils';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Package,
  Utensils,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

interface MisPedidosProps {
  user: UserProfile;
}

export const MisPedidos: React.FC<MisPedidosProps> = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState<'comida' | 'tienda'>('comida');
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [merchOrders, setMerchOrders] = useState<MerchOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [foods, merches] = await Promise.all([
        getUserFoodOrders(user.uid),
        getUserMerchOrders(user.uid),
      ]);
      setFoodOrders(foods);
      setMerchOrders(merches);
    } catch (err) {
      console.error('Error fetching user orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling cada 10s para ver avances de cocina/envío
    return () => clearInterval(interval);
  }, [user.uid]);

  const getFoodStatusBadge = (order: FoodOrder) => {
    switch (order.status) {
      case 'pendiente':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Recibido en Cocina</span>;
      case 'preparando':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 animate-pulse">En Preparación</span>;
      case 'listo':
        if (order.orderType === 'in-seat') {
          return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-600 text-white shadow-xs">¡LISTO • ASIGNANDO RUNNER!</span>;
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-xs">¡LISTO PARA RECOGER!</span>;
      case 'en-camino':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-xs animate-bounce">🚴 ¡RUNNER EN CAMINO!</span>;
      case 'entregado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">Entregado</span>;
      case 'cancelado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Cancelado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{order.status}</span>;
    }
  };

  const getMerchStatusBadge = (status: MerchOrder['status']) => {
    switch (status) {
      case 'pendiente':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Pendiente de Empaque</span>;
      case 'empacado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Empacado / Listo para Salir</span>;
      case 'en_transito':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">En Tránsito con Paquetería</span>;
      case 'entregado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Entregado al Aficionado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtabs para alternar entre Alimentos y Mercancía */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Seguimiento de Mis Pedidos</h2>
          <p className="text-xs text-slate-500">
            Consulta en tiempo real el estatus de tus alimentos en el estadio y envíos de la tienda
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200 p-1 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('comida')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeSubTab === 'comida'
                ? 'bg-white text-red-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Comida Estadio ({foodOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('tienda')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeSubTab === 'tienda'
                ? 'bg-white text-red-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Tienda & Envíos ({merchOrders.length})
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Consultando tus pedidos..." />
      ) : activeSubTab === 'comida' ? (
        /* Pedidos de Comida y Bebidas Express */
        foodOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No tienes pedidos de alimentos activos</p>
            <p className="text-xs">Ve a la sección "Comida & Bebidas" para pedir platillos y recoger en mostrador.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {foodOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-2 bg-red-800 text-white font-mono font-black text-lg rounded-xl shadow-xs">
                      {order.pickupCode}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{order.standName}</h3>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getFoodStatusBadge(order)}
                    <span className="text-sm font-black text-slate-900">
                      ${order.total.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                </div>

                {/* Modalidad y Ubicación */}
                <div className="flex items-center justify-between text-xs bg-slate-100/70 px-3 py-1.5 rounded-lg text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {order.orderType === 'in-seat' ? '🚴 Entrega a Butaca:' : '⚡ Modalidad:'}
                    </span>
                    {order.orderType === 'in-seat' ? (
                      <span className="font-bold text-red-900">
                        Sección {order.section || '-'}, Fila {order.row || '-'}, Asiento {order.seat || '-'}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-600">Pickup Express en mostrador</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Pago: {order.paymentMethod}
                  </span>
                </div>

                {/* Items de la orden */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl">
                  {order.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span><strong>{i.quantity}x</strong> {i.name}</span>
                      <span className="font-semibold text-slate-900">${(i.price * i.quantity).toLocaleString('es-MX')} MXN</span>
                    </div>
                  ))}
                </div>

                {/* Mensaje de llamado */}
                {order.status === 'listo' && order.orderType === 'pickup' && (
                  <div className="p-3 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm animate-pulse">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>¡Tu orden está servida en barra! Muestra tu código <strong>{order.pickupCode}</strong> al encargado para recoger.</span>
                  </div>
                )}
                {order.status === 'listo' && order.orderType === 'in-seat' && (
                  <div className="p-3 bg-purple-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm">
                    <Clock className="w-5 h-5 shrink-0" />
                    <span>Tu pedido está listo en cocina. Esperando que un Runner lo tome para llevarlo a tu asiento (Sección {order.section}, Butaca {order.seat}).</span>
                  </div>
                )}
                {order.status === 'en-camino' && (
                  <div className="p-3 bg-blue-600 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md animate-pulse">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>🚴 ¡Un Runner va en camino con tu comida! Permanece en tu asiento (Sección {order.section}, Fila {order.row}, Asiento {order.seat}).</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Pedidos de Mercancía Oficial y Envíos */
        merchOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No tienes pedidos de tienda</p>
            <p className="text-xs">Visita la "Tienda Oficial" para comprar tus jerseys y accesorios de Venados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {merchOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">ID: {order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-xs text-slate-400">• {new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="font-extrabold text-sm text-slate-900 mt-0.5">
                      {order.shippingType === 'domicilio' ? 'Envío a Domicilio' : 'Retiro en Tienda Teodoro Mariscal'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {getMerchStatusBadge(order.status)}
                    <span className="text-sm font-black text-slate-900">
                      ${order.total.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                </div>

                {/* Artículos comprados */}
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl text-xs">
                      {item.image && (
                        <img
                          src={normalizeGoogleDriveImageUrl(item.image) || getDefaultProductPlaceholder()}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover bg-white shrink-0 border border-slate-200"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = getDefaultProductPlaceholder();
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.quantity} pza{item.quantity > 1 ? 's' : ''} • Talla: {item.size || 'N/A'} • SKU: {item.sku}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">${(item.price * item.quantity).toLocaleString('es-MX')} MXN</span>
                    </div>
                  ))}
                </div>

                {/* Datos de rastreo y logística */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600 space-y-0.5">
                    <p>
                      <strong>Paquetería / Transporte:</strong> {order.carrier || 'Asignando transportista...'}
                    </p>
                    {order.trackingNumber && (
                      <p className="flex items-center gap-1.5 text-slate-800">
                        <strong>Número de Guía:</strong>
                        <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-red-900 border border-slate-200">
                          {order.trackingNumber}
                        </span>
                      </p>
                    )}
                  </div>

                  {order.shippingAddress && (
                    <p className="text-slate-500 text-[11px] max-w-xs">
                      Destino: {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { FoodOrder, MerchOrder, UserProfile } from '../../types';
import { getUserFoodOrders } from '../../lib/foodOrders';
import { getUserMerchOrders } from '../../lib/logistics';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { formatDeliverySeat } from '../../lib/seatUtils';
import { useLanguage } from '../../context/LanguageContext';
import {
  Package,
  Utensils,
  CheckCircle2,
  Clock,
  ShoppingBag,
} from 'lucide-react';

interface MisPedidosProps {
  user: UserProfile;
}

export const MisPedidos: React.FC<MisPedidosProps> = ({ user }) => {
  const { t } = useLanguage();
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
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60">
            {t('orders.status.food.pendiente', 'Recibido en Cocina')}
          </span>
        );
      case 'preparando':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200/60 animate-pulse">
            {t('orders.status.food.preparando', 'En Preparación')}
          </span>
        );
      case 'listo':
        if (order.orderType === 'in-seat') {
          return (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-600 text-white shadow-xs">
              {t('orders.status.food.listo_runner', '¡LISTO • ASIGNANDO RUNNER!')}
            </span>
          );
        }
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-xs">
            {t('orders.status.food.listo_pickup', '¡LISTO PARA RECOGER!')}
          </span>
        );
      case 'en-camino':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white shadow-xs">
            {t('orders.status.food.en_camino', '🚴 ¡RUNNER EN CAMINO!')}
          </span>
        );
      case 'entregado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
            {t('orders.status.food.entregado', 'Entregado')}
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200/60">
            {t('orders.status.food.cancelado', 'Cancelado')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {order.status}
          </span>
        );
    }
  };

  const getMerchStatusBadge = (status: MerchOrder['status']) => {
    switch (status) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60">
            {t('orders.status.merch.pendiente', 'Pendiente de Empaque')}
          </span>
        );
      case 'empacado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200/60">
            {t('orders.status.merch.empacado', 'Empacado / Listo para Salir')}
          </span>
        );
      case 'en_transito':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200/60">
            {t('orders.status.merch.en_transito', 'En Tránsito con Paquetería')}
          </span>
        );
      case 'entregado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
            {t('orders.status.merch.entregado', 'Entregado al Aficionado')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtabs para alternar entre Alimentos y Mercancía */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {t('orders.title', 'Historial y Seguimiento de Pedidos')}
          </h2>
          <p className="text-xs text-slate-500">
            {t('orders.subtitle', 'Consulta en tiempo real el estatus de tus alimentos en el estadio y envíos de la tienda')}
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold self-start sm:self-center">
          <button
            onClick={() => setActiveSubTab('comida')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'comida'
                ? 'bg-white text-red-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            {t('orders.stadium_food_tab', 'Comida Estadio')} ({foodOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('tienda')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'tienda'
                ? 'bg-white text-red-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            {t('orders.store_shipping_tab', 'Tienda & Envíos')} ({merchOrders.length})
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message={t('common.loading', 'Consultando tus pedidos...')} />
      ) : activeSubTab === 'comida' ? (
        /* Pedidos de Comida y Bebidas Express */
        foodOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Utensils className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              {t('orders.empty_food_title', 'No tienes pedidos de alimentos activos')}
            </p>
            <p className="text-xs">
              {t('orders.empty_food_desc', 'Ve a la sección "Comida & Bebidas" para pedir platillos y recoger en mostrador.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {foodOrders.map((order) => {
              const formattedLocation = formatDeliverySeat(order.section, order.row, order.seat);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                >
                  {/* Encabezado: Negocio + Código + Fecha a la izquierda, Total + Estado a la derecha */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 bg-red-800 text-white font-mono font-black text-sm sm:text-base rounded-xl shadow-2xs shrink-0">
                        {order.pickupCode}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                          {order.standName}
                        </h3>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Agrupación compacta de Precio y Estado en la misma línea */}
                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      <span className="text-sm sm:text-base font-black text-slate-950">
                        ${order.total.toLocaleString('es-MX')} MXN
                      </span>
                      <span className="text-slate-300 font-bold hidden xs:inline">•</span>
                      {getFoodStatusBadge(order)}
                    </div>
                  </div>

                  {/* Línea compacta de Entrega / Modalidad y Método de Pago */}
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.orderType === 'in-seat' ? (
                        <>
                          <span className="text-sm">🚴</span>
                          <span className="font-bold text-slate-900">
                            {t('orders.in_seat_delivery', 'Entrega a Butaca')}:
                          </span>
                          <span className="font-bold text-red-900 bg-red-50/80 px-2 py-0.5 rounded border border-red-200/60">
                            {formattedLocation}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">⚡</span>
                          <span className="font-medium text-slate-700">
                            {t('orders.express_pickup', 'Pickup Express en mostrador')}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium">
                      {t('orders.payment', 'Pago')}: <span className="font-semibold text-slate-700">{order.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Items de la orden en lista compacta sin bordes pesados */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700 px-1 pt-0.5">
                    {order.items.map((i, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5">
                        <span className="font-black text-red-800 bg-red-50 px-1.5 py-0.5 rounded text-[11px]">
                          {i.quantity}x
                        </span>
                        <span className="font-medium text-slate-900">{i.name}</span>
                        <span className="text-slate-400 font-normal">
                          (${(i.price * i.quantity).toLocaleString('es-MX')})
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Mensajes de aviso / estado de entrega en vivo */}
                  {order.status === 'listo' && order.orderType === 'pickup' && (
                    <div className="p-2.5 bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs animate-pulse">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        ¡Tu orden está servida en barra! Muestra tu código <strong>{order.pickupCode}</strong> al encargado para recoger.
                      </span>
                    </div>
                  )}
                  {order.status === 'listo' && order.orderType === 'in-seat' && (
                    <div className="p-2.5 bg-purple-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        Tu pedido está listo en cocina. Esperando que un Runner lo tome para llevarlo a tu asiento ({formattedLocation}).
                      </span>
                    </div>
                  )}
                  {order.status === 'en-camino' && (
                    <div className="p-2.5 bg-blue-600 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-xs animate-pulse">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        🚴 ¡Un Runner va en camino con tu comida! Permanece en tu asiento ({formattedLocation}).
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Pedidos de Mercancía Oficial y Envíos */
        merchOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              {t('orders.empty_merch_title', 'No tienes pedidos de tienda')}
            </p>
            <p className="text-xs">
              {t('orders.empty_merch_desc', 'Visita la "Tienda Oficial" para comprar tus jerseys y accesorios.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {merchOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow space-y-3"
              >
                {/* Encabezado: ID y Tipo de Entrega a la izquierda, Total + Estado a la derecha */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        ID: {order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">
                        • {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 mt-1">
                      {order.shippingType === 'domicilio'
                        ? t('orders.home_delivery', 'Envío a Domicilio')
                        : t('orders.stadium_pickup', 'Retiro en Tienda Estadio')}
                    </h3>
                  </div>

                  {/* Agrupación compacta de Precio y Estado en la misma línea */}
                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    <span className="text-sm sm:text-base font-black text-slate-950">
                      ${order.total.toLocaleString('es-MX')} MXN
                    </span>
                    <span className="text-slate-300 font-bold hidden xs:inline">•</span>
                    {getMerchStatusBadge(order.status)}
                  </div>
                </div>

                {/* Línea compacta de Paquetería / Guía / Destino */}
                <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm">📦</span>
                    {order.shippingType === 'domicilio' ? (
                      <>
                        <span className="font-medium">
                          {order.carrier || t('orders.carrier', 'Transporte')}:
                        </span>
                        {order.trackingNumber ? (
                          <span className="font-mono font-bold text-red-900 bg-red-50/80 px-2 py-0.5 rounded border border-red-200/60">
                            #{order.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            {t('orders.assigning_carrier', 'Asignando transportista...')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-medium text-slate-700">
                        {t('orders.stadium_pickup', 'Retiro en Tienda Oficial Teodoro Mariscal')}
                      </span>
                    )}
                  </div>

                  {order.shippingAddress && (
                    <div className="text-[11px] text-slate-500 font-medium truncate max-w-xs">
                      📍 {order.shippingAddress.city}, {order.shippingAddress.state}
                    </div>
                  )}
                </div>

                {/* Artículos comprados en lista limpia */}
                <div className="space-y-1.5 px-1 pt-0.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-red-800 bg-red-50 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                          {item.quantity}x
                        </span>
                        <span className="font-bold text-slate-900 truncate">{item.name}</span>
                        {item.size && (
                          <span className="text-[11px] text-slate-500 shrink-0">
                            • {t('orders.size', 'Talla')}: {item.size}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 shrink-0 ml-3">
                        ${(item.price * item.quantity).toLocaleString('es-MX')} MXN
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

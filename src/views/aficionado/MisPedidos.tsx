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
  CreditCard,
} from 'lucide-react';

interface MisPedidosProps {
  user: UserProfile;
  onOpenAuth?: () => void;
}

export const MisPedidos: React.FC<MisPedidosProps> = ({ user, onOpenAuth }) => {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'comida' | 'tienda'>('comida');
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [merchOrders, setMerchOrders] = useState<MerchOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user || !user.uid) {
      setLoading(false);
      return;
    }
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
    if (!user || !user.uid) {
      setLoading(false);
      return;
    }
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling cada 10s para ver avances de cocina/envío
    return () => clearInterval(interval);
  }, [user?.uid]);

  if (!user || !user.uid) {
    return (
      <div className="py-12 px-4 max-w-md mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-red-900/30 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-950/40">
          <Package className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white">
            Inicia sesión para ver tus pedidos
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Consulta el estado en vivo de tus pedidos de comida entregados por los runners a tu butaca y el seguimiento de tus compras de la tienda oficial.
          </p>
        </div>
        <button
          id="btn-login-pedidos-guest"
          type="button"
          onClick={onOpenAuth}
          className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-red-950/50 transition-all cursor-pointer"
        >
          Iniciar Sesión
        </button>
      </div>
    );
  }

  const getFoodStatusBadge = (order: FoodOrder) => {
    switch (order.status) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40 uppercase">
            {t('orders.status.food.pendiente', 'Recibido en Cocina')}
          </span>
        );
      case 'preparando':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-950/60 text-sky-300 border border-sky-500/40 animate-pulse uppercase">
            {t('orders.status.food.preparando', 'En Preparación')}
          </span>
        );
      case 'listo':
        if (order.orderType === 'in-seat') {
          return (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-950/60 text-purple-300 border border-purple-500/40 shadow-xs uppercase">
              {t('orders.status.food.listo_runner', '¡LISTO • ASIGNANDO RUNNER!')}
            </span>
          );
        }
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-xs uppercase">
            {t('orders.status.food.listo_pickup', '¡LISTO PARA RECOGER!')}
          </span>
        );
      case 'en-camino':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-950/60 text-blue-300 border border-blue-500/40 shadow-xs uppercase">
            {t('orders.status.food.en_camino', '🚴 ¡RUNNER EN CAMINO!')}
          </span>
        );
      case 'entregado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 uppercase">
            {t('orders.status.food.entregado', 'Entregado')}
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/40 uppercase">
            {t('orders.status.food.cancelado', 'Cancelado')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
            {order.status}
          </span>
        );
    }
  };

  const getMerchStatusBadge = (status: MerchOrder['status']) => {
    switch (status) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40 uppercase">
            {t('orders.status.merch.pendiente', 'Pendiente de Empaque')}
          </span>
        );
      case 'empacado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-950/60 text-sky-300 border border-sky-500/40 uppercase">
            {t('orders.status.merch.empacado', 'Empacado / Listo para Salir')}
          </span>
        );
      case 'en_transito':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950/60 text-purple-300 border border-purple-500/40 uppercase">
            {t('orders.status.merch.en_transito', 'En Tránsito con Paquetería')}
          </span>
        );
      case 'entregado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 uppercase">
            {t('orders.status.merch.entregado', 'Entregado al Aficionado')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sports">
      {/* Subtabs para alternar entre Alimentos y Mercancía */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-wider">
            {t('orders.title', 'Historial y Seguimiento de Pedidos')}
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            {t('orders.subtitle', 'Consulta en tiempo real el estatus de tus alimentos en el estadio y envíos de la tienda')}
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-[#0A0E17] border border-slate-700/80 p-1 text-xs font-bold self-start sm:self-center">
          <button
            onClick={() => setActiveSubTab('comida')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider ${
              activeSubTab === 'comida'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            {t('orders.stadium_food_tab', 'Comida Estadio')} ({foodOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('tienda')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider ${
              activeSubTab === 'tienda'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
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
          <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <Utensils className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              {t('orders.empty_food_title', 'No tienes pedidos de alimentos activos')}
            </p>
            <p className="text-xs text-slate-400 font-sans">
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
                  className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-4 sm:p-5 shadow-xl hover:border-slate-600 transition-colors space-y-3"
                >
                  {/* Encabezado: Negocio + Código + Fecha a la izquierda, Total + Estado a la derecha */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 bg-red-600 text-white font-scoreboard font-black text-sm sm:text-base rounded-xl shadow-md shrink-0">
                        {order.pickupCode}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight tracking-wide">
                          {order.standName}
                        </h3>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-sans">
                          <Clock className="w-3 h-3 text-red-500" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Agrupación compacta de Precio y Estado en la misma línea */}
                    <div className="flex items-center gap-2.5 self-start sm:self-center">
                      <span className="text-sm sm:text-base font-black text-emerald-400 font-scoreboard">
                        ${order.total.toLocaleString('es-MX')} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
                      </span>
                      <span className="text-slate-600 font-bold hidden xs:inline">•</span>
                      {getFoodStatusBadge(order)}
                    </div>
                  </div>

                  {/* Línea compacta de Entrega / Modalidad y Método de Pago */}
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-slate-300 bg-[#0A0E17] px-3 py-2 rounded-xl border border-slate-700/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.orderType === 'in-seat' ? (
                        <>
                          <span className="text-sm">🚴</span>
                          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                            {t('orders.in_seat_delivery', 'Entrega a Butaca')}:
                          </span>
                          <span className="font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60">
                            {formattedLocation}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">⚡</span>
                          <span className="font-medium text-slate-300">
                            {t('orders.express_pickup', 'Pickup Express en mostrador')}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-[11px] font-sans flex items-center gap-1.5">
                      {order.paymentStatus === 'pagado' || order.paymentDetails || (order.paymentMethod && order.paymentMethod.toLowerCase().includes('tarjeta')) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                          <CreditCard className="w-3 h-3 text-emerald-400" />
                          <span>Pagado con Tarjeta {order.paymentDetails?.cardBrand ? `(${order.paymentDetails.cardBrand.toUpperCase()} •••• ${order.paymentDetails.cardLast4})` : ''}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700 text-[10px] font-medium">
                          <span>💵 {t('orders.payment', 'Pago')}: <strong className="text-white">{order.paymentMethod}</strong></span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items de la orden en lista compacta */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 px-1 pt-0.5">
                    {order.items.map((i, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5">
                        <span className="font-black text-white bg-red-600 px-1.5 py-0.5 rounded text-[10px] font-mono">
                          {i.quantity}x
                        </span>
                        <span className="font-medium text-slate-200">{i.name}</span>
                        <span className="text-emerald-400 font-scoreboard text-[11px]">
                          (${(i.price * i.quantity).toLocaleString('es-MX')})
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Mensajes de aviso / estado de entrega en vivo */}
                  {order.status === 'listo' && order.orderType === 'pickup' && (
                    <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg animate-pulse">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>
                        ¡Tu orden está servida en barra! Muestra tu código <strong>{order.pickupCode}</strong> al encargado para recoger.
                      </span>
                    </div>
                  )}
                  {order.status === 'listo' && order.orderType === 'in-seat' && (
                    <div className="p-2.5 bg-purple-950/70 border border-purple-500/60 text-purple-300 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg">
                      <Clock className="w-4 h-4 shrink-0 text-purple-400" />
                      <span>
                        Tu pedido está listo en cocina. Esperando que un Runner lo tome para llevarlo a tu asiento ({formattedLocation}).
                      </span>
                    </div>
                  )}
                  {order.status === 'en-camino' && (
                    <div className="p-2.5 bg-blue-950/70 border border-blue-500/60 text-blue-300 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg animate-pulse">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
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
          <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">
              {t('orders.empty_merch_title', 'No tienes pedidos de tienda')}
            </p>
            <p className="text-xs text-slate-400 font-sans">
              {t('orders.empty_merch_desc', 'Visita la "Tienda Oficial" para comprar tus jerseys y accesorios.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {merchOrders.map((order) => (
              <div
                key={order.id}
                className="bg-[#0F1626] rounded-2xl border border-slate-700/80 p-4 sm:p-5 shadow-xl hover:border-slate-600 transition-colors space-y-3"
              >
                {/* Encabezado: ID y Tipo de Entrega a la izquierda, Total + Estado a la derecha */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-scoreboard text-xs font-bold text-slate-300 bg-[#0A0E17] px-2 py-0.5 rounded border border-slate-700">
                        ID: {order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400 font-sans">
                        • {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white mt-1 tracking-wide">
                      {order.shippingType === 'domicilio'
                        ? t('orders.home_delivery', 'Envío a Domicilio')
                        : t('orders.stadium_pickup', 'Retiro en Tienda Estadio')}
                    </h3>
                  </div>

                  {/* Agrupación compacta de Precio y Estado en la misma línea */}
                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    <span className="text-sm sm:text-base font-black text-emerald-400 font-scoreboard">
                      ${order.total.toLocaleString('es-MX')} <span className="text-[10px] text-slate-400 font-sans">MXN</span>
                    </span>
                    <span className="text-slate-600 font-bold hidden xs:inline">•</span>
                    {getMerchStatusBadge(order.status)}
                  </div>
                </div>

                {/* Línea compacta de Paquetería / Guía / Destino */}
                <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-slate-300 bg-[#0A0E17] px-3 py-2 rounded-xl border border-slate-700/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm">📦</span>
                    {order.shippingType === 'domicilio' ? (
                      <>
                        <span className="font-medium text-slate-300 font-sans">
                          {order.carrier || t('orders.carrier', 'Transporte')}:
                        </span>
                        {order.trackingNumber ? (
                          <span className="font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60">
                            #{order.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic font-sans">
                            {t('orders.assigning_carrier', 'Asignando transportista...')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-medium text-slate-300">
                        {t('orders.stadium_pickup', 'Retiro en Tienda Oficial Teodoro Mariscal')}
                      </span>
                    )}
                  </div>

                  {order.shippingAddress && (
                    <div className="text-[11px] text-slate-400 font-medium truncate max-w-xs font-sans">
                      📍 {order.shippingAddress.city}, {order.shippingAddress.state}
                    </div>
                  )}
                </div>

                {/* Artículos comprados en lista limpia */}
                <div className="space-y-1.5 px-1 pt-0.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-white bg-red-600 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">
                          {item.quantity}x
                        </span>
                        <span className="font-bold text-white truncate">{item.name}</span>
                        {item.size && (
                          <span className="text-[11px] text-slate-400 shrink-0 font-sans">
                            • {t('orders.size', 'Talla')}: {item.size}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-emerald-400 font-scoreboard shrink-0 ml-3">
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

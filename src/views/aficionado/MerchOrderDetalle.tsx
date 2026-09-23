import React, { useState } from 'react';
import { MerchOrder } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ArrowLeft,
  Clock,
  MapPin,
  ShoppingBag,
  Truck,
  Building,
  CheckCircle2,
  Share2,
  Download,
  Check,
  CreditCard,
  Package,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface MerchOrderDetalleProps {
  order: MerchOrder;
  onBack: () => void;
}

export const MerchOrderDetalle: React.FC<MerchOrderDetalleProps> = ({ order, onBack }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalItemsCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getMerchItemTitle = (item: any): string => {
    return item?.name || item?.product?.title || item?.title || 'Producto Oficial';
  };

  const getMerchItemSize = (item: any): string | undefined => {
    return item?.size || item?.selectedSize;
  };

  const getMerchItemPrice = (item: any): number => {
    if (typeof item?.price === 'number') return item.price;
    if (typeof item?.product?.price === 'number') return item.product.price;
    return 0;
  };

  const handleShare = async () => {
    const itemsList = order.items
      .map((i) => {
        const title = getMerchItemTitle(i);
        const size = getMerchItemSize(i);
        return `• ${i.quantity}x ${title}${size ? ` (${size})` : ''}`;
      })
      .join('\n');

    const deliveryText =
      order.shippingType === 'domicilio'
        ? `Envío a Domicilio: ${order.shippingAddress?.street}, ${order.shippingAddress?.city}`
        : 'Retiro en Tienda Oficial del Estadio Teodoro Mariscal';

    const shareText = `¡Compra en Tienda Oficial Confirmada!\nPedido: #${order.id.slice(-8).toUpperCase()}\nEntrega: ${deliveryText}\nArtículos:\n${itemsList}\nTotal: $${order.total.toLocaleString('es-MX')} MXN`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido Tienda #${order.id.slice(-8).toUpperCase()}`,
          text: shareText,
        });
        showToast('¡Compartido con éxito!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareText);
        }
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast('¡Datos copiados al portapapeles!'))
      .catch(() => showToast('No se pudo copiar'));
  };

  const handleDownload = () => {
    const itemsText = order.items
      .map((i) => {
        const title = getMerchItemTitle(i);
        const size = getMerchItemSize(i);
        const price = getMerchItemPrice(i);
        return `  ${i.quantity}x ${title.slice(0, 22).padEnd(23, ' ')}${
          size ? ` [${size}]` : ''
        } $${(price * i.quantity).toFixed(2)} MXN`;
      })
      .join('\n');

    const content = `
========================================
       RECIBO OFICIAL TIENDA DEL CLUB
            ESTADIO DEPORTIVO
========================================
ORDEN ID:        #${order.id.toUpperCase()}
FECHA DE COMPRA: ${new Date(order.createdAt).toLocaleDateString()} ${new Date(order.createdAt).toLocaleTimeString()}
MODALIDAD:       ${order.shippingType === 'domicilio' ? 'Envío a Domicilio' : 'Retiro en Tienda Estadio'}
ESTADO LOGÍSTICO:${order.status.toUpperCase()}
MÉTODO DE PAGO:  ${order.paymentMethod || 'Tarjeta en Línea (Stripe SSL)'}
----------------------------------------
DESTINO:
${
  order.shippingType === 'domicilio' && order.shippingAddress
    ? `Destinatario: ${order.shippingAddress.recipientName || 'Aficionado'}\nCalle: ${order.shippingAddress.street}\nColonia: ${order.shippingAddress.neighborhood}\nCiudad: ${order.shippingAddress.city}, ${order.shippingAddress.state} CP ${order.shippingAddress.postalCode}\nTel: ${order.shippingAddress.phone || 'N/A'}\nPaquetería: ${order.carrier || 'Por asignar'}\nGuía: ${order.trackingNumber || 'En preparación'}`
    : 'Retiro en mostrador: Tienda Oficial Estadio Teodoro Mariscal\nHorario: Lunes a Sábado de 10:00 a 18:00 hrs y días de juego'
}
----------------------------------------
ARTÍCULOS:
${itemsText}
----------------------------------------
SUBTOTAL:        $${(order.subtotal || order.total).toFixed(2)} MXN
ENVÍO:           $${(order.shippingCost || 0).toFixed(2)} MXN
TOTAL PAGADO:    $${order.total.toFixed(2)} MXN
========================================
¡Gracias por tu compra y por apoyar al equipo!
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recibo-tienda-${order.id.slice(-8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('¡Recibo descargado con éxito!');
  };

  // Pasos logísticos
  const steps = [
    { key: 'pendiente', label: 'Pendiente de Empaque', icon: Clock },
    { key: 'empacado', label: 'Empacado / Listo', icon: Package },
    {
      key: 'en_transito',
      label: order.shippingType === 'domicilio' ? 'En Tránsito' : 'Listo para Retiro',
      icon: order.shippingType === 'domicilio' ? Truck : Building,
    },
    { key: 'entregado', label: 'Entregado', icon: CheckCircle2 },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'pendiente':
        return 0;
      case 'empacado':
        return 1;
      case 'en_transito':
        return 2;
      case 'entregado':
        return 3;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === 'cancelado';

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Toast flotante */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Botón Volver */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Mis Compras</span>
        </button>

        <span className="text-[11px] font-mono text-slate-400">
          ID: {order.id.slice(-8).toUpperCase()}
        </span>
      </div>

      {/* Contenedor del Comprobante Oficial */}
      <div
        className={`rounded-3xl border shadow-2xl overflow-hidden ${
          theme === 'light'
            ? 'bg-white border-slate-200'
            : 'bg-[#0B111E] border-slate-800'
        }`}
      >
        {/* Cabecera / Banner Rojo Oficial */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 px-6 py-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <ShoppingBag className="w-40 h-40" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-[10px] font-bold tracking-widest uppercase mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>TIENDA OFICIAL DEL CLUB</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider font-sports">
            {order.shippingType === 'domicilio' ? 'Envío a Domicilio' : 'Retiro en Tienda Estadio'}
          </h2>

          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-widest text-red-200 font-mono">
              NÚMERO DE ORDEN
            </span>
            <div className="mt-1 font-mono font-black text-xl sm:text-2xl text-white tracking-widest">
              #{order.id.slice(-8).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* QR de verificación y datos principales */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-[#060A13] border border-slate-800/80">
            <div className="p-3 bg-white rounded-2xl shadow-xl shrink-0">
              <QRCodeDisplay value={order.id} size={130} />
            </div>

            <div className="space-y-3 flex-1 text-center sm:text-left">
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  MODALIDAD DE ENTREGA
                </span>
                <p className="text-base font-extrabold text-white mt-0.5 flex items-center justify-center sm:justify-start gap-1.5 font-sports">
                  {order.shippingType === 'domicilio' ? (
                    <>
                      <Truck className="w-4 h-4 text-blue-400" />
                      <span>Paquetería a Domicilio</span>
                    </>
                  ) : (
                    <>
                      <Building className="w-4 h-4 text-emerald-400" />
                      <span>Retiro en Tienda Estadio</span>
                    </>
                  )}
                </p>

                {order.shippingType === 'domicilio' && order.shippingAddress && (
                  <p className="text-xs text-slate-300 mt-1">
                    📍 {order.shippingAddress.street}, {order.shippingAddress.neighborhood}, {order.shippingAddress.city}, {order.shippingAddress.state}
                  </p>
                )}
                {order.shippingType === 'tienda' && (
                  <p className="text-xs text-slate-300 mt-1">
                    📍 Mostrador Principal • Estadio Teodoro Mariscal
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-600">•</span>
                <span className="font-sports font-extrabold text-emerald-400 text-sm font-scoreboard">
                  ${order.total.toLocaleString('es-MX')} MXN
                </span>
              </div>
            </div>
          </div>

          {/* Estado de Progreso de Envío */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sports">
              Seguimiento Logístico
            </span>

            {isCancelled ? (
              <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="text-xs font-bold">
                  Este pedido fue cancelado. Comunícate con la tienda si tienes dudas.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1 relative">
                  {steps.map((st, idx) => {
                    const Icon = st.icon;
                    const isPassed = idx < currentStepIdx;
                    const isCurrent = idx === currentStepIdx;

                    return (
                      <div key={st.key} className="flex flex-col items-center text-center">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            isCurrent
                              ? 'bg-red-600 text-white ring-4 ring-red-500/30 shadow-lg shadow-red-950/40 scale-105'
                              : isPassed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isPassed ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <span
                          className={`text-[10px] mt-1.5 leading-tight font-sports font-bold ${
                            isCurrent
                              ? 'text-red-400'
                              : isPassed
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Info de paquetería / guía si está en tránsito */}
                {order.shippingType === 'domicilio' && (
                  <div className="p-3 bg-[#060A13] border border-slate-800 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-300">
                        Transportista: <strong className="text-white">{order.carrier || 'Por asignar'}</strong>
                      </span>
                    </div>
                    {order.trackingNumber ? (
                      <span className="font-mono text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60 font-bold">
                        Guía: #{order.trackingNumber}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">
                        Guía de rastreo disponible una vez empaquetado
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desglose de Artículos */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sports">
              Artículos ({totalItemsCount} unidades)
            </span>
            <div className="divide-y divide-slate-800/80 rounded-2xl bg-[#060A13] border border-slate-800/80 p-3">
              {order.items.map((item, idx) => {
                const title = getMerchItemTitle(item);
                const size = getMerchItemSize(item);
                const price = getMerchItemPrice(item);

                return (
                  <div key={idx} className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-red-600/20 text-red-400 font-mono font-black text-xs">
                        {item.quantity}x
                      </span>
                      <div>
                        <span className="font-bold text-white block">{title}</span>
                        {size && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Talla: {size}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-scoreboard font-bold text-emerald-400">
                      ${(price * item.quantity).toFixed(2)} MXN
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales y Método de Pago */}
          <div className="space-y-2 p-4 rounded-2xl bg-[#060A13] border border-slate-800/80 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono text-slate-200">
                ${(order.subtotal || order.total).toFixed(2)} MXN
              </span>
            </div>
            {order.shippingCost !== undefined && order.shippingCost > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Costo de Envío</span>
                <span className="font-mono text-slate-200">
                  ${order.shippingCost.toFixed(2)} MXN
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono block">
                  MÉTODO DE PAGO
                </span>
                <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  {order.paymentMethod || 'Tarjeta en Línea'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono block">
                  TOTAL PAGADO
                </span>
                <span className="text-lg font-black text-emerald-400 font-scoreboard">
                  ${order.total.toLocaleString('es-MX')} MXN
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleShare}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-sports font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-red-400" />
              <span>Compartir</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Recibo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

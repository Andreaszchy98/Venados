import React, { useState } from 'react';
import { FoodOrder } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { formatDeliverySeat } from '../../lib/seatUtils';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Utensils,
  CheckCircle2,
  Share2,
  Download,
  Check,
  CreditCard,
  ChefHat,
  Bike,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';

interface FoodOrderDetalleProps {
  order: FoodOrder;
  onBack: () => void;
}

export const FoodOrderDetalle: React.FC<FoodOrderDetalleProps> = ({ order, onBack }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const formattedSeat = formatDeliverySeat(order.section, order.row, order.seat);
  const totalItemsCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShare = async () => {
    const itemsList = order.items.map((i) => `• ${i.quantity}x ${i.name}`).join('\n');
    const locationText =
      order.orderType === 'in-seat'
        ? `Entrega a butaca: ${formattedSeat}`
        : 'Retiro express en mostrador de barra';

    const shareText = `¡Pedido de Comida en Estadio!\nCódigo de entrega: ${order.pickupCode}\nPuesto: ${order.standName}\nModalidad: ${locationText}\nPlatillos:\n${itemsList}\nTotal: $${order.total.toLocaleString('es-MX')} MXN`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido ${order.pickupCode} - ${order.standName}`,
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
      .then(() => showToast('¡Datos del pedido copiados al portapapeles!'))
      .catch(() => showToast('No se pudo copiar'));
  };

  const handleDownload = () => {
    const itemsText = order.items
      .map(
        (i) =>
          `  ${i.quantity}x ${i.name.padEnd(25, ' ')} $${(i.price * i.quantity).toFixed(2)} MXN`
      )
      .join('\n');

    const content = `
========================================
       COMPROBANTE OFICIAL DE CONSUMO
            ESTADIO DEPORTIVO
========================================
CÓDIGO DE RETIRO: ${order.pickupCode}
FECHA:            ${new Date(order.createdAt).toLocaleDateString()} ${new Date(order.createdAt).toLocaleTimeString()}
CONCESIÓN:        ${order.standName}
MODALIDAD:        ${order.orderType === 'in-seat' ? `Entrega a Butaca (${formattedSeat})` : 'Pickup Express en Barra'}
ESTADO:           ${order.status.toUpperCase()}
MÉTODO DE PAGO:   ${order.paymentMethod || 'Tarjeta en Línea'}
PAGO APROBADO:    ${order.paymentStatus === 'pagado' ? 'SÍ • STRIPE VERIFIED' : 'PENDIENTE'}
----------------------------------------
PLATILLOS / CONSUMOS:
${itemsText}
----------------------------------------
TOTAL PAGADO:     $${order.total.toFixed(2)} MXN
========================================
Conserva este comprobante digital.
Muestra tu código ${order.pickupCode} al Runner o en la barra para recibir tu orden.
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprobante-comida-${order.pickupCode}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('¡Comprobante descargado con éxito!');
  };

  // Pasos de preparación en vivo
  const steps: { key: string; label: string; icon: any }[] = [
    { key: 'pendiente', label: 'Recibido en Cocina', icon: ChefHat },
    { key: 'preparando', label: 'En Preparación', icon: Clock },
    {
      key: 'listo',
      label: order.orderType === 'in-seat' ? 'Asignando Runner' : 'Listo en Barra',
      icon: order.orderType === 'in-seat' ? Bike : PackageCheck,
    },
    ...(order.orderType === 'in-seat'
      ? [{ key: 'en-camino', label: 'En Camino a Asiento', icon: Bike }]
      : []),
    { key: 'entregado', label: 'Entregado', icon: CheckCircle2 },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'pendiente':
        return 0;
      case 'preparando':
        return 1;
      case 'listo':
        return 2;
      case 'en-camino':
        return 3;
      case 'entregado':
        return order.orderType === 'in-seat' ? 4 : 3;
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
            <Utensils className="w-40 h-40" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-[10px] font-bold tracking-widest uppercase mb-3">
            <Utensils className="w-3 h-3 text-red-300" />
            <span>ALIMENTOS & BEBIDAS EN VIVO</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider font-sports">
            {order.standName}
          </h2>

          <div className="mt-4 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase tracking-widest text-red-200 font-semibold mb-1">
              CÓDIGO DE RETIRO / ENTREGA
            </span>
            <div className="px-6 py-2 bg-black/40 backdrop-blur-md border border-white/30 rounded-2xl shadow-inner font-scoreboard font-black text-3xl sm:text-4xl text-white tracking-widest">
              {order.pickupCode}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* QR de verificación y datos principales */}
          <div className={`flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl border ${
            theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-[#060A13] border-slate-800/80 text-white'
          }`}>
            <div className="p-3 bg-white rounded-2xl shadow-xl shrink-0">
              <QRCodeDisplay value={order.pickupCode || order.id} size={130} />
            </div>

            <div className="space-y-3 flex-1 text-center sm:text-left">
              <div>
                <span className={`text-[11px] font-mono uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-600 font-bold' : 'text-slate-400'
                }`}>
                  MODALIDAD DE ENTREGA
                </span>
                <p className={`text-base font-extrabold mt-0.5 flex items-center justify-center sm:justify-start gap-1.5 font-sports ${
                  theme === 'light' ? 'text-slate-950' : 'text-white'
                }`}>
                  {order.orderType === 'in-seat' ? (
                    <>
                      <Bike className="w-4 h-4 text-red-500" />
                      <span>Entrega a Butaca</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4 text-emerald-500" />
                      <span>Pickup Express en Barra</span>
                    </>
                  )}
                </p>
                {order.orderType === 'in-seat' && (
                  <p className="text-xs text-red-500 font-bold bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg mt-1 inline-block">
                    📍 {formattedSeat}
                  </p>
                )}
              </div>

              <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.createdAt).toLocaleDateString()}
                </span>
                <span className={theme === 'light' ? 'text-slate-300' : 'text-slate-600'}>•</span>
                <span className="font-sports font-extrabold text-emerald-600 text-sm font-scoreboard">
                  ${order.total.toLocaleString('es-MX')} MXN
                </span>
              </div>
            </div>
          </div>

          {/* Estado de Progreso en Vivo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider font-sports ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Estatus del Pedido en Tiempo Real
              </span>
              <span className="text-[11px] font-bold text-red-500 font-mono animate-pulse">
                • Actualización en Vivo
              </span>
            </div>

            {isCancelled ? (
              <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="text-xs font-bold">
                  Este pedido fue cancelado. Comunícate con atención si requieres asistencia.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 relative">
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
                              : theme === 'light'
                              ? 'bg-slate-200 text-slate-500'
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
                              ? 'text-red-500'
                              : isPassed
                              ? 'text-emerald-600'
                              : theme === 'light'
                              ? 'text-slate-500'
                              : 'text-slate-500'
                          }`}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Avisos especiales según el estado activo */}
                {order.status === 'listo' && order.orderType === 'pickup' && (
                  <div className="p-3 bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg animate-pulse">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>
                      ¡Tu orden está lista en barra! Muestra tu código <strong>{order.pickupCode}</strong> para recoger.
                    </span>
                  </div>
                )}
                {order.status === 'listo' && order.orderType === 'in-seat' && (
                  <div className="p-3 bg-purple-950/70 border border-purple-500/60 text-purple-300 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg">
                    <Clock className="w-4 h-4 shrink-0 text-purple-400" />
                    <span>
                      Tu orden está lista en cocina. Esperando asignación de Runner para entrega a tu asiento.
                    </span>
                  </div>
                )}
                {order.status === 'en-camino' && (
                  <div className="p-3 bg-blue-950/70 border border-blue-500/60 text-blue-300 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg animate-pulse">
                    <Bike className="w-4 h-4 shrink-0 text-blue-400" />
                    <span>
                      ¡El Runner va en camino con tu comida! Permanece en tu asiento ({formattedSeat}).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desglose de Platillos */}
          <div className={`space-y-2 pt-2 border-t ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
            <span className={`text-xs font-bold uppercase tracking-wider font-sports ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Desglose de Consumo ({totalItemsCount} platillos)
            </span>
            <div className={`divide-y rounded-2xl border p-3 ${
              theme === 'light' ? 'bg-slate-100 border-slate-200 divide-slate-200' : 'bg-[#060A13] border-slate-800/80 divide-slate-800/80'
            }`}>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-red-600/20 text-red-600 font-mono font-black text-xs">
                      {item.quantity}x
                    </span>
                    <span className={`font-bold ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>{item.name}</span>
                  </div>
                  <span className="font-scoreboard font-bold text-emerald-600">
                    ${(item.price * item.quantity).toFixed(2)} MXN
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pago y Resumen */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${
            theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#060A13] border-slate-800/80 text-white'
          }`}>
            <div className="space-y-0.5">
              <span className={`text-[10px] uppercase tracking-wider font-mono ${
                theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
              }`}>
                MÉTODO DE PAGO
              </span>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-200'
              }`}>
                <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                <span>{order.paymentMethod || 'Tarjeta en Línea'}</span>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-[10px] uppercase tracking-wider font-mono ${
                theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
              }`}>
                TOTAL PAGADO
              </span>
              <p className="text-lg font-black text-emerald-600 font-scoreboard">
                ${order.total.toLocaleString('es-MX')} MXN
              </p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleShare}
              className={`py-3 px-4 rounded-xl font-sports font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              <Share2 className="w-4 h-4 text-red-500" />
              <span>Compartir</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

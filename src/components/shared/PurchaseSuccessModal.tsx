import React, { useState, useMemo } from 'react';
import { Ticket, FoodOrder, MerchOrder } from '../../types';
import { CinemaTicketSummary } from './CinemaTicketSummary';
import { QRCodeDisplay } from './QRCodeDisplay';
import { useTheme } from '../../context/ThemeContext';
import {
  CheckCircle2,
  Ticket as TicketIcon,
  ShoppingBag,
  Utensils,
  ArrowRight,
  X,
  Share2,
  Download,
  Check,
  ShieldCheck,
  MapPin,
  Clock,
  Truck,
  Building,
  Armchair,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Store,
  Mail,
} from 'lucide-react';
import { SendToHostEmailModal } from './SendToHostEmailModal';
import {
  HostEmailPayload,
  buildFoodOrderHostEmail,
  buildTicketOrderHostEmail,
  generateHostDigitalPassHtml,
} from '../../lib/orderEmailService';

export type PurchaseSuccessType = 'ticket' | 'food' | 'merch';

interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: PurchaseSuccessType;
  // Para boletos
  tickets?: Ticket[];
  onNavigateToTickets?: () => void;
  // Para comida
  foodOrder?: FoodOrder;
  foodOrders?: FoodOrder[];
  onNavigateToOrders?: () => void;
  // Para tienda
  merchOrder?: MerchOrder;
  storeName?: string;
  // Texto personalizado opcional
  customTitle?: string;
  customSubtitle?: string;
}

export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
  isOpen,
  onClose,
  type,
  tickets = [],
  onNavigateToTickets,
  foodOrder,
  foodOrders,
  onNavigateToOrders,
  merchOrder,
  storeName,
  customTitle,
  customSubtitle,
}) => {
  const { theme } = useTheme();
  const [selectedTicketIndex, setSelectedTicketIndex] = useState(0);
  const [selectedFoodOrderIndex, setSelectedFoodOrderIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalPayload, setEmailModalPayload] = useState<HostEmailPayload | null>(null);

  const allFoodOrders: FoodOrder[] = useMemo(() => {
    if (foodOrders && foodOrders.length > 0) return foodOrders;
    if (foodOrder) return [foodOrder];
    return [];
  }, [foodOrders, foodOrder]);

  const activeFoodOrder = allFoodOrders[selectedFoodOrderIndex] || allFoodOrders[0] || foodOrder;

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast('¡Copiado al portapapeles!');
      } else {
        showToast('Datos copiados');
      }
    } catch {
      showToast('No se pudo copiar');
    }
  };

  // Acciones para orden de comida
  const handleShareFood = async () => {
    if (!activeFoodOrder) return;
    const itemsText = activeFoodOrder.items.map((i) => `• ${i.quantity}x ${i.name}`).join('\n');
    const shareText = `¡Pedido de Comida Confirmado!\nStand: ${activeFoodOrder.standName}\nCódigo de Retiro: ${activeFoodOrder.pickupCode}\nTipo: ${
      activeFoodOrder.orderType === 'in-seat'
        ? `Entrega a Butaca (Sec. ${activeFoodOrder.section || 'General'}, Fila ${activeFoodOrder.row || '-'}, Asiento ${activeFoodOrder.seat || '-'})`
        : 'Pick Up Express en Barra'
    }\nTotal: $${activeFoodOrder.total} MXN\n\nArtículos:\n${itemsText}${
      allFoodOrders.length > 1 ? `\n(Comanda ${selectedFoodOrderIndex + 1} de ${allFoodOrders.length} del pedido multi-negocio)` : ''
    }`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Pedido ${activeFoodOrder.pickupCode} — ${activeFoodOrder.standName}`,
          text: shareText,
        });
        showToast('¡Pedido compartido con éxito!');
      } catch (e: any) {
        if (e.name !== 'AbortError') copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const handleDownloadFood = () => {
    if (!activeFoodOrder) return;
    const allOrdersText = allFoodOrders.length > 1
      ? allFoodOrders
          .map((ord, idx) => {
            const itText = ord.items
              .map((i) => `    ${i.quantity}x ${i.name.padEnd(23, ' ')} $${(i.price * i.quantity).toFixed(2)} MXN`)
              .join('\n');
            return `--- COMANDA #${idx + 1}: ${ord.standName} (${ord.pickupCode}) ---\nSubtotal Negocio: $${ord.total} MXN\nModalidad: ${ord.orderType === 'in-seat' ? `Entrega Butaca (Sec. ${ord.section}, Fila ${ord.row}, As. ${ord.seat})` : 'Pickup en Mostrador'}\nArtículos:\n${itText}`;
          })
          .join('\n\n')
      : activeFoodOrder.items
          .map((i) => `  ${i.quantity}x ${i.name.padEnd(25, ' ')} $${(i.price * i.quantity).toFixed(2)} MXN`)
          .join('\n');

    const totalDivided = allFoodOrders.reduce((s, o) => s + o.total, 0);

    const content = `
========================================
     COMPROBANTE OFICIAL DE CONSUMO
          ESTADIO DEPORTIVO
========================================
${allFoodOrders.length > 1 ? `PEDIDO MULTI-NEGOCIO (${allFoodOrders.length} COMANDAS)\nTotal Consolidado Pagado: $${totalDivided} MXN\n` : `Stand:       ${activeFoodOrder.standName}\nCódigo:      ${activeFoodOrder.pickupCode}\n`}Cliente:     ${activeFoodOrder.customerName}
----------------------------------------
${allOrdersText}
----------------------------------------
Pago:        ${activeFoodOrder.paymentMethod}
Estado:      PAGO CONFIRMADO (STRIPE SSL)
Fecha:       ${new Date().toLocaleString('es-MX')}
========================================
Presenta cada código en el stand correspondiente o al runner.
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Comprobante-Comida-${activeFoodOrder.pickupCode}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('¡Comprobante de alimentos descargado!');
  };

  // Acciones para orden de tienda
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

  const handleShareMerch = async () => {
    if (!merchOrder) return;
    const itemsText = merchOrder.items
      .map((i: any) => {
        const title = getMerchItemTitle(i);
        const size = getMerchItemSize(i);
        return `• ${i.quantity}x ${title}${size ? ` (${size})` : ''}`;
      })
      .join('\n');
    const shareText = `¡Compra en Tienda Oficial Confirmada!\nPedido: #${merchOrder.id.slice(-8).toUpperCase()}\nEntrega: ${
      merchOrder.shippingType === 'domicilio'
        ? `Envío a domicilio (${merchOrder.shippingAddress?.city || 'Mazatlán'})`
        : 'Recoger en Tienda del Estadio'
    }\nTotal: $${merchOrder.total} MXN\n\nProductos:\n${itemsText}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Pedido Tienda #${merchOrder.id.slice(-8).toUpperCase()}`,
          text: shareText,
        });
        showToast('¡Comprobante compartido!');
      } catch (e: any) {
        if (e.name !== 'AbortError') copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const handleDownloadMerch = () => {
    if (!merchOrder) return;
    const itemsText = merchOrder.items
      .map((i: any) => {
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
     COMPROBANTE OFICIAL DE TIENDA
    VENADOS DE MAZATLÁN STORE
========================================
Pedido ID:   #${merchOrder.id.toUpperCase()}
Fecha:       ${new Date(merchOrder.createdAt || Date.now()).toLocaleDateString('es-MX')}
Cliente:     ${merchOrder.customerName}
Modalidad:   ${
      merchOrder.shippingType === 'domicilio'
        ? `Envío a Domicilio (${merchOrder.shippingAddress?.street || ''}, ${merchOrder.shippingAddress?.city || ''})`
        : 'Retiro en Tienda Oficial del Estadio'
    }
----------------------------------------
Artículos:
${itemsText}
----------------------------------------
Subtotal:    $${merchOrder.subtotal} MXN
Envío:       $${merchOrder.shippingCost} MXN
Total:       $${merchOrder.total} MXN
Pago:        ${merchOrder.paymentMethod}
Estado:      PAGO CONFIRMADO (STRIPE SSL)
========================================
Conserva este comprobante para seguimiento o retiro.
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo-Tienda-${merchOrder.id.slice(-8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('¡Comprobante de compra descargado!');
  };

  // Títulos y subtítulos según el tipo
  const modalTitle =
    customTitle ||
    (type === 'ticket'
      ? tickets.length > 1
        ? '¡Tus Boletos Están Listos!'
        : '¡Tu Boleto Está Listo!'
      : type === 'food'
      ? allFoodOrders.length > 1
        ? `¡Tus ${allFoodOrders.length} Pedidos Están Confirmados!`
        : '¡Tu Pedido de Comida Está Listo!'
      : '¡Tu Compra de Tienda Está Confirmada!');

  const modalSubtitle =
    customSubtitle ||
    (type === 'ticket'
      ? 'Presenta este resumen de acceso digital en el molinete de ingreso al estadio.'
      : type === 'food'
      ? activeFoodOrder?.orderType === 'in-seat'
        ? allFoodOrders.length > 1
          ? 'Llevaremos cada orden a tu butaca. El pago único fue distribuido entre tus negocios seleccionados.'
          : 'Llevaremos tu pedido directamente a tu asiento durante el evento.'
        : allFoodOrders.length > 1
        ? 'Se generó un código de retiro independiente para cada negocio. Muestra el código respectivo al llegar al mostrador.'
        : 'Muestra este código al llegar a la barra express para retirar tu pedido.'
      : merchOrder?.shippingType === 'domicilio'
      ? 'Hemos recibido tu orden y estamos preparando el envío a tu domicilio.'
      : 'Muestra este código en la tienda oficial del estadio para retirar tus productos.');

  const currentTicket = tickets[selectedTicketIndex] || tickets[0];

  return (
    <div
      id="purchase-success-modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
    >
      {/* Notificación flotante de feedback */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-2xl border border-emerald-400 flex items-center gap-1.5 animate-fadeIn whitespace-nowrap">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div
        id="purchase-success-modal-container"
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden relative my-auto max-h-[94vh] flex flex-col ${
          theme === 'light'
            ? 'bg-white text-slate-900 border-slate-200'
            : 'bg-[#0F1626] text-white border-slate-700/80'
        }`}
      >
        {/* Barra superior decorativa multicolor */}
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 shrink-0" />

        {/* Botón de cerrar */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-20 p-2 rounded-full border transition-colors cursor-pointer ${
            theme === 'light'
              ? 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-200'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border-slate-700/60'
          }`}
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Header de éxito */}
          <div className="text-center space-y-1.5 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/90 border border-emerald-500/50 rounded-full text-[11px] font-black uppercase text-emerald-400 font-sports tracking-wider shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pago Confirmado • Stripe SSL</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-black font-sports tracking-wide leading-tight ${
              theme === 'light' ? 'text-slate-950' : 'text-white'
            }`}>
              {modalTitle}
            </h2>
            <p className={`text-xs max-w-sm mx-auto leading-relaxed ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-300'
            }`}>
              {modalSubtitle}
            </p>
          </div>

          {/* ======================================================== */}
          {/* CASO 1: BOLETOS DIGITALES (Estilo Cinépolis)            */}
          {/* ======================================================== */}
          {type === 'ticket' && currentTicket && (
            <div className="space-y-3">
              {/* Selector de boletos múltiples si compró más de 1 */}
              {tickets.length > 1 && (
                <div className={`flex items-center justify-between gap-2 p-2 rounded-2xl border ${
                  theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => setSelectedTicketIndex((prev) => Math.max(0, prev - 1))}
                    disabled={selectedTicketIndex === 0}
                    className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                      theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Boleto anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="text-center">
                    <span className="text-xs font-sports font-bold text-amber-500 uppercase tracking-wider block">
                      Boleto {selectedTicketIndex + 1} de {tickets.length}
                    </span>
                    <span className={`text-[10px] block truncate max-w-[200px] ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {currentTicket.section} • {currentTicket.row} • {currentTicket.seat}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTicketIndex((prev) => Math.min(tickets.length - 1, prev + 1))
                    }
                    disabled={selectedTicketIndex === tickets.length - 1}
                    className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                      theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Siguiente boleto"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Render del Resumen de Boleto Oficial */}
              <CinemaTicketSummary ticket={currentTicket} />

              {/* Botón para enviar por correo el Pase Digital */}
              <button
                type="button"
                onClick={() => {
                  const payload = buildTicketOrderHostEmail([currentTicket], 'Estadio Teodoro Mariscal', currentTicket.customerEmail || 'soportevxp@gmail.com');
                  setEmailModalPayload(payload);
                  setIsEmailModalOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-red-500/50 bg-red-600/20 hover:bg-red-600/30 text-red-300 font-sports font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <Mail className="w-4 h-4 text-red-500" />
                <span>Enviar Pase Digital por Correo (soportevxp@gmail.com)</span>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* CASO 2: PEDIDO DE COMIDA Y BEBIDAS                       */}
          {/* ======================================================== */}
          {type === 'food' && activeFoodOrder && (
            <div
              id="food-receipt-card"
              className={`rounded-3xl shadow-2xl border overflow-hidden ${
                theme === 'light'
                  ? 'bg-slate-50 text-slate-900 border-slate-200 shadow-slate-200'
                  : 'bg-[#0B111E] text-white border-slate-800'
              }`}
            >
              {/* Barra de pestañas si hay múltiples comandas generadas por negocio */}
              {allFoodOrders.length > 1 && (
                <div className={`p-3 border-b text-xs ${
                  theme === 'light' ? 'bg-amber-500/10 border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between font-sports font-bold mb-2">
                    <span className="text-amber-500 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                      <Store className="w-3.5 h-3.5" />
                      {allFoodOrders.length} Comandas Generadas • Puesto {selectedFoodOrderIndex + 1} de {allFoodOrders.length}
                    </span>
                    <span className={`text-[11px] font-scoreboard ${theme === 'light' ? 'text-slate-800 font-bold' : 'text-slate-200'}`}>
                      Total Pagado: ${allFoodOrders.reduce((sum, o) => sum + o.total, 0).toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    {allFoodOrders.map((ord, idx) => (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => setSelectedFoodOrderIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-sports font-bold tracking-wide transition-all border shrink-0 flex items-center gap-2 cursor-pointer ${
                          selectedFoodOrderIndex === idx
                            ? 'bg-red-600 text-white border-red-500 shadow-md font-black ring-2 ring-red-500/30'
                            : theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            : 'bg-[#141C2E] border-slate-700 text-slate-300 hover:bg-[#1A2438]'
                        }`}
                      >
                        <span className="truncate max-w-[130px]">{ord.standName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          selectedFoodOrderIndex === idx ? 'bg-black/30 text-white' : 'bg-slate-200 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          ${ord.total}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cabecera del pedido */}
              <div className="p-5 pb-3 text-center relative bg-gradient-to-b from-amber-600/15 via-transparent to-transparent">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase tracking-wider font-sports mb-2">
                  <Utensils className="w-3 h-3 text-amber-500" />
                  <span>Pedido Oficial • Alimentos & Bebidas</span>
                </div>

                <h3 className={`text-xl sm:text-2xl font-black font-sports tracking-wide leading-tight px-2 ${
                  theme === 'light' ? 'text-slate-950' : 'text-white'
                }`}>
                  {activeFoodOrder.standName || 'Stand Estadio Teodoro Mariscal'}
                </h3>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      activeFoodOrder.orderType === 'in-seat'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {activeFoodOrder.orderType === 'in-seat' ? (
                      <>
                        <Armchair className="w-3 h-3" />
                        <span>Entrega Directa a Butaca</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>Pick Up Express en Barra</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Código QR grande */}
                <div className="mt-4 flex flex-col items-center justify-center">
                  <div className="p-3 bg-white rounded-2xl shadow-xl border border-slate-200 inline-block">
                    <QRCodeDisplay
                      value={`FOOD:${activeFoodOrder.pickupCode || activeFoodOrder.id}`}
                      size={135}
                      alt={`QR Pedido ${activeFoodOrder.pickupCode}`}
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <span className={`font-mono text-xl font-black tracking-widest px-3.5 py-1 rounded-lg border inline-block ${
                      theme === 'light'
                        ? 'bg-slate-200 text-amber-600 border-slate-300'
                        : 'bg-slate-900/90 text-amber-400 border-slate-800'
                    }`}>
                      {activeFoodOrder.pickupCode || activeFoodOrder.id.slice(-6).toUpperCase()}
                    </span>
                    <p className={`text-[10px] uppercase tracking-wider font-bold mt-1.5 ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {activeFoodOrder.orderType === 'in-seat'
                        ? 'Muestra este código al Runner que lleve tu orden'
                        : 'Muestra este código en la barra express para retirar'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Línea perforada punteada */}
              <div className="relative my-1">
                <div className={`absolute -left-3.5 -top-3 w-7 h-7 rounded-full border ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
                }`} />
                <div className={`absolute -right-3.5 -top-3 w-7 h-7 rounded-full border ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
                }`} />
                <div className={`border-b-2 border-dashed mx-7 ${
                  theme === 'light' ? 'border-slate-300' : 'border-slate-700/70'
                }`} />
              </div>

              {/* Contenido inferior */}
              <div className="p-5 pt-3 space-y-4">
                {/* Punto de entrega / Butaca */}
                {activeFoodOrder.orderType === 'in-seat' ? (
                  <div>
                    <span className={`text-[10px] uppercase font-black tracking-wider block font-sports mb-1 ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Lugar de Entrega
                    </span>
                    <div className={`grid grid-cols-3 gap-2 p-2.5 rounded-xl border text-center text-xs ${
                      theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-[#121929] border-slate-800'
                    }`}>
                      <div>
                        <span className={`text-[9px] block uppercase font-sports ${
                          theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
                        }`}>
                          Sección
                        </span>
                        <span className={`font-black ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{activeFoodOrder.section || '-'}</span>
                      </div>
                      <div className={`border-x ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
                        <span className={`text-[9px] block uppercase font-sports ${
                          theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
                        }`}>
                          Fila
                        </span>
                        <span className="font-mono font-bold text-amber-500">
                          {activeFoodOrder.row || '-'}
                        </span>
                      </div>
                      <div>
                        <span className={`text-[9px] block uppercase font-sports ${
                          theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
                        }`}>
                          Butaca
                        </span>
                        <span className="font-mono font-bold text-red-500">
                          {activeFoodOrder.seat || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                    theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-[#121929] border-slate-800'
                  }`}>
                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className={`text-[10px] block font-sports uppercase ${
                        theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
                      }`}>
                        Punto de Retiro
                      </span>
                      <strong className={theme === 'light' ? 'text-slate-900' : 'text-white'}>
                        Barra Express de {activeFoodOrder.standName || 'Concesión'}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Desglose de platillos de esta comanda */}
                <div>
                  <span className={`text-[10px] uppercase font-black tracking-wider block font-sports mb-1.5 ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Detalle de Comanda ({activeFoodOrder.items.reduce((s, i) => s + i.quantity, 0)}{' '}
                    artículos)
                  </span>
                  <div className={`max-h-36 overflow-y-auto custom-scrollbar space-y-1.5 p-2.5 rounded-xl border text-xs ${
                    theme === 'light' ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#121929] border-slate-800'
                  }`}>
                    {activeFoodOrder.items.map((item, idx) => (
                      <div key={idx} className={`flex items-center justify-between ${
                        theme === 'light' ? 'text-slate-900 font-semibold' : 'text-slate-300'
                      }`}>
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 font-mono font-bold text-[10px]">
                            {item.quantity}x
                          </span>
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ${
                          theme === 'light' ? 'text-slate-950' : 'text-white'
                        }`}>
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Acciones de compartir / descargar / enviar por correo */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleShareFood}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                      theme === 'light'
                        ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-900 shadow-xs'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">Compartir</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadFood}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                      theme === 'light'
                        ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-900 shadow-xs'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">Descargar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const payload = buildFoodOrderHostEmail(allFoodOrders, null, 'Estadio Teodoro Mariscal');
                      setEmailModalPayload(payload);
                      setIsEmailModalOpen(true);
                    }}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                      theme === 'light'
                        ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 shadow-xs'
                        : 'bg-red-950/40 hover:bg-red-900/60 border-red-700/60 text-red-300'
                    }`}
                    title="Enviar orden de compra al correo del anfitrión"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">Anfitrión</span>
                  </button>
                </div>

                {/* Total de este puesto y desglose multi-orden */}
                <div className={`p-3 rounded-xl border space-y-1.5 text-xs ${
                  theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-slate-900 shadow-xs' : 'bg-[#080D18] border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={theme === 'light' ? 'text-slate-700 font-bold' : 'text-slate-400'}>
                      Monto Asignado a {activeFoodOrder.standName}:
                    </span>
                    <strong className="text-emerald-600 font-black text-base font-mono">
                      ${activeFoodOrder.total.toLocaleString('es-MX')} MXN
                    </strong>
                  </div>
                  {allFoodOrders.length > 1 && (
                    <div className="pt-1 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Total de la Transacción Unificada ({allFoodOrders.length} negocios):</span>
                      <span className="font-bold text-slate-900 dark:text-slate-200 font-mono">
                        ${allFoodOrders.reduce((sum, o) => sum + o.total, 0).toLocaleString('es-MX')} MXN
                      </span>
                    </div>
                  )}
                </div>

                {/* Pie de seguridad */}
                <div className={`flex items-center justify-between text-[10px] pt-0.5 ${
                  theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'
                }`}>
                  <span>Ref: #{activeFoodOrder.id.slice(-8).toUpperCase()}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Autenticado por Stripe
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CASO 3: COMPRA EN TIENDA OFICIAL (SOUVENIRS / ROPA)     */}
          {/* ======================================================== */}
          {type === 'merch' && merchOrder && (
            <div
              id="merch-receipt-card"
              className={`rounded-3xl shadow-2xl border overflow-hidden ${
                theme === 'light'
                  ? 'bg-slate-50 text-slate-900 border-slate-200 shadow-slate-200'
                  : 'bg-[#0B111E] text-white border-slate-800'
              }`}
            >
              {/* Cabecera del pedido */}
              <div className="p-5 pb-3 text-center relative bg-gradient-to-b from-red-600/15 via-transparent to-transparent">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/15 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-wider font-sports mb-2">
                  <ShoppingBag className="w-3 h-3 text-red-500" />
                  <span>Comprobante Oficial • Tienda Oficial</span>
                </div>

                <h3 className={`text-xl sm:text-2xl font-black font-sports tracking-wide leading-tight px-2 ${
                  theme === 'light' ? 'text-slate-950' : 'text-white'
                }`}>
                  {storeName || 'Tienda Oficial Venados de Mazatlán'}
                </h3>
                <p className={`text-[11px] mt-0.5 font-medium ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  Liga ARCO Mexicana del Pacífico
                </p>

                {/* Código QR grande */}
                <div className="mt-4 flex flex-col items-center justify-center">
                  <div className="p-3 bg-white rounded-2xl shadow-xl border border-slate-200 inline-block">
                    <QRCodeDisplay
                      value={`MERCH:${merchOrder.id}`}
                      size={135}
                      alt={`QR Pedido ${merchOrder.id}`}
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <span className={`font-mono text-base font-black tracking-widest px-3.5 py-1 rounded-lg border inline-block ${
                      theme === 'light'
                        ? 'bg-slate-900 text-amber-400 border-slate-800'
                        : 'bg-slate-900/90 text-white border-slate-800'
                    }`}>
                      #{merchOrder.id.slice(-8).toUpperCase()}
                    </span>
                    <p className={`text-[10px] uppercase tracking-wider font-bold mt-1.5 ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {merchOrder.shippingType === 'domicilio'
                        ? 'Código de seguimiento y despacho oficial'
                        : 'Muestra este código en la tienda para retirar tu pedido'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Línea perforada punteada */}
              <div className="relative my-1">
                <div className={`absolute -left-3.5 -top-3 w-7 h-7 rounded-full border ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
                }`} />
                <div className={`absolute -right-3.5 -top-3 w-7 h-7 rounded-full border ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0F1626] border-slate-700/80'
                }`} />
                <div className={`border-b-2 border-dashed mx-7 ${
                  theme === 'light' ? 'border-slate-300' : 'border-slate-700/70'
                }`} />
              </div>

              {/* Contenido inferior */}
              <div className="p-5 pt-3 space-y-4">
                {/* Modalidad de entrega */}
                <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-xs' : 'bg-[#121929] border-slate-800 text-white'
                }`}>
                  {merchOrder.shippingType === 'domicilio' ? (
                    <>
                      <Truck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className={`text-[10px] block font-sports uppercase ${
                          theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
                        }`}>
                          Envío a Domicilio
                        </span>
                        <strong className={`block ${theme === 'light' ? 'text-slate-950 font-extrabold' : 'text-white'}`}>
                          {merchOrder.shippingAddress?.street || 'Dirección registrada'}
                        </strong>
                        <span className={`text-[11px] ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                          {merchOrder.shippingAddress?.neighborhood
                            ? `${merchOrder.shippingAddress.neighborhood}, `
                            : ''}
                          {merchOrder.shippingAddress?.city || 'Mazatlán'},{' '}
                          {merchOrder.shippingAddress?.state || 'Sinaloa'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Building className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className={`text-[10px] block font-sports uppercase ${
                          theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'
                        }`}>
                          Punto de Retiro
                        </span>
                        <strong className={`block ${theme === 'light' ? 'text-slate-950 font-extrabold' : 'text-white'}`}>
                          Tienda Oficial — Estadio Teodoro Mariscal
                        </strong>
                        <span className={`text-[11px] ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                          {merchOrder.notes || 'Retirar con identificación oficial y este código'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Desglose de artículos */}
                <div>
                  <span className={`text-[10px] uppercase font-black tracking-wider block font-sports mb-1.5 ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Productos Comprados ({merchOrder.items.reduce((s, i) => s + i.quantity, 0)}{' '}
                    artículos)
                  </span>
                  <div className={`max-h-36 overflow-y-auto custom-scrollbar space-y-1.5 p-2.5 rounded-xl border text-xs ${
                    theme === 'light' ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#121929] border-slate-800'
                  }`}>
                    {merchOrder.items.map((item: any, idx) => {
                      const title = getMerchItemTitle(item);
                      const size = getMerchItemSize(item);
                      const price = getMerchItemPrice(item);
                      return (
                        <div key={idx} className={`flex items-center justify-between ${
                          theme === 'light' ? 'text-slate-900 font-semibold' : 'text-slate-300'
                        }`}>
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="px-1.5 py-0.5 rounded-md bg-red-600/20 text-red-600 font-mono font-bold text-[10px]">
                              {item.quantity}x
                            </span>
                            <span className="truncate">
                              {title}
                              {size ? (
                                <span className={`ml-1 font-mono ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                                  ({size})
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <span className={`font-mono font-bold shrink-0 ${
                            theme === 'light' ? 'text-slate-950' : 'text-white'
                          }`}>
                            ${(price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Acciones de compartir / descargar / enviar por correo */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleShareMerch}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                      theme === 'light'
                        ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-900 shadow-xs'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">Compartir</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadMerch}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                      theme === 'light'
                        ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-900 shadow-xs'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">Descargar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!merchOrder) return;
                      const nowFormatted = new Date().toLocaleString('es-MX');
                      const itemsText = merchOrder.items
                        .map((i: any) => `• ${i.quantity}x ${getMerchItemTitle(i)}${getMerchItemSize(i) ? ` (${getMerchItemSize(i)})` : ''} - $${(getMerchItemPrice(i) * i.quantity).toFixed(2)} MXN`)
                        .join('\n');
                      const payload: HostEmailPayload = {
                        orderType: 'merch',
                        hostName: storeName || 'Tienda Oficial Venados Store',
                        hostEmail: 'tienda@venadosmazatlan.com',
                        customerName: merchOrder.customerName || 'Cliente de Tienda',
                        orderIdOrCode: `#${merchOrder.id.slice(-8).toUpperCase()}`,
                        date: nowFormatted,
                        subject: `[ORDEN TIENDA OFICIAL] Pedido #${merchOrder.id.slice(-8).toUpperCase()} — ${merchOrder.customerName}`,
                        bodyText: `Estimado Administrador de Tienda Oficial,\n\nSe ha recibido una nueva compra de productos oficiales en la plataforma:\n\nPEDIDO:     #${merchOrder.id.toUpperCase()}\nCLIENTE:    ${merchOrder.customerName}\nFECHA:      ${nowFormatted}\nMODALIDAD:  ${merchOrder.shippingType === 'domicilio' ? `Envío a Domicilio (${merchOrder.shippingAddress?.street || ''}, ${merchOrder.shippingAddress?.city || 'Mazatlán'})` : 'Retiro en Tienda Oficial'}\nTOTAL:      $${merchOrder.total} MXN (Pagado Stripe SSL)\n\nARTÍCULOS:\n${itemsText}\n\nPor favor proceda a preparar el pedido.\n`,
                        htmlBody: generateHostDigitalPassHtml({
                          badgeTitle: 'ORDEN TIENDA OFICIAL',
                          eventTitle: (storeName || 'TIENDA OFICIAL VENADOS').toUpperCase(),
                          leagueOrCategory: 'Souvenirs & Jerseys Oficiales',
                          qrCodeValue: merchOrder.id,
                          orderCode: `#${merchOrder.id.slice(-8).toUpperCase()}`,
                          eventDateText: nowFormatted,
                          venueName: 'Estadio Teodoro Mariscal',
                          zoneSection: merchOrder.shippingType === 'domicilio' ? 'Envío a Domicilio' : 'Retiro en Tienda',
                          rowNumber: 'VXP Store',
                          seatNumber: `${merchOrder.items.reduce((s: number, i: any) => s + i.quantity, 0)} pzas`,
                          gate: merchOrder.shippingType === 'domicilio' ? 'DHL Express' : 'Mostrador Tienda',
                          totalAmountFormatted: `$${merchOrder.total.toFixed(2)} MXN`,
                          referenceId: `#${merchOrder.id.slice(-8).toUpperCase()}`,
                          customerName: merchOrder.customerName,
                          customerEmail: merchOrder.customerEmail,
                          notesOrItemsHtml: `
                            <div style="font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; margin-bottom: 6px;">ARTÍCULOS:</div>
                            ${merchOrder.items.map((i: any) => `<div style="font-size: 11px; color: #ffffff; margin-bottom: 3px;">• ${i.quantity}x ${getMerchItemTitle(i)} — <strong style="color: #10B981;">$${(getMerchItemPrice(i) * i.quantity).toFixed(2)} MXN</strong></div>`).join('')}
                          `,
                        }),
                        summary: {
                          total: merchOrder.total,
                          paymentMethod: merchOrder.paymentMethod || 'Tarjeta en Línea',
                          itemsCount: merchOrder.items.reduce((s: number, i: any) => s + i.quantity, 0),
                          destinationOrSeat: merchOrder.shippingType === 'domicilio' ? 'Envío a Domicilio' : 'Retiro en Tienda',
                          venueName: 'Estadio Teodoro Mariscal',
                        },
                      };
                      setEmailModalPayload(payload);
                      setIsEmailModalOpen(true);
                    }}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                      theme === 'light'
                        ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 shadow-xs'
                        : 'bg-red-950/40 hover:bg-red-900/60 border-red-700/60 text-red-300'
                    }`}
                    title="Enviar orden de compra al correo de la tienda"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate">Anfitrión</span>
                  </button>
                </div>

                {/* Total y método */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                  theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-slate-900 shadow-xs' : 'bg-[#080D18] border-slate-800 text-slate-300'
                }`}>
                  <span className={theme === 'light' ? 'text-slate-700 font-bold' : 'text-slate-400'}>Total Pagado:</span>
                  <strong className="text-emerald-600 font-black text-base font-mono">
                    ${merchOrder.total.toLocaleString('es-MX')} MXN
                  </strong>
                </div>

                {/* Pie de seguridad */}
                <div className={`flex items-center justify-between text-[10px] pt-0.5 ${
                  theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'
                }`}>
                  <span>Ref: #{merchOrder.id.slice(-8).toUpperCase()}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Autenticado por Stripe
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* BOTONES INFERIORES DE NAVEGACIÓN                         */}
          {/* ======================================================== */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {type === 'ticket' ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToTickets) onNavigateToTickets();
                }}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-sports text-xs sm:text-sm font-black tracking-wider uppercase shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>Ver en Mis Boletos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToOrders) onNavigateToOrders();
                }}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-sports text-xs sm:text-sm font-black tracking-wider uppercase shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Ver en Mis Pedidos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sports uppercase tracking-wider border border-slate-700"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Envío de Orden al Correo del Anfitrión */}
      {emailModalPayload && (
        <SendToHostEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setEmailModalPayload(null);
          }}
          emailPayload={emailModalPayload}
        />
      )}
    </div>
  );
};

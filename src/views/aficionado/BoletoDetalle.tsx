import React, { useState, useEffect } from 'react';
import { Ticket, VenueEvent } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { normalizeGoogleDriveImageUrl } from '../../lib/imageUtils';
import { getEventPosterPlaceholder } from '../../lib/venueEvents';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Share2,
  Download,
  Check,
  CheckCircle2,
  Clock,
  XCircle,
  Ticket as TicketIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface BoletoDetalleProps {
  ticket: Ticket;
  siblingTickets?: Ticket[];
  event?: VenueEvent | null;
  onBack: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

export const BoletoDetalle: React.FC<BoletoDetalleProps> = ({
  ticket,
  siblingTickets = [],
  event,
  onBack,
  onSelectTicket,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWalletAdded, setIsWalletAdded] = useState(false);

  // Determinar índice actual en la lista de hermanos (Compra Conjunta)
  const currentIndex = siblingTickets.findIndex((t) => t.id === ticket.id);
  const hasSiblings = siblingTickets.length > 1;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Navegar al boleto anterior
  const handlePrev = () => {
    if (!hasSiblings || !onSelectTicket) return;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : siblingTickets.length - 1;
    onSelectTicket(siblingTickets[prevIdx].id);
  };

  // Navegar al siguiente boleto
  const handleNext = () => {
    if (!hasSiblings || !onSelectTicket) return;
    const nextIdx = currentIndex < siblingTickets.length - 1 ? currentIndex + 1 : 0;
    onSelectTicket(siblingTickets[nextIdx].id);
  };

  // Manejo de teclado (flechas izquierda/derecha y escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      } else if (e.key === 'ArrowLeft' && hasSiblings) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && hasSiblings) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, siblingTickets, hasSiblings]);

  // Acción de Compartir
  const handleShare = async () => {
    const shareTitle = `Boleto Oficial: ${ticket.matchTitle}`;
    const shareText = `¡Tengo mi acceso oficial para ${ticket.matchTitle}!\nRecinto: ${ticket.stadium || 'Estadio'}\nZona: ${ticket.section} | Fila: ${ticket.row} | Butaca: ${ticket.seat}\nPuerta: ${ticket.gate || 'Acceso Principal'}\nCódigo QR: ${ticket.qrId}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href,
        });
        showToast('¡Boleto compartido con éxito!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareText);
        }
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToast('¡Datos del boleto copiados al portapapeles!');
      }
    } catch {
      showToast('No se pudo copiar al portapapeles.');
    }
  };

  // Acción de Descargar
  const handleDownload = () => {
    try {
      const ticketContent = `
========================================
       PASE OFICIAL DE ACCESO AL ESTADIO
========================================
Evento:      ${ticket.matchTitle}
Fecha:       ${ticket.matchDate}
Hora:        ${ticket.matchTime || 'Por confirmar'}
Recinto:     ${ticket.stadium || 'Estadio'}
----------------------------------------
Zona:        ${ticket.section}
Fila:        ${ticket.row}
Butaca:      ${ticket.seat}
Puerta:      ${ticket.gate || 'Acceso General'}
----------------------------------------
Total:       $${ticket.price} MXN
Código QR:   ${ticket.qrId}
Ref. Pago:   #${ticket.purchaseId || ticket.id.slice(-8)}
Estado:      ${ticket.status.toUpperCase()}
========================================
Presenta este código en los molinetes del estadio.
`;
      const blob = new Blob([ticketContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Boleto-${ticket.qrId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('¡Boleto descargado en tu dispositivo!');
    } catch (e) {
      window.print();
    }
  };

  // Acción de Google Wallet
  const handleAddToGoogleWallet = () => {
    setIsWalletAdded(true);
    showToast('¡Boleto vinculado a Google Wallet!');
  };

  // Obtener URL de póster para el fondo de pantalla
  const posterUrl =
    normalizeGoogleDriveImageUrl(event?.posterUrl) ||
    getEventPosterPlaceholder(event?.type || 'baseball');

  return (
    <div className="relative min-h-[calc(100vh-80px)] w-full flex flex-col justify-start items-center p-3 sm:p-6 pb-28 sm:pb-24 overflow-hidden">
      {/* 1. Fondo Cinemático con Póster del Evento y Overlay Oscuro */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <img
          src={posterUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter blur-xl scale-110 opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-[#0A0E17]/95 to-black/95 backdrop-blur-md" />
      </div>

      {/* 2. Barra Superior de Navegación y Selector de Asientos (Compra Conjunta) */}
      <div className="relative z-10 w-full max-w-md mx-auto mb-4 flex items-center justify-between gap-2">
        <button
          id="btn-back-to-tickets-list"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-sports font-bold tracking-wider uppercase backdrop-blur-md border border-white/15 transition-all cursor-pointer shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Mis Boletos</span>
        </button>

        {hasSiblings && (
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 p-1 rounded-xl shadow-lg">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Boleto anterior"
              className="p-1.5 rounded-lg hover:bg-white/15 active:scale-90 text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-sports font-black text-slate-200 px-1.5 whitespace-nowrap">
              Boleto {currentIndex + 1} de {siblingTickets.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Boleto siguiente"
              className="p-1.5 rounded-lg hover:bg-white/15 active:scale-90 text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Selector rápido de butacas para compra conjunta */}
      {hasSiblings && (
        <div className="relative z-10 w-full max-w-md mx-auto mb-3 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {siblingTickets.map((sib, sIdx) => {
            const isSelected = sib.id === ticket.id;
            const cleanSeatNum = (sib.seat || '').replace(/^(Butaca|Asiento)\s*/i, '').trim();
            return (
              <button
                key={sib.id}
                type="button"
                onClick={() => onSelectTicket?.(sib.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-sports font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                  isSelected
                    ? 'bg-red-600 text-white border border-red-400 scale-105 shadow-red-900/50'
                    : 'bg-black/60 text-slate-300 hover:text-white hover:bg-black/80 border border-white/10'
                }`}
              >
                <TicketIcon className="w-3 h-3 text-amber-400" />
                <span>
                  {sIdx + 1}. Fila {sib.row} · B{cleanSeatNum}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toast flotante de confirmación */}
      {toastMessage && (
        <div className="relative z-30 mb-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-xl border border-emerald-400 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3. Tarjeta Blanca Flotante con el QR Grande y Protagonista */}
      <div
        id="tarjeta-boleto-flotante"
        className="relative z-10 w-full max-w-md mx-auto rounded-3xl bg-white text-slate-900 border border-slate-200 shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Acento superior rojo deportivo */}
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 w-full" />

        {/* Cabecera del Boleto */}
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-700 text-white font-sports shadow-xs">
                <TicketIcon className="w-3 h-3" />
                <span>Pase Oficial Estadio</span>
              </span>
              {ticket.purchaseId && (
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  Ref: #{ticket.purchaseId.slice(-7)}
                </span>
              )}
            </div>

            {/* Badge de Estado */}
            {ticket.status === 'activo' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 font-sports">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Acceso Válido
              </span>
            ) : ticket.status === 'usado' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800 border border-slate-300 font-sports">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                Utilizado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-950 border border-red-300 font-sports">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                Cancelado
              </span>
            )}
          </div>

          {/* Nombre del Evento */}
          <h2 className="text-xl sm:text-2xl font-black font-sports tracking-wide leading-tight text-slate-900">
            {ticket.matchTitle}
          </h2>

          {/* Fecha, Hora y Recinto */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
              <Calendar className="w-4 h-4 text-red-600 shrink-0" />
              {ticket.matchDate} {ticket.matchTime && `• ${ticket.matchTime} hrs`}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              {ticket.stadium || 'Estadio'}
            </span>
          </div>

          {/* QR Grande y Protagonista */}
          <div className="mt-5 pt-3 pb-2 flex flex-col items-center justify-center border-t border-dashed border-slate-200">
            <div className="p-3.5 bg-white rounded-2xl shadow-xl border-2 border-slate-200 inline-block transition-transform hover:scale-[1.02]">
              <QRCodeDisplay
                value={ticket.qrId}
                size={164}
                alt={`Código QR ${ticket.qrId}`}
              />
            </div>

            <div className="mt-3 text-center space-y-1">
              <span className="font-mono text-base font-black tracking-widest text-slate-900 px-3.5 py-1 rounded-lg bg-slate-100 border border-slate-300 inline-block">
                {ticket.qrId}
              </span>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                Presenta este código en el torniquete de acceso
              </p>
            </div>
          </div>
        </div>

        {/* Línea divisoria perforada con muescas circulares laterales */}
        <div className="relative my-1">
          <div className="absolute -left-3.5 -top-3 w-7 h-7 rounded-full bg-[#0A0E17] border border-slate-700 shadow-inner" />
          <div className="absolute -right-3.5 -top-3 w-7 h-7 rounded-full bg-[#0A0E17] border border-slate-700 shadow-inner" />
          <div className="border-b-2 border-dashed border-slate-300 mx-6" />
        </div>

        {/* Información Organizada en Bloques */}
        <div className="p-5 sm:p-6 pt-3 space-y-4">
          {/* Columnas de Zona / Fila / Butaca */}
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block font-sports mb-1.5">
              Asignación de Butaca
            </span>
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div>
                <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 font-sports">
                  Zona / Sección
                </span>
                <span className="block text-sm sm:text-base font-black text-slate-900 font-sports mt-0.5 truncate" title={ticket.section}>
                  {ticket.section}
                </span>
              </div>
              <div className="border-x border-slate-200">
                <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 font-sports">
                  Fila
                </span>
                <span className="block text-sm sm:text-base font-black text-amber-700 font-mono mt-0.5">
                  {ticket.row}
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 font-sports">
                  Butaca
                </span>
                <span className="block text-sm sm:text-base font-black text-red-600 font-mono mt-0.5">
                  {ticket.seat}
                </span>
              </div>
            </div>
          </div>

          {/* Puerta de Acceso y Total */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-700">
            <span>
              Puerta de acceso:{' '}
              <strong className="text-slate-900 font-black">
                {ticket.gate || 'Acceso General'}
              </strong>
            </span>
            <span>
              Total:{' '}
              <strong className="text-emerald-700 font-black text-sm">
                ${ticket.price} MXN
              </strong>
            </span>
          </div>

          {/* Botones de Compartir, Descargar y Google Wallet */}
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sports uppercase tracking-wider"
              >
                <Share2 className="w-3.5 h-3.5 text-red-600" />
                <span>Compartir</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 border border-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sports uppercase tracking-wider"
              >
                <Download className="w-3.5 h-3.5 text-amber-700" />
                <span>Descargar</span>
              </button>
            </div>

            {/* Google Wallet */}
            <button
              type="button"
              onClick={handleAddToGoogleWallet}
              className={`w-full py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border font-sports text-xs uppercase tracking-wider font-bold ${
                isWalletAdded
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  : 'bg-black hover:bg-zinc-900 active:scale-98 border-zinc-800 text-white shadow-md'
              }`}
            >
              {isWalletAdded ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Vinculado a Google Wallet</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Agregar a Google Wallet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

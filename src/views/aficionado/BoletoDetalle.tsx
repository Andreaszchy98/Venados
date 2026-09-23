import React, { useState, useEffect } from 'react';
import { Ticket, VenueEvent } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import {
  cleanRowValue,
  cleanSeatValue,
  cleanSectionValue,
  formatMatchTime,
  formatRowLabel,
} from '../../lib/seatUtils';
import { useTheme } from '../../context/ThemeContext';
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
  Sparkles,
  Users,
} from 'lucide-react';

interface BoletoDetalleProps {
  ticket: Ticket;
  siblingTickets?: Ticket[];
  event?: VenueEvent | null;
  onBack: () => void;
}

export const BoletoDetalle: React.FC<BoletoDetalleProps> = ({
  ticket,
  siblingTickets = [],
  event,
  onBack,
}) => {
  const { theme } = useTheme();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWalletAdded, setIsWalletAdded] = useState(false);

  // Determinar lista total de boletos de esta compra
  const allTickets = siblingTickets.length > 0 ? siblingTickets : [ticket];
  const isJoint = allTickets.length > 1;

  // El código QR oficial usa el purchaseId si está disponible, o el qrId como fallback
  const displayQrCode = ticket.purchaseId || ticket.qrId;

  // Total acumulado de la compra
  const totalAmount = allTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

  // Determinar estado consolidado
  const isAllUsed = allTickets.every((t) => t.status === 'usado');
  const isAllCancelled = allTickets.every((t) => t.status === 'cancelado');
  const hasActive = allTickets.some((t) => t.status === 'activo');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Manejo de teclado (Escape para volver)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Formato limpio de asientos para compartir y descargar
  const seatsSummaryText = allTickets
    .map((t, idx) => {
      const rowLabel = formatRowLabel(t.row);
      const seatNum = cleanSeatValue(t.seat);
      return `${allTickets.length > 1 ? `${idx + 1}. ` : ''}${cleanSectionValue(t.section)} • ${rowLabel} • Butaca ${seatNum}`;
    })
    .join('\n');

  // Acción de Compartir
  const handleShare = async () => {
    const shareTitle = `Boleto Oficial: ${ticket.matchTitle}`;
    const shareText = `¡Tengo mi acceso oficial para ${ticket.matchTitle}!\nRecinto: ${ticket.stadium || 'Estadio'}\n${isJoint ? `Boletos incluidos (${allTickets.length}):\n${seatsSummaryText}` : `Ubicación: ${cleanSectionValue(ticket.section)} | ${formatRowLabel(ticket.row)} | Butaca ${cleanSeatValue(ticket.seat)}`}\nPuerta: ${ticket.gate || 'Acceso Principal'}\nCódigo QR: ${displayQrCode}`;

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
      const formattedTime = formatMatchTime(ticket.matchTime) || 'Por confirmar';
      const ticketContent = `
========================================
       PASE OFICIAL DE ACCESO AL ESTADIO
========================================
Evento:      ${ticket.matchTitle}
Fecha:       ${ticket.matchDate}
Hora:        ${formattedTime}
Recinto:     ${ticket.stadium || 'Estadio'}
Puerta:      ${ticket.gate || 'Acceso General'}
----------------------------------------
${isJoint ? `ASIENTOS INCLUIDOS (${allTickets.length} accesos):\n${seatsSummaryText}` : `Zona:        ${cleanSectionValue(ticket.section)}\nFila:        ${cleanRowValue(ticket.row)}\nButaca:      ${cleanSeatValue(ticket.seat)}`}
----------------------------------------
Total:       $${totalAmount} MXN
Código QR:   ${displayQrCode}
Ref. Pago:   #${ticket.purchaseId || ticket.id.slice(-8)}
Estado:      ${isAllUsed ? 'UTILIZADO' : hasActive ? 'ACCESO VÁLIDO' : 'CANCELADO'}
========================================
Presenta este código en los molinetes del estadio.
`;
      const blob = new Blob([ticketContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Pase-${displayQrCode}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('¡Pase de acceso descargado!');
    } catch (e) {
      window.print();
    }
  };

  // Acción de Google Wallet
  const handleAddToGoogleWallet = () => {
    setIsWalletAdded(true);
    showToast('¡Boleto vinculado a Google Wallet!');
  };

  const formattedMatchTimeDisplay = formatMatchTime(ticket.matchTime);

  // Agrupamiento inteligente de asientos si comparten sección y fila
  const firstTicket = allTickets[0];
  const sameSection = allTickets.every((t) => t.section === firstTicket.section);
  const sameRow = allTickets.every((t) => t.row === firstTicket.row);

  return (
    <div className="w-full max-w-xl mx-auto space-y-3 pt-0 pb-16 sm:pb-12">
      {/* 1. Barra Superior Compacta: Botón Volver + Badge de Compra Conjunta */}
      <div className="flex items-center justify-between gap-2">
        <button
          id="btn-back-to-tickets-list"
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sports font-bold tracking-wider uppercase border transition-all cursor-pointer shadow-xs active:scale-95 ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
              : 'bg-[#101625] hover:bg-[#182032] border-slate-700 text-slate-200'
          }`}
        >
          <ArrowLeft className="w-4 h-4 text-red-500" />
          <span>Volver a Mis Boletos</span>
        </button>

        {isJoint && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-600 text-white text-[11px] font-sports font-bold tracking-wider uppercase shadow-xs">
            <Users className="w-3.5 h-3.5 text-amber-300" />
            <span>Compra Conjunta ({allTickets.length} accesos)</span>
          </div>
        )}
      </div>

      {/* Toast flotante de confirmación */}
      {toastMessage && (
        <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-lg border border-emerald-400 flex items-center justify-center gap-1.5 animate-in fade-in duration-150">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Tarjeta del Boleto: Adaptativa al tema Dark / Light sin espacios muertos */}
      <div
        id="tarjeta-boleto-flotante"
        className={`w-full rounded-2xl border shadow-xl overflow-hidden transition-all duration-200 ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0F1626] border-slate-700/80 text-white'
        }`}
      >
        {/* Acento superior rojo deportivo */}
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 w-full" />

        {/* Cabecera del Boleto */}
        <div className="p-4 sm:p-5 pb-3">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-red-600 text-white font-sports shadow-2xs">
                <TicketIcon className="w-3 h-3" />
                <span>Pase Oficial Estadio</span>
              </span>
              {ticket.purchaseId && (
                <span
                  className={`font-mono text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded border ${
                    theme === 'light'
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-[#0A0E17] text-slate-300 border-slate-700'
                  }`}
                >
                  Ref: #{ticket.purchaseId.slice(-7)}
                </span>
              )}
            </div>

            {/* Badge de Estado */}
            {isAllUsed ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border font-sports ${
                  theme === 'light'
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Utilizado
              </span>
            ) : isAllCancelled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-950 border border-red-300 font-sports">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                Cancelado
              </span>
            ) : hasActive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 font-sports">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Acceso Válido
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300 font-sports">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Parcialmente Usado
              </span>
            )}
          </div>

          {/* Nombre del Evento */}
          <h2
            className={`text-lg sm:text-xl font-black font-sports tracking-wide leading-tight ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            {ticket.matchTitle}
          </h2>

          {/* Fecha, Hora y Recinto */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 font-bold ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
              {ticket.matchDate} {formattedMatchTimeDisplay && `• ${formattedMatchTimeDisplay}`}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {ticket.stadium || 'Estadio'}
            </span>
          </div>

          {/* UN SOLO QR Grande y Protagonista por Compra */}
          <div
            className={`mt-4 pt-3 pb-1 flex flex-col items-center justify-center border-t border-dashed ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700'
            }`}
          >
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 inline-block">
              <QRCodeDisplay
                value={displayQrCode}
                size={160}
                alt={`Código QR ${displayQrCode}`}
              />
            </div>

            <div className="mt-2.5 text-center space-y-1">
              <span
                className={`font-mono text-sm sm:text-base font-black tracking-widest px-3 py-0.5 rounded-lg border inline-block ${
                  theme === 'light'
                    ? 'bg-slate-100 text-slate-900 border-slate-300'
                    : 'bg-[#0A0E17] text-white border-slate-700'
                }`}
              >
                {displayQrCode}
              </span>
              <p
                className={`text-[11px] uppercase tracking-wider font-bold ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {isJoint
                  ? `Válido para los ${allTickets.length} accesos de esta compra en torniquetes`
                  : 'Presenta este código en el torniquete de acceso'}
              </p>
            </div>
          </div>
        </div>

        {/* Línea divisoria perforada sutil */}
        <div className="relative my-0.5 px-4">
          <div
            className={`border-b-2 border-dashed ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700/80'
            }`}
          />
        </div>

        {/* Información Detallada de TODOS los Asientos Incluidos en la Compra */}
        <div className="p-4 sm:p-5 pt-3 space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[10px] uppercase font-black tracking-wider font-sports ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {isJoint ? `Asientos Cubiertos (${allTickets.length})` : 'Asignación de Butaca'}
              </span>
              {isJoint && (
                <span
                  className={`text-[11px] font-sports font-bold px-2 py-0.5 rounded-md border ${
                    theme === 'light'
                      ? 'text-red-600 bg-red-50 border-red-200'
                      : 'text-red-400 bg-red-950/50 border-red-800/60'
                  }`}
                >
                  Un solo QR para el grupo
                </span>
              )}
            </div>

            {/* Vista compacta y limpia de asientos */}
            {!isJoint ? (
              /* Asiento individual en 3 columnas */
              <div
                className={`grid grid-cols-3 gap-2 p-2.5 rounded-xl border text-center ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-900'
                    : 'bg-[#0A0E17] border-slate-700/70 text-white'
                }`}
              >
                <div>
                  <span
                    className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Zona / Sección
                  </span>
                  <span className="block text-xs sm:text-sm font-black font-sports mt-0.5 truncate" title={ticket.section}>
                    {cleanSectionValue(ticket.section)}
                  </span>
                </div>
                <div
                  className={`border-x ${
                    theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                  }`}
                >
                  <span
                    className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Fila
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-amber-500 font-mono mt-0.5">
                    {cleanRowValue(ticket.row) || '-'}
                  </span>
                </div>
                <div>
                  <span
                    className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Butaca
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-red-500 font-mono mt-0.5">
                    {cleanSeatValue(ticket.seat) || '-'}
                  </span>
                </div>
              </div>
            ) : sameSection && sameRow ? (
              /* Compra conjunta en misma sección y fila: Resumen unificado + lista de butacas */
              <div className="space-y-2">
                <div
                  className={`grid grid-cols-2 gap-2 p-2.5 rounded-xl border text-center ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-[#0A0E17] border-slate-700/70 text-white'
                  }`}
                >
                  <div>
                    <span
                      className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                        theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Zona / Sección
                    </span>
                    <span className="block text-xs sm:text-sm font-black font-sports mt-0.5 truncate">
                      {cleanSectionValue(firstTicket.section)}
                    </span>
                  </div>
                  <div
                    className={`border-l ${
                      theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                    }`}
                  >
                    <span
                      className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                        theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Fila
                    </span>
                    <span className="block text-xs sm:text-sm font-black text-amber-500 font-mono mt-0.5">
                      {formatRowLabel(firstTicket.row)}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-[#0A0E17] border-slate-700/70'
                  }`}
                >
                  <span
                    className={`block text-[9px] uppercase font-bold tracking-wider font-sports mb-1.5 text-center ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Butacas Asignadas
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {allTickets.map((t, idx) => (
                      <span
                        key={t.id || idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border font-mono text-xs font-black shadow-2xs ${
                          theme === 'light'
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-[#141C2E] border-slate-700 text-slate-100'
                        }`}
                      >
                        <TicketIcon className="w-3 h-3 text-red-500" />
                        <span>Butaca {cleanSeatValue(t.seat)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Compra conjunta con diferentes filas/zonas: Lista organizada */
              <div
                className={`p-2 rounded-xl border divide-y ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200 divide-slate-200 text-slate-800'
                    : 'bg-[#0A0E17] border-slate-700/70 divide-slate-800 text-slate-200'
                }`}
              >
                {allTickets.map((t, idx) => (
                  <div key={t.id || idx} className="py-1.5 first:pt-0.5 last:pb-0.5 flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span>
                        <strong>{cleanSectionValue(t.section)}</strong> • {formatRowLabel(t.row)}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-black text-red-500 px-2 py-0.5 rounded border shadow-2xs ${
                        theme === 'light'
                          ? 'bg-white border-slate-200'
                          : 'bg-[#141C2E] border-slate-700'
                      }`}
                    >
                      B{cleanSeatValue(t.seat)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Puerta de Acceso y Total */}
          <div
            className={`flex items-center justify-between text-xs pt-2 border-t ${
              theme === 'light'
                ? 'border-slate-100 text-slate-700'
                : 'border-slate-800 text-slate-300'
            }`}
          >
            <span>
              Puerta de acceso:{' '}
              <strong className={theme === 'light' ? 'text-slate-900 font-black' : 'text-white font-black'}>
                {ticket.gate || 'Acceso General'}
              </strong>
            </span>
            <span>
              Total ({allTickets.length} {allTickets.length === 1 ? 'boleto' : 'boletos'}):{' '}
              <strong className="text-emerald-500 font-black text-sm">
                ${totalAmount} MXN
              </strong>
            </span>
          </div>

          {/* Botones de Compartir, Descargar y Google Wallet */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShare}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sports uppercase tracking-wider active:scale-98 ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-[#141C2E] hover:bg-[#1C273E] border-slate-700 text-slate-200'
                }`}
              >
                <Share2 className="w-3.5 h-3.5 text-red-500" />
                <span>Compartir</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sports uppercase tracking-wider active:scale-98 ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-[#141C2E] hover:bg-[#1C273E] border-slate-700 text-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span>Descargar</span>
              </button>
            </div>

            {/* Google Wallet */}
            <button
              type="button"
              onClick={handleAddToGoogleWallet}
              className={`w-full py-2 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border font-sports text-xs uppercase tracking-wider font-bold ${
                isWalletAdded
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                  : theme === 'light'
                  ? 'bg-slate-900 hover:bg-black active:scale-98 border-slate-800 text-white shadow-md'
                  : 'bg-black hover:bg-zinc-900 active:scale-98 border-zinc-800 text-white shadow-md'
              }`}
            >
              {isWalletAdded ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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

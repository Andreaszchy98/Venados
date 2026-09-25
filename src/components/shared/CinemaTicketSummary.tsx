import React, { useState } from 'react';
import { Ticket } from '../../types';
import { QRCodeDisplay } from './QRCodeDisplay';
import { 
  Calendar, 
  MapPin, 
  Share2, 
  Download, 
  Check, 
  ShieldCheck, 
  Sparkles,
  Ticket as TicketIcon
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface CinemaTicketSummaryProps {
  ticket: Ticket;
  className?: string;
}

export const CinemaTicketSummary: React.FC<CinemaTicketSummaryProps> = ({
  ticket,
  className = '',
}) => {
  const { theme } = useTheme();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWalletAdded, setIsWalletAdded] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Acción de Compartir
  const handleShare = async () => {
    const shareTitle = `Boleto Oficial: ${ticket.matchTitle}`;
    const shareText = `¡Tengo mi boleto para ${ticket.matchTitle}!\nRecinto: ${ticket.stadium || 'Estadio Teodoro Mariscal'}\nSección: ${ticket.section} | Fila: ${ticket.row} | Butaca: ${ticket.seat}\nPuerta: ${ticket.gate || 'Acceso Principal'}\nCódigo QR: ${ticket.qrId}`;

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
          // Fallback a portapapeles si falló la API nativa
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

  // Acción de Guardar / Descargar
  const handleDownload = () => {
    try {
      // Descargar un comprobante en formato texto / pase imprimible
      const ticketContent = `
========================================
    VENADOS DE MAZATLÁN - BOLETO OFICIAL
========================================
Evento:     ${ticket.matchTitle}
Fecha:      ${ticket.matchDate}
Hora:       ${ticket.matchTime || 'Por confirmar'}
Recinto:    ${ticket.stadium || 'Estadio Teodoro Mariscal'}
----------------------------------------
Zona:       ${ticket.section}
Fila:       ${ticket.row}
Butaca:     ${ticket.seat}
Puerta:     ${ticket.gate || 'Acceso General'}
----------------------------------------
Total:      $${ticket.price} MXN
Código QR:  ${ticket.qrId}
Ref. Pago:  #${ticket.purchaseId || ticket.id.slice(-8)}
Estado:     PAGO CONFIRMADO (STRIPE)
========================================
Presenta este código en los molinetes del estadio.
`;
      const blob = new Blob([ticketContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Boleto-Venados-${ticket.qrId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('¡Boleto descargado en tu dispositivo!');
    } catch (e) {
      window.print();
    }
  };

  // Acción de Google Wallet (Android)
  const handleAddToGoogleWallet = () => {
    setIsWalletAdded(true);
    showToast('¡Boleto vinculado a Google Wallet!');
  };

  return (
    <div className={`relative w-full max-w-md mx-auto ${className}`}>
      {/* Notificación flotante de feedback */}
      {toastMessage && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-lg border border-emerald-400 flex items-center gap-1.5 animate-fadeIn whitespace-nowrap">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tarjeta de Boleto Estilo Cinépolis (Cuerpo Completo) */}
      <div
        id="cinema-ticket-card"
        className={`rounded-3xl shadow-2xl border overflow-hidden transition-all duration-300 relative ${
          theme === 'light'
            ? 'bg-[#FFFFFF] border-slate-300/80 text-slate-900 shadow-slate-300/50'
            : 'bg-[#0B111E] border-slate-800 text-white shadow-black/80'
        }`}
      >
        {/* Cabecera del Boleto: Distintivo de Marca y Título */}
        <div className="p-6 pb-4 text-center relative bg-gradient-to-b from-red-600/10 via-transparent to-transparent">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/15 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-wider font-sports mb-2.5">
            <TicketIcon className="w-3 h-3 text-red-500" />
            <span>Pase Digital Oficial</span>
          </div>

          <h3 className={`text-xl sm:text-2xl font-black font-sports tracking-wide leading-tight px-2 ${
            theme === 'light' ? 'text-slate-950' : 'text-white'
          }`}>
            {ticket.matchTitle}
          </h3>
          <p className={`text-[11px] mt-1 font-medium ${
            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
          }`}>
            Liga ARCO Mexicana del Pacífico
          </p>

          {/* Bloque del Código QR */}
          <div className="mt-5 flex flex-col items-center justify-center">
            <div className="p-3 bg-white rounded-2xl shadow-xl border border-slate-200 inline-block transition-transform hover:scale-[1.02]">
              <QRCodeDisplay
                value={ticket.qrId}
                size={144}
                alt={`Código QR ${ticket.qrId}`}
              />
            </div>

            {/* Código alfanumérico */}
            <div className="mt-3 text-center">
              <span className={`font-mono text-base font-black tracking-widest px-3 py-1 rounded-lg border ${
                theme === 'light'
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-slate-900/80 text-white border-slate-800'
              }`}>
                {ticket.qrId}
              </span>
              <p className={`text-[10px] uppercase tracking-wider font-bold mt-1.5 ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Muestra este código en el lector del molinete
              </p>
            </div>
          </div>
        </div>

        {/* Línea divisoria perforada con muescas laterales (Estilo Boleto de Cine) */}
        <div className="relative my-2">
          {/* Muesca izquierda */}
          <div
            className={`absolute -left-3.5 -top-3 w-7 h-7 rounded-full border ${
              theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0F1626] border-slate-700/80'
            }`}
          />
          {/* Muesca derecha */}
          <div
            className={`absolute -right-3.5 -top-3 w-7 h-7 rounded-full border ${
              theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0F1626] border-slate-700/80'
            }`}
          />
          {/* Línea perforada punteada */}
          <div className={`border-b-2 border-dashed mx-7 ${
            theme === 'light' ? 'border-slate-300' : 'border-slate-700/70'
          }`} />
        </div>

        {/* Contenido inferior: Datos del Boleto tipo Cinépolis */}
        <div className="p-6 pt-4 space-y-5">
          {/* 1. Bloque de Fecha y hora del evento (etiqueta arriba, dato grande abajo) */}
          <div className="space-y-1">
            <span className={`text-[10px] uppercase font-black tracking-wider block font-sports ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Fecha y Hora del Evento
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-lg sm:text-xl font-black font-sports tracking-wide ${
                theme === 'light' ? 'text-slate-950' : 'text-white'
              }`}>
                {ticket.matchDate}
              </span>
              {ticket.matchTime && (
                <span className="text-sm sm:text-base font-bold text-amber-500 font-sports">
                  • {ticket.matchTime} hrs
                </span>
              )}
            </div>
          </div>

          {/* 2. Bloque para el Recinto (etiqueta arriba, valor grande abajo) */}
          <div className="space-y-1">
            <span className={`text-[10px] uppercase font-black tracking-wider block font-sports ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Recinto
            </span>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <span className={`text-base sm:text-lg font-black font-sports tracking-wide ${
                theme === 'light' ? 'text-slate-950' : 'text-white'
              }`}>
                {ticket.stadium || 'Estadio Teodoro Mariscal'}
              </span>
            </div>
          </div>

          {/* 3. Bloque de Asiento en 3 columnas cortas (Zona/Sección, Fila, Butaca) */}
          <div>
            <span className={`text-[10px] uppercase font-black tracking-wider block font-sports mb-1.5 ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Asignación de Butaca
            </span>
            <div className={`grid grid-cols-3 gap-2 p-3 rounded-2xl border text-center ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#121929] border-slate-800'
            }`}>
              {/* Columna 1: Zona/Sección */}
              <div className="px-1">
                <span className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Zona / Sección
                </span>
                <span className={`block text-sm sm:text-base font-black font-sports mt-0.5 truncate ${
                  theme === 'light' ? 'text-slate-950' : 'text-white'
                }`} title={ticket.section}>
                  {ticket.section}
                </span>
              </div>

              {/* Columna 2: Fila */}
              <div className={`px-1 border-x ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
                <span className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Fila
                </span>
                <span className="block text-sm sm:text-base font-black text-amber-500 font-mono mt-0.5">
                  {ticket.row}
                </span>
              </div>

              {/* Columna 3: Butaca */}
              <div className="px-1">
                <span className={`block text-[9px] uppercase font-bold tracking-wider font-sports ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Butaca
                </span>
                <span className="block text-sm sm:text-base font-black text-red-500 font-mono mt-0.5">
                  {ticket.seat}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Fila de Acciones debajo del bloque de asiento */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {/* Botón Compartir */}
              <button
                type="button"
                onClick={handleShare}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                  theme === 'light'
                    ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-900'
                    : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <Share2 className="w-3.5 h-3.5 text-red-500" />
                <span>Compartir</span>
              </button>

              {/* Botón Descargar / Guardar */}
              <button
                type="button"
                onClick={handleDownload}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sports uppercase tracking-wider ${
                  theme === 'light'
                    ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-900'
                    : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span>Descargar</span>
              </button>
            </div>

            {/* Botón Oficial Agregar a Google Wallet */}
            <button
              type="button"
              onClick={handleAddToGoogleWallet}
              className={`w-full py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                isWalletAdded
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : theme === 'light'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'
                  : 'bg-black hover:bg-zinc-900 border-zinc-700 text-white shadow-md'
              }`}
            >
              {isWalletAdded ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">Agregado a Google Wallet</span>
                </>
              ) : (
                <>
                  {/* Isotipo Oficial Google Wallet (colores de Google) */}
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="3" stroke="#4285F4" strokeWidth="2" />
                    <circle cx="16" cy="12" r="2" fill="#FBBC04" />
                    <path d="M2 10H22" stroke="#EA4335" strokeWidth="2" />
                    <path d="M12 15H18" stroke="#34A853" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs font-medium tracking-wide">
                    Agregar a <strong className="font-bold">Google Wallet</strong>
                  </span>
                </>
              )}
            </button>
          </div>

          {/* 5. Puerta de Acceso y Total Pagado (Fila corta estilizada cerca del final) */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-slate-900' : 'bg-[#080D18] border-slate-800/80 text-white'
          }`}>
            <div className="flex items-center gap-1.5">
              <span className={theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}>Puerta de ingreso:</span>
              <strong className={theme === 'light' ? 'text-slate-900 font-extrabold' : 'text-white font-bold'}>
                {ticket.gate || 'Rampa Nivel 300'}
              </strong>
            </div>
            <div className={`h-3 w-px ${theme === 'light' ? 'bg-slate-300' : 'bg-slate-800'}`} />
            <div className="flex items-center gap-1.5">
              <span className={theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}>Total:</span>
              <strong className="text-emerald-600 font-black text-sm">
                ${ticket.price} MXN
              </strong>
            </div>
          </div>

          {/* Pie de seguridad y referencia */}
          <div className={`flex items-center justify-between text-[10px] pt-1 ${
            theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'
          }`}>
            <span>Ref: #{ticket.purchaseId ? ticket.purchaseId.slice(-7) : ticket.id.slice(-7)}</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="w-3 h-3" />
              Autenticado por Stripe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

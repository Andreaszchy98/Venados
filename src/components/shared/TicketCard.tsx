import React from 'react';
import { Ticket } from '../../types';
import { Calendar, MapPin, CheckCircle2, Clock, XCircle, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { QRCodeDisplay } from './QRCodeDisplay';

interface TicketCardProps {
  ticket: Ticket;
  onValidate?: (ticketId: string) => void;
  showAdminActions?: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  onValidate,
  showAdminActions = false,
}) => {
  const { theme } = useTheme();

  const getStatusBadge = () => {
    switch (ticket.status) {
      case 'activo':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
              theme === 'light'
                ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-emerald-800' : 'text-emerald-400'}`} />
            Acceso Válido
          </span>
        );
      case 'usado':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
              theme === 'light'
                ? 'bg-slate-200 text-slate-800 border-slate-300'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Ingresado / Usado
          </span>
        );
      case 'cancelado':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
              theme === 'light'
                ? 'bg-red-100 text-red-950 border-red-300'
                : 'bg-red-950/80 text-red-300 border-red-500/60'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            Cancelado
          </span>
        );
    }
  };

  return (
    <div
      id={`ticket-card-${ticket.id}`}
      className={`rounded-2xl border shadow-xl overflow-hidden flex flex-col md:flex-row transition-all relative group ${
        theme === 'light'
          ? 'bg-white border-slate-200 hover:border-red-500/40 text-slate-900'
          : 'bg-[#0F1626] border-slate-700/80 hover:border-red-600/50 hover:shadow-red-950/20 text-white'
      }`}
    >
      {/* Indicador de acento deportivo en el borde superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-amber-500" />

      {/* Lado Principal del Boleto Deportivo */}
      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider uppercase bg-red-700 text-white shadow-xs font-sports">
                <span>Pase Oficial Estadio</span>
              </div>
              {ticket.purchaseId && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    theme === 'light'
                      ? 'bg-slate-100 text-slate-900 border-slate-300'
                      : 'bg-slate-800 text-white border-slate-600'
                  }`}
                >
                  Ref: #{ticket.purchaseId.slice(-7)}
                </span>
              )}
            </div>
            {getStatusBadge()}
          </div>

          <h3
            className={`text-lg md:text-xl font-black leading-tight font-sports tracking-wide ${
              theme === 'light' ? '!text-[#0F172A] text-slate-900' : 'text-white'
            }`}
          >
            {ticket.matchTitle}
          </h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 font-semibold ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4 text-red-500" />
              {ticket.matchDate} {ticket.matchTime && `• ${ticket.matchTime}`}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 ${
                theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-300'
              }`}
            >
              <MapPin className="w-4 h-4 text-amber-500" />
              {ticket.stadium}
            </span>
          </div>
        </div>

        {/* Bloque Deportivo de Butaca - Estilo Marcador / Roster */}
        <div
          className={`grid grid-cols-3 gap-2 p-3 rounded-xl border text-center ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#141C2E] border-slate-700/70'
          }`}
        >
          <div>
            <span
              className={`block text-[10px] uppercase font-bold tracking-wider font-sports ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Zona / Sección
            </span>
            <span
              className={`text-xs sm:text-sm font-black line-clamp-1 ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              {ticket.section}
            </span>
          </div>
          <div className={`border-x ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
            <span
              className={`block text-[10px] uppercase font-bold tracking-wider font-sports ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Fila
            </span>
            <span
              className={`text-xs sm:text-sm font-black font-mono ${
                theme === 'light' ? 'text-amber-700' : 'text-amber-400'
              }`}
            >
              {ticket.row}
            </span>
          </div>
          <div>
            <span
              className={`block text-[10px] uppercase font-bold tracking-wider font-sports ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Butaca
            </span>
            <span
              className={`text-xs sm:text-sm font-black font-mono ${
                theme === 'light' ? 'text-red-700' : 'text-red-400'
              }`}
            >
              {ticket.seat}
            </span>
          </div>
        </div>

        {ticket.gate && (
          <div
            className={`text-xs flex items-center justify-between pt-1 ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            <span>
              Puerta de ingreso:{' '}
              <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-white font-bold'}>
                {ticket.gate}
              </strong>
            </span>
            <span>
              Total:{' '}
              <strong
                className={
                  theme === 'light'
                    ? 'text-emerald-800 font-black'
                    : 'text-emerald-400 font-black'
                }
              >
                ${ticket.price} MXN
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Franja de corte perforada estilo boleto físico deportivo */}
      <div
        className={`relative border-t md:border-t-0 md:border-l border-dashed p-4 md:p-6 flex md:flex-col items-center justify-between md:justify-center gap-3 shrink-0 md:w-52 text-center ${
          theme === 'light'
            ? 'border-slate-300 bg-slate-100/90'
            : 'border-slate-700 bg-[#0C1220]'
        }`}
      >
        {/* Círculos de muesca visual para efecto perforado */}
        <div
          className={`hidden md:block absolute -top-3 -left-3 w-6 h-6 rounded-full border ${
            theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#0A0E17] border-slate-700'
          }`}
        ></div>
        <div
          className={`hidden md:block absolute -bottom-3 -left-3 w-6 h-6 rounded-full border ${
            theme === 'light' ? 'bg-white border-slate-300' : 'bg-[#0A0E17] border-slate-700'
          }`}
        ></div>

        <div className="p-2 bg-white rounded-xl shadow-md inline-flex items-center justify-center border border-slate-200 overflow-hidden">
          <QRCodeDisplay value={ticket.qrId} size={80} alt={`Código QR para boleto ${ticket.qrId}`} />
        </div>
        <div>
          <span
            className={`text-[10px] block font-mono font-bold tracking-wider ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            {ticket.qrId}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold block mt-0.5 ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            Escanear en Molinete
          </span>
        </div>

        {showAdminActions && onValidate && ticket.status === 'activo' && (
          <button
            onClick={() => onValidate(ticket.id)}
            className="w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer font-sports"
          >
            Validar Ingreso
          </button>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Ticket } from '../../types';
import { Calendar, MapPin, QrCode, CheckCircle2, Clock, XCircle, ShieldCheck } from 'lucide-react';

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
  const getStatusBadge = () => {
    switch (ticket.status) {
      case 'activo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Acceso Válido
          </span>
        );
      case 'usado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Ingresado / Usado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            Cancelado
          </span>
        );
    }
  };

  return (
    <div
      id={`ticket-card-${ticket.id}`}
      className="bg-[#0F1626] rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden flex flex-col md:flex-row transition-all hover:border-red-600/50 hover:shadow-red-950/20 relative group"
    >
      {/* Indicador de acento deportivo en el borde superior */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-amber-500" />

      {/* Lado Principal del Boleto Deportivo */}
      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider uppercase bg-red-700/90 text-white shadow-xs font-sports">
                <span>Pase Oficial Estadio</span>
              </div>
              {ticket.purchaseId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Ref: #{ticket.purchaseId.slice(-7)}
                </span>
              )}
            </div>
            {getStatusBadge()}
          </div>

          <h3 className="text-lg md:text-xl font-black text-white leading-tight font-sports tracking-wide">
            {ticket.matchTitle}
          </h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
              <Calendar className="w-4 h-4 text-red-500" />
              {ticket.matchDate} {ticket.matchTime && `• ${ticket.matchTime}`}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-4 h-4 text-amber-400" />
              {ticket.stadium}
            </span>
          </div>
        </div>

        {/* Bloque Deportivo de Butaca - Estilo Marcador / Roster */}
        <div className="grid grid-cols-3 gap-2 bg-[#141C2E] p-3 rounded-xl border border-slate-700/70 text-center">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sports">
              Zona / Sección
            </span>
            <span className="text-xs sm:text-sm font-black text-white line-clamp-1">
              {ticket.section}
            </span>
          </div>
          <div className="border-x border-slate-700">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sports">
              Fila
            </span>
            <span className="text-xs sm:text-sm font-black text-amber-400 font-mono">
              {ticket.row}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sports">
              Butaca
            </span>
            <span className="text-xs sm:text-sm font-black text-red-400 font-mono">
              {ticket.seat}
            </span>
          </div>
        </div>

        {ticket.gate && (
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
            <span>Puerta de ingreso: <strong className="text-white font-bold">{ticket.gate}</strong></span>
            <span>Total: <strong className="text-emerald-400 font-black">${ticket.price} MXN</strong></span>
          </div>
        )}
      </div>

      {/* Franja de corte perforada estilo boleto físico deportivo */}
      <div className="relative border-t md:border-t-0 md:border-l border-dashed border-slate-700 bg-[#0C1220] p-4 md:p-6 flex md:flex-col items-center justify-between md:justify-center gap-3 shrink-0 md:w-52 text-center">
        {/* Círculos de muesca visual para efecto perforado */}
        <div className="hidden md:block absolute -top-3 -left-3 w-6 h-6 bg-[#0A0E17] rounded-full border border-slate-700"></div>
        <div className="hidden md:block absolute -bottom-3 -left-3 w-6 h-6 bg-[#0A0E17] rounded-full border border-slate-700"></div>

        <div className="p-2.5 bg-white rounded-xl shadow-md inline-block">
          <QrCode className="w-16 h-16 text-slate-950" />
        </div>
        <div>
          <span className="text-[10px] block font-mono text-slate-300 font-bold tracking-wider">
            {ticket.qrId}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mt-0.5">
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

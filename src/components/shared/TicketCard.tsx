import React from 'react';
import { Ticket } from '../../types';
import { Calendar, MapPin, QrCode, CheckCircle2, Clock, XCircle } from 'lucide-react';

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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Boleto Válido
          </span>
        );
      case 'usado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Ingresado / Usado
          </span>
        );
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            Cancelado
          </span>
        );
    }
  };

  return (
    <div
      id={`ticket-card-${ticket.id}`}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md"
    >
      {/* Lado Principal del Boleto */}
      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="inline-block px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-red-800 text-white">
              LMP Temporada Regular
            </div>
            {getStatusBadge()}
          </div>
          <h3 className="text-lg font-bold text-slate-900 leading-tight">
            {ticket.matchTitle}
          </h3>
          <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-red-700" />
              {ticket.matchDate} {ticket.matchTime && `• ${ticket.matchTime}`}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              {ticket.stadium}
            </span>
          </div>
        </div>

        {/* Detalles de Butaca */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
          <div>
            <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Zona / Sección
            </span>
            <span className="text-xs font-bold text-slate-800 line-clamp-1">
              {ticket.section}
            </span>
          </div>
          <div className="border-x border-slate-200">
            <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Fila
            </span>
            <span className="text-xs font-bold text-slate-800">
              {ticket.row}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Asiento
            </span>
            <span className="text-xs font-bold text-red-700">
              {ticket.seat}
            </span>
          </div>
        </div>

        {ticket.gate && (
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Puerta asignada: <strong className="text-slate-700">{ticket.gate}</strong></span>
            <span>Precio: <strong className="text-slate-900">${ticket.price} MXN</strong></span>
          </div>
        )}
      </div>

      {/* Franja de corte / Separador para simular boleto físico */}
      <div className="relative border-t md:border-t-0 md:border-l border-dashed border-slate-200 bg-slate-50 p-4 md:p-6 flex md:flex-col items-center justify-between md:justify-center gap-3 shrink-0 md:w-48 text-center">
        {/* Círculos de muesca visual */}
        <div className="hidden md:block absolute -top-3 -left-3 w-6 h-6 bg-slate-100 rounded-full border border-slate-200"></div>
        <div className="hidden md:block absolute -bottom-3 -left-3 w-6 h-6 bg-slate-100 rounded-full border border-slate-200"></div>

        <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs inline-block">
          <QrCode className="w-16 h-16 text-slate-800" />
        </div>
        <div>
          <span className="text-[10px] block font-mono text-slate-500 font-semibold">
            {ticket.qrId}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Escanear en torniquete
          </span>
        </div>

        {showAdminActions && onValidate && ticket.status === 'activo' && (
          <button
            onClick={() => onValidate(ticket.id)}
            className="w-full mt-2 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
          >
            Marcar Ingreso
          </button>
        )}
      </div>
    </div>
  );
};

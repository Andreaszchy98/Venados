import React, { useState, useEffect } from 'react';
import { Ticket, UserProfile } from '../../types';
import { getAllTickets, updateTicketStatus } from '../../lib/tickets';
import { TicketCard } from '../../components/shared/TicketCard';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { ErrorMessage } from '../../components/shared/ErrorMessage';
import { Ticket as TicketIcon, Search, CheckCircle2, ShieldAlert } from 'lucide-react';

interface TaquillaViewProps {
  user: UserProfile;
}

export const TaquillaView: React.FC<TaquillaViewProps> = ({ user }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllTickets();
      setTickets(data);
    } catch (err: any) {
      console.error('Error fetching tickets for taquilla:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleValidateTicket = async (ticketId: string) => {
    try {
      await updateTicketStatus(ticketId, 'usado');
      setStatusMessage('¡Boleto validado con éxito! El estado ahora es USADO.');
      fetchTickets();
    } catch (err: any) {
      setStatusMessage('Error al validar el boleto.');
    }
  };

  const filteredTickets = tickets.filter(
    (t) =>
      t.qrId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.matchTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-amber-600" />
            Módulo de Taquilla y Control de Accesos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Validación de boletos y consulta de accesos en puertas del estadio
          </p>
        </div>

        {/* Buscador de boletos por QR o datos */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código QR, zona..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {statusMessage}
          </span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Consultando boletos en taquilla..." />
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-2">
          <p className="text-sm font-semibold">No se encontraron boletos para mostrar.</p>
          <p className="text-xs">
            Inicia sesión como aficionado o genera boletos de prueba para que aparezcan en taquilla.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              showAdminActions={true}
              onValidate={handleValidateTicket}
            />
          ))}
        </div>
      )}
    </div>
  );
};

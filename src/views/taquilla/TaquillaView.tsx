import React, { useState, useEffect } from 'react';
import { Ticket, UserProfile } from '../../types';
import { getVenueTickets, updateTicketStatus } from '../../lib/tickets';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
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
      const data = await getVenueTickets(user?.venueId || DEFAULT_VENUE_ID);
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

  const handleValidateTicket = async (ticketId: string, purchaseId?: string) => {
    try {
      await updateTicketStatus(ticketId, 'usado', purchaseId);
      setStatusMessage('¡Boleto(s) validado(s) con éxito! El acceso ha sido registrado.');
      fetchTickets();
    } catch (err: any) {
      setStatusMessage('Error al validar el boleto.');
    }
  };

  const filteredTickets = tickets.filter(
    (t) =>
      (t.qrId && t.qrId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.section && t.section.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.matchTitle && t.matchTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.customerName && t.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.stripePaymentIntentId && t.stripePaymentIntentId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1626] p-5 sm:p-6 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-red-600 to-amber-500" />
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-1.5 font-sports">
            <span>Control de Torniquetes & Acceso</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 font-sports tracking-wide">
            <TicketIcon className="w-5 h-5 text-amber-500" />
            Taquilla & Validación de Accesos
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Escaneo de códigos QR, validación en puertas y control de entradas para el evento
          </p>
        </div>

        {/* Buscador de boletos por QR o datos */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código QR, fila, butaca..."
            className="w-full pl-10 pr-3.5 py-2 bg-[#141C2E] border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
          />
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {statusMessage}
          </span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-300 hover:text-white underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Consultando boletos en taquilla..." />
      ) : filteredTickets.length === 0 ? (
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-10 text-center text-slate-400 space-y-2">
          <TicketIcon className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">No se encontraron boletos con el criterio ingresado</p>
          <p className="text-xs text-slate-400">
            Los boletos generados en compras o taquilla aparecerán automáticamente listos para su validación.
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

import React, { useState, useEffect } from 'react';
import { Ticket, UserProfile } from '../../types';
import {
  subscribeUserTickets,
  createSampleTicketsForUser,
} from '../../lib/tickets';
import { TicketCard } from '../../components/shared/TicketCard';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Ticket as TicketIcon, PlusCircle, Sparkles } from 'lucide-react';

interface MisBoletosProps {
  user: UserProfile;
}

export const MisBoletos: React.FC<MisBoletosProps> = ({ user }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'activo' | 'usado'>('todos');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUserTickets(
      user.uid,
      (updatedTickets) => {
        setTickets(updatedTickets);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  const handleGenerateSamples = async () => {
    setGenerating(true);
    try {
      await createSampleTicketsForUser(user.uid);
    } catch (err) {
      console.error('Error generating tickets:', err);
    } finally {
      setGenerating(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'todos') return true;
    return t.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Barra de cabecera con filtros y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-red-700" />
            Mis Boletos Digitales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acceso a tus entradas para los próximos juegos en el Teodoro Mariscal
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setFilter('todos')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filter === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({tickets.length})
            </button>
            <button
              onClick={() => setFilter('activo')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filter === 'activo'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activos ({tickets.filter((t) => t.status === 'activo').length})
            </button>
            <button
              onClick={() => setFilter('usado')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filter === 'usado'
                  ? 'bg-white text-slate-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Usados
            </button>
          </div>

          <button
            id="add-sample-tickets-btn"
            onClick={handleGenerateSamples}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            title="Crear boletos de prueba en Firestore"
          >
            {generating ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <PlusCircle className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">Generar Boleto Prueba</span>
          </button>
        </div>
      </div>

      {/* Lista de Boletos */}
      {loading ? (
        <LoadingSpinner message="Cargando tus boletos desde Firestore..." />
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto">
            <TicketIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              No tienes boletos{' '}
              {filter !== 'todos' ? `en estado "${filter}"` : 'disponibles'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Aquí aparecerán los boletos que adquieras para la temporada de los Venados de Mazatlán.
            </p>
          </div>
          <button
            onClick={handleGenerateSamples}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors uppercase tracking-wider"
          >
            <Sparkles className="w-4 h-4" /> Generar Boletos de Prueba (Firestore)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
};

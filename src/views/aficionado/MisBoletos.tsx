import React, { useState, useEffect } from 'react';
import { Ticket, UserProfile } from '../../types';
import {
  subscribeUserTickets,
  createSampleTicketsForUser,
  purchaseTicketWithSaleRecord,
} from '../../lib/tickets';
import { TicketCard } from '../../components/shared/TicketCard';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Ticket as TicketIcon, PlusCircle, Sparkles, X, CheckCircle2, DollarSign, Calendar, MapPin, ShieldCheck } from 'lucide-react';

interface MisBoletosProps {
  user: UserProfile;
}

const UPCOMING_MATCHES = [
  {
    id: 'm1',
    title: 'Venados de Mazatlán vs Tomateros de Culiacán',
    opponent: 'Tomateros de Culiacán',
    date: '2026-10-15',
    time: '20:00 hrs',
    stadium: 'Estadio Teodoro Mariscal',
  },
  {
    id: 'm2',
    title: 'Venados de Mazatlán vs Naranjeros de Hermosillo',
    opponent: 'Naranjeros de Hermosillo',
    date: '2026-10-22',
    time: '19:30 hrs',
    stadium: 'Estadio Teodoro Mariscal',
  },
  {
    id: 'm3',
    title: 'Venados de Mazatlán vs Yaquis de Obregón',
    opponent: 'Yaquis de Obregón',
    date: '2026-10-29',
    time: '20:00 hrs',
    stadium: 'Estadio Teodoro Mariscal',
  },
];

const SECTIONS = [
  { name: 'Platea Baja Central', price: 450, gate: 'Puerta 2 Central' },
  { name: 'Preferente Lateral', price: 320, gate: 'Puerta 4 Lateral' },
  { name: 'Palco VIP Premier', price: 850, gate: 'Acceso VIP Puerta 1' },
  { name: 'Bleachers / Grada General', price: 150, gate: 'Puerta 8 Bleachers' },
];

export const MisBoletos: React.FC<MisBoletosProps> = ({ user }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'activo' | 'usado'>('todos');

  // Modal de Compra de Boletos
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [seatRow, setSeatRow] = useState('Fila E');
  const [seatNumber, setSeatNumber] = useState('Asiento 12');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo / Terminal física en Taquilla' | 'Tarjeta en Línea' | 'Venados Pay'>('Efectivo / Terminal física en Taquilla');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccessMsg, setPurchaseSuccessMsg] = useState<string | null>(null);

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

  const handleBuyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurchasing(true);
    try {
      const match = UPCOMING_MATCHES[selectedMatchIdx];
      const section = SECTIONS[selectedSectionIdx];

      await purchaseTicketWithSaleRecord(
        {
          userId: user.uid,
          matchTitle: match.title,
          opponent: match.opponent,
          matchDate: match.date,
          matchTime: match.time,
          stadium: match.stadium,
          section: section.name,
          row: seatRow,
          seat: seatNumber,
          price: section.price,
          gate: section.gate,
        },
        paymentMethod,
        user.displayName || 'Aficionado Venados'
      );

      setPurchaseSuccessMsg(`¡Boleto para ${match.opponent} adquirido con éxito!`);
      setIsBuyModalOpen(false);
      setTimeout(() => setPurchaseSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Error buying ticket:', err);
    } finally {
      setPurchasing(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'todos') return true;
    return t.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Alerta de Éxito */}
      {purchaseSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs sm:text-sm font-semibold animate-in fade-in duration-150">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{purchaseSuccessMsg}</span>
        </div>
      )}

      {/* Barra de cabecera con filtros y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-red-700" />
            Mis Boletos Digitales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acceso a tus entradas para los próximos juegos en el Teodoro Mariscal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtros */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setFilter('todos')}
              className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                filter === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({tickets.length})
            </button>
            <button
              onClick={() => setFilter('activo')}
              className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                filter === 'activo'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activos ({tickets.filter((t) => t.status === 'activo').length})
            </button>
            <button
              onClick={() => setFilter('usado')}
              className={`px-3 py-1 font-medium rounded-lg transition-colors cursor-pointer ${
                filter === 'usado'
                  ? 'bg-white text-slate-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Usados
            </button>
          </div>

          <button
            onClick={() => setIsBuyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Comprar Boleto</span>
          </button>
        </div>
      </div>

      {/* Lista de Boletos */}
      {loading ? (
        <LoadingSpinner message="Cargando tus boletos desde Firestore..." />
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center mx-auto">
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
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => setIsBuyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Comprar Boleto para Juego
            </button>
            <button
              onClick={handleGenerateSamples}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> Generar Boletos de Prueba
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}

      {/* MODAL RESPONSIVO: Comprar Boleto con Métodos de Pago */}
      {isBuyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-700 rounded-xl">
                  <TicketIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Adquirir Entrada para el Estadio
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Estadio Teodoro Mariscal • Mazatlán, Sinaloa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBuyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="buy-ticket-form" onSubmit={handleBuyTicket} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* Selección de Juego */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Selecciona el Juego
                </label>
                <div className="space-y-2">
                  {UPCOMING_MATCHES.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMatchIdx(idx)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedMatchIdx === idx
                          ? 'border-red-700 bg-red-50/70 shadow-xs ring-1 ring-red-700'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">{m.title}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-red-600" /> {m.date} - {m.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" /> {m.stadium}
                          </span>
                        </p>
                      </div>
                      {selectedMatchIdx === idx && (
                        <CheckCircle2 className="w-5 h-5 text-red-700 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selección de Zona / Sección */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Sección y Precio
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SECTIONS.map((sec, idx) => (
                    <button
                      key={sec.name}
                      type="button"
                      onClick={() => setSelectedSectionIdx(idx)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        selectedSectionIdx === idx
                          ? 'border-red-700 bg-red-50/70 shadow-xs ring-1 ring-red-700'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{sec.name}</span>
                        <span className="font-black text-xs text-red-900">${sec.price} MXN</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">{sec.gate}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fila y Asiento */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Fila</label>
                  <input
                    type="text"
                    required
                    value={seatRow}
                    onChange={(e) => setSeatRow(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Asiento</label>
                  <input
                    type="text"
                    required
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-600"
                  />
                </div>
              </div>

              {/* 3. Selección de Método de Pago */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Selecciona Método de Pago
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Efectivo / Terminal física en Taquilla')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      paymentMethod === 'Efectivo / Terminal física en Taquilla'
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">💵</span>
                      {paymentMethod === 'Efectivo / Terminal física en Taquilla' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-slate-900 leading-tight">
                        Efectivo / Terminal en Taquilla
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Paga en ventanilla física al llegar
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tarjeta en Línea')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                      paymentMethod === 'Tarjeta en Línea'
                        ? 'border-red-700 bg-red-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">💳</span>
                      {paymentMethod === 'Tarjeta en Línea' && (
                        <span className="w-2 h-2 rounded-full bg-red-700"></span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-[11px] text-slate-900 leading-tight">
                        Tarjeta en Línea
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Visa, Mastercard, Amex
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </form>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-left">
                <span className="text-[11px] text-slate-500">Monto total:</span>
                <p className="text-base sm:text-lg font-black text-red-900">
                  ${SECTIONS[selectedSectionIdx].price.toLocaleString('es-MX')} MXN
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBuyModalOpen(false)}
                  className="w-1/2 sm:w-auto px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="buy-ticket-form"
                  disabled={purchasing}
                  className="w-1/2 sm:w-auto px-5 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {purchasing ? (
                    'Emitiendo...'
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirmar Entrada</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


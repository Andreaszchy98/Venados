import React, { useState, useEffect } from 'react';
import { Ticket } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { generateTotpCode } from '../../lib/tickets';
import { cleanRowValue, cleanSeatValue, cleanSectionValue, formatMatchTime, formatRowLabel } from '../../lib/seatUtils';
import { useTheme } from '../../context/ThemeContext';
import { Calendar, MapPin, CheckCircle2, Clock, XCircle, Ticket as TicketIcon, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';

interface ReclamoBoletoViewProps {
  claimToken: string;
  onNavigateHome: () => void;
}

export const ReclamoBoletoView: React.FC<ReclamoBoletoViewProps> = ({ claimToken, onNavigateHome }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
  const [totpCode, setTotpCode] = useState<string>('');

  // Cargar boleto en tiempo real por claimToken
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function fetchTicket() {
      try {
        const ticketsCol = collection(db, 'tickets');
        const q = query(ticketsCol, where('claimToken', '==', claimToken));
        const snap = await getDocs(q);

        if (snap.empty) {
          setErrorMsg('El enlace de reclamo no es válido, ha expirado o el boleto ya fue reclamado.');
          setLoading(false);
          return;
        }

        const ticketDoc = snap.docs[0];
        const ticketData = { id: ticketDoc.id, ...(ticketDoc.data() as Omit<Ticket, 'id'>) };
        setTicket(ticketData);
        setTotpCode(`${ticketData.qrId}-${ticketData.secretSeed ? generateTotpCode(ticketData.secretSeed) : ''}`);

        // Escuchar cambios en tiempo real (ej. si el validador lo marca como usado)
        unsubscribe = onSnapshot(doc(db, 'tickets', ticketDoc.id), (docSnap) => {
          if (docSnap.exists()) {
            setTicket({ id: docSnap.id, ...(docSnap.data() as Omit<Ticket, 'id'>) });
          }
        });
      } catch (e: any) {
        console.error('Error fetching claimed ticket:', e);
        setErrorMsg('Error al conectar con la base de datos de accesos.');
      } finally {
        setLoading(false);
      }
    }

    fetchTicket();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [claimToken]);

  // Reloj digital y TOTP dinámico
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString());
      if (ticket?.secretSeed) {
        setTotpCode(`${ticket.qrId}-${generateTotpCode(ticket.secretSeed)}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [ticket?.secretSeed, ticket?.qrId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-6 text-white">
        <LoadingSpinner message="Verificando pase de invitado oficial..." />
      </div>
    );
  }

  if (errorMsg || !ticket) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-[#0F1626] border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black font-sports uppercase tracking-wider">Enlace No Disponible</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={onNavigateHome}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports shadow-lg transition-all cursor-pointer"
          >
            Ir a la Aplicación Principal
          </button>
        </div>
      </div>
    );
  }

  const isUsed = ticket.status === 'usado';
  const isCancelled = ticket.status === 'cancelado';

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-[#0F1626] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Franja superior deportiva */}
        <div className="h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 w-full" />

        <div className="p-6 space-y-5">
          {/* Cabecera invitado */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-600 text-white font-sports font-black text-xs flex items-center justify-center shadow-md">
                V
              </span>
              <span className="text-xs font-sports font-bold tracking-widest uppercase text-slate-300">
                Pase Web Guest • Sin Registro
              </span>
            </div>

            {isUsed ? (
              <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-bold flex items-center gap-1 font-sports">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Ingresado
              </span>
            ) : isCancelled ? (
              <span className="px-3 py-1 bg-red-950 text-red-300 border border-red-800 rounded-full text-xs font-bold flex items-center gap-1 font-sports">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                Cancelado
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full text-xs font-bold flex items-center gap-1 font-sports">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Acceso Válido
              </span>
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black font-sports uppercase tracking-wide text-white leading-tight">
              {ticket.matchTitle}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-red-500" />
                {ticket.matchDate} {ticket.matchTime && `• ${ticket.matchTime}`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-500" />
                {ticket.stadium || 'Estadio'}
              </span>
            </div>
          </div>

          {/* QR Dinámico Anti-Captura con Reloj en Vivo */}
          <div className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center space-y-4 shadow-inner">
            <div className="relative p-1.5 rounded-2xl bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse shadow-lg">
              <div className="p-3 bg-white rounded-xl inline-flex items-center justify-center">
                <QRCodeDisplay value={totpCode || ticket.qrId} size={150} alt="QR Dinámico Guest" />
              </div>
            </div>

            {/* Reloj digital anti-captura */}
            <div className="w-full bg-[#141C2E] border border-slate-700/80 rounded-xl px-3 py-1.5 text-center shadow-sm">
              <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold text-amber-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>RELOJ EN VIVO: {currentTime}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              {isUsed
                ? 'Este boleto ya fue registrado en los torniquetes del estadio.'
                : 'Muestra este código QR dinámico en la puerta de acceso. Se actualiza automáticamente.'}
            </p>
          </div>

          {/* Butaca Asignada */}
          <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-[#141C2E] border border-slate-700/80 text-center">
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Zona</span>
              <span className="text-xs sm:text-sm font-black font-sports truncate block mt-0.5">
                {cleanSectionValue(ticket.section)}
              </span>
            </div>
            <div className="border-x border-slate-700">
              <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Fila</span>
              <span className="text-xs sm:text-sm font-black text-amber-400 font-mono mt-0.5 block">
                {cleanRowValue(ticket.row) || '-'}
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Butaca</span>
              <span className="text-xs sm:text-sm font-black text-red-500 font-mono mt-0.5 block">
                {cleanSeatValue(ticket.seat) || '-'}
              </span>
            </div>
          </div>

          {ticket.gate && (
            <div className="text-xs text-center text-slate-400">
              Puerta asignada: <strong className="text-white">{ticket.gate}</strong>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onNavigateHome}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports shadow-lg shadow-red-950/40 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Ir a la App Oficial Venados VXP</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

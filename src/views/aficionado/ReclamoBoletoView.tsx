import React, { useState, useEffect } from 'react';
import { Ticket } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { generateTotpCode } from '../../lib/tickets';
import { cleanRowValue, cleanSeatValue, cleanSectionValue, formatMatchTime, formatRowLabel } from '../../lib/seatUtils';
import { useTheme } from '../../context/ThemeContext';
import {
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  Ticket as TicketIcon,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Download,
  Copy,
  Check,
  Share2,
  Compass,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, limit } from 'firebase/firestore';
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
  const [copied, setCopied] = useState(false);

  // Cargar boleto en tiempo real con resolución multi-criterio robusta
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function fetchTicket() {
      const cleanToken = claimToken.trim();
      if (!cleanToken) {
        setErrorMsg('No se especificó un código o enlace de butaca válido.');
        setLoading(false);
        return;
      }

      try {
        const ticketsCol = collection(db, 'tickets');
        let foundDoc: any = null;

        // 1. Buscar por claimToken exacto
        const q1 = query(ticketsCol, where('claimToken', '==', cleanToken), limit(1));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          foundDoc = snap1.docs[0];
        }

        // 2. Si no, buscar por claimToken en mayúsculas
        if (!foundDoc && cleanToken.toUpperCase() !== cleanToken) {
          const qUpper = query(ticketsCol, where('claimToken', '==', cleanToken.toUpperCase()), limit(1));
          const snapUpper = await getDocs(qUpper);
          if (!snapUpper.empty) {
            foundDoc = snapUpper.docs[0];
          }
        }

        // 3. Si no, buscar por qrId
        if (!foundDoc) {
          const q2 = query(ticketsCol, where('qrId', '==', cleanToken), limit(1));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            foundDoc = snap2.docs[0];
          }
        }

        // 4. Si no, buscar por doc ID directo
        if (!foundDoc) {
          try {
            const directDocSnap = await getDoc(doc(db, 'tickets', cleanToken));
            if (directDocSnap.exists()) {
              foundDoc = directDocSnap;
            }
          } catch {}
        }

        // 5. Si no, buscar por purchaseId
        if (!foundDoc) {
          const q3 = query(ticketsCol, where('purchaseId', '==', cleanToken), limit(1));
          const snap3 = await getDocs(q3);
          if (!snap3.empty) {
            foundDoc = snap3.docs[0];
          }
        }

        if (!foundDoc) {
          setErrorMsg('El enlace de reclamo no es válido, ha expirado o el boleto ya no se encuentra en el sistema.');
          setLoading(false);
          return;
        }

        const ticketData = { id: foundDoc.id, ...(foundDoc.data() as Omit<Ticket, 'id'>) };
        setTicket(ticketData);
        setTotpCode(`${ticketData.qrId}-${ticketData.secretSeed ? generateTotpCode(ticketData.secretSeed) : ''}`);

        // Escuchar cambios en tiempo real (ej. si el validador del estadio lo marca como usado en molinete)
        unsubscribe = onSnapshot(doc(db, 'tickets', foundDoc.id), (docSnap) => {
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

  // Reloj digital y TOTP dinámico anti-captura
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

  const handleCopySeatData = async () => {
    if (!ticket) return;
    const text = `Boleto Oficial Venados VXP\nPartido: ${ticket.matchTitle}\nFecha: ${ticket.matchDate} ${ticket.matchTime || ''}\nRecinto: ${ticket.stadium || 'Estadio'}\nZona: ${cleanSectionValue(ticket.section)} | Fila: ${cleanRowValue(ticket.row)} | Butaca: ${cleanSeatValue(ticket.seat)}\nPuerta: ${ticket.gate || 'Acceso General'}\nCódigo: ${ticket.qrId}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleDownloadPass = () => {
    if (!ticket) return;
    try {
      const content = `========================================
       PASE OFICIAL DE ACCESO AL ESTADIO
========================================
Evento:      ${ticket.matchTitle}
Fecha:       ${ticket.matchDate}
Hora:        ${ticket.matchTime || 'Por confirmar'}
Recinto:     ${ticket.stadium || 'Estadio'}
Zona:        ${cleanSectionValue(ticket.section)}
Fila:        ${cleanRowValue(ticket.row)}
Butaca:      ${cleanSeatValue(ticket.seat)}
Puerta:      ${ticket.gate || 'Acceso Principal'}
----------------------------------------
Código QR:   ${ticket.qrId}
Ref. Pase:   #${ticket.id.slice(-8)}
Estado:      ${ticket.status === 'usado' ? 'UTILIZADO' : ticket.status === 'activo' ? 'ACCESO VÁLIDO' : 'CANCELADO'}
========================================
Muestra este pase en los torniquetes del estadio.
`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Pase-${ticket.qrId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-6 text-white">
        <LoadingSpinner message="Verificando tu pase de invitado oficial..." />
      </div>
    );
  }

  if (errorMsg || !ticket) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-4 sm:p-6 text-white">
        <div className="max-w-md w-full bg-[#0F1626] border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black font-sports uppercase tracking-wider">Enlace No Disponible</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={onNavigateHome}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4" />
            <span>Explorar Cartelera de Partidos</span>
          </button>
        </div>
      </div>
    );
  }

  const isUsed = ticket.status === 'usado';
  const isCancelled = ticket.status === 'cancelado';

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md bg-[#0F1626] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Franja superior deportiva */}
        <div className="h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 w-full" />

        <div className="p-5 sm:p-6 space-y-4">
          {/* Cabecera invitado */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-600 text-white font-sports font-black text-xs flex items-center justify-center shadow-md">
                V
              </span>
              <span className="text-xs font-sports font-bold tracking-widest uppercase text-slate-300">
                Pase Oficial • Sin Registro
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
            <h1 className="text-lg sm:text-2xl font-black font-sports uppercase tracking-wide text-white leading-tight">
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
          <div className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center space-y-3.5 shadow-inner">
            <div className="relative p-1.5 rounded-2xl bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse shadow-lg">
              <div className="p-3 bg-white rounded-xl inline-flex items-center justify-center">
                <QRCodeDisplay value={totpCode || ticket.qrId} size={150} alt="QR Dinámico Guest" />
              </div>
            </div>

            {/* Reloj digital anti-captura */}
            <div className="w-full bg-[#141C2E] border border-slate-700/80 rounded-xl px-3 py-1.5 text-center shadow-xs">
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
          <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#141C2E] border border-slate-700/80 text-center">
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-400 font-sports">Zona</span>
              <span className="text-xs sm:text-sm font-black font-sports truncate block mt-0.5" title={ticket.section}>
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

          {/* Acciones del pase: Copiar y Descargar */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopySeatData}
              className="py-2.5 px-3 bg-[#141C2E] hover:bg-[#1A253D] border border-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase font-sports flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copiar Datos</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPass}
              className="py-2.5 px-3 bg-[#141C2E] hover:bg-[#1A253D] border border-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase font-sports flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-red-400" />
              <span>Descargar (.txt)</span>
            </button>
          </div>

          {/* Navegar a la app oficial sin forzar login */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={onNavigateHome}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports shadow-lg shadow-red-950/40 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Explorar Cartelera de Partidos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { verifyAndFulfillStripeCheckout, FulfillCheckoutResult } from '../../lib/stripe';
import { CinemaTicketSummary } from '../shared/CinemaTicketSummary';
import { CheckCircle2, AlertTriangle, ShieldCheck, Ticket as TicketIcon, ArrowRight, X } from 'lucide-react';
import { Ticket } from '../../types';

interface StripeSuccessModalProps {
  sessionId: string;
  onClose: () => void;
  onNavigateToTickets?: () => void;
}

export const StripeSuccessModal: React.FC<StripeSuccessModalProps> = ({
  sessionId,
  onClose,
  onNavigateToTickets,
}) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FulfillCheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fulfill = async () => {
      try {
        setLoading(true);
        const res = await verifyAndFulfillStripeCheckout(sessionId);
        if (isMounted) {
          setResult(res);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error verificando pago en Stripe:', err);
          setError(err.message || 'No se pudo verificar el pago con Stripe.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fulfill();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleCleanAndClose = () => {
    // Limpiar query params de la URL para que no se re-abra si el usuario refresca
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_status');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    onClose();
  };

  const handleGoToTickets = () => {
    handleCleanAndClose();
    if (onNavigateToTickets) {
      onNavigateToTickets();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0F1626] rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden text-white relative my-auto max-h-[94vh] flex flex-col">
        {/* Barra superior decorativa */}
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 shrink-0" />

        <button
          onClick={handleCleanAndClose}
          className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-7 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-white font-sports tracking-wide">
                  Confirmando tu pago en Stripe...
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto font-sans">
                  Verificando la transacción bancaria y generando tu resumen de boleto digital oficial.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="py-8 space-y-4 text-center">
              <div className="w-12 h-12 bg-red-950/80 border border-red-500/50 rounded-2xl flex items-center justify-center mx-auto text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-300 font-sports">Problema al verificar el pago</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">{error}</p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCleanAndClose}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sports uppercase tracking-wider"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : result && result.ticket ? (
            <>
              {/* Header de éxito con jerarquía visual refinada */}
              <div className="text-center space-y-1.5 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/90 border border-emerald-500/50 rounded-full text-[11px] font-black uppercase text-emerald-400 font-sports tracking-wider shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pago Confirmado • Stripe SSL</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sports tracking-wide">
                  ¡Tus Boletos Están Listos!
                </h2>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Presenta este resumen de acceso digital en el molinete de ingreso al estadio.
                </p>
              </div>

              {/* Render del Resumen de Boleto Premium Estilo Cine (Cinépolis) */}
              <div>
                <CinemaTicketSummary ticket={result.ticket} />
              </div>

              {/* Botones de navegación inferiores */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleGoToTickets}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-sports text-xs sm:text-sm font-black tracking-wider uppercase shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <TicketIcon className="w-4 h-4" />
                  <span>Ver en Mis Boletos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCleanAndClose}
                  className="py-3 px-5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sports uppercase tracking-wider border border-slate-700"
                >
                  Continuar
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

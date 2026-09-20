import React, { useState, useEffect } from 'react';
import { CreditCard, ShieldCheck, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { completeSimulatedPayment } from '../../lib/stripe';

interface StripeDemoCheckoutModalProps {
  sessionId: string;
  onClose: () => void;
}

export const StripeDemoCheckoutModal: React.FC<StripeDemoCheckoutModalProps> = ({
  sessionId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/stripe/simulatedSession/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setSessionData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('No se pudo cargar la sesión de checkout.');
        setLoading(false);
      });
  }, [sessionId]);

  const handlePay = async () => {
    setProcessing(true);
    try {
      await completeSimulatedPayment(sessionId);
      const targetUrl = `${window.location.origin}/?stripe_status=success&session_id=${sessionId}`;
      window.location.href = targetUrl;
    } catch (e: any) {
      setError(e.message || 'Error al procesar el pago');
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    const targetUrl = `${window.location.origin}/?stripe_status=cancelled`;
    window.location.href = targetUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden text-slate-900 border border-slate-200">
        {/* Header estilo Stripe Checkout */}
        <div className="bg-[#635BFF] p-6 text-white text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wide uppercase mb-2 backdrop-blur-xs">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Stripe Checkout Demo</span>
          </div>
          <h3 className="text-xl font-black tracking-tight">Pasarela de Pagos Stripe</h3>
          <p className="text-xs text-indigo-100 mt-1">
            Simulador seguro de checkout para pruebas y evaluación
          </p>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-8 text-center text-slate-500 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium">Conectando con la pasarela segura...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          ) : sessionData ? (
            <>
              {/* Resumen del cobro */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-600 font-medium">Concepto:</span>
                  <span className="font-bold text-slate-900 text-right">
                    {sessionData.metadata?.matchTitle || 'Boleto de Evento'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Ubicación:</span>
                  <span className="font-semibold text-slate-800">
                    {sessionData.metadata?.section || 'General'} • {sessionData.metadata?.seatRow || ''}{' '}
                    {sessionData.metadata?.seatNumber || ''}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-900">Total a Pagar:</span>
                  <span className="text-lg font-black text-indigo-600 font-scoreboard">
                    ${(sessionData.amount_total / 100).toFixed(2)} {sessionData.currency?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Tarjeta de prueba */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Modo Sandbox / Prueba</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Para procesar cobros reales con tarjeta de crédito/débito en producción, configura tu clave secreta
                  <code className="mx-1 px-1.5 py-0.5 bg-indigo-100 rounded font-mono font-bold">STRIPE_SECRET_KEY</code>
                  en Settings de AI Studio.
                </p>
              </div>

              {/* Botones de acción */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={processing}
                  className="w-full py-3 px-4 bg-[#635BFF] hover:bg-[#534be0] active:bg-[#4339cc] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Procesando pago con Stripe...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pago de ${(sessionData.amount_total / 100).toFixed(2)} MXN</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={processing}
                  className="w-full py-2.5 px-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4 text-slate-400" />
                  <span>Cancelar pago y regresar</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

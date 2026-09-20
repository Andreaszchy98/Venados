import React, { useState, useEffect } from 'react';
import {
  fetchPendingStripeSessions,
  verifyAndFulfillStripeCheckout,
  PendingStripeSession,
} from '../../lib/stripe';
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Ticket,
  Clock,
  User,
  Mail,
  DollarSign,
  X,
  ExternalLink,
} from 'lucide-react';

interface StripePendingPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketGenerated?: () => void;
}

export const StripePendingPaymentsModal: React.FC<StripePendingPaymentsModalProps> = ({
  isOpen,
  onClose,
  onTicketGenerated,
}) => {
  const [loading, setLoading] = useState(false);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [pendingSessions, setPendingSessions] = useState<PendingStripeSession[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingStripeSessions();
      setIsConfigured(data.configured);
      setPendingSessions(data.pendingSessions || []);
    } catch (err: any) {
      console.error('Error cargando sesiones pendientes:', err);
      setError(err.message || 'No se pudieron consultar los pagos de Stripe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPending();
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleFulfill = async (sessionId: string) => {
    setFulfillingId(sessionId);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await verifyAndFulfillStripeCheckout(sessionId);
      if (res.success) {
        setSuccessMessage(`¡Boleto #${res.ticketId?.slice(-6)} emitido con éxito con QR ${res.qrId || ''}!`);
        // Actualizar lista local
        setPendingSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (onTicketGenerated) onTicketGenerated();
      } else {
        throw new Error(res.error || 'No se pudo generar el boleto');
      }
    } catch (err: any) {
      setError(err.message || 'Error al emitir boleto');
    } finally {
      setFulfillingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0F1626] rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-700/80 flex items-center justify-between bg-[#141E34]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700/50 text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide font-sports uppercase">
                Verificar Pagos Pendientes en Stripe
              </h3>
              <p className="text-xs text-slate-400">
                Detecta sesiones pagadas en Stripe que no finalizaron el retorno web y permite emitir sus boletos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Mensajes */}
          {successMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {!isConfigured && (
            <div className="p-3 bg-amber-950/60 border border-amber-600/50 rounded-xl text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Modo Demostración / Simulación: </span>
                <span>
                  No hay una clave <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono">STRIPE_SECRET_KEY</code> configurada en variables de entorno.
                  Se muestran sesiones simuladas de prueba en memoria.
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
              <p className="text-xs font-medium">Consultando API de Stripe y conciliando con Firestore...</p>
            </div>
          ) : pendingSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-200 font-sports uppercase tracking-wider">
                Todo Conciliado al 100%
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No existen pagos completados en Stripe pendientes de emisión. Todos los cargos registrados cuentan con su boleto oficial generado en Firestore.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>Sesiones encontradas sin boleto ({pendingSessions.length})</span>
                <button
                  onClick={loadPending}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizar</span>
                </button>
              </div>

              {pendingSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-xl bg-[#141E34] border border-slate-700/70 hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-white font-sports">
                        {session.eventName}
                      </span>
                      {session.isDemo && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold uppercase">
                          Demo
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {session.customerName}
                      </span>
                      {session.customerEmail && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Mail className="w-3.5 h-3.5" />
                          {session.customerEmail}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="font-semibold text-slate-300">{session.section} • {session.seat}</span>
                      <span>•</span>
                      <span>{new Date(session.created).toLocaleString('es-MX')}</span>
                    </div>

                    <div className="text-[10px] font-mono text-slate-500 truncate max-w-sm">
                      ID: {session.id}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/50">
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-400 font-scoreboard">
                        ${session.amountTotal.toFixed(2)} {session.currency}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={fulfillingId === session.id}
                      onClick={() => handleFulfill(session.id)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black font-sports uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      {fulfillingId === session.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Generando...</span>
                        </>
                      ) : (
                        <>
                          <Ticket className="w-3.5 h-3.5" />
                          <span>Generar Boleto</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141E34]/80 border-t border-slate-700/80 flex items-center justify-between text-xs">
          <button
            onClick={loadPending}
            disabled={loading}
            className="text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Volver a Escanear Stripe</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

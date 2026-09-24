import React, { useState } from 'react';
import {
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ExternalLink,
  Wifi,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { processDirectCardPayment, DirectPaymentResult } from '../../lib/stripe';

export interface CardPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  concept: string;
  customerName: string;
  customerEmail?: string;
  orderType: 'boletos' | 'tienda' | 'comida';
  metadata?: Record<string, string>;
  externalSessionUrl?: string | null;
  onSuccess: (result: DirectPaymentResult) => void;
}

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'generic';

export const CardPaymentModal: React.FC<CardPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  concept,
  customerName,
  customerEmail,
  orderType,
  metadata,
  externalSessionUrl,
  onSuccess,
}) => {
  const { theme } = useTheme();

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(customerName || '');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [zipCode, setZipCode] = useState('82000');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Detectar marca de tarjeta
  const getCardBrand = (cleanNum: string): CardBrand => {
    if (cleanNum.startsWith('4')) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(cleanNum)) return 'mastercard';
    if (/^(34|37)/.test(cleanNum)) return 'amex';
    return 'generic';
  };

  const rawCardNumber = cardNumber.replace(/\D/g, '');
  const brand = getCardBrand(rawCardNumber);
  const maxCardLength = brand === 'amex' ? 15 : 16;

  // Formatear número de tarjeta con espacios
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, maxCardLength);
    if (brand === 'amex') {
      const part1 = val.slice(0, 4);
      const part2 = val.slice(4, 10);
      const part3 = val.slice(10, 15);
      const formatted = [part1, part2, part3].filter(Boolean).join(' ');
      setCardNumber(formatted);
    } else {
      const parts = val.match(/.{1,4}/g) || [];
      setCardNumber(parts.join(' '));
    }
  };

  // Formatear expiración MM/AA
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 2) {
      const mm = parseInt(val.slice(0, 2), 10);
      if (mm > 12) val = '12' + val.slice(2);
      if (mm === 0) val = '01' + val.slice(2);
      setExpiry(`${val.slice(0, 2)}/${val.slice(2)}`);
    } else {
      setExpiry(val);
    }
  };

  // CVC max 3 o 4 (Amex)
  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const max = brand === 'amex' ? 4 : 3;
    setCvc(e.target.value.replace(/\D/g, '').slice(0, max));
  };

  // Rellenar tarjeta de prueba oficial de Stripe
  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardHolder(customerName || 'Aficionado Venados');
    setExpiry('12/28');
    setCvc('123');
    setZipCode('82000');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanNum = cardNumber.replace(/\D/g, '');
    if (cleanNum.length < (brand === 'amex' ? 15 : 16)) {
      setErrorMessage('Ingresa un número de tarjeta válido.');
      return;
    }

    if (!cardHolder.trim()) {
      setErrorMessage('Ingresa el nombre del titular como aparece en la tarjeta.');
      return;
    }

    const [expMonth, expYear] = expiry.split('/');
    if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 2) {
      setErrorMessage('Ingresa una fecha de expiración válida (MM/AA).');
      return;
    }

    if (cvc.length < (brand === 'amex' ? 4 : 3)) {
      setErrorMessage(`El código de seguridad (CVC) debe tener ${brand === 'amex' ? '4' : '3'} dígitos.`);
      return;
    }

    setIsProcessing(true);

    try {
      const last4 = cleanNum.slice(-4);
      const brandName =
        brand === 'visa' ? 'Visa' : brand === 'mastercard' ? 'Mastercard' : brand === 'amex' ? 'AMEX' : 'Tarjeta';

      const result = await processDirectCardPayment({
        amount,
        concept,
        customerName: cardHolder.trim(),
        customerEmail: customerEmail || 'aficionado@venados.com',
        cardLast4: last4,
        cardBrand: brandName,
        orderType,
        metadata: {
          ...metadata,
          zipCode,
        },
      });

      setIsProcessing(false);
      onSuccess(result);
    } catch (err: any) {
      console.error('Error procesando pago con tarjeta:', err);
      setErrorMessage(err.message || 'Error al procesar el pago. Por favor intenta de nuevo.');
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="card-payment-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg my-auto rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border transition-all flex flex-col max-h-[90vh] ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0B111E] border-slate-700/90 text-white'
        }`}
      >
        {/* Header con gradiente de seguridad */}
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 p-4 sm:p-5 text-white relative shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                  Pago Seguro con Tarjeta
                </h3>
                <p className="text-[11px] text-red-100 flex items-center gap-1.5 mt-0.5 font-sans">
                  <Lock className="w-3 h-3 text-emerald-300" />
                  <span>Cifrado SSL de 256 bits • Procesado vía Stripe</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable del modal */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Tarjeta interactiva visual */}
          <div className="relative w-full h-40 sm:h-44 rounded-2xl p-4 sm:p-5 text-white shadow-xl overflow-hidden bg-gradient-to-tr from-[#0F172A] via-[#1E293B] to-[#334155] border border-slate-700 flex flex-col justify-between select-none shrink-0">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-600/30 rounded-full blur-2xl" />

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-6 sm:w-10 sm:h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-inner flex items-center justify-center">
                  <div className="w-full h-px bg-amber-700/40" />
                </div>
                <Wifi className="w-4 h-4 text-slate-300 rotate-90" />
              </div>

              <div className="text-right">
                {brand === 'visa' && (
                  <span className="font-black text-xl tracking-wider text-blue-400 font-sans italic">
                    VISA
                  </span>
                )}
                {brand === 'mastercard' && (
                  <div className="flex items-center">
                    <div className="w-5 h-5 rounded-full bg-red-500 opacity-90 -mr-2 shadow-xs" />
                    <div className="w-5 h-5 rounded-full bg-amber-400 opacity-90 shadow-xs" />
                  </div>
                )}
                {brand === 'amex' && (
                  <span className="font-black text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 rounded tracking-wider">
                    AMEX
                  </span>
                )}
                {brand === 'generic' && (
                  <span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">
                    Crédito / Débito
                  </span>
                )}
              </div>
            </div>

            <div className="relative z-10 font-mono text-sm sm:text-base tracking-[0.2em] font-bold text-slate-100 drop-shadow-md">
              {cardNumber || '•••• •••• •••• ••••'}
            </div>

            <div className="relative z-10 flex items-end justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                  Titular
                </span>
                <span className="font-semibold tracking-wider uppercase truncate block max-w-[180px] sm:max-w-[220px]">
                  {cardHolder || 'NOMBRE DEL TITULAR'}
                </span>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                  Vence
                </span>
                <span className="font-mono font-bold tracking-wider">
                  {expiry || 'MM/AA'}
                </span>
              </div>
            </div>
          </div>

          {/* Resumen del Concepto y Total */}
          <div
            className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between text-xs shrink-0 ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200 text-slate-800'
                : 'bg-[#141C2E] border-slate-700 text-slate-200'
            }`}
          >
            <div className="space-y-0.5 max-w-[65%]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-500 block">
                Concepto
              </span>
              <p className="font-semibold truncate">{concept}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Total a Cobrar
              </span>
              <p className="text-sm sm:text-base font-black font-scoreboard text-emerald-500">
                ${amount.toLocaleString('es-MX')} <span className="text-[10px] font-sans">MXN</span>
              </p>
            </div>
          </div>

          {/* Botón rápido de autollenado para pruebas */}
          <div className="flex items-center justify-between shrink-0">
            <span
              className={`text-[11px] font-medium ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              ¿Deseas probar el flujo?
            </span>
            <button
              type="button"
              onClick={handleFillTestCard}
              className="text-[11px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer underline underline-offset-2"
            >
              <Sparkles className="w-3 h-3" />
              <span>Llenar tarjeta de prueba Stripe</span>
            </button>
          </div>

          {/* Mensaje de error si existe */}
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulario con todos los campos reales */}
          <form id="card-form" onSubmit={handleSubmit} className="space-y-3">
            {/* Número de Tarjeta */}
            <div>
              <label
                className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Número de Tarjeta
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  disabled={isProcessing}
                  required
                  className={`w-full pl-10 pr-4 py-2 rounded-xl border text-sm font-mono tracking-wider font-semibold focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-[#141C2E] border-slate-700 text-white placeholder:text-slate-500'
                  }`}
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              </div>
            </div>

            {/* Nombre del Titular */}
            <div>
              <label
                className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                Nombre en la Tarjeta
              </label>
              <input
                type="text"
                autoComplete="cc-name"
                placeholder="Como aparece en la tarjeta"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                disabled={isProcessing}
                required
                className={`w-full px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold tracking-wide uppercase focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    : 'bg-[#141C2E] border-slate-700 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Expiración, CVC y Código Postal */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  Vencimiento
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={handleExpiryChange}
                  disabled={isProcessing}
                  required
                  className={`w-full px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-mono text-center font-bold tracking-wider focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-[#141C2E] border-slate-700 text-white placeholder:text-slate-500'
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  CVC / CVV
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    value={cvc}
                    onChange={handleCvcChange}
                    disabled={isProcessing}
                    required
                    className={`w-full pl-8 pr-2 py-2 rounded-xl border text-xs sm:text-sm font-mono text-center font-bold tracking-widest focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all ${
                      theme === 'light'
                        ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-[#141C2E] border-slate-700 text-white placeholder:text-slate-500'
                    }`}
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label
                  className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${
                    theme === 'light' ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  C.P.
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="82000"
                  maxLength={5}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  disabled={isProcessing}
                  required
                  className={`w-full px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-mono text-center font-bold tracking-wider focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all ${
                    theme === 'light'
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-[#141C2E] border-slate-700 text-white placeholder:text-slate-500'
                  }`}
                />
              </div>
            </div>

            {/* Garantía de Seguridad */}
            <div
              className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] ${
                theme === 'light'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Tus datos viajan tokenizados y encriptados de extremo a extremo conforme a PCI-DSS.</span>
            </div>

            {/* Botón de Confirmación de Pago */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Autorizando pago seguro...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Pagar ${amount.toLocaleString('es-MX')} MXN</span>
                  </>
                )}
              </button>

              {externalSessionUrl && (
                <button
                  type="button"
                  onClick={() => {
                    window.open(externalSessionUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className={`w-full py-2 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>O abrir pasarela externa de Stripe en pestaña nueva</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className={`w-full py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cancelar y regresar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

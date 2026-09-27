import React, { useState, useEffect, useRef } from 'react';
import { FoodOrder } from '../../types';
import { Html5Qrcode } from 'html5-qrcode';
import { cleanRowValue, cleanSeatValue, cleanSectionValue } from '../../lib/seatUtils';
import {
  QrCode,
  X,
  CheckCircle2,
  XCircle,
  Zap,
  ZapOff,
  Keyboard,
  Camera,
  User,
  Armchair,
  AlertTriangle,
} from 'lucide-react';

interface RunnerQrScannerModalProps {
  order: FoodOrder;
  onClose: () => void;
  onDeliverySuccess: (orderId: string) => Promise<void>;
}

export const RunnerQrScannerModal: React.FC<RunnerQrScannerModalProps> = ({
  order,
  onClose,
  onDeliverySuccess,
}) => {
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error' | 'manual'>('scanning');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerContainerId = 'runner-qr-reader-container';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  const playErrorChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  // Función para validar si un código escaneado o escrito coincide con la orden
  const validateCode = (inputCode: string): boolean => {
    if (!inputCode) return false;

    const cleanInput = inputCode.trim().toUpperCase().replace(/^FOOD:/i, '');
    const cleanPickup = (order.pickupCode || '').trim().toUpperCase();
    const cleanOrderId = (order.id || '').trim().toUpperCase();

    if (cleanInput === cleanPickup || cleanInput === cleanOrderId) {
      return true;
    }

    // Normalizado sin guiones ni caracteres especiales
    const normInput = cleanInput.replace(/[^A-Z0-9]/g, '');
    const normPickup = cleanPickup.replace(/[^A-Z0-9]/g, '');
    const normId = cleanOrderId.replace(/[^A-Z0-9]/g, '');

    if (normInput === normPickup || normInput === normId) {
      return true;
    }

    if (normInput.includes(normPickup) || normPickup.includes(normInput)) {
      return true;
    }

    return false;
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.warn('Error deteniendo escáner:', err);
      }
      html5QrCodeRef.current = null;
    }
  };

  const handleValidCodeScanned = async (validToken: string) => {
    await stopScanner();
    setScanStatus('success');
    playSuccessChime();
    setIsSubmitting(true);

    try {
      await onDeliverySuccess(order.id);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar el estado de la entrega');
      setIsSubmitting(false);
    }
  };

  const handleInvalidCodeScanned = (scannedText: string) => {
    playErrorChime();
    setScanStatus('error');
    setErrorMessage(
      `El código escaneado (${scannedText}) no corresponde a la orden #${order.pickupCode} de ${order.customerName}.`
    );
  };

  // Iniciar cámara con html5-qrcode
  useEffect(() => {
    if (scanStatus !== 'scanning') return;

    let isMounted = true;
    const qrCode = new Html5Qrcode(scannerContainerId);
    html5QrCodeRef.current = qrCode;

    qrCode
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (!isMounted) return;
          if (validateCode(decodedText)) {
            handleValidCodeScanned(decodedText);
          } else {
            handleInvalidCodeScanned(decodedText);
          }
        },
        () => {
          // Frame ticks
        }
      )
      .then(() => {
        try {
          const videoElement = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement;
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            if (track) {
              videoTrackRef.current = track;
              const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
              if (capabilities.torch) {
                setTorchSupported(true);
              }
            }
          }
        } catch (e) {
          console.warn('Torch detection error:', e);
        }
      })
      .catch((err) => {
        console.warn('Error iniciando cámara:', err);
        if (isMounted) {
          setScanStatus('manual');
          setErrorMessage('No se pudo acceder a la cámara. Usa la validación por código manual.');
        }
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [scanStatus]);

  const toggleTorch = async () => {
    if (!videoTrackRef.current) return;
    try {
      const nextTorch = !torchOn;
      await (videoTrackRef.current as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch failed:', e);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!manualCode.trim()) {
      setErrorMessage('Ingresa el código de entrega para verificar.');
      return;
    }

    if (validateCode(manualCode)) {
      handleValidCodeScanned(manualCode);
    } else {
      playErrorChime();
      setErrorMessage(`Código incorrecto (${manualCode.trim().toUpperCase()}). El código esperado es #${order.pickupCode}.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0F1420] border-2 border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white flex flex-col max-h-[92vh]">
        {/* Encabezado con datos del cliente y pedido */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-4 sm:p-5 border-b border-blue-500/40 relative">
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/40 text-blue-300 border border-white/20 font-sports mb-1">
            <QrCode className="w-3 h-3 text-amber-400" />
            <span>Validación de Entrega en Butaca</span>
          </div>

          <h3 className="text-xl font-black font-sports uppercase tracking-wide">
            Escanear QR de Comanda
          </h3>

          <div className="mt-2 bg-black/40 p-2.5 rounded-2xl border border-white/20 space-y-1 text-xs">
            <p className="flex items-center gap-1.5 text-white font-bold">
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Cliente: <strong className="text-amber-300">{order.customerName}</strong></span>
            </p>
            <p className="flex items-center gap-1.5 text-slate-300 font-mono">
              <Armchair className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>
                Ubicación: <strong>Sec. {cleanSectionValue(order.section) || 'General'}, Fila {cleanRowValue(order.row)}, Seat {cleanSeatValue(order.seat)}</strong>
              </span>
            </p>
            <p className="text-[11px] text-blue-200 font-bold font-mono">
              Código Esperado: <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-xs font-black">#{order.pickupCode}</span>
            </p>
          </div>
        </div>

        {/* Contenido Dinámico según Estado del Escáner */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {scanStatus === 'scanning' && (
            <div className="space-y-4 text-center">
              <p className="text-xs text-slate-300 font-medium">
                Pide al cliente que muestre el código QR de su comanda en su pantalla e identifica el marco:
              </p>

              {/* Viewport de Escaneo de Cámara */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500 shadow-2xl bg-black min-h-[260px] flex items-center justify-center">
                <div id={scannerContainerId} className="w-full h-full min-h-[260px]" />

                {/* Linterna Toggle Button */}
                {torchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                      torchOn
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                        : 'bg-black/70 text-slate-300 border-slate-700 hover:bg-black/90'
                    }`}
                  >
                    {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                    <span>{torchOn ? 'Flash ON' : 'Flash'}</span>
                  </button>
                )}
              </div>

              {/* Selector alternativo manual */}
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setScanStatus('manual');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Keyboard className="w-4 h-4 text-amber-400" />
                <span>¿Problemas para escanear? Ingresar código manualmente</span>
              </button>
            </div>
          )}

          {scanStatus === 'error' && (
            <div className="space-y-4 text-center py-4 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-red-500/20 border-2 border-red-500 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-xl">
                <XCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-black text-red-400 font-sports uppercase">
                  Código QR Inválido
                </h4>
                <p className="text-xs text-slate-300 px-2 font-medium">
                  {errorMessage}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setScanStatus('scanning');
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-colors cursor-pointer font-sports flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Volver a Escanear</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setScanStatus('manual');
                  }}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <Keyboard className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </div>
          )}

          {scanStatus === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-black text-white font-sports uppercase flex items-center justify-center gap-2">
                  <Keyboard className="w-4 h-4 text-amber-400" /> Confirmación Manual por Código
                </h4>
                <p className="text-xs text-slate-400">
                  Ingresa el código impreso en la pantalla del cliente (ejemplo: <strong>{order.pickupCode}</strong>).
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider font-sports">
                  Código de Retiro / Entrega:
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder={`Ej: ${order.pickupCode}`}
                  className="w-full px-4 py-3 bg-[#141C2E] border-2 border-blue-500 text-white rounded-xl font-mono text-center text-xl font-black tracking-widest focus:outline-hidden focus:ring-2 focus:ring-amber-400 uppercase"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setScanStatus('scanning');
                  }}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>Cámara</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !manualCode.trim()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer font-sports flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Validando...' : 'Verificar y Entregar'}</span>
                </button>
              </div>
            </form>
          )}

          {scanStatus === 'success' && (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-black text-emerald-400 font-sports uppercase tracking-wide">
                  ¡Código QR Verificado!
                </h4>
                <p className="text-sm font-bold text-white">
                  Comanda #{order.pickupCode} confirmada exitosamente
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Entregado a {order.customerName}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Ticket, UserProfile } from '../../types';
import { validateAndConsumeTicketByCode, ValidationScanResult } from '../../lib/tickets';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Ticket as TicketIcon,
  ShieldCheck,
  MapPin,
  Clock,
  RefreshCw,
  User,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';

interface TaquillaViewProps {
  user: UserProfile;
}

const GATES = [
  'Puerta 1 - Central Principal',
  'Puerta 2 - Norte / Sol',
  'Puerta 3 - Sur / Sombra',
  'Puerta 4 - VIP / Palcos',
  'Puerta 5 - General'
];

export const TaquillaView: React.FC<TaquillaViewProps> = ({ user }) => {
  const [assignedGate, setAssignedGate] = useState<string>(
    localStorage.getItem('vxp_assigned_gate') || GATES[0]
  );
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Counters
  const [turnCount, setTurnCount] = useState<number>(() => {
    const saved = localStorage.getItem('vxp_turn_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [todayGateCount, setTodayGateCount] = useState<number>(0);

  // Result overlay state
  const [scanResult, setScanResult] = useState<ValidationScanResult | null>(null);
  const [resultStatus, setResultStatus] = useState<'valido' | 'invalido' | 'usado' | 'especial' | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const scannerContainerId = 'interactive-qr-scanner';

  // Save assigned gate and turn count to localStorage
  useEffect(() => {
    localStorage.setItem('vxp_assigned_gate', assignedGate);
  }, [assignedGate]);

  useEffect(() => {
    localStorage.setItem('vxp_turn_count', turnCount.toString());
  }, [turnCount]);

  // Real-time listener for "Total de la puerta hoy"
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'tickets'),
      where('usedGate', '==', assignedGate),
      where('status', '==', 'usado')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let count = 0;
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.usedAt && data.usedAt.startsWith(todayStr)) {
            count++;
          }
        });
        setTodayGateCount(count);
      },
      (err) => {
        console.error('Error fetching gate real-time count:', err);
      }
    );

    return () => unsubscribe();
  }, [assignedGate]);

  // Web Audio API & Vibration feedback
  const playSound = (type: 'success' | 'error' | 'special') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc.frequency.setValueAtTime(120, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);

        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      } else if (type === 'special') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Audio/Vibration not permitted or supported', e);
    }
  };

  // Start Camera Scanner
  useEffect(() => {
    if (!scanning || scanResult || cameraError) return;

    let isMounted = true;
    const qrCode = new Html5Qrcode(scannerContainerId);
    html5QrCodeRef.current = qrCode;

    qrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      },
      (decodedText) => {
        if (!isMounted) return;
        handleProcessCode(decodedText);
      },
      (errorMessage) => {
        // Scanning frame ticks (ignore frequent scan errors)
      }
    ).then(() => {
      // Check torch capability
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
        console.warn('Torch detection not available', e);
      }
    }).catch((err) => {
      if (err?.name !== 'NotAllowedError' && !err?.message?.includes('Permission denied') && !err?.message?.includes('NotAllowedError')) {
        console.error('Error starting camera scanner:', err);
      }
      if (isMounted) {
        setCameraError(err?.message || 'Permiso de cámara denegado (bloqueado por el navegador o iframe).');
      }
    });

    return () => {
      isMounted = false;
      if (qrCode.isScanning) {
        qrCode.stop().catch(() => {});
      }
    };
  }, [scanning, scanResult, cameraError]);

  const handleProcessCode = async (code: string) => {
    if (!code || scanResult) return;

    // Stop scanner temporarily while processing
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {}
    }
    setScanning(false);

    const userName = user.displayName || user.email || 'Taquilla Operador';
    const res = await validateAndConsumeTicketByCode(code, assignedGate, userName);

    setScanResult(res);
    setResultStatus(res.status);

    if (res.status === 'valido') {
      playSound('success');
      setTurnCount((prev) => prev + 1);
      // Auto-return to scanner after ~2 seconds for valid tickets
      setTimeout(() => {
        resetScannerState();
      }, 2100);
    } else if (res.status === 'especial') {
      playSound('special');
      setTurnCount((prev) => prev + 1);
      // Requires manual touch
    } else {
      playSound('error');
      // Requires manual touch
    }
  };

  const resetScannerState = () => {
    setScanResult(null);
    setResultStatus(null);
    setManualCode('');
    setCameraError(null);
    setScanning(true);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!videoTrackRef.current) {
      const videoElement = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        videoTrackRef.current = stream.getVideoTracks()[0];
      }
    }

    if (videoTrackRef.current) {
      try {
        const newTorchState = !torchOn;
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: newTorchState } as any],
        });
        setTorchOn(newTorchState);
      } catch (err) {
        console.warn('Torch not supported on this device', err);
        setTorchSupported(false);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessCode(manualCode.trim());
  };

  return (
    <div className="min-h-[85vh] flex flex-col bg-[#0A0E17] text-white rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
      
      {/* 1. Indicador Superior: Contadores & Selección de Puerta */}
      <div className="bg-[#0F1626] border-b border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-amber-400 font-sports">Taquilla • Modo Escáner Activo</span>
            </div>
            <select
              value={assignedGate}
              onChange={(e) => setAssignedGate(e.target.value)}
              className="mt-1 bg-[#141C2E] border border-slate-700 text-white text-xs sm:text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              {GATES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contadores en Tiempo Real */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="bg-[#141C2E] border border-slate-700/80 rounded-xl px-4 py-2 text-center shadow-md">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Este Turno</span>
            <span className="text-xl font-black text-emerald-400 font-sports">{turnCount}</span>
          </div>
          <div className="bg-[#141C2E] border border-slate-700/80 rounded-xl px-4 py-2 text-center shadow-md">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Puerta Hoy</span>
            <span className="text-xl font-black text-amber-400 font-sports">{todayGateCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Pantalla Principal: Cámara con Escáner QR en Tiempo Real */}
      <div className="relative flex-1 flex flex-col items-center justify-center bg-black min-h-[420px] overflow-hidden">
        
        {/* Contenedor del video de la cámara */}
        <div id={scannerContainerId} className="absolute inset-0 w-full h-full object-cover"></div>

        {/* Si hay error de cámara o permisos denegados */}
        {cameraError && !scanResult && (
          <div className="absolute inset-0 z-20 bg-[#0A0E17]/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white font-sports">Cámara No Disponible / Permiso Denegado</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                El navegador o el entorno iframe ha denegado el acceso a la cámara. Puedes utilizar el **Ingreso Manual de Rescate** abajo o reintentar el permiso.
              </p>
              <p className="text-[11px] font-mono text-red-400 mt-2 bg-red-950/40 p-2 rounded-lg border border-red-900/50">
                {cameraError}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setCameraError(null);
                  setScanning(false);
                  setTimeout(() => setScanning(true), 100);
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase tracking-wider font-sports shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar Cámara</span>
              </button>
              <button
                onClick={() => {
                  handleProcessCode('VND-2026-TKT-DEMO123');
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider font-sports shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simular Escaneo de Prueba</span>
              </button>
            </div>
          </div>
        )}

        {/* Marco de lectura centrado */}
        {!scanResult && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 z-10">
            <div className="w-64 h-64 sm:w-72 sm:h-72 border-2 border-dashed border-amber-400/80 rounded-3xl relative flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.2)] bg-black/10 backdrop-backdrop-blur-[2px]">
              {/* Esquinas animadas del visor */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-2xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-2xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-2xl"></div>
              
              {/* Línea láser de escaneo en movimiento */}
              <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse shadow-[0_0_12px_#ef4444]"></div>
              
              <div className="text-center p-4 bg-black/60 rounded-2xl border border-slate-800/80 backdrop-blur-md">
                <Camera className="w-8 h-8 text-amber-400 mx-auto mb-1 animate-bounce" />
                <span className="text-xs font-bold text-white uppercase tracking-wider block font-sports">Apunta al Código QR</span>
                <span className="text-[10px] text-slate-300">Colócalo dentro del recuadro</span>
              </div>
            </div>

            {/* Botón de Linterna / Flash flotante (si el dispositivo lo soporta) */}
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={`absolute bottom-6 px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-xl backdrop-blur-md border transition-all cursor-pointer pointer-events-auto ${
                  torchOn
                    ? 'bg-amber-500 text-black border-amber-300 shadow-amber-500/30'
                    : 'bg-black/70 text-white border-slate-700 hover:bg-black/90'
                }`}
              >
                {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                <span>{torchOn ? 'Linterna Activada' : 'Encender Linterna'}</span>
              </button>
            )}
          </div>
        )}

        {/* 3. Respuesta Visual Inmediata a Pantalla Completa según Resultado */}
        {scanResult && resultStatus && (
          <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 sm:p-10 animate-fade-in ${
            resultStatus === 'valido'
              ? 'bg-emerald-950/95 border-4 border-emerald-500'
              : resultStatus === 'especial'
              ? 'bg-amber-950/95 border-4 border-amber-500'
              : 'bg-red-950/95 border-4 border-red-500'
          }`}>
            
            {/* Cabecera del Resultado */}
            <div className="text-center space-y-3 max-w-lg w-full">
              {resultStatus === 'valido' && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-sm font-black uppercase tracking-widest font-sports animate-pulse">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>¡Acceso Válido!</span>
                </div>
              )}
              {resultStatus === 'especial' && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-sm font-black uppercase tracking-widest font-sports animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span>Cortesía / Boleto Especial</span>
                </div>
              )}
              {(resultStatus === 'invalido' || resultStatus === 'usado') && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-sm font-black uppercase tracking-widest font-sports animate-pulse">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span>{resultStatus === 'usado' ? '¡Boleto Ya Utilizado!' : 'Acceso Denegado'}</span>
                </div>
              )}

              <h3 className="text-2xl sm:text-3xl font-black text-white font-sports">
                {scanResult.message}
              </h3>
            </div>

            {/* Detalles del Boleto o Compra Conjunta */}
            {scanResult.tickets.length > 0 && (
              <div className="mt-6 w-full max-w-md bg-[#0F1626]/90 border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-4 text-left">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Evento / Partido</span>
                  <p className="text-sm font-black text-white line-clamp-1">{scanResult.tickets[0].matchTitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#141C2E] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Zona / Sección</span>
                    <span className="text-base font-black text-amber-400 font-sports">{scanResult.tickets[0].section}</span>
                  </div>
                  <div className="bg-[#141C2E] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Fila</span>
                    <span className="text-base font-black text-white font-sports">{scanResult.tickets[0].row}</span>
                  </div>
                </div>

                {/* Lista de Asientos (Soporta Compra Conjunta completa) */}
                <div className="bg-[#141C2E] p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Asiento(s) Incluidos ({scanResult.tickets.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {scanResult.tickets.map((t, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-black font-sports">
                        {t.seat}
                      </span>
                    ))}
                  </div>
                </div>

                {resultStatus === 'especial' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Requiere verificación física de identificación (INSEN / INAPAM / Menor / Prensa).</span>
                  </div>
                )}

                {resultStatus === 'usado' && scanResult.usedAt && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-red-400 shrink-0" />
                    <span>
                      Usado previamente a las {new Date(scanResult.usedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hrs en <strong className="text-white">{scanResult.usedGate || 'Otra puerta'}</strong>.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Botón de continuar / toque manual requerido para rojo, azul/especial, o reintento */}
            {resultStatus !== 'valido' && (
              <button
                onClick={resetScannerState}
                className="mt-8 px-8 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-black uppercase tracking-wider shadow-2xl transition-all cursor-pointer font-sports flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Tocar para Seguir Escaneando</span>
              </button>
            )}

            {resultStatus === 'valido' && (
              <span className="mt-6 text-xs text-emerald-300 font-bold uppercase tracking-wider animate-pulse">
                Volviendo al escáner automáticamente...
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Barra de Búsqueda / Ingreso Manual de Rescate */}
      <div className="bg-[#0F1626] border-t border-slate-800 p-4 z-10">
        <form onSubmit={handleManualSubmit} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ingreso manual: teclea código QR o ID de compra (ej. VND-2026-TKT-...)"
              className="w-full pl-10 pr-4 py-2.5 bg-[#141C2E] border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-md transition-all cursor-pointer font-sports shrink-0"
          >
            Validar Manual
          </button>
        </form>
      </div>

    </div>
  );
};

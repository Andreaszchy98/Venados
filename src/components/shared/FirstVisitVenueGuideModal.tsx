import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, MapPin, X, ArrowRight, ShieldCheck, Check, Lock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { UserRole } from '../../types';

interface FirstVisitVenueGuideModalProps {
  onOpenSettings?: () => void;
  userRole?: UserRole;
}

const STORAGE_KEY = 'vxp_venue_guide_dismissed_v1';

export const FirstVisitVenueGuideModal: React.FC<FirstVisitVenueGuideModalProps> = ({ onOpenSettings, userRole }) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  const isAficionadoOrGuest = !userRole || userRole === 'aficionado';

  useEffect(() => {
    // Si el usuario es un operativo de negocio (no aficionado), no mostrar la guía de cambio de sede
    if (!isAficionadoOrGuest) {
      return;
    }

    // Verificar si el usuario ya vio la guía anteriormente
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        // Retardo suave para permitir que la app cargue fluidamente antes de mostrar la guía
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignorar en entornos sin localStorage
    }
  }, [isAficionadoOrGuest]);

  // Escuchar evento personalizado para poder reabrir la guía desde cualquier lugar (Ajustes o Ayuda)
  useEffect(() => {
    const handleOpenGuide = () => {
      setIsOpen(true);
    };
    window.addEventListener('vxp_open_venue_guide', handleOpenGuide);
    return () => {
      window.removeEventListener('vxp_open_venue_guide', handleOpenGuide);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {}
    }
  };

  const handleOpenSettingsNow = () => {
    handleClose();
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      window.dispatchEvent(new CustomEvent('vxp_open_settings'));
    }
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop con desenfoque de fondo */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Tarjeta del Pop-up Modal */}
      <div
        className={`relative w-full max-w-lg mx-auto rounded-3xl border shadow-2xl overflow-hidden z-10 transition-all duration-300 transform scale-100 flex flex-col max-h-[92vh] ${
          isLight
            ? 'bg-white text-slate-900 border-slate-200 shadow-slate-900/30'
            : 'bg-[#0E1526] text-white border-slate-700/80 shadow-black/80'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="venue-guide-title"
      >
        {/* Cabecera con Botón de Cierre */}
        <div
          className={`p-3.5 sm:p-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121B30] border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-red-900/30 shrink-0">
              <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 font-sports block leading-none">
                Guía de Inicio Rápido
              </span>
              <h3 id="venue-guide-title" className={`text-sm sm:text-base font-black uppercase tracking-tight font-sports leading-tight mt-0.5 ${
                isLight ? 'text-slate-950' : 'text-white'
              }`}>
                Selección de Estadio & Sede
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
            }`}
            aria-label="Cerrar ventana emergente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con Adaptabilidad Completa a Temas */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 text-xs sm:text-sm">
          {/* Tarjeta Visual: Representación del Icono de Ajustes y Lista de Sedes */}
          <div
            className={`rounded-2xl border p-3 sm:p-4 flex flex-col items-center gap-3 transition-colors ${
              isLight
                ? 'bg-slate-50/90 border-slate-200 shadow-inner'
                : 'bg-[#080D18] border-slate-800/80 shadow-inner'
            }`}
          >
            {/* 1. Icono Destacado: El botón de Ajustes */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                  isLight
                    ? 'bg-white border-red-500/30 text-red-600 shadow-red-500/10'
                    : 'bg-[#121A2D] border-red-500/40 text-red-500 shadow-black/50'
                }`}
              >
                <SlidersHorizontal className="w-8 h-8 sm:w-9 sm:h-9" />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider font-sports px-2 py-0.5 rounded-full border ${
                isLight
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-red-950/60 text-red-400 border-red-500/30'
              }`}>
                Icono de Ajustes & Sede
              </span>
            </div>

            {/* 2. Lista de las 4 Sedes Oficiales con contraste perfecto */}
            <div
              className={`w-full max-w-md rounded-2xl p-2.5 sm:p-3 border transition-colors ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
                  : 'bg-[#101728] border-slate-700/80 text-white'
              }`}
            >
              <div className={`flex items-center justify-between pb-2 mb-2 border-b text-[11px] font-black uppercase tracking-wider font-sports ${
                isLight ? 'border-slate-200 text-slate-800' : 'border-slate-700/60 text-slate-200'
              }`}>
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  Sedes Deportivas y Equipos Oficiales:
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                }`}>
                  4 Estadios
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* 1. ESTADIO TEODORO MARISCAL - VENADOS DE MAZATLÁN (EQUIPO OFICIAL) */}
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    isLight
                      ? 'bg-red-50/70 border-red-300 text-slate-900 ring-1 ring-red-400/30'
                      : 'bg-red-950/30 border-red-500/40 text-white ring-1 ring-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none shrink-0">🏟️</span>
                    <div className="min-w-0">
                      <div className="font-extrabold truncate text-xs sm:text-sm">
                        Estadio Teodoro Mariscal
                      </div>
                      <div className={`text-[10px] font-semibold ${
                        isLight ? 'text-slate-600' : 'text-slate-300'
                      }`}>
                        Mazatlán, Sinaloa
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-xs font-sports">
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      Venados de Mazatlán
                    </span>
                    <span className={`block text-[9px] font-black uppercase tracking-widest mt-0.5 ${
                      isLight ? 'text-red-700 font-bold' : 'text-amber-400'
                    }`}>
                      Equipo Oficial
                    </span>
                  </div>
                </div>

                {/* 2. ESTADIO CHARROS DE JALISCO */}
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    isLight
                      ? 'bg-slate-50/80 border-slate-200 text-slate-800'
                      : 'bg-[#151E33] border-slate-700/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none shrink-0">⚾</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate text-xs">
                        Estadio Panamericano Charros
                      </div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Zapopan, Jalisco
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border font-sports shrink-0 ${
                    isLight
                      ? 'bg-white text-blue-700 border-blue-200'
                      : 'bg-blue-950/40 text-blue-300 border-blue-800/40'
                  }`}>
                    Charros de Jalisco
                  </span>
                </div>

                {/* 3. ESTADIO ENCANTO */}
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    isLight
                      ? 'bg-slate-50/80 border-slate-200 text-slate-800'
                      : 'bg-[#151E33] border-slate-700/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none shrink-0">⚽</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate text-xs">
                        Estadio El Encanto
                      </div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Mazatlán, Sinaloa
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border font-sports shrink-0 ${
                    isLight
                      ? 'bg-white text-amber-700 border-amber-200'
                      : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                  }`}>
                    Dorados de Sinaloa
                  </span>
                </div>

                {/* 4. ESTADIO TOMATEROS */}
                <div
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    isLight
                      ? 'bg-slate-50/80 border-slate-200 text-slate-800'
                      : 'bg-[#151E33] border-slate-700/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none shrink-0">⚾</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate text-xs">
                        Estadio Tomateros
                      </div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Culiacán, Sinaloa
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border font-sports shrink-0 ${
                    isLight
                      ? 'bg-white text-emerald-800 border-emerald-200'
                      : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                  }`}>
                    Tomateros de Culiacán
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Texto de Instrucciones adaptado dinámicamente al tema */}
          <div
            className={`p-3.5 sm:p-4 rounded-2xl border space-y-2 leading-relaxed transition-colors ${
              isLight
                ? 'bg-amber-50/90 border-amber-200/90 text-slate-900 shadow-xs'
                : 'bg-amber-950/20 border-amber-500/30 text-slate-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none select-none shrink-0">💡</span>
              <div className="space-y-1.5 text-xs sm:text-[13px]">
                <p className={`font-black uppercase tracking-tight font-sports ${
                  isLight ? 'text-red-700' : 'text-red-400'
                }`}>
                  ¿Cómo seleccionar tu estadio o comprar boletos?
                </p>
                <p className={isLight ? 'text-slate-800' : 'text-slate-200'}>
                  Para seleccionar de qué estadio deseas ver tus eventos, oprime el icono{' '}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-black shadow-2xs border ${
                    isLight
                      ? 'bg-white border-red-300 text-red-600'
                      : 'bg-[#151D2F] border-red-500/40 text-red-400'
                  }`}>
                    <SlidersHorizontal className="w-3 h-3 inline" /> Ajustes & Sede
                  </span>{' '}
                  situado en la barra superior junto al botón de inicio de sesión.
                </p>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Se desplegará el menú donde podrás seleccionar de qué sede comprar tus boletos, consultar cartelera y pedir alimentos, además de personalizar el Modo Claro u Oscuro.
                </p>
              </div>
            </div>
          </div>

          {/* Opción para no volver a mostrar al iniciar */}
          <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-400 text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
            />
            <span className={`text-[11px] sm:text-xs font-semibold ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              No volver a mostrar este aviso automáticamente al iniciar
            </span>
          </label>
        </div>

        {/* Botones de Acción en el Pie del Modal */}
        <div
          className={`p-3.5 sm:p-4 border-t flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121B30] border-slate-800'
          }`}
        >
          <button
            type="button"
            onClick={handleClose}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isAficionadoOrGuest ? 'Entendido, Explorar' : 'Cerrar Guía'}
          </button>

          {isAficionadoOrGuest && (
            <button
              type="button"
              onClick={handleOpenSettingsNow}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-950/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 font-sports"
            >
              <span>Elegir Sede Ahora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

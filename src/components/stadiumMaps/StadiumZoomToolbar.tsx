import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info, Move, Crosshair } from 'lucide-react';
import { StadiumRegionPreset } from './useStadiumPanZoom';
import { useTheme } from '../../context/ThemeContext';

export interface StadiumZoomToolbarProps {
  scale: number;
  presets: StadiumRegionPreset[];
  activeRegionId: string;
  onSelectPreset: (preset: StadiumRegionPreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  showZoneGuide?: boolean;
  onToggleZoneGuide?: () => void;
  hintText?: string;
  className?: string;
}

export const StadiumZoomToolbar: React.FC<StadiumZoomToolbarProps> = ({
  scale,
  presets,
  activeRegionId,
  onSelectPreset,
  onZoomIn,
  onZoomOut,
  onReset,
  showZoneGuide,
  onToggleZoneGuide,
  hintText,
  className = '',
}) => {
  const { theme } = useTheme();
  const percent = Math.round(scale * 100);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Barra de Controles y Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Selector rápido de sectores / áreas del estadio */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar max-w-full">
          <span className={`text-[11px] font-bold flex items-center gap-1 shrink-0 px-1 ${
            theme === 'light' ? 'text-slate-600' : 'text-slate-400'
          }`}>
            <Crosshair className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Enfocar área:</span>
          </span>
          {presets.map((preset) => {
            const isActive = activeRegionId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-2 ring-amber-400/60'
                    : theme === 'light'
                    ? 'bg-white text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-300 shadow-xs'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
                }`}
                title={`Enfocar en ${preset.label}`}
              >
                <span>{preset.icon || '📍'}</span>
                <span>{preset.shortLabel || preset.label}</span>
              </button>
            );
          })}
        </div>

        {/* Botones de control de Zoom (+, -, Reset, Info) adaptados a tema claro y oscuro */}
        <div className={`flex items-center gap-1 rounded-xl p-1 shadow-xs shrink-0 ml-auto border ${
          theme === 'light'
            ? 'bg-white border-slate-300 text-slate-700'
            : 'bg-slate-900/95 border-slate-700/80 text-slate-300'
        }`}>
          <button
            type="button"
            onClick={onZoomOut}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Alejar (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          
          <span className={`text-[10px] font-mono font-black px-1.5 select-none min-w-[38px] text-center ${
            theme === 'light' ? 'text-slate-800' : 'text-slate-300'
          }`}>
            {percent}%
          </span>

          <button
            type="button"
            onClick={onZoomIn}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Acercar (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onReset}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer border-l ml-0.5 pl-1.5 ${
              theme === 'light'
                ? 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Restablecer mapa completo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {onToggleZoneGuide && (
            <button
              type="button"
              onClick={onToggleZoneGuide}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showZoneGuide
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Guía de colores y precios"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mini guía interactiva sobre el mapa */}
      <div className="flex items-center justify-between text-[11px] px-1">
        <span className={`flex items-center gap-1.5 font-medium ${
          theme === 'light' ? 'text-slate-600' : 'text-slate-400'
        }`}>
          <Move className={`w-3 h-3 shrink-0 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`} />
          <span>Arrastra para moverte • Rueda o doble clic en cualquier zona para zoom focal</span>
        </span>
        {hintText && (
          <span className={`font-bold hidden md:inline ${
            theme === 'light' ? 'text-amber-700' : 'text-amber-400/90'
          }`}>
            {hintText}
          </span>
        )}
      </div>
    </div>
  );
};

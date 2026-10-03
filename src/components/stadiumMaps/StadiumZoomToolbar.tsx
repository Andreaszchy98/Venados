import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info, Move, Crosshair } from 'lucide-react';
import { StadiumRegionPreset } from './useStadiumPanZoom';

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
  const percent = Math.round(scale * 100);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Barra de Controles y Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Selector rápido de sectores / áreas del estadio */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar max-w-full">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 px-1">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Enfocar área:</span>
          </span>
          {presets.map((preset) => {
            const isActive = activeRegionId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-1 ring-amber-400/50'
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

        {/* Botones de control de Zoom (+, -, Reset, Info) */}
        <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-xl p-1 shadow-sm shrink-0 ml-auto">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Alejar (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          
          <span className="text-[10px] font-mono font-bold text-slate-400 px-1 select-none min-w-[36px] text-center">
            {percent}%
          </span>

          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Acercar (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onReset}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border-l border-slate-700/60 ml-0.5 pl-1.5"
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
                  ? 'bg-amber-500 text-slate-950 font-bold'
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
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Move className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Arrastra para moverte • Rueda o doble clic en cualquier zona para zoom focal</span>
        </span>
        {hintText && <span className="text-amber-400/90 font-medium hidden md:inline">{hintText}</span>}
      </div>
    </div>
  );
};

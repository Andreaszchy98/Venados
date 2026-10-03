import React, { useState, useMemo, useCallback } from 'react';
import { SeatSection, VenueEvent } from '../../types';
import { TOMATEROS_ZONES, TOMATEROS_SVG_ZONE_MAP, getZonePrice } from '../../lib/seatMap';
import { useStadiumPanZoom, StadiumRegionPreset } from './useStadiumPanZoom';
import { StadiumZoomToolbar } from './StadiumZoomToolbar';
import { Info, Move, Sparkles } from 'lucide-react';

const TOMATEROS_PRESETS: StadiumRegionPreset[] = [
  { id: 'all', label: 'Todo el Estadio', shortLabel: 'Estadio', icon: '🏟️', normX: 0.5, normY: 0.5, scale: 1 },
  { id: 'home', label: 'Home Plate / Platino / Deluxe', shortLabel: 'Home / Platino', icon: '⚾', normX: 0.50, normY: 0.76, scale: 2.1 },
  { id: 'first_base', label: 'Lateral 1ra Base / Plateas Der', shortLabel: '1ra Base', icon: '1️⃣', normX: 0.76, normY: 0.58, scale: 2.0 },
  { id: 'third_base', label: 'Lateral 3ra Base / Plateas Izq', shortLabel: '3ra Base', icon: '3️⃣', normX: 0.24, normY: 0.58, scale: 2.0 },
  { id: 'outfield', label: 'Jardines & Bleachers', shortLabel: 'Jardines', icon: '🌳', normX: 0.50, normY: 0.22, scale: 1.9 },
  { id: 'upper', label: 'Nivel 2 / Palcos', shortLabel: 'Nivel Superior', icon: '🏢', normX: 0.50, normY: 0.88, scale: 1.85 },
];

export interface TomaterosStadiumMapProps {
  sections?: SeatSection[];
  activeSectionNumber?: string;
  activeZoneFilter?: string | null;
  onSelectSection: (sectionNumber: string, zoneName?: string) => void;
  event?: VenueEvent | null;
  soldOutSectionsSet?: Set<string>;
  highlightOnlyActiveSection?: boolean;
}

export const TomaterosStadiumMap: React.FC<TomaterosStadiumMapProps> = ({
  sections = [],
  activeSectionNumber = '',
  activeZoneFilter = null,
  onSelectSection,
  event = null,
  soldOutSectionsSet,
  highlightOnlyActiveSection = false,
}) => {
  const [hoveredInfo, setHoveredInfo] = useState<{ id: string; zone: string } | null>(null);
  const [showZoneGuide, setShowZoneGuide] = useState<boolean>(false);

  const {
    scale,
    isDragging,
    hasMovedRef,
    containerRef,
    activeRegionId,
    zoomToRegion,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    transformStyle,
  } = useStadiumPanZoom({ minScale: 0.75, maxScale: 3.8 });

  // Manejador por delegación de eventos para los 54 polígonos
  const handleBloquesClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (hasMovedRef.current) return;
      const polygon = (e.target as Element).closest('polygon.blk');
      if (!polygon) return;
      const secId = polygon.id;
      const zoneKey = polygon.getAttribute('data-zone') || '';
      const zoneName = TOMATEROS_SVG_ZONE_MAP[zoneKey] || zoneKey;
      const zoneMeta = TOMATEROS_ZONES[zoneName];

      const hasAssignedPrice = event && event.priceTiers && event.priceTiers.length > 0
        ? event.priceTiers.some((t) => t.section.trim().toLowerCase() === (zoneMeta?.name || zoneName).trim().toLowerCase() && t.price > 0)
        : (zoneMeta && zoneMeta.defaultPrice > 0);

      if (!hasAssignedPrice) {
        return;
      }

      if (secId) {
        onSelectSection(secId, zoneMeta ? zoneMeta.name : zoneName);
      }
    },
    [event, onSelectSection, hasMovedRef]
  );

  const handleBloquesMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setHoveredInfo(null);
      return;
    }
    const polygon = (e.target as Element).closest('polygon.blk');
    if (!polygon) {
      setHoveredInfo(null);
      return;
    }
    const id = polygon.id;
    const zone = polygon.getAttribute('data-zone') || '';
    setHoveredInfo({ id, zone });
  }, [isDragging]);

  const handleBloquesMouseLeave = useCallback(() => {
    setHoveredInfo(null);
  }, []);

  // Metadatos de la sección o zona activa
  const activeZoneMeta = useMemo(() => {
    if (!activeSectionNumber) return null;
    const directMeta = Object.values(TOMATEROS_ZONES).find(
      (z) => z.name.toLowerCase() === activeSectionNumber.toLowerCase()
    );
    if (directMeta) return directMeta;

    // Buscar si es un ID de bloque (ej. "suite-1", "num_home-2")
    const prefix = activeSectionNumber.split('-')[0];
    const zoneName = TOMATEROS_SVG_ZONE_MAP[prefix];
    if (zoneName && TOMATEROS_ZONES[zoneName]) {
      return TOMATEROS_ZONES[zoneName];
    }
    return null;
  }, [activeSectionNumber]);

  return (
    <div className="space-y-2.5">
      {/* Estilos dinámicos para fondo blanco y alta definición */}
      <style>{`
        .blk {
          cursor: pointer;
          transition: fill 0.18s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.12));
        }
        .blk:hover {
          filter: brightness(1.15) drop-shadow(0 3px 8px rgba(0, 0, 0, 0.35)) !important;
          stroke: #0f172a !important;
          stroke-width: 1.8px !important;
        }
        ${hoveredInfo?.id ? `
          #${hoveredInfo.id} {
            stroke: #0f172a !important;
            stroke-width: 2px !important;
            filter: brightness(1.15) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35)) !important;
          }
        ` : ''}
        ${activeSectionNumber ? `
          #${activeSectionNumber}, [data-zone="${activeSectionNumber}"] {
            stroke: #d97706 !important;
            stroke-width: 2.8px !important;
            filter: drop-shadow(0 0 8px rgba(217, 119, 6, 0.85)) !important;
          }
        ` : ''}
      `}</style>

      {/* Indicador de sección y zona activa */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {activeSectionNumber ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-black text-amber-500 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sección: {activeSectionNumber}
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-400">
              Toca cualquier sección para ver butacas
            </span>
          )}

          {activeZoneMeta && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${activeZoneMeta.badgeBg}`}>
              {activeZoneMeta.name} • ${getZonePrice(activeZoneMeta.name, event)} MXN
            </span>
          )}
        </div>
      </div>

      {/* Barra de herramientas con selector de áreas y zoom focal */}
      <StadiumZoomToolbar
        scale={scale}
        presets={TOMATEROS_PRESETS}
        activeRegionId={activeRegionId}
        onSelectPreset={(preset) => zoomToRegion(preset.normX, preset.normY, preset.scale, preset.id)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleResetZoom}
        showZoneGuide={showZoneGuide}
        onToggleZoneGuide={() => setShowZoneGuide(!showZoneGuide)}
        hintText="Estadio Tomateros de Culiacán"
      />

      {/* Contenedor interactivo del SVG con Pan & Zoom focal */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className={`relative w-full rounded-2xl bg-white p-2 sm:p-4 border border-slate-200 shadow-xl overflow-hidden select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title="Arrastra para mover • Rueda o doble clic en cualquier zona para hacer zoom"
      >
        {/* Banner flotante con información al pasar el cursor */}
        {hoveredInfo && !isDragging && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none px-3 py-2 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md text-xs animate-in fade-in zoom-in-95 duration-100">
            <div className="font-black text-amber-400">
              {hoveredInfo.id}
            </div>
            <div className="text-slate-300 font-medium mt-0.5">
              {(() => {
                const zoneName = TOMATEROS_SVG_ZONE_MAP[hoveredInfo.zone] || hoveredInfo.zone;
                const zoneMeta = TOMATEROS_ZONES[zoneName];
                if (!zoneMeta || zoneMeta.defaultPrice === 0) {
                  return <span className="text-slate-400 italic">sin precio asignado</span>;
                }
                const price = getZonePrice(zoneMeta.name, event);
                return (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{zoneMeta.name}</span>
                    <span className="text-amber-400 font-black">${price} MXN</span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Mini pista visual en la esquina inferior */}
        <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-700/60 backdrop-blur-xs text-[10px] font-medium text-slate-300">
          Arrastra para mover • Zoom con rueda/pellizco
        </div>

        <div
          className="w-full flex items-center justify-center max-h-[750px] pointer-events-auto"
          style={transformStyle}
        >
          <svg
            viewBox="0 0 500 500"
            className="w-full h-auto max-w-[850px]"
            shapeRendering="geometricPrecision"
            textRendering="geometricPrecision"
            onClick={handleBloquesClick}
            onMouseMove={handleBloquesMouseMove}
            onMouseLeave={handleBloquesMouseLeave}
          >
            {/* Fondo blanco base del lienzo SVG */}
            <rect width="500" height="500" fill="#ffffff" rx="16" />

            {/* Terreno de juego */}
            <g id="campo" pointerEvents="none">
              <path
                id="campo-naranja"
                fill="#c77c38"
                fillRule="evenodd"
                d="M252.5,261.0 250.0,262.8 249.0,268.5 251.5,271.2 255.5,271.5 258.8,268.8 259.0,264.0 256.5,261.2ZM246.0,50.2 233.2,52.2 219.2,56.2 206.2,62.0 192.0,71.0 101.2,158.0 101.2,159.2 146.8,206.5 152.0,249.5 153.0,253.8 228.8,331.2 233.2,331.8 277.8,332.2 295.5,315.5 377.2,235.5 378.5,196.0 411.0,163.5 411.0,162.8 354.8,104.2 321.0,71.2 302.8,60.2 287.8,54.2 267.0,50.2ZM254.8,231.5 283.0,259.2 286.0,264.5 259.8,291.8 249.0,292.2 247.0,290.8 222.8,265.5 222.5,263.0ZM367.2,193.0 365.8,229.5 272.5,320.2 235.0,320.0 234.0,319.5 163.8,247.2 161.5,224.8 157.8,205.8 158.0,203.8 158.8,203.8 199.8,246.2 200.5,247.5 200.0,249.8 200.2,252.2 243.0,296.2 242.5,302.5 244.2,307.5 249.5,311.8 251.2,312.2 257.5,311.8 260.5,310.2 264.5,305.5 265.2,295.5 307.5,253.8 308.2,252.5 308.0,249.0 366.5,191.8ZM118.2,158.2 194.5,83.8 204.2,76.8 219.8,68.8 235.5,63.8 246.2,61.8 266.2,61.8 281.8,64.8 295.2,69.8 307.0,76.0 319.2,84.8 390.2,158.2 394.0,162.8 308.2,247.0 306.8,246.5 299.5,232.2 290.0,222.2 275.0,213.2 260.0,209.2 242.2,210.2 233.2,213.0 224.5,217.5 215.5,224.2 210.0,230.2 205.2,237.2 201.8,244.8 200.2,245.5 118.8,159.8Z"
              />
              <path
                id="campo-verde"
                fill="#1f5837"
                fillRule="evenodd"
                d="M255.2,232.2 254.2,232.2 223.0,263.2 223.2,265.5 249.0,291.8 259.0,291.5 260.0,291.0 285.5,264.5 283.2,260.2ZM252.5,260.5 256.8,260.8 259.5,264.0 259.0,269.5 255.5,272.0 251.2,271.8 248.5,268.5 249.2,263.2 250.0,262.0ZM366.5,192.8 362.2,196.2 308.5,249.2 308.5,253.2 266.0,295.2 265.5,296.5 265.0,305.5 260.2,311.0 257.5,312.2 253.2,313.0 250.8,312.8 248.2,311.5 243.8,307.5 242.0,303.0 242.2,296.0 199.5,252.0 199.5,246.8 163.5,209.2 158.2,204.5 162.0,224.0 164.2,247.0 234.5,319.2 272.5,319.8 365.2,229.2ZM118.8,158.2 119.0,159.2 200.2,244.8 201.5,244.2 204.8,237.2 210.2,229.2 215.8,223.5 224.8,216.8 232.5,212.8 242.0,209.8 260.5,208.8 275.2,212.8 290.0,221.8 299.8,231.8 307.2,246.2 308.0,246.5 393.5,162.8 387.5,156.0 318.8,85.0 306.5,76.2 295.2,70.2 281.5,65.2 266.0,62.2 246.5,62.2 235.5,64.2 219.8,69.2 204.2,77.2 194.2,84.5Z"
              />
            </g>

            {/* 54 bloques oficiales */}
            <g id="bloques" stroke="#ffffff" strokeWidth={0.8} strokeLinejoin="round">
              <polygon id="jardin-1" className="blk" data-zone="jardin" fill="#626a79" points="81.0,110.2 68.5,123.0 68.5,124.0 85.2,141.2 86.5,141.2 99.0,129.0 99.0,128.0 81.5,110.2"/>
              <polygon id="jardin-2" className="blk" data-zone="jardin" fill="#626a79" points="99.0,93.2 86.2,106.5 103.2,124.2 104.2,124.2 116.5,112.0 116.5,111.0 100.5,94.2"/>
              <polygon id="jardin-3" className="blk" data-zone="jardin" fill="#626a79" points="116.0,76.5 104.0,88.5 104.0,89.8 119.2,105.8 121.5,107.5 134.0,95.0 134.0,94.0 117.0,76.5"/>
              <polygon id="jardin-4" className="blk" data-zone="jardin" fill="#626a79" points="134.0,59.2 121.8,70.8 121.2,72.0 134.0,85.5 138.5,89.8 139.5,90.0 152.0,78.0 152.0,77.2 136.5,61.2"/>
              <polygon id="jardin-5" className="blk" data-zone="jardin" fill="#626a79" points="151.8,42.0 139.0,54.2 139.0,55.2 156.2,73.2 157.0,73.2 168.5,62.5 170.0,60.2 152.5,42.0"/>
              <polygon id="jardin-6" className="blk" data-zone="jardin" fill="#626a79" points="169.0,25.0 156.8,37.2 156.8,38.0 168.8,50.8 174.0,55.8 175.2,55.8 187.5,43.2 170.0,25.0"/>
              <polygon id="jardin-7" className="blk" data-zone="jardin" fill="#626a79" points="187.0,8.0 174.8,20.2 174.8,21.0 191.8,38.8 192.8,38.8 205.2,26.8 205.2,25.5 188.0,8.0"/>
              <polygon id="jardin-8" className="blk" data-zone="jardin" fill="#626a79" points="328.2,11.0 327.5,11.0 310.0,28.5 310.0,29.2 322.5,42.0 323.2,42.0 340.5,25.2 340.5,24.0"/>
              <polygon id="jardin-9" className="blk" data-zone="jardin" fill="#626a79" points="345.8,29.0 344.8,29.0 327.2,46.2 328.5,48.8 339.5,60.0 340.2,60.0 357.8,42.5 357.5,41.5"/>
              <polygon id="jardin-10" className="blk" data-zone="jardin" fill="#626a79" points="362.8,46.5 361.8,46.5 344.5,64.0 344.5,64.8 356.5,77.5 357.2,77.5 375.2,59.8"/>
              <polygon id="jardin-11" className="blk" data-zone="jardin" fill="#626a79" points="380.0,64.2 378.8,64.2 361.5,81.5 361.5,82.2 373.2,95.2 374.8,95.0 391.8,78.0 391.8,76.8 390.5,75.0"/>
              <polygon id="jardin-12" className="blk" data-zone="jardin" fill="#626a79" points="397.2,82.0 396.2,82.0 378.5,99.2 378.8,100.2 391.0,112.8 392.2,112.5 409.2,95.5 409.2,94.8"/>
              <polygon id="jardin-13" className="blk" data-zone="jardin" fill="#626a79" points="414.5,100.0 413.0,100.2 396.0,117.0 396.2,118.8 408.0,130.5 408.8,130.5 426.2,113.5 426.2,112.8"/>
              <polygon id="jardin-14" className="blk" data-zone="jardin" fill="#626a79" points="431.2,117.2 430.2,117.5 413.0,135.0 424.5,148.2 425.5,148.2 442.8,131.2 442.8,129.8 441.8,128.0"/>
              <polygon id="suite-1" className="blk" data-zone="suite" fill="#2a457c" points="329.5,435.2 320.2,425.5 315.8,429.2 311.5,431.2 294.5,430.5 293.8,434.0 293.8,444.0 320.2,444.5 329.5,436.0"/>
              <polygon id="suite-2" className="blk" data-zone="suite" fill="#2a457c" points="217.2,422.8 217.5,443.0 263.2,443.5 286.2,444.2 286.5,424.2 286.0,423.5"/>
              <polygon id="suite-3" className="blk" data-zone="suite" fill="#2a457c" points="173.2,433.5 173.5,435.2 180.8,442.2 209.0,442.5 209.5,442.0 209.2,429.2 190.2,429.2 186.5,428.2 181.8,425.0"/>
              <polygon id="platea-1" className="blk" data-zone="platea" fill="#2a457c" points="448.0,302.8 447.0,302.8 434.2,314.8 434.5,315.8 443.0,324.5 444.2,324.2 456.5,312.5 456.5,311.8"/>
              <polygon id="platea-2" className="blk" data-zone="platea" fill="#2a457c" points="429.8,320.0 428.2,320.2 416.2,332.2 417.5,334.2 425.0,342.2 426.0,342.2 438.5,330.2 438.5,329.2"/>
              <polygon id="platea-3" className="blk" data-zone="platea" fill="#2a457c" points="411.2,337.2 407.5,340.2 398.0,349.8 407.2,359.8 420.2,348.0 420.2,346.8 419.2,345.2"/>
              <polygon id="platea-4" className="blk" data-zone="platea" fill="#2a457c" points="393.5,354.8 392.8,354.8 380.0,367.0 380.2,368.2 388.5,377.2 389.5,377.2 402.5,365.2 401.2,362.8"/>
              <polygon id="platea-5" className="blk" data-zone="platea" fill="#2a457c" points="375.5,372.5 361.8,385.0 361.8,386.0 370.2,394.8 371.2,394.8 384.2,382.5 383.2,380.5"/>
              <polygon id="platea-6" className="blk" data-zone="platea" fill="#2a457c" points="357.2,390.2 356.5,390.2 343.5,402.8 352.5,412.8 354.5,411.5 366.0,400.2"/>
              <polygon id="platea-7" className="blk" data-zone="platea" fill="#2a457c" points="339.0,408.0 337.2,408.5 325.2,420.5 325.2,421.2 334.0,430.2 334.8,430.2 347.8,418.0 347.5,416.8"/>
              <polygon id="platea-8" className="blk" data-zone="platea" fill="#2a457c" points="169.2,410.5 168.2,410.5 159.2,419.5 159.2,420.2 168.0,429.0 171.2,426.5 177.5,420.2 177.5,419.2"/>
              <polygon id="platea-9" className="blk" data-zone="platea" fill="#2a457c" points="154.2,396.5 145.5,405.2 145.5,406.2 154.2,414.5 155.2,414.5 163.5,405.0"/>
              <polygon id="platea-10" className="blk" data-zone="platea" fill="#2a457c" points="141.2,382.2 138.5,384.2 131.5,391.2 139.8,400.2 141.0,400.0 149.8,391.5"/>
              <polygon id="platea-11" className="blk" data-zone="platea" fill="#2a457c" points="127.5,368.0 126.2,368.5 117.8,376.8 117.8,377.5 126.5,386.5 127.2,386.5 135.8,377.5 135.8,376.8"/>
              <polygon id="platea-12" className="blk" data-zone="platea" fill="#2a457c" points="113.8,353.8 113.0,353.8 104.0,362.5 104.5,364.0 112.2,372.2 113.0,372.2 122.0,363.2 121.2,361.5"/>
              <polygon id="platea-13" className="blk" data-zone="platea" fill="#2a457c" points="99.8,339.5 90.2,348.5 90.2,349.5 98.5,358.2 108.2,349.5 108.2,348.5"/>
              <polygon id="platea-14" className="blk" data-zone="platea" fill="#2a457c" points="86.2,325.8 85.2,325.8 76.2,334.5 76.2,335.2 84.5,343.8 85.8,343.5 94.5,335.0"/>
              <polygon id="platea-15" className="blk" data-zone="platea" fill="#2a457c" points="72.0,311.0 71.2,311.0 62.0,320.2 62.0,321.0 70.8,330.0 71.5,330.0 80.8,321.0 80.5,319.5"/>
              <polygon id="platea-16" className="blk" data-zone="platea" fill="#2a457c" points="466.8,284.5 465.8,284.5 452.2,297.2 452.2,298.0 461.0,307.5 461.8,307.5 475.2,294.5 474.8,292.8"/>
              <polygon id="num_home-1" className="blk" data-zone="num_home" fill="#2a457c" points="271.2,361.2 270.8,361.8 270.5,384.0 269.5,406.0 300.8,407.0 300.0,404.0 283.2,362.0 282.8,361.5"/>
              <polygon id="num_home-2" className="blk" data-zone="num_home" fill="#2a457c" points="242.8,360.2 241.5,380.0 241.5,405.8 262.8,406.2 264.2,361.5 258.8,360.8"/>
              <polygon id="num_home-3" className="blk" data-zone="num_home" fill="#2a457c" points="235.0,360.5 220.2,360.2 219.5,360.8 200.8,405.0 234.2,405.2 235.2,366.8"/>
              <polygon id="num_bajo-1" className="blk" data-zone="num_bajo" fill="#186687" points="343.5,305.2 328.5,320.2 328.5,321.0 354.5,348.2 360.2,353.5 376.2,337.8 376.2,337.2 344.5,305.2"/>
              <polygon id="num_bajo-2" className="blk" data-zone="num_bajo" fill="#186687" points="322.8,325.2 307.5,341.5 339.0,373.8 339.8,373.8 355.0,358.0 323.5,325.2"/>
              <polygon id="num_bajo-3" className="blk" data-zone="num_bajo" fill="#186687" points="302.2,345.8 289.2,358.5 289.2,359.5 307.2,404.5 308.0,404.8 334.2,378.8 334.2,378.0 308.5,351.5"/>
              <polygon id="num_bajo-4" className="blk" data-zone="num_bajo" fill="#186687" points="205.2,348.2 204.5,348.2 172.5,380.2 172.5,381.2 193.0,402.2 194.0,402.2 213.5,358.5 213.5,356.8"/>
              <polygon id="num_bajo-5" className="blk" data-zone="num_bajo" fill="#186687" points="189.0,332.0 187.5,332.2 156.2,363.5 156.2,364.2 166.8,375.5 167.8,375.5 200.0,343.8"/>
              <polygon id="num_bajo-6" className="blk" data-zone="num_bajo" fill="#186687" points="173.0,315.5 170.8,316.2 140.2,346.8 140.2,347.5 151.2,359.0 152.0,359.0 183.8,327.2 183.5,326.2"/>
              <polygon id="num_medio-1" className="blk" data-zone="num_medio" fill="#2e80bb" points="364.2,285.2 349.5,299.8 349.5,300.8 380.8,332.8 381.8,332.8 396.5,318.5 396.5,317.5 380.2,300.2 365.0,285.2"/>
              <polygon id="num_medio-2" className="blk" data-zone="num_medio" fill="#2e80bb" points="157.2,299.2 156.2,299.2 124.2,330.8 124.2,331.5 134.5,342.2 135.5,342.2 167.2,310.5 165.2,307.2"/>
              <polygon id="num_medio-3" className="blk" data-zone="num_medio" fill="#2e80bb" points="141.0,282.5 140.2,282.5 108.2,314.2 108.2,315.0 119.2,326.0 151.5,294.5 151.5,293.8 150.0,291.8"/>
              <polygon id="num_medio-4" className="blk" data-zone="num_medio" fill="#2e80bb" points="135.2,276.8 129.8,271.0 129.0,271.0 84.0,289.2 83.8,290.0 103.0,309.2 103.8,309.2 135.2,277.8"/>
              <polygon id="num_medio-5" className="blk" data-zone="num_medio" fill="#2e80bb" points="390.8,259.5 390.8,260.5 421.8,293.5 424.0,292.2 448.0,268.8 448.0,268.2 438.2,263.5 403.0,248.5 401.2,249.5"/>
              <polygon id="num_medio-6" className="blk" data-zone="num_medio" fill="#2e80bb" points="385.0,265.0 370.0,279.8 370.0,280.5 401.5,313.0 402.2,313.0 416.5,299.2 416.8,297.8 386.5,265.8"/>
              <polygon id="num_claro-1" className="blk" data-zone="num_claro" fill="#4d9dd0" points="124.2,244.0 119.8,244.0 75.8,250.2 75.2,250.8 79.8,283.8 81.2,283.8 126.2,266.0 126.8,265.5 126.8,263.0"/>
              <polygon id="num_claro-2" className="blk" data-zone="num_claro" fill="#4d9dd0" points="119.0,209.2 70.8,216.8 70.2,217.2 70.2,219.0 74.2,245.0 122.5,238.0 123.0,237.5 123.0,235.5"/>
              <polygon id="num_claro-3" className="blk" data-zone="num_claro" fill="#4d9dd0" points="117.5,197.2 117.0,196.0 94.8,172.5 89.2,173.8 66.2,176.8 64.2,177.5 68.8,209.8 69.8,211.0 117.5,204.0 118.0,203.5"/>
              <polygon id="num_claro-4" className="blk" data-zone="num_claro" fill="#4d9dd0" points="405.5,175.8 405.0,191.8 405.5,192.2 452.2,193.8 452.8,193.2 453.8,168.8 453.5,167.5 452.8,167.0 438.2,166.2 415.0,166.2"/>
              <polygon id="num_claro-5" className="blk" data-zone="num_claro" fill="#4d9dd0" points="404.8,198.8 404.0,221.5 404.5,222.2 444.2,223.5 451.8,223.2 452.8,200.2 452.2,199.5 419.0,198.0 405.5,198.2"/>
              <polygon id="num_claro-6" className="blk" data-zone="num_claro" fill="#4d9dd0" points="404.0,228.5 403.8,242.2 404.5,243.0 424.8,251.0 449.8,262.2 450.8,262.0 451.8,237.0 451.5,229.0 417.5,228.0 404.5,228.0"/>
            </g>
          </svg>
        </div>
      </div>

      {/* Guía informativa de zonas oficiales y precios */}
      {showZoneGuide && (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400 tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Zonas Oficiales - Estadio Tomateros
            </div>
            <button
              type="button"
              onClick={() => setShowZoneGuide(false)}
              className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded bg-slate-800"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1 text-xs">
            {Object.entries(TOMATEROS_ZONES)
              .filter(([k]) => !['Deluxe Supreme', 'Platino', 'Oro', 'Sky Plus', 'Plus', 'Fan Plus', 'Sky'].includes(k))
              .map(([zoneKey, meta]) => {
                const price = getZonePrice(meta.name, event);
                return (
                  <div
                    key={zoneKey}
                    className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: meta.fillColor }}
                        />
                        <span className="font-bold text-slate-200 truncate">{meta.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                        {meta.description}
                      </p>
                    </div>
                    <div className="mt-2 text-right">
                      {meta.defaultPrice > 0 ? (
                        <span className="font-black text-amber-400 text-xs">${price} MXN</span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">sin precio asignado</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

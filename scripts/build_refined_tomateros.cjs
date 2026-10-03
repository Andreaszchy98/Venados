// scripts/build_refined_tomateros.cjs
const fs = require('fs');
const path = require('path');

const blockRecords = JSON.parse(fs.readFileSync('/tmp/tomateros-recomputed-blocks.json', 'utf-8'));

console.log(`Building refined TomaterosStadiumMap.tsx with ${blockRecords.length} blocks...`);

const fileContent = `import React, { useState, useMemo } from 'react';
import { SeatSection, VenueEvent } from '../../types';
import { ZoomIn, ZoomOut, RotateCcw, Info, Sparkles } from 'lucide-react';

export interface TomaterosStadiumMapProps {
  sections?: SeatSection[];
  activeSectionNumber?: string;
  activeZoneFilter?: string | null;
  onSelectSection: (sectionNumber: string, zoneName?: string) => void;
  event?: VenueEvent | null;
  soldOutSectionsSet?: Set<string>;
  highlightOnlyActiveSection?: boolean;
}

export interface TomaterosBlockDef {
  id: string;
  zone: string;
  pathD: string;
  centerPoint: { x: number; y: number };
  fillColor: string;
  strokeColor: string;
}

/**
 * Catálogo geométrico data-driven del Estadio Tomateros de Culiacán (79 bloques).
 * Proporción 1:1 (~820px x 810px), tribunas laterales a 45°, franjas continuas
 * y jardines pegados a la barda perimetral.
 */
export const TOMATEROS_BLOCKS: TomaterosBlockDef[] = ${JSON.stringify(blockRecords, null, 2)};

export const TOMATEROS_ZONES_LEGEND = [
  { name: 'Jardines', color: '#475569', label: 'Jardines (Bleachers)' },
  { name: 'Zona Especial Jardines', color: '#1E3A8A', label: 'Especial Jardines / HR' },
  { name: 'Lateral Superior 3A', color: '#0EA5E9', label: 'Lateral Superior 3ra Base' },
  { name: 'Lateral Superior 1A', color: '#0EA5E9', label: 'Lateral Superior 1ra Base' },
  { name: 'Lateral 3A', color: '#38BDF8', label: 'Gradas Principales 3ra Base' },
  { name: 'Lateral 1A', color: '#38BDF8', label: 'Gradas Principales 1ra Base' },
  { name: 'Palcos Campo 3A', color: '#0284C7', label: 'Palcos de Campo 3ra Base' },
  { name: 'Palcos Campo 1A', color: '#0284C7', label: 'Palcos de Campo 1ra Base' },
  { name: 'Central Home', color: '#0F172A', label: 'Central Detrás de Home' },
  { name: 'Palco Home', color: '#0369A1', label: 'Palco Home Plate' },
  { name: 'Numerados Home', color: '#64748B', label: 'Numerados Home' },
  { name: 'Plateas 3A', color: '#9333EA', label: 'Plateas 3ra Base' },
  { name: 'Plateas 1A', color: '#9333EA', label: 'Plateas 1ra Base' },
  { name: 'Suites 3A', color: '#64748B', label: 'Suites 3ra Base' },
  { name: 'Suites 1A', color: '#64748B', label: 'Suites 1ra Base' },
  { name: 'Suites Home', color: '#475569', label: 'Suites Presidencial y Diamante' },
];

const TomaterosStadiumMapComponent: React.FC<TomaterosStadiumMapProps> = ({
  sections = [],
  activeSectionNumber = '',
  activeZoneFilter = null,
  onSelectSection,
  event = null,
  soldOutSectionsSet,
  highlightOnlyActiveSection = false,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [showZoneGuide, setShowZoneGuide] = useState<boolean>(false);

  const isSelected = (blockId: string) => {
    return activeSectionNumber === blockId;
  };

  const isDimmed = (blockId: string, zoneName: string) => {
    if (activeZoneFilter && activeZoneFilter !== 'Todas') {
      return activeZoneFilter !== zoneName;
    }
    if (highlightOnlyActiveSection && activeSectionNumber) {
      return activeSectionNumber !== blockId;
    }
    return false;
  };

  const hoveredBlockMeta = useMemo(() => {
    if (!hoveredSection) return null;
    return TOMATEROS_BLOCKS.find((b) => b.id === hoveredSection) || null;
  }, [hoveredSection]);

  return (
    <div className="space-y-2.5">
      {/* Barra superior de herramientas idéntica al Teodoro Mariscal */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {activeSectionNumber ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-black text-amber-500">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Bloque {activeSectionNumber} seleccionado
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-400">
              Toca cualquier bloque del mapa para elegir asientos
            </span>
          )}
        </div>

        {/* Controles de zoom compactos */}
        <div className="flex items-center gap-1 bg-[#0F1626] border border-slate-700/80 rounded-xl p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.5, Math.round((z + 0.15) * 100) / 100))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.8, Math.round((z - 0.15) * 100) / 100))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Restablecer vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowZoneGuide(!showZoneGuide)}
            className={\`p-1.5 rounded-lg transition-colors cursor-pointer \${
              showZoneGuide ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }\`}
            title="Distribución de zonas"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenedor del mapa con fondo claro según la Imagen A de referencia */}
      <div className="relative w-full aspect-square max-h-[720px] bg-[#F8FAFC] dark:bg-[#0B111E] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-2xl flex flex-col items-center justify-center p-1 sm:p-3 select-none transition-colors">
        {/* Atmósfera suave con gradientes de estadio */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,_rgba(241,245,249,0.8)_0%,_rgba(226,232,240,0.95)_75%,_#CBD5E1_100%)] dark:bg-[radial-gradient(circle_at_50%_45%,_rgba(30,41,59,0.5)_0%,_rgba(11,17,30,0.95)_75%,_#060A12_100%)] pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* SVG exacto del Estadio Tomateros */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 1000 1000"
            className="w-full h-full max-h-[680px] transition-transform duration-200"
            style={{ transform: \`scale(\${zoomLevel})\` }}
          >
            <defs>
              {/* Filtro luminoso para bloque seleccionado */}
              <filter id="tomaterosActiveGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFFFFF" floodOpacity="0.95" />
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#F59E0B" floodOpacity="0.9" />
              </filter>
              <filter id="tomaterosHoverGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FFFFFF" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* ======================================================== */}
            {/* 1. TERRENO DE JUEGO (CAMPO CON ESQUINAS EN DIAGONAL)    */}
            {/* ======================================================== */}
            <g id="tomateros-baseball-field">
              {/* Pasto verde fair y foul territory */}
              <polygon
                points="500,665 435,600 265,430 252,312 395,170 445,150 500,145 555,150 605,170 748,312 735,430 565,600"
                fill="#1E824C"
                stroke="#14532D"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Pista de advertencia (Warning track) de arcilla naranja en barda */}
              <path
                d="M 265,430 L 252,312 L 395,170 L 445,150 L 500,145 L 555,150 L 605,170 L 748,312 L 735,430 L 722,425 L 734,320 L 596,184 L 550,165 L 500,160 L 450,165 L 404,184 L 266,320 L 278,425 Z"
                fill="#D97706"
                opacity="0.95"
              />

              {/* Franja de advertencia en laterales de foul */}
              <path
                d="M 265,430 L 278,425 L 435,582 L 427,592 Z"
                fill="#D97706"
                opacity="0.55"
              />
              <path
                d="M 735,430 L 722,425 L 565,582 L 573,592 Z"
                fill="#D97706"
                opacity="0.55"
              />

              {/* Líneas de Cal Blancas (Foul lines a 45°) */}
              <line
                x1="500"
                y1="665"
                x2="265"
                y2="430"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="500"
                y1="665"
                x2="735"
                y2="430"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Postes de Foul (Foul Poles) */}
              <circle cx="265" cy="430" r="4.5" fill="#FBBF24" stroke="#78350F" strokeWidth="1" />
              <circle cx="735" cy="430" r="4.5" fill="#FBBF24" stroke="#78350F" strokeWidth="1" />

              {/* Abanico / Arco de arcilla naranja del diamante de infield */}
              <path
                d="
                  M 380,565
                  C 365,455 635,455 620,565
                  L 535,635
                  C 515,655 485,655 465,635
                  Z
                "
                fill="#D97706"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Diamante de pasto verde interior (cuadrado girado a 45°) */}
              <polygon
                points="500,495 565,560 500,625 435,560"
                fill="#1E824C"
                stroke="#22C55E"
                strokeWidth="1.5"
              />

              {/* Montículo del Pitcher */}
              <circle cx="500" cy="560" r="11" fill="#FFFFFF" />
              <circle cx="500" cy="560" r="8" fill="#D97706" />
              <rect x="497" y="558.5" width="6" height="3" fill="#FFFFFF" rx="0.5" />

              {/* Almohadillas (1B, 2B, 3B en color blanco giradas a 45°) */}
              <rect x="495" y="490" width="10" height="10" fill="#FFFFFF" transform="rotate(45 500 495)" />
              <rect x="560" y="555" width="10" height="10" fill="#FFFFFF" transform="rotate(45 565 560)" />
              <rect x="430" y="555" width="10" height="10" fill="#FFFFFF" transform="rotate(45 435 560)" />

              {/* Home Plate Pentagonal con cajas de bateo */}
              <polygon points="500,665 494,657 494,651 506,651 506,657" fill="#FFFFFF" />
              <rect x="484" y="649" width="7" height="15" fill="none" stroke="#FFFFFF" strokeWidth="1" />
              <rect x="509" y="649" width="7" height="15" fill="none" stroke="#FFFFFF" strokeWidth="1" />
            </g>

            {/* ======================================================== */}
            {/* 2. LOS 79 BLOQUES CLICABLES DEL ESTADIO TOMATEROS       */}
            {/* ======================================================== */}
            <g id="tomateros-blocks-container">
              {TOMATEROS_BLOCKS.map((block) => {
                const selected = isSelected(block.id);
                const hovered = hoveredSection === block.id;
                const dimmed = isDimmed(block.id, block.zone);
                const isSoldOut = soldOutSectionsSet ? (soldOutSectionsSet.has(block.id) || soldOutSectionsSet.has(block.id.toLowerCase())) : false;

                return (
                  <path
                    key={block.id}
                    id={block.id}
                    d={block.pathD}
                    fill={isSoldOut ? '#1E293B' : selected ? '#FFFFFF' : hovered ? '#FFFFFF' : block.fillColor}
                    stroke={selected ? '#F59E0B' : hovered ? '#FFFFFF' : isSoldOut ? '#334155' : block.strokeColor}
                    strokeWidth={selected ? 3.5 : hovered ? 2.2 : 1.2}
                    opacity={isSoldOut ? 0.35 : dimmed ? 0.22 : 1}
                    filter={selected ? 'url(#tomaterosActiveGlow)' : hovered ? 'url(#tomaterosHoverGlow)' : undefined}
                    className={isSoldOut ? 'cursor-not-allowed' : 'cursor-pointer transition-all duration-100'}
                    onClick={() => onSelectSection(block.id, block.zone)}
                    onMouseEnter={() => setHoveredSection(block.id)}
                    onMouseLeave={() => setHoveredSection(null)}
                  />
                );
              })}
            </g>

            {/* ======================================================== */}
            {/* 3. TOOLTIP FLOTANTE EN HOVER                             */}
            {/* ======================================================== */}
            {hoveredBlockMeta && (
              <g
                transform={\`translate(\${hoveredBlockMeta.centerPoint.x}, \${hoveredBlockMeta.centerPoint.y - 24})\`}
                className="pointer-events-none z-50"
              >
                <rect
                  x="-65"
                  y="-16"
                  width="130"
                  height="32"
                  rx="7"
                  fill="#0F172A"
                  stroke="#F59E0B"
                  strokeWidth="1.8"
                  opacity="0.96"
                />
                <text
                  x="0"
                  y="-2"
                  fill="#F8FAFC"
                  fontSize="10"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  {hoveredBlockMeta.id}
                </text>
                <text
                  x="0"
                  y="10"
                  fill="#FBBF24"
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {hoveredBlockMeta.zone}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Guía informativa de distribución de bloques y zonas */}
      {showZoneGuide && (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400 tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Distribución de Secciones - Estadio Tomateros
            </div>
            <button
              type="button"
              onClick={() => setShowZoneGuide(false)}
              className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded bg-slate-800"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TOMATEROS_ZONES_LEGEND.map((z) => (
              <div
                key={z.name}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50"
              >
                <span
                  className="w-3.5 h-3.5 rounded-md shrink-0 border border-white/20 shadow-xs"
                  style={{ backgroundColor: z.color }}
                />
                <span className="text-[11px] font-bold text-slate-200 truncate">
                  {z.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

TomaterosStadiumMapComponent.displayName = 'TomaterosStadiumMap';
export const TomaterosStadiumMap = React.memo(TomaterosStadiumMapComponent);
export default TomaterosStadiumMap;
`;

const targetPath = path.join(process.cwd(), 'src/components/stadiumMaps/TomaterosStadiumMap.tsx');
fs.writeFileSync(targetPath, fileContent, 'utf-8');
console.log('Successfully updated', targetPath);

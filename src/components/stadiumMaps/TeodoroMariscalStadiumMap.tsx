import React, { useState, useMemo } from 'react';
import { SeatSection, VenueEvent } from '../../types';
import { MARISCAL_ZONES, getZonePrice } from '../../lib/seatMap';
import { ZoomIn, ZoomOut, RotateCcw, Info, Sparkles, MapPin, ShieldCheck } from 'lucide-react';

interface TeodoroMariscalStadiumMapProps {
  sections: SeatSection[];
  activeSectionNumber: string;
  activeZoneFilter: string | null;
  onSelectSection: (sectionNumber: string) => void;
  event?: VenueEvent | null;
}

interface SectionDefinition {
  num: string;
  zone: string;
  centerType: 'outfield' | 'infield';
  angleDeg: number;
  radius: number;
  width: number;
  height: number;
}

// Configuración matemática de coordenadas radiales para las 86 secciones oficiales del Teodoro Mariscal
const SECTIONS_CONFIG: SectionDefinition[] = [
  // 1. DELUXE SUPREME: 12 al 1 (Central baja pegada a Home Plate)
  { num: '1', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 46, radius: 76, width: 22, height: 16 },
  { num: '2', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 54, radius: 76, width: 22, height: 16 },
  { num: '3', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 62, radius: 76, width: 22, height: 16 },
  { num: '4', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 70, radius: 76, width: 22, height: 16 },
  { num: '5', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 78, radius: 76, width: 22, height: 16 },
  { num: '6', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 86, radius: 76, width: 22, height: 16 },
  { num: '7', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 94, radius: 76, width: 22, height: 16 },
  { num: '8', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 102, radius: 76, width: 22, height: 16 },
  { num: '9', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 110, radius: 76, width: 22, height: 16 },
  { num: '10', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 118, radius: 76, width: 22, height: 16 },
  { num: '11', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 126, radius: 76, width: 22, height: 16 },
  { num: '12', zone: 'Deluxe Supreme', centerType: 'infield', angleDeg: 134, radius: 76, width: 22, height: 16 },

  // 2. PLATINO (Rojo): Laterales bajas del Infield
  // Primera Base (1B)
  { num: '108', zone: 'Platino', centerType: 'infield', angleDeg: 38, radius: 76, width: 24, height: 16 },
  { num: '107', zone: 'Platino', centerType: 'infield', angleDeg: 30, radius: 76, width: 24, height: 16 },
  { num: '106', zone: 'Platino', centerType: 'infield', angleDeg: 22, radius: 76, width: 24, height: 16 },
  { num: '105', zone: 'Platino', centerType: 'infield', angleDeg: 14, radius: 76, width: 24, height: 16 },
  // Tercera Base (3B)
  { num: '115', zone: 'Platino', centerType: 'infield', angleDeg: 142, radius: 76, width: 24, height: 16 },
  { num: '116', zone: 'Platino', centerType: 'infield', angleDeg: 150, radius: 76, width: 24, height: 16 },
  { num: '117', zone: 'Platino', centerType: 'infield', angleDeg: 158, radius: 76, width: 24, height: 16 },

  // 3. ORO (Azul Turquesa): Infield sobre las líneas de cal
  // Primera Base
  { num: '104', zone: 'Oro', centerType: 'infield', angleDeg: 6, radius: 76, width: 24, height: 16 },
  { num: '103', zone: 'Oro', centerType: 'infield', angleDeg: -2, radius: 76, width: 24, height: 16 },
  { num: '102', zone: 'Oro', centerType: 'infield', angleDeg: -10, radius: 76, width: 24, height: 16 },
  { num: '101', zone: 'Oro', centerType: 'infield', angleDeg: -18, radius: 76, width: 24, height: 16 },
  // Tercera Base
  { num: '118', zone: 'Oro', centerType: 'infield', angleDeg: 166, radius: 76, width: 24, height: 16 },
  { num: '119', zone: 'Oro', centerType: 'infield', angleDeg: 174, radius: 76, width: 24, height: 16 },
  { num: '120', zone: 'Oro', centerType: 'infield', angleDeg: 182, radius: 76, width: 24, height: 16 },
  { num: '121', zone: 'Oro', centerType: 'infield', angleDeg: 190, radius: 76, width: 24, height: 16 },

  // 4. JARDINES BAJOS (FAN - Celeste): Barda de Outfield
  // Jardín Izquierdo (Left Field)
  { num: '122', zone: 'Fan', centerType: 'outfield', angleDeg: 196, radius: 198, width: 27, height: 17 },
  { num: '123', zone: 'Fan', centerType: 'outfield', angleDeg: 210, radius: 198, width: 27, height: 17 },
  { num: '124', zone: 'Fan', centerType: 'outfield', angleDeg: 224, radius: 198, width: 27, height: 17 },
  { num: '125', zone: 'Fan', centerType: 'outfield', angleDeg: 238, radius: 198, width: 27, height: 17 },
  { num: '126', zone: 'Fan', centerType: 'outfield', angleDeg: 252, radius: 198, width: 27, height: 17 },
  { num: '127', zone: 'Fan', centerType: 'outfield', angleDeg: 266, radius: 198, width: 27, height: 17 },
  // Jardín Derecho (Right Field)
  { num: '128', zone: 'Fan', centerType: 'outfield', angleDeg: 274, radius: 198, width: 27, height: 17 },
  { num: '129', zone: 'Fan', centerType: 'outfield', angleDeg: 288, radius: 198, width: 27, height: 17 },
  { num: '130', zone: 'Fan', centerType: 'outfield', angleDeg: 302, radius: 198, width: 27, height: 17 },
  { num: '131', zone: 'Fan', centerType: 'outfield', angleDeg: 316, radius: 198, width: 27, height: 17 },
  { num: '132', zone: 'Fan', centerType: 'outfield', angleDeg: 330, radius: 198, width: 27, height: 17 },
  { num: '133', zone: 'Fan', centerType: 'outfield', angleDeg: 344, radius: 198, width: 27, height: 17 },

  // 5. JARDINES ALTOS NIVEL 200 (FAN PLUS - Gris Lavanda)
  // Jardín Izquierdo Alto
  { num: '222', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 196, radius: 224, width: 29, height: 17 },
  { num: '223', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 210, radius: 224, width: 29, height: 17 },
  { num: '224', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 224, radius: 224, width: 29, height: 17 },
  { num: '225', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 238, radius: 224, width: 29, height: 17 },
  { num: '226', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 252, radius: 224, width: 29, height: 17 },
  { num: '227', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 266, radius: 224, width: 29, height: 17 },
  // Jardín Derecho Alto
  { num: '228', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 274, radius: 224, width: 29, height: 17 },
  { num: '229', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 288, radius: 224, width: 29, height: 17 },
  { num: '230', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 302, radius: 224, width: 29, height: 17 },
  { num: '231', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 316, radius: 224, width: 29, height: 17 },
  { num: '232', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 330, radius: 224, width: 29, height: 17 },
  { num: '233', zone: 'Fan Plus', centerType: 'outfield', angleDeg: 344, radius: 224, width: 29, height: 17 },

  // 6. NIVEL 200 LATERAL (PLUS - Verde Lima)
  // Primera Base
  { num: '201', zone: 'Plus', centerType: 'infield', angleDeg: -18, radius: 110, width: 27, height: 18 },
  { num: '202', zone: 'Plus', centerType: 'infield', angleDeg: -10, radius: 110, width: 27, height: 18 },
  { num: '203', zone: 'Plus', centerType: 'infield', angleDeg: -2, radius: 110, width: 27, height: 18 },
  { num: '204', zone: 'Plus', centerType: 'infield', angleDeg: 6, radius: 110, width: 27, height: 18 },
  // Tercera Base
  { num: '218', zone: 'Plus', centerType: 'infield', angleDeg: 166, radius: 110, width: 27, height: 18 },
  { num: '219', zone: 'Plus', centerType: 'infield', angleDeg: 174, radius: 110, width: 27, height: 18 },
  { num: '220', zone: 'Plus', centerType: 'infield', angleDeg: 182, radius: 110, width: 27, height: 18 },
  { num: '221', zone: 'Plus', centerType: 'infield', angleDeg: 190, radius: 110, width: 27, height: 18 },

  // 7. NIVEL 200 CENTRAL (DIAMANTE - Naranja Terracota): 205 a 217
  { num: '205', zone: 'Diamante', centerType: 'infield', angleDeg: 14, radius: 110, width: 27, height: 18 },
  { num: '206', zone: 'Diamante', centerType: 'infield', angleDeg: 26, radius: 110, width: 27, height: 18 },
  { num: '207', zone: 'Diamante', centerType: 'infield', angleDeg: 38, radius: 110, width: 27, height: 18 },
  { num: '208', zone: 'Diamante', centerType: 'infield', angleDeg: 50, radius: 110, width: 27, height: 18 },
  { num: '209', zone: 'Diamante', centerType: 'infield', angleDeg: 62, radius: 110, width: 27, height: 18 },
  { num: '210', zone: 'Diamante', centerType: 'infield', angleDeg: 74, radius: 110, width: 27, height: 18 },
  { num: '211', zone: 'Diamante', centerType: 'infield', angleDeg: 85, radius: 110, width: 27, height: 18 },
  { num: '212', zone: 'Diamante', centerType: 'infield', angleDeg: 95, radius: 110, width: 27, height: 18 },
  { num: '213', zone: 'Diamante', centerType: 'infield', angleDeg: 106, radius: 110, width: 27, height: 18 },
  { num: '214', zone: 'Diamante', centerType: 'infield', angleDeg: 118, radius: 110, width: 27, height: 18 },
  { num: '215', zone: 'Diamante', centerType: 'infield', angleDeg: 130, radius: 110, width: 27, height: 18 },
  { num: '216', zone: 'Diamante', centerType: 'infield', angleDeg: 142, radius: 110, width: 27, height: 18 },
  { num: '217', zone: 'Diamante', centerType: 'infield', angleDeg: 154, radius: 110, width: 27, height: 18 },

  // 8. NIVEL 300 LATERAL (SKY - Morado)
  // Primera Base
  { num: '301', zone: 'Sky', centerType: 'infield', angleDeg: -18, radius: 146, width: 29, height: 19 },
  { num: '302', zone: 'Sky', centerType: 'infield', angleDeg: -10, radius: 146, width: 29, height: 19 },
  { num: '303', zone: 'Sky', centerType: 'infield', angleDeg: -2, radius: 146, width: 29, height: 19 },
  { num: '304', zone: 'Sky', centerType: 'infield', angleDeg: 6, radius: 146, width: 29, height: 19 },
  // Tercera Base
  { num: '313', zone: 'Sky', centerType: 'infield', angleDeg: 166, radius: 146, width: 29, height: 19 },
  { num: '314', zone: 'Sky', centerType: 'infield', angleDeg: 174, radius: 146, width: 29, height: 19 },
  { num: '315', zone: 'Sky', centerType: 'infield', angleDeg: 182, radius: 146, width: 29, height: 19 },
  { num: '316', zone: 'Sky', centerType: 'infield', angleDeg: 190, radius: 146, width: 29, height: 19 },

  // 9. NIVEL 300 CENTRAL (SKY PLUS - Melocotón / Salmón Claro)
  // Primera Base
  { num: '305', zone: 'Sky Plus', centerType: 'infield', angleDeg: 20, radius: 146, width: 29, height: 19 },
  { num: '306', zone: 'Sky Plus', centerType: 'infield', angleDeg: 34, radius: 146, width: 29, height: 19 },
  { num: '307', zone: 'Sky Plus', centerType: 'infield', angleDeg: 48, radius: 146, width: 29, height: 19 },
  // Tercera Base
  { num: '310', zone: 'Sky Plus', centerType: 'infield', angleDeg: 132, radius: 146, width: 29, height: 19 },
  { num: '311', zone: 'Sky Plus', centerType: 'infield', angleDeg: 146, radius: 146, width: 29, height: 19 },
  { num: '312', zone: 'Sky Plus', centerType: 'infield', angleDeg: 160, radius: 146, width: 29, height: 19 },
];

export const TeodoroMariscalStadiumMap: React.FC<TeodoroMariscalStadiumMapProps> = ({
  sections,
  activeSectionNumber,
  activeZoneFilter,
  onSelectSection,
  event,
}) => {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showZoneGuide, setShowZoneGuide] = useState<boolean>(false);

  // Centros de referencia geométrica
  const outfieldCenter = { x: 420, y: 400 };
  const infieldCenter = { x: 420, y: 510 };

  const isDimmed = (zoneName: string) => {
    if (!activeZoneFilter || activeZoneFilter === 'Todas') return false;
    return activeZoneFilter !== zoneName;
  };

  const isSelected = (secNumber: string) => activeSectionNumber === secNumber;

  // Mapa rápido de secciones para disponibilidad
  const sectionMetaMap = useMemo(() => {
    const map = new Map<string, SeatSection>();
    for (const sec of sections) {
      map.set(sec.sectionNumber, sec);
    }
    return map;
  }, [sections]);

  return (
    <div className="space-y-4">
      {/* Contenedor SVG principal con atmósfera nocturna oficial */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[4/3] max-h-[640px] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col items-center justify-center p-2 sm:p-4 select-none">
        {/* Fondo decorativo con luces de estadio */}
        <div className="absolute inset-0 bg-radial from-slate-900 via-slate-950 to-[#060910] pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado con marca oficial Venados */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-700/60 shadow-xs backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-red-200">
                VENADOS • TEODORO MARISCAL
              </span>
            </div>
            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Distribución Oficial 2026
            </span>
          </div>

          {/* Controles de zoom */}
          <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-lg backdrop-blur-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Acercar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.15))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Alejar"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Restablecer vista"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowZoneGuide(!showZoneGuide)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showZoneGuide ? 'bg-red-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Guía de colores y puertas"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SVG Interactivo */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 840 920"
            className="w-full h-full max-h-[580px] transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <defs>
              {/* Gradiente césped del Outfield */}
              <radialGradient id="tmOutfieldGrass" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#78C646" />
                <stop offset="80%" stopColor="#6DB83B" />
                <stop offset="100%" stopColor="#5E9E30" />
              </radialGradient>

              {/* Arcilla del Infield */}
              <radialGradient id="tmInfieldClay" cx="50%" cy="60%" r="60%">
                <stop offset="0%" stopColor="#E59458" />
                <stop offset="90%" stopColor="#D97A38" />
                <stop offset="100%" stopColor="#B45A1E" />
              </radialGradient>

              {/* Sombra de secciones */}
              <filter id="boxShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* 1. TERRENO DE JUEGO (CAMPO CIRCULAR EXACTO DEL AFICHE OFICIAL) */}
            <g id="field-ground">
              {/* Círculo verde del Outfield */}
              <circle
                cx={outfieldCenter.x}
                cy={outfieldCenter.y}
                r="180"
                fill="url(#tmOutfieldGrass)"
                stroke="#4E8C22"
                strokeWidth="2.5"
              />

              {/* Barda de jonrón (curva perimetral) */}
              <circle
                cx={outfieldCenter.x}
                cy={outfieldCenter.y}
                r="180"
                fill="none"
                stroke="#FACC15"
                strokeWidth="3.5"
                strokeDasharray="8 4"
                opacity="0.9"
              />

              {/* Arcilla del Infield (Abanico de béisbol) */}
              <path
                d="M 345 505 Q 420 425 495 505 L 420 568 Z"
                fill="url(#tmInfieldClay)"
                stroke="#C26A28"
                strokeWidth="1.5"
              />

              {/* Diamante de pasto interior */}
              <polygon
                points="420,460 460,500 420,540 380,500"
                fill="#6DB83B"
                stroke="#88D650"
                strokeWidth="1.5"
              />

              {/* Líneas de Cal (Foul Lines) */}
              <line
                x1="420"
                y1="560"
                x2="293"
                y2="433"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeOpacity="0.9"
              />
              <line
                x1="420"
                y1="560"
                x2="547"
                y2="433"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeOpacity="0.9"
              />

              {/* Montículo del Lanzador */}
              <circle cx="420" cy="500" r="11" fill="#D97A38" stroke="#FFFFFF" strokeWidth="1" />
              <rect x="416" y="498.5" width="8" height="3" fill="#FFFFFF" rx="0.5" />

              {/* Bases (1ra, 2da, 3ra y Home) */}
              {/* Home Plate */}
              <polygon points="420,563 415,558 415,553 425,553 425,558" fill="#FFFFFF" />
              {/* Primera Base (1B) */}
              <rect x="456" y="496" width="8" height="8" fill="#FFFFFF" transform="rotate(45 460 500)" />
              {/* Segunda Base (2B) */}
              <rect x="416" y="456" width="8" height="8" fill="#FFFFFF" transform="rotate(45 420 460)" />
              {/* Tercera Base (3B) */}
              <rect x="376" y="496" width="8" height="8" fill="#FFFFFF" transform="rotate(45 380 500)" />

              {/* Textos del terreno */}
              <text
                x="420"
                y="300"
                fill="#FFFFFF"
                opacity="0.35"
                fontSize="12"
                fontWeight="900"
                textAnchor="middle"
                letterSpacing="3"
              >
                JARDÍN CENTRAL
              </text>
              <text
                x="320"
                y="350"
                fill="#FFFFFF"
                opacity="0.25"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                JARDÍN IZQ.
              </text>
              <text
                x="520"
                y="350"
                fill="#FFFFFF"
                opacity="0.25"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                JARDÍN DER.
              </text>
            </g>

            {/* 2. RENDERIZADO DE LAS 86 SECCIONES RADIALES */}
            <g id="stadium-sections">
              {SECTIONS_CONFIG.map((sec) => {
                const zoneMeta = MARISCAL_ZONES[sec.zone] || {
                  colorHex: '#64748B',
                  fillColor: '#64748B',
                  name: sec.zone,
                };

                const center = sec.centerType === 'outfield' ? outfieldCenter : infieldCenter;
                const rad = (sec.angleDeg * Math.PI) / 180;
                const posX = center.x + sec.radius * Math.cos(rad);
                const posY = center.y + sec.radius * Math.sin(rad);

                // Rotación del bloque para apuntar perpendicularmente al diamante
                let rot = sec.angleDeg - 90;
                // Si el texto queda de cabeza, rotar 180 grados para óptima legibilidad
                let textRot = 0;
                if (rot > 90 || rot < -90) {
                  textRot = 180;
                }

                const selected = isSelected(sec.num);
                const hovered = hoveredSection === sec.num;
                const dimmed = isDimmed(sec.zone);
                const price = getZonePrice(sec.zone, event);

                // Determinar color de texto legible según el fondo de zona
                const isDarkText = sec.zone === 'Fan' || sec.zone === 'Fan Plus' || sec.zone === 'Plus';
                const textColor = selected ? '#0F172A' : isDarkText ? '#0F172A' : '#FFFFFF';

                return (
                  <g
                    key={sec.num}
                    transform={`translate(${posX}, ${posY}) rotate(${rot})`}
                    className="cursor-pointer transition-transform duration-100"
                    onClick={() => onSelectSection(sec.num)}
                    onMouseEnter={() => setHoveredSection(sec.num)}
                    onMouseLeave={() => setHoveredSection(null)}
                  >
                    {/* Caja de sección */}
                    <rect
                      x={-sec.width / 2}
                      y={-sec.height / 2}
                      width={sec.width}
                      height={sec.height}
                      rx={3}
                      fill={selected ? '#FFFFFF' : zoneMeta.colorHex}
                      stroke={selected ? '#F59E0B' : hovered ? '#FFFFFF' : '#0F172A'}
                      strokeWidth={selected ? 3 : hovered ? 2 : 0.8}
                      opacity={dimmed ? 0.25 : 1}
                      filter="url(#boxShadow)"
                    />

                    {/* Número de sección */}
                    <text
                      x={0}
                      y={textRot === 180 ? 3.5 : 3.5}
                      transform={`rotate(${textRot})`}
                      fill={textColor}
                      fontSize={sec.num.length > 2 ? 7.5 : 8.5}
                      fontWeight="900"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {sec.num}
                    </text>

                    {/* Tooltip dinámico al posar el cursor */}
                    {hovered && (
                      <g
                        transform={`rotate(${-rot}) translate(0, -28)`}
                        className="pointer-events-none z-50"
                      >
                        <rect
                          x={-55}
                          y={-14}
                          width={110}
                          height={24}
                          rx={6}
                          fill="#0F172A"
                          stroke="#F59E0B"
                          strokeWidth={1.5}
                        />
                        <text
                          x={0}
                          y={-2}
                          fill="#F8FAFC"
                          fontSize="8.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          Sec. #{sec.num} • {sec.zone}
                        </text>
                        <text
                          x={0}
                          y={7}
                          fill="#FCD34D"
                          fontSize="7.5"
                          fontWeight="black"
                          textAnchor="middle"
                        >
                          ${price} MXN
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 3. LOGOS & PIE DE PÁGINA DEL PÓSTER */}
            <g id="poster-footer" transform="translate(0, 830)">
              <line x1="120" y1="0" x2="720" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
              
              {/* Emblema 80 Aniversario */}
              <text x="310" y="32" fill="#E2E8F0" fontSize="13" fontWeight="900" textAnchor="middle">
                80 ANIVERSARIO
              </text>
              <text x="310" y="46" fill="#EF4444" fontSize="9" fontWeight="extrabold" textAnchor="middle" letterSpacing="1">
                VENADOS DE MAZATLÁN
              </text>

              {/* Separador */}
              <circle cx="420" cy="35" r="2.5" fill="#64748B" />

              {/* Liga Arco Mexicana del Pacífico */}
              <text x="530" y="32" fill="#E2E8F0" fontSize="12" fontWeight="900" textAnchor="middle">
                LIGA ARCO
              </text>
              <text x="530" y="46" fill="#38BDF8" fontSize="8.5" fontWeight="black" textAnchor="middle" letterSpacing="1">
                MEXICANA DEL PACÍFICO
              </text>

              {/* Mensaje de taquilla */}
              <text x="420" y="70" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">
                Boletos en taquilla (sólo en días de juego), y en línea en esta plataforma oficial.
              </text>
            </g>
          </svg>
        </div>

        {/* Notificación flotante de sección activa */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
          <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-xl backdrop-blur-xs flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-slate-300">
              Sección: <strong className="text-white font-black">#{activeSectionNumber}</strong>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-2xl border border-slate-800">
            <Sparkles className="w-3 h-3 text-red-400" />
            <span>Haz clic en cualquier bloque para ver sus butacas</span>
          </div>
        </div>
      </div>

      {/* Modal / Panel desplegable con Guía Oficial de Zonas */}
      {showZoneGuide && (
        <div className="bg-slate-900 text-slate-100 p-4 rounded-3xl border border-slate-700 shadow-xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              Guía Oficial de Zonas y Secciones • Teodoro Mariscal
            </h4>
            <button
              onClick={() => setShowZoneGuide(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {Object.entries(MARISCAL_ZONES).map(([name, meta]) => {
              const price = getZonePrice(name, event);
              return (
                <div
                  key={name}
                  onClick={() => onSelectSection(name === 'Deluxe Supreme' ? '6' : name === 'Platino' ? '106' : name === 'Oro' ? '103' : name === 'Fan' ? '125' : name === 'Fan Plus' ? '225' : name === 'Plus' ? '203' : name === 'Diamante' ? '211' : name === 'Sky' ? '303' : '306')}
                  className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-slate-500 cursor-pointer transition-all flex items-start gap-2.5"
                >
                  <span
                    className="w-4 h-4 rounded-md shrink-0 mt-0.5 border border-white/20 shadow-xs"
                    style={{ backgroundColor: meta.colorHex }}
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">{name}</span>
                      <span className="font-mono font-black text-amber-400">${price}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{meta.description}</p>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      Acceso: {meta.gate}
                    </span>
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

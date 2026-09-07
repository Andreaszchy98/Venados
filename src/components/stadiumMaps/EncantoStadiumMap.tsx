import React, { useState } from 'react';
import { SeatSection, VenueEvent } from '../../types';
import { ENCANTO_ZONES, getZonePrice } from '../../lib/seatMap';

interface EncantoStadiumMapProps {
  sections: SeatSection[];
  activeSectionNumber: string;
  activeZoneFilter: string | null;
  onSelectSection: (sectionNumber: string) => void;
  event?: VenueEvent | null;
}

export const EncantoStadiumMap: React.FC<EncantoStadiumMapProps> = ({
  sections,
  activeSectionNumber,
  activeZoneFilter,
  onSelectSection,
  event,
}) => {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  // Determinar si una sección está atenuada por filtro de zona
  const isDimmed = (zoneName: string) => {
    if (!activeZoneFilter) return false;
    return activeZoneFilter !== zoneName;
  };

  const isSelected = (secNumber: string) => activeSectionNumber === secNumber;

  const renderSectionBlock = (
    secNumber: string,
    zoneName: string,
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string,
    rx = 3
  ) => {
    const meta = ENCANTO_ZONES[zoneName] || {
      fillColor: '#6B7280',
      strokeColor: '#4B5563',
      colorHex: '#6B7280',
      gate: 'Puerta 1',
    };

    const selected = isSelected(secNumber);
    const hovered = hoveredSection === secNumber;
    const dimmed = isDimmed(zoneName);
    const price = getZonePrice(zoneName, event);

    return (
      <g
        key={secNumber}
        className="cursor-pointer transition-all duration-150"
        onClick={() => onSelectSection(secNumber)}
        onMouseEnter={() => setHoveredSection(secNumber)}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={rx}
          fill={meta.fillColor}
          stroke={selected ? '#FBBF24' : hovered ? '#FFFFFF' : meta.strokeColor}
          strokeWidth={selected ? 3 : hovered ? 2 : 1}
          opacity={dimmed ? 0.3 : hovered ? 1 : 0.92}
          className="transition-all"
          filter={selected ? 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.75))' : undefined}
        />
        <text
          x={x + width / 2}
          y={y + height / 2 + 3.5}
          textAnchor="middle"
          fontSize={width < 32 || height < 18 ? 8 : 10}
          fontWeight={selected ? '900' : '700'}
          fill={meta.colorHex === '#0F172A' || meta.colorHex === '#16A34A' ? '#FFFFFF' : '#FFFFFF'}
          pointerEvents="none"
          className="select-none"
        >
          {label || secNumber}
        </text>
        <title>{`${secNumber} (${zoneName}) - $${price} MXN - Acceso: ${meta.gate}`}</title>
      </g>
    );
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-950 p-2 sm:p-4 border border-slate-800 shadow-2xl select-none">
      {/* Indicador de estadio y hover flotante */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="font-bold text-slate-200">Plano Arquitectónico Oficial: Estadio El Encanto</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
            Mazatlán F.C. • Liga MX
          </span>
        </div>
        {hoveredSection && (
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-xs text-amber-300 font-semibold animate-in fade-in">
            <span>Sección: {hoveredSection}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300">
              {sections.find((s) => s.sectionNumber === hoveredSection)?.zoneName || 'Zona Oficial'}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox="0 0 940 640"
        className="w-full h-auto max-h-[580px] drop-shadow-md"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Degradado para el césped */}
          <linearGradient id="grassStripes" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#15803D" />
            <stop offset="20%" stopColor="#166534" />
            <stop offset="40%" stopColor="#15803D" />
            <stop offset="60%" stopColor="#166534" />
            <stop offset="80%" stopColor="#15803D" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>

          {/* Sombra de secciones */}
          <filter id="sectionGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* CONTORNO EXTERIOR DEL ESTADIO */}
        <rect
          x="35"
          y="25"
          width="870"
          height="590"
          rx="50"
          fill="#0B1120"
          stroke="#1E293B"
          strokeWidth="3"
        />

        {/* ========================================================= */}
        {/* PUERTAS DE ACCESO OFICIALES (Círculos morados con número)  */}
        {/* ========================================================= */}
        {/* Puerta 5: Superior Izquierda (Cabecera Superior) */}
        <g className="cursor-pointer">
          <circle cx="120" cy="55" r="18" fill="#581C87" stroke="#A855F7" strokeWidth="2.5" />
          <text x="120" y="61" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">5</text>
          <text x="120" y="85" textAnchor="middle" fill="#D8B4FE" fontSize="9" fontWeight="700">Puerta 5</text>
          <title>Puerta 5: Acceso a Cabecera Superior</title>
        </g>

        {/* Puertas 3 y 4: Superior Centro (Palcos, Sky Boxes, Lounge, Norte) */}
        <g className="cursor-pointer">
          <circle cx="440" cy="40" r="18" fill="#581C87" stroke="#A855F7" strokeWidth="2.5" />
          <text x="440" y="46" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">4</text>
          <circle cx="490" cy="40" r="18" fill="#581C87" stroke="#A855F7" strokeWidth="2.5" />
          <text x="490" y="46" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">3</text>
          <text x="465" y="66" textAnchor="middle" fill="#D8B4FE" fontSize="9" fontWeight="700">Puertas 3 y 4</text>
          <title>Puertas 3 y 4: Acceso a General Norte, Palcos, Sky Boxes y Zona Lounge</title>
        </g>

        {/* Puerta 2: Superior Derecha (Oriente Superior) */}
        <g className="cursor-pointer">
          <circle cx="810" cy="55" r="18" fill="#581C87" stroke="#A855F7" strokeWidth="2.5" />
          <text x="810" y="61" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">2</text>
          <text x="810" y="85" textAnchor="middle" fill="#D8B4FE" fontSize="9" fontWeight="700">Puerta 2</text>
          <title>Puerta 2: Acceso a Oriente Superior</title>
        </g>

        {/* Puerta 1: Extremo Derecho Centro (General Sur, Tiro de Esquina, Centrales y Laterales) */}
        <g className="cursor-pointer">
          <circle cx="865" cy="320" r="20" fill="#581C87" stroke="#A855F7" strokeWidth="2.5" />
          <text x="865" y="326" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900">1</text>
          <text x="865" y="352" textAnchor="middle" fill="#D8B4FE" fontSize="9" fontWeight="700">Puerta 1</text>
          <title>Puerta 1: Acceso a General Sur, Tiro de Esquina, Poniente Central/Lateral y Oriente Central/Lateral</title>
        </g>

        {/* Puerta 6: Inferior Izquierda (Poniente Superior) */}
        <g className="cursor-pointer">
          <circle cx="120" cy="580" r="18" fill="#581C87" stroke="#A855F7" strokeWidth="2.5" />
          <text x="120" y="586" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">6</text>
          <text x="120" y="608" textAnchor="middle" fill="#D8B4FE" fontSize="9" fontWeight="700">Puerta 6</text>
          <title>Puerta 6: Acceso a Poniente Superior</title>
        </g>

        {/* ========================================================= */}
        {/* TERRENO DE JUEGO (CANCHA DE FÚTBOL PROFESIONAL)          */}
        {/* ========================================================= */}
        <g id="pitch">
          {/* Pasto */}
          <rect
            x="240"
            y="180"
            width="440"
            height="270"
            rx="4"
            fill="url(#grassStripes)"
            stroke="#14532D"
            strokeWidth="2"
          />

          {/* Bandas y líneas de cancha */}
          <rect
            x="250"
            y="190"
            width="420"
            height="250"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            opacity="0.9"
          />

          {/* Línea media */}
          <line
            x1="460"
            y1="190"
            x2="460"
            y2="440"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            opacity="0.9"
          />

          {/* Círculo central */}
          <circle
            cx="460"
            cy="315"
            r="44"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            opacity="0.9"
          />
          <circle cx="460" cy="315" r="3" fill="#FFFFFF" />

          {/* ESCUDO MAZATLÁN F.C. EN MEDIO CAMPO */}
          <g transform="translate(436, 291)" opacity="0.85">
            <circle cx="24" cy="24" r="22" fill="#2E1065" stroke="#9333EA" strokeWidth="1.5" />
            {/* Ancla estilizada */}
            <path
              d="M24 10 L24 34 M17 28 Q24 38 31 28 M19 14 L29 14"
              stroke="#FACC15"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="24" cy="11" r="2.5" fill="#FACC15" />
          </g>
          <text
            x="460"
            y="375"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="8"
            fontWeight="800"
            letterSpacing="1.5"
            opacity="0.75"
          >
            MAZATLÁN F.C.
          </text>

          {/* Área grande izquierda (Norte) */}
          <rect
            x="250"
            y="245"
            width="65"
            height="140"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            opacity="0.9"
          />
          {/* Área chica izquierda */}
          <rect
            x="250"
            y="275"
            width="25"
            height="80"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            opacity="0.9"
          />
          {/* Punto penal izq */}
          <circle cx="300" cy="315" r="2" fill="#FFFFFF" />
          {/* Portería izq */}
          <rect
            x="242"
            y="290"
            width="8"
            height="50"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="1"
            opacity="0.95"
          />

          {/* Área grande derecha (Sur) */}
          <rect
            x="605"
            y="245"
            width="65"
            height="140"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            opacity="0.9"
          />
          {/* Área chica derecha */}
          <rect
            x="645"
            y="275"
            width="25"
            height="80"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            opacity="0.9"
          />
          {/* Punto penal der */}
          <circle cx="620" cy="315" r="2" fill="#FFFFFF" />
          {/* Portería der */}
          <rect
            x="670"
            y="290"
            width="8"
            height="50"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="1"
            opacity="0.95"
          />

          {/* Bancas Poniente */}
          <rect x="360" y="452" width="60" height="7" rx="2" fill="#334155" />
          <text x="390" y="458" textAnchor="middle" fill="#94A3B8" fontSize="5" fontWeight="700">BANCA LOCAL</text>
          <rect x="500" y="452" width="60" height="7" rx="2" fill="#334155" />
          <text x="530" y="458" textAnchor="middle" fill="#94A3B8" fontSize="5" fontWeight="700">BANCA VISITA</text>
        </g>

        {/* ========================================================= */}
        {/* NIVEL 1 INFERIOR: PONIENTE (CENTRAL, LATERAL & ESQUINAS)  */}
        {/* ========================================================= */}
        {/* Poniente Central (Rojo: PC-1 a PC-4) */}
        {renderSectionBlock('PC-1', 'Poniente Central', 380, 465, 38, 26)}
        {renderSectionBlock('PC-2', 'Poniente Central', 420, 465, 38, 26)}
        {renderSectionBlock('PC-3', 'Poniente Central', 460, 465, 38, 26)}
        {renderSectionBlock('PC-4', 'Poniente Central', 500, 465, 38, 26)}

        {/* Poniente Lateral (Azul: PL-1 a PL-6) */}
        {/* Izquierda de Poniente Central */}
        {renderSectionBlock('PL-1', 'Poniente Lateral', 260, 465, 38, 26)}
        {renderSectionBlock('PL-2', 'Poniente Lateral', 300, 465, 38, 26)}
        {renderSectionBlock('PL-3', 'Poniente Lateral', 340, 465, 38, 26)}
        {/* Derecha de Poniente Central */}
        {renderSectionBlock('PL-4', 'Poniente Lateral', 540, 465, 38, 26)}
        {renderSectionBlock('PL-5', 'Poniente Lateral', 580, 465, 38, 26)}
        {renderSectionBlock('PL-6', 'Poniente Lateral', 620, 465, 38, 26)}

        {/* Tiro de Esquina (Celeste: TE-1 a TE-4) */}
        {renderSectionBlock('TE-1', 'Tiro de Esquina', 215, 465, 40, 26, 'TE-1')}
        {renderSectionBlock('TE-2', 'Tiro de Esquina', 662, 465, 40, 26, 'TE-2')}
        {renderSectionBlock('TE-3', 'Tiro de Esquina', 215, 140, 40, 26, 'TE-3')}
        {renderSectionBlock('TE-4', 'Tiro de Esquina', 662, 140, 40, 26, 'TE-4')}

        {/* ========================================================= */}
        {/* PALCOS 1 AL 22 (Barra Naranja Poniente)                   */}
        {/* ========================================================= */}
        <g
          className="cursor-pointer"
          onClick={() => onSelectSection('Palco 1')}
          onMouseEnter={() => setHoveredSection('Palcos 1 al 22')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <rect
            x="215"
            y="496"
            width="488"
            height="20"
            rx="4"
            fill="#F97316"
            stroke={
              activeSectionNumber.startsWith('Palco ') && parseInt(activeSectionNumber.split(' ')[1]) <= 22
                ? '#FBBF24'
                : '#EA580C'
            }
            strokeWidth={
              activeSectionNumber.startsWith('Palco ') && parseInt(activeSectionNumber.split(' ')[1]) <= 22 ? 3 : 1
            }
            opacity={isDimmed('Palcos') ? 0.3 : 0.95}
          />
          <text
            x="459"
            y="510"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            letterSpacing="1.2"
          >
            PALCOS 1 AL 22
          </text>
          <title>Palcos 1 al 22 (Poniente) - Puertas 3 y 4</title>
        </g>

        {/* ========================================================= */}
        {/* PONIENTE SUPERIOR (Verde Azulado / Teal: PS-1 a PS-8)     */}
        {/* ========================================================= */}
        {renderSectionBlock('PS-1', 'Poniente Superior', 200, 522, 60, 28)}
        {renderSectionBlock('PS-2', 'Poniente Superior', 263, 522, 60, 28)}
        {renderSectionBlock('PS-3', 'Poniente Superior', 326, 522, 62, 28)}
        {renderSectionBlock('PS-4', 'Poniente Superior', 391, 522, 66, 28)}
        {renderSectionBlock('PS-5', 'Poniente Superior', 460, 522, 66, 28)}
        {renderSectionBlock('PS-6', 'Poniente Superior', 529, 522, 62, 28)}
        {renderSectionBlock('PS-7', 'Poniente Superior', 594, 522, 60, 28)}
        {renderSectionBlock('PS-8', 'Poniente Superior', 657, 522, 60, 28)}

        {/* ========================================================= */}
        {/* NIVEL 1 SUPERIOR: ORIENTE (CENTRAL & LATERAL)             */}
        {/* ========================================================= */}
        {/* Oriente Central (Negro / Pizarra: OC-1 a OC-4) */}
        {renderSectionBlock('OC-1', 'Oriente Central', 380, 140, 38, 26)}
        {renderSectionBlock('OC-2', 'Oriente Central', 420, 140, 38, 26)}
        {renderSectionBlock('OC-3', 'Oriente Central', 460, 140, 38, 26)}
        {renderSectionBlock('OC-4', 'Oriente Central', 500, 140, 38, 26)}

        {/* Oriente Lateral (Morado: OL-1 a OL-6) */}
        {/* Izquierda de Oriente Central */}
        {renderSectionBlock('OL-1', 'Oriente Lateral', 260, 140, 38, 26)}
        {renderSectionBlock('OL-2', 'Oriente Lateral', 300, 140, 38, 26)}
        {renderSectionBlock('OL-3', 'Oriente Lateral', 340, 140, 38, 26)}
        {/* Derecha de Oriente Central */}
        {renderSectionBlock('OL-4', 'Oriente Lateral', 540, 140, 38, 26)}
        {renderSectionBlock('OL-5', 'Oriente Lateral', 580, 140, 38, 26)}
        {renderSectionBlock('OL-6', 'Oriente Lateral', 620, 140, 38, 26)}

        {/* ========================================================= */}
        {/* PALCOS 23 AL 42 (Barra Naranja Oriente)                   */}
        {/* ========================================================= */}
        <g
          className="cursor-pointer"
          onClick={() => onSelectSection('Palco 23')}
          onMouseEnter={() => setHoveredSection('Palcos 23 al 42')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <rect
            x="215"
            y="114"
            width="488"
            height="20"
            rx="4"
            fill="#F97316"
            stroke={
              activeSectionNumber.startsWith('Palco ') && parseInt(activeSectionNumber.split(' ')[1]) >= 23
                ? '#FBBF24'
                : '#EA580C'
            }
            strokeWidth={
              activeSectionNumber.startsWith('Palco ') && parseInt(activeSectionNumber.split(' ')[1]) >= 23 ? 3 : 1
            }
            opacity={isDimmed('Palcos') ? 0.3 : 0.95}
          />
          <text
            x="459"
            y="128"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            letterSpacing="1.2"
          >
            PALCOS 23 AL 42
          </text>
          <title>Palcos 23 al 42 (Oriente) - Puertas 3 y 4</title>
        </g>

        {/* ========================================================= */}
        {/* ORIENTE SUPERIOR (Verde: OS-1 a OS-8)                     */}
        {/* ========================================================= */}
        {renderSectionBlock('OS-1', 'Oriente Superior', 200, 80, 60, 28)}
        {renderSectionBlock('OS-2', 'Oriente Superior', 263, 80, 60, 28)}
        {renderSectionBlock('OS-3', 'Oriente Superior', 326, 80, 62, 28)}
        {renderSectionBlock('OS-4', 'Oriente Superior', 391, 80, 66, 28)}
        {renderSectionBlock('OS-5', 'Oriente Superior', 460, 80, 66, 28)}
        {renderSectionBlock('OS-6', 'Oriente Superior', 529, 80, 62, 28)}
        {renderSectionBlock('OS-7', 'Oriente Superior', 594, 80, 60, 28)}
        {renderSectionBlock('OS-8', 'Oriente Superior', 657, 80, 60, 28)}

        {/* ========================================================= */}
        {/* CABECERA NORTE (IZQUIERDA)                                */}
        {/* ========================================================= */}
        {/* ZONA LOUNGE (Barra Rosa Vertical) */}
        <g
          className="cursor-pointer"
          onClick={() => onSelectSection('ZL-1')}
          onMouseEnter={() => setHoveredSection('Zona Lounge')}
          onMouseLeave={() => setHoveredSection(null)}
        >
          <rect
            x="208"
            y="215"
            width="24"
            height="200"
            rx="5"
            fill="#EC4899"
            stroke={activeSectionNumber.startsWith('ZL-') ? '#FBBF24' : '#DB2777'}
            strokeWidth={activeSectionNumber.startsWith('ZL-') ? 3 : 1.5}
            opacity={isDimmed('Zona Lounge') ? 0.3 : 0.95}
          />
          <text
            x="-315"
            y="224"
            transform="rotate(-90)"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="9"
            fontWeight="900"
            letterSpacing="2"
          >
            ZONA LOUNGE
          </text>
          <title>Zona Lounge (Cabecera Norte) - Puertas 3 y 4</title>
        </g>

        {/* General Norte (Gris: GN-1 a GN-6) */}
        {renderSectionBlock('GN-1', 'General Norte', 160, 160, 42, 46)}
        {renderSectionBlock('GN-2', 'General Norte', 160, 210, 42, 50)}
        {renderSectionBlock('GN-3', 'General Norte', 160, 264, 42, 50)}
        {renderSectionBlock('GN-4', 'General Norte', 160, 318, 42, 50)}
        {renderSectionBlock('GN-5', 'General Norte', 160, 372, 42, 50)}
        {renderSectionBlock('GN-6', 'General Norte', 160, 426, 42, 46)}

        {/* Cabecera Superior (Verde Limón: CS-1 a CS-8) */}
        {renderSectionBlock('CS-1', 'Cabecera Superior', 105, 115, 46, 46)}
        {renderSectionBlock('CS-2', 'Cabecera Superior', 105, 165, 46, 48)}
        {renderSectionBlock('CS-3', 'Cabecera Superior', 105, 217, 46, 48)}
        {renderSectionBlock('CS-4', 'Cabecera Superior', 105, 269, 46, 46)}
        {renderSectionBlock('CS-5', 'Cabecera Superior', 105, 319, 46, 46)}
        {renderSectionBlock('CS-6', 'Cabecera Superior', 105, 369, 46, 48)}
        {renderSectionBlock('CS-7', 'Cabecera Superior', 105, 421, 46, 48)}
        {renderSectionBlock('CS-8', 'Cabecera Superior', 105, 473, 46, 46)}

        {/* ========================================================= */}
        {/* CABECERA SUR (DERECHA: GENERAL SUR AMARILLO)              */}
        {/* ========================================================= */}
        {renderSectionBlock('GS-1', 'General Sur', 710, 140, 52, 42)}
        {renderSectionBlock('GS-2', 'General Sur', 710, 186, 52, 42)}
        {renderSectionBlock('GS-3', 'General Sur', 710, 232, 52, 42)}
        {renderSectionBlock('GS-4', 'General Sur', 710, 278, 52, 42)}
        {renderSectionBlock('GS-5', 'General Sur', 710, 324, 52, 42)}
        {renderSectionBlock('GS-6', 'General Sur', 710, 370, 52, 42)}
        {renderSectionBlock('GS-7', 'General Sur', 710, 416, 52, 42)}
        {renderSectionBlock('GS-8', 'General Sur', 710, 462, 52, 42)}

        {/* ========================================================= */}
        {/* SKY BOXES (DORADO / OLIVO: SB-1 a SB-4)                   */}
        {/* ========================================================= */}
        {renderSectionBlock('SB-1', 'Sky Boxes', 156, 110, 46, 32, 'SB-1')}
        {renderSectionBlock('SB-2', 'Sky Boxes', 715, 96, 48, 36, 'SB-2')}
        {renderSectionBlock('SB-3', 'Sky Boxes', 156, 486, 46, 32, 'SB-3')}
        {renderSectionBlock('SB-4', 'Sky Boxes', 715, 510, 48, 36, 'SB-4')}

        {/* LEYENDAS CARDINALES */}
        <text x="460" y="575" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="900" letterSpacing="3">
          TRIBUNA PONIENTE
        </text>
        <text x="460" y="70" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="900" letterSpacing="3">
          TRIBUNA ORIENTE
        </text>
        <text x="75" y="320" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="900" letterSpacing="3" transform="rotate(-90 75 320)">
          CABECERA NORTE
        </text>
        <text x="785" y="320" textAnchor="middle" fill="#64748B" fontSize="10" fontWeight="900" letterSpacing="3" transform="rotate(90 785 320)">
          CABECERA SUR
        </text>
      </svg>
    </div>
  );
};

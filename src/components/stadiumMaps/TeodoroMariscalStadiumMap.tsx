import React, { useState, useMemo } from 'react';
import { SeatSection, VenueEvent } from '../../types';
import { MARISCAL_ZONES, getZonePrice } from '../../lib/seatMap';
import { ZoomIn, ZoomOut, RotateCcw, Info, Sparkles } from 'lucide-react';

interface TeodoroMariscalStadiumMapProps {
  sections: SeatSection[];
  activeSectionNumber: string;
  activeZoneFilter: string | null;
  onSelectSection: (sectionNumber: string) => void;
  event?: VenueEvent | null;
  soldOutSectionsSet?: Set<string>;
}

interface SectorDef {
  num: string;
  zone: string;
  fillColor: string;
  textColor: string;
  strokeColor?: string;
  rIn: number;
  rOut: number;
  startDeg: number;
  endDeg: number;
}

// Generador de sector anular preciso en coordenadas polares
function createAnnularSectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number,
  paddingDeg: number = 0.5
): string {
  const s = startDeg + paddingDeg;
  const e = endDeg - paddingDeg;

  const a1 = (s * Math.PI) / 180;
  const a2 = (e * Math.PI) / 180;

  const x1In = cx + rIn * Math.cos(a1);
  const y1In = cy + rIn * Math.sin(a1);
  const x2In = cx + rIn * Math.cos(a2);
  const y2In = cy + rIn * Math.sin(a2);

  const x1Out = cx + rOut * Math.cos(a1);
  const y1Out = cy + rOut * Math.sin(a1);
  const x2Out = cx + rOut * Math.cos(a2);
  const y2Out = cy + rOut * Math.sin(a2);

  const largeArc = Math.abs(e - s) > 180 ? 1 : 0;

  return `M ${x1In} ${y1In} A ${rIn} ${rIn} 0 ${largeArc} 1 ${x2In} ${y2In} L ${x2Out} ${y2Out} A ${rOut} ${rOut} 0 ${largeArc} 0 ${x1Out} ${y1Out} Z`;
}

// Cálculo del punto central para ubicar el número y rotación legible
function getSectorCenterAndRotation(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number
) {
  const midAngle = (startDeg + endDeg) / 2;
  const midR = (rIn + rOut) / 2;
  const rad = (midAngle * Math.PI) / 180;

  const x = cx + midR * Math.cos(rad);
  const y = cy + midR * Math.sin(rad);

  // Tangente a la curvatura para que el texto fluya naturalmente a lo largo del arco
  let rotDeg = midAngle + 90;
  if (rotDeg > 90 && rotDeg < 270) {
    rotDeg += 180;
  }

  return { x, y, rotDeg };
}

// Radios concéntricos unificados según el póster oficial
const R_T1_IN = 256;
const R_T1_OUT = 296;

const R_T2_IN = 302;
const R_T2_OUT = 346;

const R_T3_IN = 352;
const R_T3_OUT = 398;

// Paleta cromática exacta de la imagen del usuario
const COLOR_FAN = '#38B6FF'; // Cyan / Sky Blue (Bleachers Fila Baja)
const COLOR_FAN_PLUS = '#9FB4C7'; // Lavender Grey (Bleachers Fila Alta)
const COLOR_DELUXE = '#E4DFF0'; // White / Light Lavender (Palcos 1-12)
const COLOR_PLATINO = '#E5243B'; // Crimson Red
const COLOR_ORO = '#0292D8'; // Deep Cyan / Turquoise
const COLOR_PLUS = '#94CE3A'; // Bright Lime Green
const COLOR_DIAMANTE = '#ED6A26'; // Terracotta Orange
const COLOR_SKY = '#772582'; // Rich Royal Purple
const COLOR_SKY_PLUS = '#FA8E5C'; // Peach / Coral Warm Orange

// Definición geométrica exacta de los 86 sectores de la imagen del usuario
const SECTOR_DEFINITIONS: SectorDef[] = [
  // =========================================================================
  // 1. BLEACHERS (JARDINES SUPERIORES)
  // =========================================================================
  // Fila Baja Izquierda (Cyan 122 - 127)
  { num: '122', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 211, endDeg: 219.5 },
  { num: '123', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 219.5, endDeg: 228 },
  { num: '124', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 228, endDeg: 236.5 },
  { num: '125', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 236.5, endDeg: 245 },
  { num: '126', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 245, endDeg: 253.5 },
  { num: '127', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 253.5, endDeg: 262 },

  // Fila Alta Izquierda (Gris Lavanda 222 - 227)
  { num: '222', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 211, endDeg: 219.5 },
  { num: '223', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 219.5, endDeg: 228 },
  { num: '224', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 228, endDeg: 236.5 },
  { num: '225', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 236.5, endDeg: 245 },
  { num: '226', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 245, endDeg: 253.5 },
  { num: '227', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 253.5, endDeg: 262 },

  // Fila Baja Derecha (Cyan 128 - 133)
  { num: '128', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 278, endDeg: 286.5 },
  { num: '129', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 286.5, endDeg: 295 },
  { num: '130', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 295, endDeg: 303.5 },
  { num: '131', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 303.5, endDeg: 312 },
  { num: '132', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 312, endDeg: 320.5 },
  { num: '133', zone: 'Fan', fillColor: COLOR_FAN, textColor: '#091A2B', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 320.5, endDeg: 329 },

  // Fila Alta Derecha (Gris Lavanda 228 - 233)
  { num: '228', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 278, endDeg: 286.5 },
  { num: '229', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 286.5, endDeg: 295 },
  { num: '230', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 295, endDeg: 303.5 },
  { num: '231', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 303.5, endDeg: 312 },
  { num: '232', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 312, endDeg: 320.5 },
  { num: '233', zone: 'Fan Plus', fillColor: COLOR_FAN_PLUS, textColor: '#0F172A', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 320.5, endDeg: 329 },

  // =========================================================================
  // 2. ALA IZQUIERDA (3RA BASE: ORO, PLUS Y SKY)
  // =========================================================================
  // Oro (Cyan Nivel 100)
  { num: '121', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 163, endDeg: 172 },
  { num: '120', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 154, endDeg: 163 },
  { num: '119', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 145, endDeg: 154 },
  { num: '118', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 136, endDeg: 145 },

  // Plus (Verde Lima Nivel 200)
  { num: '221', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 163, endDeg: 172 },
  { num: '220', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 154, endDeg: 163 },
  { num: '219', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 145, endDeg: 154 },
  { num: '218', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 136, endDeg: 145 },

  // Sky (Morado Nivel 300)
  { num: '316', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 163, endDeg: 172 },
  { num: '315', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 154, endDeg: 163 },
  { num: '314', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 145, endDeg: 154 },
  { num: '313', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 136, endDeg: 145 },

  // =========================================================================
  // 3. ALA DERECHA (1RA BASE: ORO, PLUS Y SKY)
  // =========================================================================
  // Oro (Cyan Nivel 100)
  { num: '101', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 8, endDeg: 17 },
  { num: '102', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 17, endDeg: 26 },
  { num: '103', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 26, endDeg: 35 },
  { num: '104', zone: 'Oro', fillColor: COLOR_ORO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 35, endDeg: 44 },

  // Plus (Verde Lima Nivel 200)
  { num: '201', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 8, endDeg: 17 },
  { num: '202', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 17, endDeg: 26 },
  { num: '203', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 26, endDeg: 35 },
  { num: '204', zone: 'Plus', fillColor: COLOR_PLUS, textColor: '#102A05', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 35, endDeg: 44 },

  // Sky (Morado Nivel 300)
  { num: '301', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 8, endDeg: 17 },
  { num: '302', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 17, endDeg: 26 },
  { num: '303', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 26, endDeg: 35 },
  { num: '304', zone: 'Sky', fillColor: COLOR_SKY, textColor: '#FFFFFF', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 35, endDeg: 44 },

  // =========================================================================
  // 4. ANILLO INFERIOR (PLATINO ROJO + PALCOS CENTRALES 1-12)
  // =========================================================================
  // Platino Izquierdo (3ra Base: 117, 116, 115)
  { num: '117', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 131.2, endDeg: 136 },
  { num: '116', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 126.3, endDeg: 131.2 },
  { num: '115', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 121.5, endDeg: 126.3 },

  // Palcos Deluxe Supreme (Blanco/Lavanda: 12 al 1 de izquierda a derecha)
  { num: '12', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 116.6, endDeg: 121.5 },
  { num: '11', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 111.8, endDeg: 116.6 },
  { num: '10', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 106.9, endDeg: 111.8 },
  { num: '9', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 102.1, endDeg: 106.9 },
  { num: '8', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 97.2, endDeg: 102.1 },
  { num: '7', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 92.4, endDeg: 97.2 },
  { num: '6', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 87.5, endDeg: 92.4 },
  { num: '5', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 82.7, endDeg: 87.5 },
  { num: '4', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 77.8, endDeg: 82.7 },
  { num: '3', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 73.0, endDeg: 77.8 },
  { num: '2', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 68.1, endDeg: 73.0 },
  { num: '1', zone: 'Deluxe Supreme', fillColor: COLOR_DELUXE, textColor: '#0F172A', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 63.3, endDeg: 68.1 },

  // Platino Derecho (1ra Base: 108, 107, 106, 105)
  { num: '108', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 58.5, endDeg: 63.3 },
  { num: '107', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 53.6, endDeg: 58.5 },
  { num: '106', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 48.8, endDeg: 53.6 },
  { num: '105', zone: 'Platino', fillColor: COLOR_PLATINO, textColor: '#FFFFFF', rIn: R_T1_IN, rOut: R_T1_OUT, startDeg: 44.0, endDeg: 48.8 },

  // =========================================================================
  // 5. NIVEL 200 CENTRAL (DIAMANTE NARANJA: 217 AL 205)
  // =========================================================================
  { num: '217', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 128.9, endDeg: 136.0 },
  { num: '216', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 121.8, endDeg: 128.9 },
  { num: '215', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 114.8, endDeg: 121.8 },
  { num: '214', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 107.7, endDeg: 114.8 },
  { num: '213', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 100.6, endDeg: 107.7 },
  { num: '212', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 93.5, endDeg: 100.6 },
  // Pasillo central en 90°
  { num: '211', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 86.5, endDeg: 93.5 },
  { num: '210', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 79.4, endDeg: 86.5 },
  { num: '209', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 72.3, endDeg: 79.4 },
  { num: '208', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 65.2, endDeg: 72.3 },
  { num: '207', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 58.1, endDeg: 65.2 },
  { num: '206', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 51.0, endDeg: 58.1 },
  { num: '205', zone: 'Diamante', fillColor: COLOR_DIAMANTE, textColor: '#FFFFFF', rIn: R_T2_IN, rOut: R_T2_OUT, startDeg: 44.0, endDeg: 51.0 },

  // =========================================================================
  // 6. NIVEL 300 CENTRAL (SKY PLUS MELOCOTÓN: 312-310 Y 307-305)
  // Con apertura central técnica entre 310 y 307
  // =========================================================================
  { num: '312', zone: 'Sky Plus', fillColor: COLOR_SKY_PLUS, textColor: '#0F172A', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 122.0, endDeg: 136.0 },
  { num: '311', zone: 'Sky Plus', fillColor: COLOR_SKY_PLUS, textColor: '#0F172A', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 108.0, endDeg: 122.0 },
  { num: '310', zone: 'Sky Plus', fillColor: COLOR_SKY_PLUS, textColor: '#0F172A', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 95.0, endDeg: 108.0 },
  // Espacio abierto en el centro (95° a 85°)
  { num: '307', zone: 'Sky Plus', fillColor: COLOR_SKY_PLUS, textColor: '#0F172A', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 72.0, endDeg: 85.0 },
  { num: '306', zone: 'Sky Plus', fillColor: COLOR_SKY_PLUS, textColor: '#0F172A', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 58.0, endDeg: 72.0 },
  { num: '305', zone: 'Sky Plus', fillColor: COLOR_SKY_PLUS, textColor: '#0F172A', rIn: R_T3_IN, rOut: R_T3_OUT, startDeg: 44.0, endDeg: 58.0 },
];

const TeodoroMariscalStadiumMapComponent = React.memo<TeodoroMariscalStadiumMapProps>(({
  sections,
  activeSectionNumber,
  activeZoneFilter,
  onSelectSection,
  event,
  soldOutSectionsSet,
}) => {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showZoneGuide, setShowZoneGuide] = useState<boolean>(false);

  // Centro geométrico global del campo circular y las gradas
  const CX = 500;
  const CY = 480;

  const isDimmed = (zoneName: string) => {
    if (!activeZoneFilter || activeZoneFilter === 'Todas') return false;
    return activeZoneFilter !== zoneName;
  };

  const isSelected = (secNumber: string) => activeSectionNumber === secNumber;

  // Mapa de secciones para rápido acceso
  const sectionMetaMap = useMemo(() => {
    const map = new Map<string, SeatSection>();
    for (const sec of sections) {
      map.set(sec.sectionNumber, sec);
    }
    return map;
  }, [sections]);

  return (
    <div className="space-y-2.5">
      {/* Barra superior de herramientas limpia fuera del mapa para no tapar ninguna butaca */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {activeSectionNumber ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-black text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sección #{activeSectionNumber} elegida
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-500">
              Toca cualquier bloque del mapa para elegir asientos
            </span>
          )}
        </div>

        {/* Controles de zoom compactos */}
        <div className="flex items-center gap-1 bg-[#0F1626] border border-slate-700/80 rounded-xl p-0.5 shadow-sm">
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.15))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Restablecer vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowZoneGuide(!showZoneGuide)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showZoneGuide ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Guía de colores y precios"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenedor del mapa 100% libre de overlays obstructivos */}
      <div className="relative w-full aspect-square max-h-[720px] bg-[#0A0E17] rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col items-center justify-center p-1 sm:p-3 select-none">
        {/* Fondo sutil con luces de estadio nocturno */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_rgba(30,41,59,0.5)_0%,_rgba(10,14,23,0.95)_75%,_#050811_100%)] pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-44 bg-[radial-gradient(ellipse_at_bottom,_rgba(15,23,42,0.6)_0%,_transparent_70%)] pointer-events-none" />

        {/* SVG exacto a la imagen del póster */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 1000 1000"
            className="w-full h-full max-h-[680px] transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <defs>
              {/* Filtro de sección seleccionada */}
              <filter id="activeGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFFFFF" floodOpacity="0.95" />
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#F59E0B" floodOpacity="0.9" />
              </filter>
            </defs>

            {/* ======================================================== */}
            {/* 1. CAMPO CIRCULAR DE BÉISBOL (VERDE VIBRANTE)            */}
            {/* ======================================================== */}
            <g id="central-field">
              {/* Círculo completo del campo verde césped */}
              <circle
                cx={CX}
                cy={CY}
                r={250}
                fill="#77B82E"
                stroke="#1B3308"
                strokeWidth="1.5"
              />

              {/* ======================================================== */}
              {/* 2. INFIELD DIAMOND: ARCILLA NARANJA + CUADRADO VERDE     */}
              {/* ======================================================== */}
              {/* Arco de arcilla naranja con borde blanco impecable (más amplio) */}
              <path
                d="
                  M 388,622
                  C 372,510 416,424 500,424
                  C 584,424 628,510 612,622
                  L 535,698
                  C 522,708 478,708 465,698
                  Z
                "
                fill="#F79422"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinejoin="round"
              />

              {/* Diamante de pasto verde interior (cuadrado girado a 45° más grande) */}
              <polygon
                points="500,466 574,540 500,614 426,540"
                fill="#77B82E"
                stroke="#A3E635"
                strokeWidth="1.2"
              />

              {/* Líneas de Cal (Foul lines desde home hacia los jardines) */}
              <line
                x1="500"
                y1="614"
                x2="355"
                y2="469"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="500"
                y1="614"
                x2="645"
                y2="469"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Montículo del Pitcher (Círculo blanco central en el diamante) */}
              <circle cx={500} cy={540} r={13} fill="#FFFFFF" />
              <circle cx={500} cy={540} r={9.5} fill="#F79422" />
              <rect x={497} y={538.5} width={6} height={3} fill="#FFFFFF" rx={0.5} />

              {/* Almohadillas (1B, 2B, 3B en color blanco giradas a 45°) */}
              <rect x={494.5} y={460.5} width={11} height={11} fill="#FFFFFF" transform="rotate(45 500 466)" />
              <rect x={568.5} y={534.5} width={11} height={11} fill="#FFFFFF" transform="rotate(45 574 540)" />
              <rect x={420.5} y={534.5} width={11} height={11} fill="#FFFFFF" transform="rotate(45 426 540)" />

              {/* Zona de Home Plate (caja con plato pentagonal y círculos de apoyo) */}
              <g transform="translate(500, 618)">
                {/* Plato pentagonal blanco */}
                <polygon points="0,0 -6,-6 -6,-11 6,-11 6,-6" fill="#FFFFFF" />
                {/* Círculos blancos laterales de guía */}
                <circle cx={-22} cy={-5} r={4.5} fill="#FFFFFF" />
                <circle cx={22} cy={-5} r={4.5} fill="#FFFFFF" />
              </g>
            </g>

            {/* ======================================================== */}
            {/* 3. TODOS LOS 86 SECTORES RADIALES CONCÉNTRICOS          */}
            {/* ======================================================== */}
            <g id="stadium-radial-sectors">
              {SECTOR_DEFINITIONS.map((sec) => {
                const pathD = createAnnularSectorPath(
                  CX,
                  CY,
                  sec.rIn,
                  sec.rOut,
                  sec.startDeg,
                  sec.endDeg,
                  0.7
                );

                const { x: tx, y: ty, rotDeg } = getSectorCenterAndRotation(
                  CX,
                  CY,
                  sec.rIn,
                  sec.rOut,
                  sec.startDeg,
                  sec.endDeg
                );

                const selected = isSelected(sec.num);
                const hovered = hoveredSection === sec.num;
                const dimmed = isDimmed(sec.zone);
                const price = getZonePrice(sec.zone, event);
                const isSoldOut = soldOutSectionsSet ? (soldOutSectionsSet.has(sec.num) || soldOutSectionsSet.has(sec.num.toLowerCase())) : false;

                return (
                  <g
                    key={sec.num}
                    className={isSoldOut ? 'cursor-not-allowed opacity-40' : 'cursor-pointer transition-transform duration-100'}
                    onClick={() => onSelectSection(sec.num)}
                    onMouseEnter={() => setHoveredSection(sec.num)}
                    onMouseLeave={() => setHoveredSection(null)}
                  >
                    {/* Sector curvado */}
                    <path
                      d={pathD}
                      fill={isSoldOut ? '#1E293B' : selected ? '#FFFFFF' : sec.fillColor}
                      stroke={selected ? '#F59E0B' : hovered ? '#FFFFFF' : isSoldOut ? '#334155' : '#0B0F19'}
                      strokeWidth={selected ? 3 : hovered ? 2 : 1.2}
                      opacity={isSoldOut ? 0.35 : dimmed ? 0.22 : 1}
                      filter={selected ? 'url(#activeGlow)' : undefined}
                    />

                    {/* Número de la sección centrado y rotado a lo largo del arco */}
                    <text
                      x={tx}
                      y={ty + 2.5}
                      transform={`rotate(${rotDeg} ${tx} ${ty})`}
                      fill={isSoldOut ? '#64748B' : selected ? '#0F172A' : sec.textColor}
                      fontSize={sec.num.length >= 3 ? 9 : 10.5}
                      fontWeight="900"
                      letterSpacing="0.2"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {isSoldOut ? '✕' : sec.num}
                    </text>

                    {/* Tooltip flotante con información de zona y precio */}
                    {hovered && (
                      <g transform={`translate(${tx}, ${ty - 28})`} className="pointer-events-none z-50">
                        <rect
                          x={-56}
                          y={-16}
                          width={112}
                          height={32}
                          rx={7}
                          fill="#0A0E17"
                          stroke="#F59E0B"
                          strokeWidth={1.8}
                          opacity={0.98}
                        />
                        <text
                          x={0}
                          y={-2}
                          fill="#F8FAFC"
                          fontSize="9.5"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          Sección {sec.num} • {sec.zone}
                        </text>
                        <text
                          x={0}
                          y={10}
                          fill="#FBBF24"
                          fontSize="9"
                          fontWeight="bold"
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
          </svg>
        </div>
      </div>

      {/* Guía expandible de Zonas y Precios */}
      {showZoneGuide && (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400 tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Zonas y Precios Oficiales
            </div>
            <button
              onClick={() => setShowZoneGuide(false)}
              className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-2 py-0.5 rounded bg-slate-800"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(MARISCAL_ZONES).map(([name, zone]) => {
              const price = getZonePrice(name, event);
              return (
                <div
                  key={name}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50"
                >
                  <span
                    className="w-4 h-4 rounded-md shrink-0 border border-white/20 shadow-xs"
                    style={{ backgroundColor: zone.colorHex }}
                  />
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-slate-200 block truncate">
                      {name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-extrabold block">
                      ${price} MXN
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
});

TeodoroMariscalStadiumMapComponent.displayName = 'TeodoroMariscalStadiumMap';
export const TeodoroMariscalStadiumMap = TeodoroMariscalStadiumMapComponent;

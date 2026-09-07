import { VenueLayoutShape, SeatSection, VenueZone } from '../types';

export interface SeatMapPosition {
  sectionId: string;
  sectionNumber: string;
  zoneId: string;
  zoneName?: string;
  ring: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // Grados para SVG transform rotate(rotation, cx, cy)
  labelX: number;
  labelY: number;
  color?: string;
}

/**
 * Natural sort helper para números de sección (ej. "101", "Sur-02", "12")
 */
export function naturalSortKey(str?: string | number | null): number {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return str;
  if (typeof str !== 'string') return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Agrupa y ordena las secciones por su anillo (ring) y orden relativo
 */
export function groupAndSortSections(sections: SeatSection[]): {
  ringName: string;
  sections: SeatSection[];
}[] {
  if (!Array.isArray(sections)) {
    return [];
  }
  const ringMap = new Map<string, SeatSection[]>();

  for (const sec of sections) {
    if (!sec || typeof sec !== 'object') continue;
    const ringKey = (sec.ring && typeof sec.ring === 'string' && sec.ring.trim()) || 'Principal';
    if (!ringMap.has(ringKey)) {
      ringMap.set(ringKey, []);
    }
    ringMap.get(ringKey)!.push(sec);
  }

  // Ordenar secciones dentro de cada ring
  const result: { ringName: string; sections: SeatSection[] }[] = [];
  for (const [ringName, secList] of ringMap.entries()) {
    secList.sort((a, b) => {
      if (a?.order !== undefined && b?.order !== undefined && a.order !== b.order) {
        return a.order - b.order;
      }
      return naturalSortKey(a?.sectionNumber) - naturalSortKey(b?.sectionNumber);
    });
    result.push({ ringName, sections: secList });
  }

  // Ordenar rings: detectar nombres clave o número de nivel para ordenar de adentro hacia afuera
  result.sort((a, b) => {
    const ringWeight = (name: string): number => {
      const lower = (name || '').toLowerCase();
      if (lower.includes('deluxe') || lower.includes('vip') || lower.includes('baja')) return 1;
      if (lower.includes('100') || lower.includes('nivel 1') || lower.includes('primer')) return 2;
      if (lower.includes('200') || lower.includes('nivel 2') || lower.includes('segundo')) return 3;
      if (lower.includes('300') || lower.includes('nivel 3') || lower.includes('sky')) return 4;
      if (lower.includes('palco')) return 5;
      return 10;
    };
    return ringWeight(a.ringName) - ringWeight(b.ringName);
  });

  return result;
}

/**
 * Motor de distribución 1: Béisbol / Herradura (baseball_horseshoe)
 * Distribuye las secciones de cada nivel en una herradura alrededor del diamante.
 */
function layoutBaseballHorseshoe(
  groupedRings: { ringName: string; sections: SeatSection[] }[],
  zonesMap?: Record<string, VenueZone>
): SeatMapPosition[] {
  const positions: SeatMapPosition[] = [];
  const homeX = 400;
  const homeY = 460;

  groupedRings.forEach((ringGroup, ringIndex) => {
    const ringNameLower = ringGroup.ringName.toLowerCase();
    const isDeluxeTight =
      ringNameLower.includes('deluxe') || (ringIndex === 0 && ringGroup.sections.length <= 14);

    const N = ringGroup.sections.length;
    if (N === 0) return;

    if (isDeluxeTight) {
      // Anillo muy cercano detrás del Home (ej. Deluxe Supreme 1-12)
      const radius = 68;
      const startAngle = 20; // Grados
      const endAngle = 160;

      ringGroup.sections.forEach((sec, i) => {
        const t = N === 1 ? 0.5 : i / (N - 1);
        const deg = startAngle + t * (endAngle - startAngle);
        const rad = (deg * Math.PI) / 180;
        // En SVG: Y crece hacia abajo, por lo que detrás de home es Y > homeY
        const px = homeX - radius * Math.cos(rad);
        const py = homeY + radius * Math.sin(rad) * 0.75;
        const rot = -(deg - 90) * 0.6;
        const zoneColor = sec.zoneId && zonesMap?.[sec.zoneId]?.color;

        positions.push({
          sectionId: sec.id,
          sectionNumber: sec.sectionNumber,
          zoneId: sec.zoneId,
          zoneName: sec.zoneName || zonesMap?.[sec.zoneId]?.name,
          ring: ringGroup.ringName,
          order: sec.order ?? i + 1,
          x: Math.round(px - 16),
          y: Math.round(py - 10),
          width: 32,
          height: 19,
          rotation: Math.round(rot),
          labelX: Math.round(px),
          labelY: Math.round(py + 4),
          color: zoneColor,
        });
      });
    } else {
      // Curva de herradura concéntrica (Nivel 100, Nivel 200, Nivel 300, etc.)
      // Radio concéntrico creciente por anillo
      const ringRadiusOffset = (ringIndex - (groupedRings[0]?.ringName.toLowerCase().includes('deluxe') ? 1 : 0)) * 38;
      const baseRadiusX = 145 + Math.max(0, ringRadiusOffset);
      const baseRadiusY = 115 + Math.max(0, ringRadiusOffset * 0.9);
      const foulLineTopY = Math.max(160, 210 - Math.max(0, ringRadiusOffset * 0.6));

      ringGroup.sections.forEach((sec, i) => {
        const t = N === 1 ? 0.5 : i / (N - 1); // 0 (izq/jardín izq) a 1 (der/jardín der)
        let px = 0;
        let py = 0;
        let rot = 0;

        if (t <= 0.25) {
          // Línea lateral izquierda hacia 3ra base / jardín izquierdo
          const subT = t / 0.25; // 0 a 1
          const startX = homeX - baseRadiusX - 110;
          const startY = foulLineTopY;
          const endX = homeX - baseRadiusX;
          const endY = homeY - 20;
          px = startX + subT * (endX - startX);
          py = startY + subT * (endY - startY);
          rot = -25 + subT * 15;
        } else if (t >= 0.75) {
          // Línea lateral derecha hacia 1ra base / jardín derecho
          const subT = (t - 0.75) / 0.25; // 0 a 1
          const startX = homeX + baseRadiusX;
          const startY = homeY - 20;
          const endX = homeX + baseRadiusX + 110;
          const endY = foulLineTopY;
          px = startX + subT * (endX - startX);
          py = startY + subT * (endY - startY);
          rot = 10 + subT * 15;
        } else {
          // Arco detrás de home plate (t entre 0.25 y 0.75)
          const subT = (t - 0.25) / 0.5; // 0 a 1
          const arcAngle = 180 - subT * 180; // 180° a 0°
          const rad = (arcAngle * Math.PI) / 180;
          px = homeX - baseRadiusX * Math.cos(rad);
          py = homeY + baseRadiusY * Math.sin(rad);
          rot = -(arcAngle - 90) * 0.45;
        }

        const zoneColor = sec.zoneId && zonesMap?.[sec.zoneId]?.color;
        positions.push({
          sectionId: sec.id,
          sectionNumber: sec.sectionNumber,
          zoneId: sec.zoneId,
          zoneName: sec.zoneName || zonesMap?.[sec.zoneId]?.name,
          ring: ringGroup.ringName,
          order: sec.order ?? i + 1,
          x: Math.round(px - 17),
          y: Math.round(py - 10),
          width: 34,
          height: 20,
          rotation: Math.round(rot),
          labelX: Math.round(px),
          labelY: Math.round(py + 4),
          color: zoneColor,
        });
      });
    }
  });

  return positions;
}

/**
 * Motor de distribución 2: Tazón rectangular (rectangular_bowl)
 * Adecuado para estadios de fútbol tipo Estadio Encanto, distribuyendo
 * las secciones en 4 lados perimetrales concéntricos (Cabecera Norte,
 * Oriente, Cabecera Sur, Poniente) con esquinas redondeadas.
 */
function layoutRectangularBowl(
  groupedRings: { ringName: string; sections: SeatSection[] }[],
  zonesMap?: Record<string, VenueZone>
): SeatMapPosition[] {
  const positions: SeatMapPosition[] = [];
  const fieldCenterX = 400;
  const fieldCenterY = 310;

  groupedRings.forEach((ringGroup, ringIndex) => {
    const N = ringGroup.sections.length;
    if (N === 0) return;

    // Dimensiones perimetrales del anillo (concéntricas)
    const ringPad = ringIndex * 48;
    const ringW = 460 + ringPad;
    const ringH = 300 + ringPad * 0.8;
    const leftX = fieldCenterX - ringW / 2;
    const rightX = fieldCenterX + ringW / 2;
    const topY = fieldCenterY - ringH / 2;
    const bottomY = fieldCenterY + ringH / 2;

    const perimeter = 2 * (ringW + ringH);

    ringGroup.sections.forEach((sec, i) => {
      // Posición proporcional a lo largo del perímetro cerrado
      const dist = ((i + 0.5) / N) * perimeter;
      let px = 0;
      let py = 0;
      let width = 36;
      let height = 22;
      let rot = 0;

      if (dist < ringW) {
        // 1. Lado Norte / Cabecera Norte (de izquierda a derecha)
        const d = dist;
        px = leftX + d;
        py = topY;
        width = 36;
        height = 22;
        rot = 0;
      } else if (dist < ringW + ringH) {
        // 2. Lado Este / Tribuna Oriente (de arriba hacia abajo)
        const d = dist - ringW;
        px = rightX;
        py = topY + d;
        width = 22;
        height = 36;
        rot = 0;
      } else if (dist < 2 * ringW + ringH) {
        // 3. Lado Sur / Cabecera Sur (de derecha a izquierda)
        const d = dist - (ringW + ringH);
        px = rightX - d;
        py = bottomY;
        width = 36;
        height = 22;
        rot = 0;
      } else {
        // 4. Lado Oeste / Tribuna Poniente (de abajo hacia arriba)
        const d = dist - (2 * ringW + ringH);
        px = leftX;
        py = bottomY - d;
        width = 22;
        height = 36;
        rot = 0;
      }

      const zoneColor = sec.zoneId && zonesMap?.[sec.zoneId]?.color;
      positions.push({
        sectionId: sec.id,
        sectionNumber: sec.sectionNumber,
        zoneId: sec.zoneId,
        zoneName: sec.zoneName || zonesMap?.[sec.zoneId]?.name,
        ring: ringGroup.ringName,
        order: sec.order ?? i + 1,
        x: Math.round(px - width / 2),
        y: Math.round(py - height / 2),
        width,
        height,
        rotation: rot,
        labelX: Math.round(px),
        labelY: Math.round(py + 4),
        color: zoneColor,
      });
    });
  });

  return positions;
}

/**
 * Motor de distribución 3: Teatro en abanico (fan_theater)
 * Abanico frontal semicircular con escenario en la parte superior.
 */
function layoutFanTheater(
  groupedRings: { ringName: string; sections: SeatSection[] }[],
  zonesMap?: Record<string, VenueZone>
): SeatMapPosition[] {
  const positions: SeatMapPosition[] = [];
  const stageX = 400;
  const stageY = 110;

  groupedRings.forEach((ringGroup, ringIndex) => {
    const N = ringGroup.sections.length;
    if (N === 0) return;

    const ringRadius = 170 + ringIndex * 55;
    const startAngle = 35; // Grados
    const endAngle = 145;

    ringGroup.sections.forEach((sec, i) => {
      const t = N === 1 ? 0.5 : i / (N - 1);
      const deg = startAngle + t * (endAngle - startAngle);
      const rad = (deg * Math.PI) / 180;
      const px = stageX + ringRadius * Math.cos(rad);
      const py = stageY + ringRadius * Math.sin(rad);
      const rot = deg - 90;
      const zoneColor = sec.zoneId && zonesMap?.[sec.zoneId]?.color;

      positions.push({
        sectionId: sec.id,
        sectionNumber: sec.sectionNumber,
        zoneId: sec.zoneId,
        zoneName: sec.zoneName || zonesMap?.[sec.zoneId]?.name,
        ring: ringGroup.ringName,
        order: sec.order ?? i + 1,
        x: Math.round(px - 17),
        y: Math.round(py - 11),
        width: 34,
        height: 22,
        rotation: Math.round(rot),
        labelX: Math.round(px),
        labelY: Math.round(py + 4),
        color: zoneColor,
      });
    });
  });

  return positions;
}

/**
 * Generador maestro de posiciones de mapa de asientos según la forma arquitectónica
 */
export function generateSeatMapLayout(
  shape: VenueLayoutShape | SeatSection[] = 'baseball_horseshoe',
  sectionsInput: SeatSection[] | VenueLayoutShape = [],
  zonesInput?: Record<string, VenueZone> | VenueZone[]
): SeatMapPosition[] {
  let resolvedShape: VenueLayoutShape = 'baseball_horseshoe';
  let resolvedSections: SeatSection[] = [];

  // Tolerar si los parámetros fueron invertidos por llamada externa
  if (Array.isArray(shape)) {
    resolvedSections = shape;
    resolvedShape = typeof sectionsInput === 'string' ? sectionsInput : 'baseball_horseshoe';
  } else {
    resolvedShape = typeof shape === 'string' ? shape : 'baseball_horseshoe';
    resolvedSections = Array.isArray(sectionsInput) ? sectionsInput : [];
  }

  if (!resolvedSections || resolvedSections.length === 0) {
    return [];
  }

  // Normalizar mapa de zonas si se proporcionó un array
  let resolvedZonesMap: Record<string, VenueZone> | undefined;
  if (Array.isArray(zonesInput)) {
    resolvedZonesMap = {};
    for (const z of zonesInput) {
      if (z && z.id) resolvedZonesMap[z.id] = z;
    }
  } else if (zonesInput && typeof zonesInput === 'object') {
    resolvedZonesMap = zonesInput;
  }

  const grouped = groupAndSortSections(resolvedSections);

  switch (resolvedShape) {
    case 'rectangular_bowl':
      return layoutRectangularBowl(grouped, resolvedZonesMap);
    case 'fan_theater':
      return layoutFanTheater(grouped, resolvedZonesMap);
    case 'baseball_horseshoe':
    default:
      return layoutBaseballHorseshoe(grouped, resolvedZonesMap);
  }
}

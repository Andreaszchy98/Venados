import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  runTransaction,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { SeatSection, EventSeat, SeatStatus, VenueEvent, Ticket } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';
import { handleFirestoreError, OperationType } from './errorHandler';
import { getCachedData, setCachedData } from './clientCache';
import { isEventPassed } from './venueEvents';

export interface ZoneMeta {
  name: string;
  defaultPrice: number;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
  fillColor: string;
  strokeColor: string;
  description: string;
  gate?: string;
}

export const MARISCAL_ZONES: Record<string, ZoneMeta> = {
  'Deluxe Supreme': {
    name: 'Deluxe Supreme',
    defaultPrice: 950,
    colorHex: '#E4DFF0',
    badgeBg: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    badgeText: 'text-indigo-950',
    fillColor: '#E4DFF0',
    strokeColor: '#C4B5FD',
    gate: 'Puerta Principal / VIP',
    description: 'Nivel central bajo exclusivo junto al Home Plate (Sec. 1-12)',
  },
  'Platino': {
    name: 'Platino',
    defaultPrice: 750,
    colorHex: '#DC2626',
    badgeBg: 'bg-red-500/15 text-red-600 border-red-500/30',
    badgeText: 'text-red-500',
    fillColor: '#DC2626',
    strokeColor: '#B91C1C',
    gate: 'Puertas 1 y 2',
    description: 'Laterales bajas del infield en color rojo (Sec. 105-108, 115-117)',
  },
  'Diamante': {
    name: 'Diamante',
    defaultPrice: 600,
    colorHex: '#EA580C',
    badgeBg: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    badgeText: 'text-orange-500',
    fillColor: '#EA580C',
    strokeColor: '#C2410C',
    gate: 'Puertas 1 y 2',
    description: 'Herraje central nivel 200 en color naranja terracota (Sec. 205-217)',
  },
  'Oro': {
    name: 'Oro',
    defaultPrice: 480,
    colorHex: '#0284C7',
    badgeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
    badgeText: 'text-sky-500',
    fillColor: '#0284C7',
    strokeColor: '#0369A1',
    gate: 'Puertas 2 y 4',
    description: 'Líneas de 1ra y 3ra base en color azul turquesa (Sec. 101-104, 118-121)',
  },
  'Sky Plus': {
    name: 'Sky Plus',
    defaultPrice: 400,
    colorHex: '#FB923C',
    badgeBg: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    badgeText: 'text-amber-500',
    fillColor: '#FB923C',
    strokeColor: '#EA580C',
    gate: 'Rampa Nivel 300',
    description: 'Nivel 300 central en color melocotón (Sec. 305-307, 310-312)',
  },
  'Plus': {
    name: 'Plus',
    defaultPrice: 350,
    colorHex: '#84CC16',
    badgeBg: 'bg-lime-500/15 text-lime-700 border-lime-500/30',
    badgeText: 'text-lime-700',
    fillColor: '#84CC16',
    strokeColor: '#65A30D',
    gate: 'Puertas 4 y 8',
    description: 'Nivel 200 lateral en color verde lima (Sec. 201-204, 218-221)',
  },
  'Fan': {
    name: 'Fan',
    defaultPrice: 220,
    colorHex: '#38BDF8',
    badgeBg: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
    badgeText: 'text-cyan-600',
    fillColor: '#38BDF8',
    strokeColor: '#0284C7',
    gate: 'Puertas 6 y 8 (Bleachers)',
    description: 'Jardines bajos en color celeste sobre la barda (Sec. 122-127, 128-133)',
  },
  'Fan Plus': {
    name: 'Fan Plus',
    defaultPrice: 280,
    colorHex: '#94A3B8',
    badgeBg: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
    badgeText: 'text-slate-200',
    fillColor: '#94A3B8',
    strokeColor: '#64748B',
    gate: 'Puertas 6 y 8 (Bleachers)',
    description: 'Jardines altos nivel 200 en color gris lavanda (Sec. 222-227, 228-233)',
  },
  'Sky': {
    name: 'Sky',
    defaultPrice: 160,
    colorHex: '#7C3AED',
    badgeBg: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
    badgeText: 'text-purple-600',
    fillColor: '#7C3AED',
    strokeColor: '#6D28D9',
    gate: 'Rampa Nivel 300',
    description: 'Nivel 300 lateral en color morado (Sec. 301-304, 313-316)',
  },
};

/**
 * Zonas oficiales de Estadio El Encanto (Dorados de Sinaloa)
 * Conforme a la distribución física oficial y puertas de acceso
 */
export const ENCANTO_ZONES: Record<string, ZoneMeta> = {
  'Poniente Central': {
    name: 'Poniente Central',
    defaultPrice: 650,
    colorHex: '#DC2626',
    badgeBg: 'bg-red-500/15 text-red-600 border-red-500/30',
    badgeText: 'text-red-500',
    fillColor: '#DC2626',
    strokeColor: '#991B1B',
    gate: 'Puerta 1',
    description: 'Nivel central poniente baja, vista directa a bancas y media cancha',
  },
  'Oriente Central': {
    name: 'Oriente Central',
    defaultPrice: 600,
    colorHex: '#0F172A',
    badgeBg: 'bg-slate-800/15 text-slate-800 border-slate-700/30',
    badgeText: 'text-slate-800',
    fillColor: '#0F172A',
    strokeColor: '#000000',
    gate: 'Puerta 1',
    description: 'Nivel central oriente frente al tiro de cámaras de transmisión',
  },
  'Poniente Lateral': {
    name: 'Poniente Lateral',
    defaultPrice: 480,
    colorHex: '#0284C7',
    badgeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
    badgeText: 'text-sky-500',
    fillColor: '#0284C7',
    strokeColor: '#0369A1',
    gate: 'Puerta 1',
    description: 'Grada lateral poniente con excelente ángulo al terreno de juego',
  },
  'Oriente Lateral': {
    name: 'Oriente Lateral',
    defaultPrice: 450,
    colorHex: '#D97706',
    badgeBg: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    badgeText: 'text-amber-500',
    fillColor: '#D97706',
    strokeColor: '#B45309',
    gate: 'Puerta 1',
    description: 'Grada lateral oriente con cercanía a las bandas de juego',
  },
  'Poniente Superior': {
    name: 'Poniente Superior',
    defaultPrice: 360,
    colorHex: '#0D9488',
    badgeBg: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
    badgeText: 'text-teal-500',
    fillColor: '#0D9488',
    strokeColor: '#0F766E',
    gate: 'Puerta 6',
    description: 'Grada alta poniente con visión panorámica completa del campo',
  },
  'Oriente Superior': {
    name: 'Oriente Superior',
    defaultPrice: 320,
    colorHex: '#16A34A',
    badgeBg: 'bg-green-500/15 text-green-600 border-green-500/30',
    badgeText: 'text-green-500',
    fillColor: '#16A34A',
    strokeColor: '#15803D',
    gate: 'Puerta 2',
    description: 'Nivel alto oriente con amplia cobertura del estadio',
  },
  'General Sur': {
    name: 'General Sur',
    defaultPrice: 220,
    colorHex: '#EAB308',
    badgeBg: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
    badgeText: 'text-yellow-600',
    fillColor: '#EAB308',
    strokeColor: '#CA8A04',
    gate: 'Puerta 1',
    description: 'Cabecera sur detrás de portería, zona de la porra y afición local',
  },
  'General Norte': {
    name: 'General Norte',
    defaultPrice: 200,
    colorHex: '#6B7280',
    badgeBg: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
    badgeText: 'text-slate-200',
    fillColor: '#6B7280',
    strokeColor: '#4B5563',
    gate: 'Puerta 3',
    description: 'Cabecera norte baja, ambiente familiar y festivo',
  },
  'Cabecera Superior': {
    name: 'Cabecera Superior',
    defaultPrice: 250,
    colorHex: '#84CC16',
    badgeBg: 'bg-lime-500/15 text-lime-600 border-lime-500/30',
    badgeText: 'text-lime-600',
    fillColor: '#84CC16',
    strokeColor: '#65A30D',
    gate: 'Puerta 5',
    description: 'Grada alta norte detrás de portería con vista elevada',
  },
  'Tiro de Esquina': {
    name: 'Tiro de Esquina',
    defaultPrice: 290,
    colorHex: '#38BDF8',
    badgeBg: 'bg-sky-400/15 text-sky-500 border-sky-400/30',
    badgeText: 'text-sky-500',
    fillColor: '#38BDF8',
    strokeColor: '#0284C7',
    gate: 'Puerta 1',
    description: 'Vértices de tiro de esquina en las cuatro esquinas de la cancha',
  },
  'Palcos': {
    name: 'Palcos',
    defaultPrice: 1200,
    colorHex: '#F97316',
    badgeBg: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    badgeText: 'text-orange-500',
    fillColor: '#F97316',
    strokeColor: '#EA580C',
    gate: 'Puertas 3 y 4',
    description: 'Palcos privados 1 al 22 (Poniente) y 23 al 42 (Oriente) con servicio exclusivo',
  },
  'Sky Boxes': {
    name: 'Sky Boxes',
    defaultPrice: 1400,
    colorHex: '#A1A134',
    badgeBg: 'bg-yellow-600/15 text-yellow-700 border-yellow-600/30',
    badgeText: 'text-yellow-700',
    fillColor: '#A1A134',
    strokeColor: '#858528',
    gate: 'Puertas 3 y 4',
    description: 'Palcos corporativos superiores en nivel club',
  },
  'Zona Lounge': {
    name: 'Zona Lounge',
    defaultPrice: 1100,
    colorHex: '#EC4899',
    badgeBg: 'bg-pink-500/15 text-pink-600 border-pink-500/30',
    badgeText: 'text-pink-500',
    fillColor: '#EC4899',
    strokeColor: '#DB2777',
    gate: 'Puertas 3 y 4',
    description: 'Área lounge VIP con bar y vista a nivel de cancha',
  },
};

export interface StadiumAccessGateInfo {
  gate: string;
  zones: string[];
}

export const ENCANTO_GATES_GUIDE: StadiumAccessGateInfo[] = [
  { gate: 'Puerta 5', zones: ['Cabecera Superior'] },
  { gate: 'Puerta 1', zones: ['General Sur', 'Poniente Central', 'Oriente Central', 'Oriente Lateral', 'Poniente Lateral', 'Tiro de Esquina'] },
  { gate: 'Puerta 3', zones: ['General Norte'] },
  { gate: 'Puerta 2', zones: ['Oriente Superior'] },
  { gate: 'Puerta 6', zones: ['Poniente Superior'] },
  { gate: 'Puertas 3 y 4', zones: ['Sky Boxes', 'Zona Lounge', 'Palcos (1 al 42)'] },
];

/**
 * Detecta si la sede o evento corresponde a Estadio El Encanto
 */
export function isEncantoVenue(venueId?: string, venueName?: string, eventType?: string): boolean {
  if (venueId === 'venue-encanto' || venueId === 'estadio-encanto') {
    return true;
  }
  const name = (venueName || '').toLowerCase();
  if (
    name.includes('encanto') ||
    name.includes('dorados') ||
    name.includes('el gran pez')
  ) {
    return true;
  }
  return false;
}

/**
 * Patrones y nombres de secciones obsoletas / anteriores que deben ser eliminadas.
 * (preferente lateral, norte, este, platea baja, bleachers, etc.)
 */
export const LEGACY_SECTION_PATTERNS = [
  /preferente\s*lateral/i,
  /platea\s*baja/i,
  /platea\s*central/i,
  /bleachers/i,
  /palco\s*vip\s*premier/i,
  /gradas?\s*generales?/i,
  /lateral\s*preferente/i,
  /central\s*vip/i,
  /palco\s*corporativo/i,
  /^norte$/i,
  /^este$/i,
  /^sur$/i,
  /^poniente$/i,
  /^oriente$/i,
];

/**
 * Comprueba si un nombre de sección es de las anteriores / obsoletas
 */
export function isLegacySection(sectionName: string): boolean {
  if (!sectionName) return true;
  const clean = sectionName.trim();
  return LEGACY_SECTION_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Retorna las zonas oficiales según el estadio seleccionado
 */
export function getStadiumZones(
  venueId?: string,
  venueName?: string,
  eventType?: string
): Record<string, ZoneMeta> {
  if (isEncantoVenue(venueId, venueName, eventType)) {
    return ENCANTO_ZONES;
  }
  return MARISCAL_ZONES;
}

/**
 * Obtiene la lista predeterminada de secciones y precios oficiales para un recinto
 * basada 100% en las zonas que aparecen en el mapa físico.
 */
export function getOfficialPriceTiersForVenue(
  venueId?: string,
  venueName?: string,
  eventType?: string
): { section: string; price: number }[] {
  const zones = getStadiumZones(venueId, venueName, eventType);
  return Object.values(zones).map((z) => ({
    section: z.name,
    price: z.defaultPrice,
  }));
}

/**
 * Resuelve y sanitiza la lista de secciones y precios para un evento específico.
 * - Elimina por completo las secciones anteriores (preferente lateral, norte, este, platea baja, bleachers, etc.)
 * - Devuelve exactamente las secciones que aparecen en el mapa del estadio.
 * - Si el evento tiene un precio personalizado para una sección oficial del mapa, lo conserva.
 */
export function getOfficialPriceTiersForEvent(
  event?: VenueEvent | null,
  venueName?: string
): { section: string; price: number }[] {
  const targetVenueId = event?.venueId;
  const targetVenueName = venueName || event?.venueName;
  const targetType = event?.type;
  const officialZones = getStadiumZones(targetVenueId, targetVenueName, targetType);

  // Mapear cada zona oficial del mapa con el precio del evento (si existe y no es legacy) o su precio predeterminado del mapa
  return Object.values(officialZones).map((zone) => {
    let finalPrice = zone.defaultPrice;

    if (event && event.priceTiers && event.priceTiers.length > 0) {
      // Buscar coincidencia exacta con nombre de la zona oficial
      const match = event.priceTiers.find(
        (t) =>
          !isLegacySection(t.section) &&
          t.section.toLowerCase().trim() === zone.name.toLowerCase().trim()
      );
      if (match && typeof match.price === 'number' && match.price > 0) {
        finalPrice = match.price;
      }
    }

    return {
      section: zone.name,
      price: finalPrice,
    };
  });
}

/**
 * Resuelve el precio por zona para un evento específico
 */
export function getZonePrice(zoneName: string, event?: VenueEvent | null): number {
  if (event && event.priceTiers && event.priceTiers.length > 0) {
    const match = event.priceTiers.find(
      (t) =>
        !isLegacySection(t.section) &&
        t.section.toLowerCase().trim() === zoneName.toLowerCase().trim()
    );
    if (match) return match.price;
  }
  const zones = getStadiumZones(event?.venueId, event?.venueName, event?.type);
  return zones[zoneName]?.defaultPrice || MARISCAL_ZONES[zoneName]?.defaultPrice || 350;
}

/**
 * Generador de las definiciones oficiales del Estadio Teodoro Mariscal
 * tomando la data oficial de venta de boletos del club:
 *
 * Zona            | Secciones
 * ------------------------------------------------------------
 * Deluxe Supreme  | 1-12 (central baja, junto al home)
 * Diamante        | 101, 108, 201, 208
 * Platino         | 104-107, 204-207 (las más cercanas al home)
 * Oro             | 102-103, 202-203
 * Sky Plus        | 109-117, 209-217
 * Plus            | 118-121, 218-221
 * Fan             | 122-127, 222-227
 * Fan Plus        | 128-133, 228-233
 * Sky             | 301-316
 */
export function buildMariscalSectionsData(venueId: string): Omit<SeatSection, 'id'>[] {
  const sections: Omit<SeatSection, 'id'>[] = [];

  const defaultProps = {
    venueId,
    totalSeats: 30,
    rows: 3,
    seatsPerRow: 10,
  };

  // 1. Deluxe Supreme: 1 a 12 (central baja junto a Home Plate)
  for (let i = 1; i <= 12; i++) {
    sections.push({
      ...defaultProps,
      sectionNumber: String(i),
      zoneName: 'Deluxe Supreme',
    });
  }

  // 2. Platino (Rojo): 105-108 (1ra base) y 115-117 (3ra base)
  for (const s of [105, 106, 107, 108, 115, 116, 117]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Platino' });
  }

  // 3. Oro (Azul Turquesa): 101-104 (1ra base) y 118-121 (3ra base)
  for (const s of [101, 102, 103, 104, 118, 119, 120, 121]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Oro' });
  }

  // 4. Diamante (Naranja Terracota): Herraje central nivel 200 (205-217)
  for (let i = 205; i <= 217; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Diamante' });
  }

  // 5. Plus (Verde Lima): Nivel 200 lateral (201-204 y 218-221)
  for (const s of [201, 202, 203, 204, 218, 219, 220, 221]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Plus' });
  }

  // 6. Fan (Celeste): Jardines Bajos sobre barda (122-127 y 128-133)
  for (let i = 122; i <= 133; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan' });
  }

  // 7. Fan Plus (Gris Lavanda): Jardines Altos nivel 200 (222-227 y 228-233)
  for (let i = 222; i <= 233; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan Plus' });
  }

  // 8. Sky (Morado): Nivel 300 lateral (301-304 y 313-316)
  for (const s of [301, 302, 303, 304, 313, 314, 315, 316]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Sky' });
  }

  // 9. Sky Plus (Melocotón): Nivel 300 central (305-307 y 310-312)
  for (const s of [305, 306, 307, 310, 311, 312]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Sky Plus' });
  }

  return sections;
}

/**
 * Generador de las definiciones oficiales de secciones de Estadio El Encanto (Dorados de Sinaloa)
 * Conforme a la distribución física oficial:
 *
 * Zona               | Secciones
 * ------------------------------------------------------------
 * Poniente Central   | PC-1 a PC-4 (Nivel central poniente baja, Puerta 1)
 * Poniente Lateral   | PL-1 a PL-6 (Grada lateral poniente, Puerta 1)
 * Poniente Superior  | PS-1 a PS-8 (Grada alta poniente panorámica, Puerta 6)
 * Oriente Central    | OC-1 a OC-4 (Nivel central oriente frente a cámaras, Puerta 1)
 * Oriente Lateral    | OL-1 a OL-6 (Grada lateral oriente, Puerta 1)
 * Oriente Superior   | OS-1 a OS-8 (Nivel alto oriente, Puerta 2)
 * Cabecera Superior  | CS-1 a CS-8 (Grada alta norte detrás de portería, Puerta 5)
 * General Norte      | GN-1 a GN-6 (Cabecera norte baja, Puerta 3)
 * General Sur        | GS-1 a GS-8 (Cabecera sur porra de Dorados y afición local, Puerta 1)
 * Tiro de Esquina    | TE-1 a TE-4 (Vértices de córner, Puerta 1)
 * Sky Boxes          | SB-1 a SB-4 (Palcos corporativos superiores, Puertas 3 y 4)
 * Zona Lounge        | ZL-1, ZL-2  (Área lounge VIP cabecera norte, Puertas 3 y 4)
 * Palcos 1 al 22     | Palco 1 a Palco 22 (Palcos Poniente, Puertas 3 y 4)
 * Palcos 23 al 42    | Palco 23 a Palco 42 (Palcos Oriente, Puertas 3 y 4)
 */
export function buildEncantoSectionsData(venueId: string = 'venue-encanto'): Omit<SeatSection, 'id'>[] {
  const sections: Omit<SeatSection, 'id'>[] = [];

  const addSecs = (prefix: string, count: number, zoneName: string, rows = 3, seatsPerRow = 10) => {
    for (let i = 1; i <= count; i++) {
      sections.push({
        venueId,
        sectionNumber: `${prefix}-${i}`,
        zoneName,
        rows,
        seatsPerRow,
        totalSeats: rows * seatsPerRow,
      });
    }
  };

  // Poniente Central (Puerta 1): PC-1 a PC-4
  addSecs('PC', 4, 'Poniente Central', 3, 10);

  // Poniente Lateral (Puerta 1): PL-1 a PL-6
  addSecs('PL', 6, 'Poniente Lateral', 3, 10);

  // Poniente Superior (Puerta 6): PS-1 a PS-8
  addSecs('PS', 8, 'Poniente Superior', 3, 10);

  // Oriente Central (Puerta 1): OC-1 a OC-4
  addSecs('OC', 4, 'Oriente Central', 3, 10);

  // Oriente Lateral (Puerta 1): OL-1 a OL-6
  addSecs('OL', 6, 'Oriente Lateral', 3, 10);

  // Oriente Superior (Puerta 2): OS-1 a OS-8
  addSecs('OS', 8, 'Oriente Superior', 3, 10);

  // Cabecera Superior (Puerta 5): CS-1 a CS-8
  addSecs('CS', 8, 'Cabecera Superior', 3, 10);

  // General Norte (Puerta 3): GN-1 a GN-6
  addSecs('GN', 6, 'General Norte', 3, 10);

  // General Sur (Puerta 1): GS-1 a GS-8
  addSecs('GS', 8, 'General Sur', 3, 10);

  // Tiro de Esquina (Puerta 1): TE-1 a TE-4
  addSecs('TE', 4, 'Tiro de Esquina', 3, 10);

  // Sky Boxes (Puertas 3 y 4): SB-1 a SB-4
  addSecs('SB', 4, 'Sky Boxes', 2, 8);

  // Zona Lounge (Puertas 3 y 4): ZL-1, ZL-2
  addSecs('ZL', 2, 'Zona Lounge', 2, 10);

  // Palcos 1 al 22 (Poniente, Puertas 3 y 4)
  for (let i = 1; i <= 22; i++) {
    sections.push({
      venueId,
      sectionNumber: `Palco ${i}`,
      zoneName: 'Palcos',
      rows: 2,
      seatsPerRow: 6,
      totalSeats: 12,
    });
  }

  // Palcos 23 al 42 (Oriente, Puertas 3 y 4)
  for (let i = 23; i <= 42; i++) {
    sections.push({
      venueId,
      sectionNumber: `Palco ${i}`,
      zoneName: 'Palcos',
      rows: 2,
      seatsPerRow: 6,
      totalSeats: 12,
    });
  }

  return sections;
}

/**
 * Selecciona la función generadora de secciones según la sede
 */
export function buildSectionsForVenue(venueId: string, eventType?: string): Omit<SeatSection, 'id'>[] {
  if (isEncantoVenue(venueId, undefined, eventType)) {
    return buildEncantoSectionsData(venueId);
  }
  return buildMariscalSectionsData(venueId);
}

/**
 * Registra o asegura el seed de las secciones del estadio correspondiente en Firestore
 */
export async function seedSeatMapForVenue(venueId: string = DEFAULT_VENUE_ID): Promise<SeatSection[]> {
  try {
    const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
    }

    const sectionsData = buildSectionsForVenue(venueId);
    const batch = writeBatch(db);
    const createdSections: SeatSection[] = [];

    for (const data of sectionsData) {
      const docId = `${venueId}_sec_${data.sectionNumber.replace(/\s+/g, '_')}`;
      const docRef = doc(db, 'seatSections', docId);
      const section: SeatSection = {
        id: docId,
        ...data,
      };
      batch.set(docRef, section);
      createdSections.push(section);
    }

    await batch.commit();
    return createdSections;
  } catch (err) {
    console.warn('Aviso al sincronizar secciones en Firestore (usando catálogo físico maestro):', err);
    // Retorna los datos en memoria para que la UI funcione de forma fluida
    const localData = buildSectionsForVenue(venueId);
    return localData.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d }));
  }
}

/** Alias para compatibilidad con código existente */
export const seedMariscalSeatMap = seedSeatMapForVenue;

/**
 * Filtra y sanitiza las secciones asegurando coherencia total con el estadio correspondiente.
 */
export function sanitizeVenueSections(venueId: string, rawSections: SeatSection[], eventType?: string): SeatSection[] {
  const isEncanto = isEncantoVenue(venueId, undefined, eventType);
  if (isEncanto) {
    const valid = rawSections.filter((s) => {
      const num = (s.sectionNumber || '').trim().toUpperCase();
      const zone = (s.zoneName || '').trim().toLowerCase();
      if (zone === 'norte' || zone === 'este') return false;
      return (
        num.startsWith('PC-') ||
        num.startsWith('PL-') ||
        num.startsWith('PS-') ||
        num.startsWith('OC-') ||
        num.startsWith('OL-') ||
        num.startsWith('OS-') ||
        num.startsWith('CS-') ||
        num.startsWith('GN-') ||
        num.startsWith('GS-') ||
        num.startsWith('TE-') ||
        num.startsWith('SB-') ||
        num.startsWith('ZL-') ||
        num.startsWith('PALCO')
      );
    });
    if (valid.length > 0) return valid;
    const master = buildEncantoSectionsData(venueId);
    return master.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d }));
  } else {
    const valid = rawSections.filter((s) => {
      const num = (s.sectionNumber || '').trim().toUpperCase();
      return (
        !num.startsWith('PC-') &&
        !num.startsWith('PL-') &&
        !num.startsWith('TE-') &&
        !num.startsWith('GN-') &&
        !num.startsWith('GS-')
      );
    });
    if (valid.length > 0) return valid;
    const master = buildMariscalSectionsData(venueId);
    return master.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d }));
  }
}

/**
 * Obtener las secciones del estadio para una sede (con caché local de 30 minutos)
 */
export async function getSeatSectionsForVenue(venueId: string = DEFAULT_VENUE_ID): Promise<SeatSection[]> {
  const cacheKey = `stadium_sections_${venueId}`;
  const cached = getCachedData<SeatSection[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
    const snap = await getDocs(q);

    if (snap.empty) {
      const seeded = await seedSeatMapForVenue(venueId);
      setCachedData(cacheKey, seeded, 30);
      return seeded;
    }

    const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
    const sanitized = sanitizeVenueSections(venueId, raw);
    setCachedData(cacheKey, sanitized, 30);
    return sanitized;
  } catch (err) {
    console.warn('Error fetching seat sections:', err);
    const localData = buildSectionsForVenue(venueId);
    const fallback = localData.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d }));
    setCachedData(cacheKey, fallback, 10);
    return fallback;
  }
}

/**
 * Escuchar secciones en tiempo real con soporte de caché previo
 */
export function subscribeSeatSections(
  venueId: string,
  callback: (sections: SeatSection[]) => void,
  onError?: (err: any) => void
): () => void {
  const cacheKey = `stadium_sections_${venueId}`;
  const cached = getCachedData<SeatSection[]>(cacheKey);
  if (cached && cached.length > 0) {
    callback(cached);
  }

  const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        const localData = buildSectionsForVenue(venueId);
        const fallback = localData.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d }));
        setCachedData(cacheKey, fallback, 30);
        callback(fallback);
      } else {
        const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
        const sanitized = sanitizeVenueSections(venueId, raw);
        setCachedData(cacheKey, sanitized, 30);
        callback(sanitized);
      }
    },
    (err) => {
      console.warn('Snapshot error on seat sections:', err);
      if (onError) onError(err);
      getSeatSectionsForVenue(venueId).then(callback);
    }
  );
}

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/**
 * Genera la disponibilidad de asientos (EventSeat) para un evento nuevo o existente.
 * Crea un documento EventSeat por cada asiento (status: 'disponible').
 */
export async function generateEventSeats(
  eventId: string,
  venueId: string = DEFAULT_VENUE_ID
): Promise<{ createdCount: number; totalSeats: number }> {
  try {
    // 1. Verificar si ya existen asientos para este evento
    const qCheck = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
    const existingSnap = await getDocs(qCheck);

    if (!existingSnap.empty) {
      return { createdCount: 0, totalSeats: existingSnap.size };
    }

    // 2. Obtener las secciones de la sede
    let sections = await getSeatSectionsForVenue(venueId);
    if (!sections || sections.length === 0) {
      sections = await seedSeatMapForVenue(venueId);
    }

    // 3. Preparar los asientos
    const seatsToCreate: EventSeat[] = [];

    for (const section of sections) {
      const numRows = section.rows || 3;
      const seatsPerRow = section.seatsPerRow || 10;

      for (let r = 0; r < numRows; r++) {
        const rowLabel = ROW_LABELS[r] || String.fromCharCode(65 + r);
        for (let s = 1; s <= seatsPerRow; s++) {
          const seatId = `${eventId}_${section.sectionNumber.replace(/\s+/g, '_')}_${rowLabel}_${s}`;
          seatsToCreate.push({
            id: seatId,
            eventId,
            sectionId: section.id,
            sectionNumber: section.sectionNumber,
            zoneName: section.zoneName,
            rowLabel,
            seatNumber: s,
            status: 'disponible',
          });
        }
      }
    }

    // 4. Guardar en Firestore en batches de 400 (límite máximo de Firestore es 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < seatsToCreate.length; i += BATCH_SIZE) {
      const chunk = seatsToCreate.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const seat of chunk) {
        const docRef = doc(db, 'eventSeats', seat.id);
        batch.set(docRef, seat);
      }
      await batch.commit();
    }

    return { createdCount: seatsToCreate.length, totalSeats: seatsToCreate.length };
  } catch (err) {
    console.warn('Aviso al generar asientos de evento:', err);
    return { createdCount: 0, totalSeats: 0 };
  }
}

/**
 * Obtener todos los asientos de un evento
 */
export async function getEventSeats(eventId: string): Promise<EventSeat[]> {
  try {
    const q = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventSeat, 'id'>) }));
  } catch (err) {
    console.warn('Error fetching event seats:', err);
    return [];
  }
}

/**
 * Escuchar en tiempo real los asientos de un evento
 */
export function subscribeEventSeats(
  eventId: string,
  callback: (seats: EventSeat[]) => void,
  onError?: (err: any) => void
): () => void {
  const cacheKey = `stadium_event_seats_${eventId}`;
  const cached = getCachedData<EventSeat[]>(cacheKey);
  if (cached && cached.length > 0) {
    callback(cached);
  }

  const q = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      const seats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventSeat, 'id'>) }));
      setCachedData(cacheKey, seats, 10);
      callback(seats);
    },
    (err) => {
      console.warn('Snapshot error on event seats:', err);
      if (onError) onError(err);
    }
  );
}

export interface SeatPurchaseItem {
  seatId: string;
  sectionId: string;
  sectionNumber: string;
  zoneName: string;
  rowLabel: string;
  seatNumber: number;
  price: number;
}

export const SEAT_LOCK_DURATION_MS = 8 * 60 * 1000; // 8 minutos

/**
 * Helper para obtener o generar un identificador persistente de dispositivo/navegador.
 * Evita desalineación de reservas si el aficionado selecciona asientos como invitado (guest)
 * y posteriormente inicia sesión con Google para pagar con tarjeta.
 */
export function getClientLockToken(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let token = localStorage.getItem('vxp_client_lock_token');
    if (!token) {
      token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('vxp_client_lock_token', token);
    }
    return token;
  } catch {
    return 'guest_fallback';
  }
}

/**
 * Determina de forma infalible si una butaca está bloqueada por OTRO aficionado.
 * Nunca bloquea al mismo aficionado que la seleccionó, incluso si la seleccionó como 'guest',
 * antes de iniciar sesión con Google o si su token de sesión coincide.
 */
export function isSeatLockedByOther(
  seat: {
    status?: SeatStatus;
    lockedUntil?: number | null;
    lockedBy?: string | null;
    clientLockToken?: string | null;
  },
  currentUserId?: string | null,
  clientLockToken?: string | null,
  currentTimeMs: number = Date.now()
): boolean {
  if (seat.status !== 'reservado') return false;
  if (!seat.lockedUntil || seat.lockedUntil <= currentTimeMs) return false;
  if (!seat.lockedBy) return false;

  // Si el usuario actual coincide con el titular del lock
  if (currentUserId && currentUserId !== 'guest' && seat.lockedBy === currentUserId) {
    return false;
  }

  // Si fue reservada bajo sesión de invitado ('guest' o 'guest_...'), pertenece al flujo
  // de compra del comprador actual que está completando la transacción
  if (
    seat.lockedBy === 'guest' ||
    seat.lockedBy.startsWith('guest_') ||
    seat.lockedBy.startsWith('guest')
  ) {
    return false;
  }

  // Si coincide con el token persistente de este dispositivo/navegador
  if (clientLockToken) {
    if (seat.lockedBy === clientLockToken) return false;
    if (seat.clientLockToken && seat.clientLockToken === clientLockToken) return false;
  }

  return true;
}

export interface LockSeatParams {
  eventId: string;
  seatId: string;
  userId: string;
  sectionNumber: string;
  rowLabel: string;
  seatNumber: number;
  zoneName: string;
  sectionId?: string;
  clientLockToken?: string;
}

/**
 * Bloqueo atómico de asiento por 8 minutos usando runTransaction:
 * Si dos usuarios intentan apartar la misma butaca al mismo milisegundo, la transacción
 * otorga la reserva exclusiva de 8 minutos al primero y rechaza/notifica al segundo.
 */
export async function lockSeatSelectionTransaction(
  params: LockSeatParams
): Promise<{ success: boolean; lockedUntil: number }> {
  const { eventId, seatId, userId, sectionNumber, rowLabel, seatNumber, zoneName, sectionId, clientLockToken } = params;
  const seatRef = doc(db, 'eventSeats', seatId);
  const now = Date.now();
  const lockedUntil = now + SEAT_LOCK_DURATION_MS;
  const effectiveLockUser = userId && userId !== 'guest' ? userId : (clientLockToken || 'guest');

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(seatRef);

    if (snap.exists()) {
      const data = snap.data() as EventSeat;

      // 1. Si ya está vendido, rechazar
      if (data.status === 'vendido') {
        throw new Error('SEAT_ALREADY_SOLD: Esta butaca ya ha sido vendida.');
      }

      // 2. Si está reservado por OTRO usuario y el bloqueo sigue activo
      const lockedByOther = isSeatLockedByOther(data, userId, clientLockToken, now);

      if (lockedByOther) {
        const remainingSeconds = Math.max(1, Math.ceil(((data.lockedUntil || now) - now) / 1000));
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        throw new Error(
          `SEAT_LOCKED_BY_OTHER: Esta butaca está bloqueada por otro usuario (tiempo restante: ${minutes}:${
            seconds < 10 ? '0' : ''
          }${seconds} min). Selecciona otra butaca.`
        );
      }

      // 3. El asiento está libre o el lock expiró o pertenece al mismo usuario: Bloquear por 8 minutos
      transaction.update(seatRef, {
        status: 'reservado',
        lockedUntil,
        lockedBy: effectiveLockUser,
        clientLockToken: clientLockToken || null,
        lockedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
    } else {
      // Si el documento aún no existía en Firestore, crearlo de forma atómica en estado 'reservado'
      transaction.set(seatRef, {
        id: seatId,
        eventId,
        sectionId: sectionId || '',
        sectionNumber,
        zoneName,
        rowLabel,
        seatNumber,
        status: 'reservado',
        lockedUntil,
        lockedBy: effectiveLockUser,
        clientLockToken: clientLockToken || null,
        lockedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
    }

    return { success: true, lockedUntil };
  });
}

/**
 * Libera el bloqueo de un asiento cuando el usuario lo deselecciona o cancela su carrito
 */
export async function releaseSeatLockTransaction(
  seatId: string,
  userId: string,
  clientLockToken?: string
): Promise<boolean> {
  const seatRef = doc(db, 'eventSeats', seatId);
  const now = Date.now();

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(seatRef);
      if (!snap.exists()) return;

      const data = snap.data() as EventSeat;
      // Solo liberamos si no está vendido y no está retenido por otro aficionado activo
      if (data.status === 'reservado') {
        const lockedByOther = isSeatLockedByOther(data, userId, clientLockToken, now);
        if (!lockedByOther) {
          transaction.update(seatRef, {
            status: 'disponible',
            lockedUntil: null,
            lockedBy: null,
            clientLockToken: null,
            lockedAt: null,
            updatedAt: new Date(now).toISOString(),
          });
        }
      }
    });
    return true;
  } catch (err) {
    console.warn('Advertencia liberando bloqueo de asiento:', err);
    return false;
  }
}

export interface PurchaseSeatsParams {
  userId: string;
  customerName: string;
  customerEmail?: string;
  event: VenueEvent;
  stadiumName: string;
  selectedSeats: SeatPurchaseItem[];
  paymentMethod: string;
  stripePaymentIntentId?: string;
  clientLockToken?: string;
}

export interface PurchaseResult {
  purchaseId: string;
  ticketIds: string[];
  totalAmount: number;
  count: number;
  tickets?: Ticket[];
}

/**
 * Compra múltiple atómica usando runTransaction de Firestore:
 * 1. Verifica en una sola lectura que todos los EventSeat sigan disponibles.
 * 2. Si alguno ya fue vendido, aborta limpiamente e informa los asientos conflictivos.
 * 3. En la misma transacción, marca/crea los asientos como 'vendido' y crea los Tickets
 *    asociados con un purchaseId compartido.
 * 4. Registra la auditoría en la colección sales.
 */
export async function purchaseSeatsTransaction(params: PurchaseSeatsParams): Promise<PurchaseResult> {
  const { userId, customerName, event, stadiumName, selectedSeats, paymentMethod, clientLockToken } = params;

  // 0. Comprobación automática de fecha del evento
  if (isEventPassed(event)) {
    throw new Error('EVENT_EXPIRED: La venta de boletos para este evento ha concluido automáticamente porque el juego o evento ya finalizó.');
  }

  if (!selectedSeats || selectedSeats.length === 0) {
    throw new Error('Debes seleccionar al menos un asiento.');
  }

  const purchaseId = `PURCHASE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Ejecución atómica
  const result = await runTransaction(db, async (transaction) => {
    // 1. TODAS LAS LECTURAS PRIMERO (Regla estricta de Firestore Transaction)
    const seatSnapshots: { ref: any; seat: SeatPurchaseItem; isNew: boolean }[] = [];
    const unavailableSeats: string[] = [];
    const currentTimeMs = Date.now();

    for (const seat of selectedSeats) {
      const seatRef = doc(db, 'eventSeats', seat.seatId);
      const snap = await transaction.get(seatRef);

      if (!snap.exists()) {
        seatSnapshots.push({ ref: seatRef, seat, isNew: true });
        continue;
      }

      const data = snap.data() as EventSeat;
      const isSold = data.status === 'vendido';
      const isLockedByOther = isSeatLockedByOther(data, userId, clientLockToken, currentTimeMs);

      if (isSold || isLockedByOther) {
        unavailableSeats.push(
          `Sec ${seat.sectionNumber} - Fila ${seat.rowLabel} Asiento ${seat.seatNumber} (${
            isSold ? 'Vendido' : 'Reservado temporalmente por otro aficionado'
          })`
        );
        continue;
      }

      seatSnapshots.push({ ref: seatRef, seat, isNew: false });
    }

    if (unavailableSeats.length > 0) {
      const errorMsg = `SEAT_CONFLICT: Los siguientes asientos no están disponibles: ${unavailableSeats.join(
        ', '
      )}. Por favor deselecciónalos y elige otros asientos.`;
      throw new Error(errorMsg);
    }

    // 2. ESCRITURAS ATÓMICAS (Crear tickets y marcar status del asiento a 'vendido')
    const createdTicketIds: string[] = [];
    const createdTickets: Ticket[] = [];
    const stadiumZones = getStadiumZones(event.venueId, stadiumName, event.type);
    const isEncanto = isEncantoVenue(event.venueId, stadiumName, event.type);
    const qrPrefix = isEncanto ? 'DOR-2026-TKT-' : 'VND-2026-TKT-';

    for (const { ref: seatRef, seat, isNew } of seatSnapshots) {
      const ticketDocRef = doc(collection(db, 'tickets'));
      const qrId = `${qrPrefix}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const zoneMeta = stadiumZones[seat.zoneName];
      const gateResolved = zoneMeta?.gate || event.gate || 'Puertas Generales';

      const ticketData: Ticket = {
        id: ticketDocRef.id,
        userId,
        eventId: event.id,
        venueId: event.venueId,
        purchaseId,
        seatId: seat.seatId,
        matchTitle: event.name,
        opponent: event.opponent || '',
        matchDate: event.date,
        matchTime: event.time || '20:00 hrs',
        stadium: stadiumName,
        section: `${seat.zoneName} - Sec. ${seat.sectionNumber}`,
        row: `Fila ${seat.rowLabel}`,
        seat: `Asiento ${seat.seatNumber}`,
        price: seat.price,
        status: 'activo',
        qrId,
        gate: gateResolved,
        createdAt: now,
        stripePaymentIntentId: params.stripePaymentIntentId || undefined,
        paymentStatus: 'paid',
        paymentMethod: paymentMethod || 'Tarjeta en Línea',
        customerName,
        customerEmail: params.customerEmail || undefined,
      };

      transaction.set(ticketDocRef, ticketData);

      if (isNew) {
        transaction.set(seatRef, {
          id: seat.seatId,
          eventId: event.id,
          sectionId: seat.sectionId || `${event.venueId}_sec_${seat.sectionNumber.replace(/\s+/g, '_')}`,
          sectionNumber: seat.sectionNumber,
          zoneName: seat.zoneName,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          status: 'vendido',
          ticketId: ticketDocRef.id,
          purchaseId,
          updatedAt: now,
          userId,
          lockedUntil: null,
          lockedBy: null,
          clientLockToken: null,
        });
      } else {
        transaction.update(seatRef, {
          status: 'vendido',
          ticketId: ticketDocRef.id,
          purchaseId,
          updatedAt: now,
          userId,
          lockedUntil: null,
          lockedBy: null,
          clientLockToken: null,
        });
      }

      createdTicketIds.push(ticketDocRef.id);
      createdTickets.push(ticketData);
    }

    return {
      purchaseId,
      ticketIds: createdTicketIds,
      totalAmount,
      count: selectedSeats.length,
      tickets: createdTickets,
    };
  });

  // 3. Auditoría de venta (en collection 'sales')
  try {
    await addDoc(collection(db, 'sales'), {
      channel: 'boletos',
      userId,
      venueId: event.venueId,
      eventId: event.id,
      referenceId: purchaseId,
      customerName,
      description: `Compra de ${selectedSeats.length} boleto(s) para ${event.name} (${selectedSeats
        .map((s) => `Sec ${s.sectionNumber} ${s.rowLabel}${s.seatNumber}`)
        .join(', ')})`,
      amount: totalAmount,
      paymentMethod,
      stripePaymentIntentId: params.stripePaymentIntentId || null,
      customerEmail: params.customerEmail || null,
      date: now,
      status: 'completada',
    });
  } catch (saleErr) {
    console.warn('Auditoría de venta registrada con advertencia:', saleErr);
  }

  return result;
}

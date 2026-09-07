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
    colorHex: '#D97706',
    badgeBg: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    badgeText: 'text-amber-500',
    fillColor: '#D97706',
    strokeColor: '#B45309',
    gate: 'Puerta Principal / VIP',
    description: 'Nivel central bajo exclusivo junto al Home Plate',
  },
  'Platino': {
    name: 'Platino',
    defaultPrice: 750,
    colorHex: '#7C3AED',
    badgeBg: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    badgeText: 'text-violet-500',
    fillColor: '#7C3AED',
    strokeColor: '#6D28D9',
    gate: 'Puertas 1 y 2',
    description: 'Vista preferencial directa detrás del plato de bateo',
  },
  'Diamante': {
    name: 'Diamante',
    defaultPrice: 600,
    colorHex: '#0284C7',
    badgeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
    badgeText: 'text-sky-500',
    fillColor: '#0284C7',
    strokeColor: '#0369A1',
    gate: 'Puertas 1 y 2',
    description: 'Infield lateral con máxima cercanía a las bases',
  },
  'Oro': {
    name: 'Oro',
    defaultPrice: 480,
    colorHex: '#EAB308',
    badgeBg: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
    badgeText: 'text-yellow-600',
    fillColor: '#EAB308',
    strokeColor: '#CA8A04',
    gate: 'Puertas 2 y 4',
    description: 'Infield intermedio de gran ángulo y visión panorámica',
  },
  'Sky Plus': {
    name: 'Sky Plus',
    defaultPrice: 400,
    colorHex: '#06B6D4',
    badgeBg: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
    badgeText: 'text-cyan-500',
    fillColor: '#06B6D4',
    strokeColor: '#0891B2',
    gate: 'Puertas 4 y 8',
    description: 'Laterales sobre las líneas de 1ra y 3ra base',
  },
  'Plus': {
    name: 'Plus',
    defaultPrice: 350,
    colorHex: '#3B82F6',
    badgeBg: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    badgeText: 'text-blue-500',
    fillColor: '#3B82F6',
    strokeColor: '#2563EB',
    gate: 'Puertas 4 y 8',
    description: 'Laterales cómodas con gran ambiente de juego',
  },
  'Fan': {
    name: 'Fan',
    defaultPrice: 220,
    colorHex: '#10B981',
    badgeBg: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    badgeText: 'text-emerald-500',
    fillColor: '#10B981',
    strokeColor: '#059669',
    gate: 'Puertas 6 y 8',
    description: 'Grada animada y familiar hacia los jardines',
  },
  'Fan Plus': {
    name: 'Fan Plus',
    defaultPrice: 280,
    colorHex: '#059669',
    badgeBg: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
    badgeText: 'text-teal-600',
    fillColor: '#059669',
    strokeColor: '#047857',
    gate: 'Puertas 6 y 8',
    description: 'Jardines exteriores con vista libre al diamante',
  },
  'Sky': {
    name: 'Sky',
    defaultPrice: 160,
    colorHex: '#6366F1',
    badgeBg: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
    badgeText: 'text-indigo-500',
    fillColor: '#6366F1',
    strokeColor: '#4F46E5',
    gate: 'Rampa Nivel 300',
    description: 'Nivel 300 superior, vista aérea de todo el estadio',
  },
};

/**
 * Zonas oficiales de Estadio El Encanto (Mazatlán F.C.)
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
    colorHex: '#7C3AED',
    badgeBg: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
    badgeText: 'text-purple-500',
    fillColor: '#7C3AED',
    strokeColor: '#6D28D9',
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
    description: 'Cabecera sur detrás de portería, zona de la porra y afición Cañonera',
  },
  'General Norte': {
    name: 'General Norte',
    defaultPrice: 200,
    colorHex: '#6B7280',
    badgeBg: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
    badgeText: 'text-slate-500',
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
  if (venueId === 'venue-encanto' || venueId === 'estadio-encanto' || venueId === 'venue-kraken') {
    return true;
  }
  const name = (venueName || '').toLowerCase();
  if (
    name.includes('encanto') ||
    name.includes('kraken') ||
    name.includes('mazatlán f.c.') ||
    name.includes('mazatlan fc')
  ) {
    return true;
  }
  return false;
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
 * Resuelve el precio por zona para un evento específico
 */
export function getZonePrice(zoneName: string, event?: VenueEvent | null): number {
  if (event && event.priceTiers && event.priceTiers.length > 0) {
    const match = event.priceTiers.find(
      (t) => t.section.toLowerCase().trim() === zoneName.toLowerCase().trim()
    );
    if (match) return match.price;

    const partial = event.priceTiers.find(
      (t) =>
        t.section.toLowerCase().includes(zoneName.toLowerCase()) ||
        zoneName.toLowerCase().includes(t.section.toLowerCase())
    );
    if (partial) return partial.price;
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

  // 1. Deluxe Supreme: 1 a 12 (central baja, junto al home)
  for (let i = 1; i <= 12; i++) {
    sections.push({
      ...defaultProps,
      sectionNumber: String(i),
      zoneName: 'Deluxe Supreme',
    });
  }

  // 2. Platino: 104-107, 204-207 (las más cercanas al home en niveles 1 y 2)
  for (let i = 104; i <= 107; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Platino' });
  }
  for (let i = 204; i <= 207; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Platino' });
  }

  // 3. Oro: 102-103, 202-203
  for (const s of [102, 103, 202, 203]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Oro' });
  }

  // 4. Diamante: 101, 108, 201, 208
  for (const s of [101, 108, 201, 208]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Diamante' });
  }

  // 5. Sky Plus: 109-117, 209-217
  for (let i = 109; i <= 117; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Sky Plus' });
  }
  for (let i = 209; i <= 217; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Sky Plus' });
  }

  // 6. Plus: 118-121, 218-221
  for (let i = 118; i <= 121; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Plus' });
  }
  for (let i = 218; i <= 221; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Plus' });
  }

  // 7. Fan: 122-127, 222-227
  for (let i = 122; i <= 127; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan' });
  }
  for (let i = 222; i <= 227; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan' });
  }

  // 8. Fan Plus: 128-133, 228-233
  for (let i = 128; i <= 133; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan Plus' });
  }
  for (let i = 228; i <= 233; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan Plus' });
  }

  // 9. Sky: 301-316 (anillo superior)
  for (let i = 301; i <= 316; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Sky' });
  }

  return sections;
}

/**
 * Generador de las definiciones oficiales de secciones de Estadio El Encanto (Mazatlán F.C.)
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
 * General Sur        | GS-1 a GS-8 (Cabecera sur porra cañonera, Puerta 1)
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
 * Obtener las secciones del estadio para una sede
 */
export async function getSeatSectionsForVenue(venueId: string = DEFAULT_VENUE_ID): Promise<SeatSection[]> {
  try {
    const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return await seedSeatMapForVenue(venueId);
    }

    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
  } catch (err) {
    console.warn('Error fetching seat sections:', err);
    const localData = buildSectionsForVenue(venueId);
    return localData.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d }));
  }
}

/**
 * Escuchar secciones en tiempo real
 */
export function subscribeSeatSections(
  venueId: string,
  callback: (sections: SeatSection[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        const localData = buildSectionsForVenue(venueId);
        callback(localData.map((d) => ({ id: `${venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`, ...d })));
      } else {
        const sections = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
        callback(sections);
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
  const q = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      const seats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventSeat, 'id'>) }));
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

export interface PurchaseSeatsParams {
  userId: string;
  customerName: string;
  event: VenueEvent;
  stadiumName: string;
  selectedSeats: SeatPurchaseItem[];
  paymentMethod: string;
}

export interface PurchaseResult {
  purchaseId: string;
  ticketIds: string[];
  totalAmount: number;
  count: number;
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
  const { userId, customerName, event, stadiumName, selectedSeats, paymentMethod } = params;

  if (!selectedSeats || selectedSeats.length === 0) {
    throw new Error('Debes seleccionar al menos un asiento.');
  }

  const purchaseId = `PURCHASE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Ejecución atómica
  const result = await runTransaction(db, async (transaction) => {
    // 1. TODAS LAS LECTURAS PRIMERO (Regla estricta de Firestore Transaction)
    const seatSnapshots: { ref: any; seat: SeatPurchaseItem }[] = [];
    const unavailableSeats: string[] = [];

    for (const seat of selectedSeats) {
      const seatRef = doc(db, 'eventSeats', seat.seatId);
      const snap = await transaction.get(seatRef);

      if (!snap.exists()) {
        unavailableSeats.push(
          `Sec ${seat.sectionNumber} - Fila ${seat.rowLabel} Asiento ${seat.seatNumber} (No registrado en sistema)`
        );
        continue;
      }

      const data = snap.data() as EventSeat;
      if (data.status !== 'disponible') {
        unavailableSeats.push(
          `Sec ${seat.sectionNumber} - Fila ${seat.rowLabel} Asiento ${seat.seatNumber}`
        );
        continue;
      }

      seatSnapshots.push({ ref: seatRef, seat });
    }

    if (unavailableSeats.length > 0) {
      const errorMsg = `SEAT_CONFLICT: Los siguientes asientos no están disponibles: ${unavailableSeats.join(
        ', '
      )}. Por favor deselecciónalos y elige otros asientos.`;
      throw new Error(errorMsg);
    }

    // 2. ESCRITURAS ATÓMICAS (Crear tickets y marcar status del asiento a 'vendido')
    const createdTicketIds: string[] = [];
    const stadiumZones = getStadiumZones(event.venueId, stadiumName, event.type);
    const isEncanto = isEncantoVenue(event.venueId, stadiumName, event.type);
    const qrPrefix = isEncanto ? 'MZT-2026-TKT-' : 'VND-2026-TKT-';

    for (const { ref: seatRef, seat } of seatSnapshots) {
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
      };

      transaction.set(ticketDocRef, ticketData);
      transaction.update(seatRef, {
        status: 'vendido',
        ticketId: ticketDocRef.id,
        purchaseId,
        updatedAt: now,
        userId,
      });

      createdTicketIds.push(ticketDocRef.id);
    }

    return {
      purchaseId,
      ticketIds: createdTicketIds,
      totalAmount,
      count: selectedSeats.length,
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
      date: now,
      status: 'completada',
    });
  } catch (saleErr) {
    console.warn('Auditoría de venta registrada con advertencia:', saleErr);
  }

  return result;
}

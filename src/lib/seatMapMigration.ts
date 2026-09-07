import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { VenueZone, SeatSection } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';

export const MARISCAL_ZONE_DEFINITIONS: Omit<VenueZone, 'venueId'>[] = [
  { id: 'zone-mariscal-deluxe-supreme', name: 'Deluxe Supreme', color: '#D97706', order: 1 },
  { id: 'zone-mariscal-platino', name: 'Platino', color: '#7C3AED', order: 2 },
  { id: 'zone-mariscal-diamante', name: 'Diamante', color: '#0284C7', order: 3 },
  { id: 'zone-mariscal-oro', name: 'Oro', color: '#EAB308', order: 4 },
  { id: 'zone-mariscal-sky-plus', name: 'Sky Plus', color: '#06B6D4', order: 5 },
  { id: 'zone-mariscal-plus', name: 'Plus', color: '#3B82F6', order: 6 },
  { id: 'zone-mariscal-fan', name: 'Fan', color: '#10B981', order: 7 },
  { id: 'zone-mariscal-fan-plus', name: 'Fan Plus', color: '#059669', order: 8 },
  { id: 'zone-mariscal-sky', name: 'Sky', color: '#6366F1', order: 9 },
];

/**
 * Mapeo de zoneName a zoneId para el Estadio Teodoro Mariscal
 */
const ZONE_NAME_TO_ID: Record<string, string> = {
  'Deluxe Supreme': 'zone-mariscal-deluxe-supreme',
  'Platino': 'zone-mariscal-platino',
  'Diamante': 'zone-mariscal-diamante',
  'Oro': 'zone-mariscal-oro',
  'Sky Plus': 'zone-mariscal-sky-plus',
  'Plus': 'zone-mariscal-plus',
  'Fan': 'zone-mariscal-fan',
  'Fan Plus': 'zone-mariscal-fan-plus',
  'Sky': 'zone-mariscal-sky',
};

/**
 * Determina el ring y orden coherente para las secciones del Mariscal
 */
export function getMariscalSectionRingAndOrder(sectionNumber: string, zoneName?: string): {
  ring: string;
  order: number;
  zoneId: string;
} {
  const num = parseInt(sectionNumber, 10);
  const resolvedZone = zoneName || 'Fan';
  const zoneId = ZONE_NAME_TO_ID[resolvedZone] || 'zone-mariscal-fan';

  // 1. Deluxe Supreme: 1 a 12
  if (num >= 1 && num <= 12) {
    return {
      ring: 'Deluxe Supreme',
      order: num,
      zoneId: 'zone-mariscal-deluxe-supreme',
    };
  }

  // 2. Nivel 300 / Sky: 301 a 316
  if (num >= 301 && num <= 316) {
    return {
      ring: 'Nivel 300',
      order: num - 300,
      zoneId: 'zone-mariscal-sky',
    };
  }

  // 3. Nivel 200: 201 a 233
  if (num >= 201 && num <= 233) {
    // Ordenar de jardín izquierdo a jardín derecho:
    // 233...228, 227...222, 221...218, 217...209, 208, 203, 207, 204, 202, 201, 210...
    let horseshoeOrder = num;
    // Si está entre 228-233 (jardín izq)
    if (num >= 228 && num <= 233) horseshoeOrder = 234 - num; // 1 a 6
    else if (num >= 222 && num <= 227) horseshoeOrder = 7 + (227 - num); // 7 a 12
    else if (num >= 218 && num <= 221) horseshoeOrder = 13 + (221 - num); // 13 a 16
    else if (num >= 209 && num <= 217) horseshoeOrder = 17 + (217 - num); // 17 a 25
    else if (num === 208) horseshoeOrder = 26;
    else if (num === 203) horseshoeOrder = 27;
    else if (num === 207) horseshoeOrder = 28;
    else if (num === 204) horseshoeOrder = 29;
    else if (num === 202) horseshoeOrder = 30;
    else if (num === 201) horseshoeOrder = 31;
    else horseshoeOrder = num;

    return {
      ring: 'Nivel 200',
      order: horseshoeOrder,
      zoneId,
    };
  }

  // 4. Nivel 100: 101 a 133
  let horseshoeOrder100 = num;
  if (num >= 128 && num <= 133) horseshoeOrder100 = 134 - num;
  else if (num >= 122 && num <= 127) horseshoeOrder100 = 7 + (127 - num);
  else if (num >= 118 && num <= 121) horseshoeOrder100 = 13 + (121 - num);
  else if (num >= 109 && num <= 117) horseshoeOrder100 = 17 + (117 - num);
  else if (num === 108) horseshoeOrder100 = 26;
  else if (num === 103) horseshoeOrder100 = 27;
  else if (num === 107) horseshoeOrder100 = 28;
  else if (num === 105) horseshoeOrder100 = 29;
  else if (num === 101) horseshoeOrder100 = 30;
  else if (num === 102) horseshoeOrder100 = 31;
  else if (num === 104) horseshoeOrder100 = 32;
  else if (num === 106) horseshoeOrder100 = 33;

  return {
    ring: 'Nivel 100',
    order: horseshoeOrder100,
    zoneId,
  };
}

export interface MigrationResult {
  migrated: boolean;
  message: string;
  zonesCreated: number;
  sectionsUpdated: number;
  venuesUpdated: string[];
}

/**
 * Ejecuta de forma segura la migración de datos para el Estadio Teodoro Mariscal
 * y deja configurado el Estadio Encanto para captura manual.
 */
export async function runMariscalSeatMapMigration(): Promise<MigrationResult> {
  try {
    const venueId = DEFAULT_VENUE_ID;

    // 1. Verificar si ya existen VenueZones para el Mariscal
    const zonesQuery = query(collection(db, 'venueZones'), where('venueId', '==', venueId));
    const zonesSnap = await getDocs(zonesQuery);

    let zonesCreated = 0;
    if (zonesSnap.empty) {
      // Crear las 9 zonas oficiales
      const batchZones = writeBatch(db);
      for (const z of MARISCAL_ZONE_DEFINITIONS) {
        const docRef = doc(db, 'venueZones', z.id);
        const zoneDoc: VenueZone = {
          ...z,
          venueId,
        };
        batchZones.set(docRef, zoneDoc);
        zonesCreated++;
      }
      await batchZones.commit();
    }

    // 2. Verificar secciones del Mariscal
    const secQuery = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
    const secSnap = await getDocs(secQuery);

    let sectionsUpdated = 0;

    if (!secSnap.empty) {
      // Verificar si ya están migradas (tienen zoneId y ring)
      const needsMigration = secSnap.docs.some((d) => {
        const data = d.data();
        return !data.zoneId || !data.ring;
      });

      if (needsMigration) {
        const BATCH_SIZE = 400;
        const docs = secSnap.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const chunk = docs.slice(i, i + BATCH_SIZE);
          const batchSec = writeBatch(db);
          for (const docSnap of chunk) {
            const data = docSnap.data();
            const { ring, order, zoneId } = getMariscalSectionRingAndOrder(
              data.sectionNumber,
              data.zoneName
            );
            batchSec.update(docSnap.ref, {
              zoneId,
              ring,
              order,
              updatedAt: new Date().toISOString(),
            });
            sectionsUpdated++;
          }
          await batchSec.commit();
        }
      }
    }

    // 3. Marcar layoutShape: 'baseball_horseshoe' en venues/venue-teodoro-mariscal
    const mariscalVenueRef = doc(db, 'venues', venueId);
    await setDoc(
      mariscalVenueRef,
      {
        id: venueId,
        name: 'Estadio Teodoro Mariscal',
        teamName: 'Venados de Mazatlán',
        layoutShape: 'baseball_horseshoe',
        active: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 4. Marcar layoutShape: 'rectangular_bowl' en venues/venue-encanto (sin inventar secciones)
    const encantoVenueRef = doc(db, 'venues', 'venue-encanto');
    await setDoc(
      encantoVenueRef,
      {
        id: 'venue-encanto',
        name: 'Estadio Encanto',
        layoutShape: 'rectangular_bowl',
        active: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      migrated: true,
      message: 'Migración del Estadio Teodoro Mariscal completada con éxito.',
      zonesCreated,
      sectionsUpdated,
      venuesUpdated: [venueId, 'venue-encanto'],
    };
  } catch (err: any) {
    console.error('Error durante la migración del mapa físico:', err);
    return {
      migrated: false,
      message: `Error al ejecutar migración: ${err.message || 'Error desconocido'}`,
      zonesCreated: 0,
      sectionsUpdated: 0,
      venuesUpdated: [],
    };
  }
}

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Zone } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';

const ZONES_COLLECTION = 'zones';

export const INITIAL_ZONES: Zone[] = [
  {
    id: 'zona-a',
    name: 'Zona A - Sombra Central',
    sections: ['100', '101', '102', '103', '104', '105', 'Palcos Centrales', 'Sombra Central'],
  },
  {
    id: 'zona-b',
    name: 'Zona B - Palcos VIP & Diamante',
    sections: ['200', '201', '202', '203', 'Palcos VIP', 'Platino', 'Diamante', 'Planta Baja VIP'],
  },
  {
    id: 'zona-c',
    name: 'Zona C - Lateral & Preferente',
    sections: ['300', '301', '302', '303', '304', 'Lateral 1', 'Lateral 2', 'Preferente', 'Lateral Sombra'],
  },
  {
    id: 'zona-d',
    name: 'Zona D - Bleachers & Cabecera',
    sections: ['400', '401', '402', '403', 'Bleachers', 'General', 'Cabecera', 'Bleachers Planta Alta'],
  },
];

/**
 * Inicializar zonas del estadio en Firestore si no existen
 */
export async function seedInitialZones(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, ZONES_COLLECTION));
    if (snap.empty) {
      for (const zone of INITIAL_ZONES) {
        const docRef = doc(db, ZONES_COLLECTION, zone.id);
        await setDoc(docRef, sanitizeFirestoreData(zone));
      }
    }
  } catch (err) {
    console.warn('Advertencia al inicializar zonas en Firestore:', err);
  }
}

/**
 * Obtener todas las zonas del estadio
 */
export async function getZones(): Promise<Zone[]> {
  try {
    const snap = await getDocs(collection(db, ZONES_COLLECTION));
    if (snap.empty) {
      await seedInitialZones();
      return INITIAL_ZONES;
    }
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Zone[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, ZONES_COLLECTION);
    return INITIAL_ZONES;
  }
}

/**
 * Obtener una zona por su ID
 */
export async function getZoneById(zoneId: string): Promise<Zone | null> {
  try {
    const docRef = doc(db, ZONES_COLLECTION, zoneId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Zone;
    }
    return INITIAL_ZONES.find((z) => z.id === zoneId) || null;
  } catch (err) {
    console.warn('Error fetching zone by id:', err);
    return INITIAL_ZONES.find((z) => z.id === zoneId) || null;
  }
}

/**
 * Resolver la zona de un pedido a partir de la sección del asiento
 */
export async function getZoneBySection(section: string): Promise<Zone | null> {
  if (!section) return null;
  const normalized = section.trim().toLowerCase();

  try {
    const allZones = await getZones();
    // 1. Coincidencia exacta o contenida en la lista de secciones
    for (const zone of allZones) {
      if (
        zone.sections.some(
          (s) => s.toLowerCase() === normalized || normalized.includes(s.toLowerCase()) || s.toLowerCase().includes(normalized)
        )
      ) {
        return zone;
      }
    }

    // 2. Mapeo heurístico por números de sección
    const num = parseInt(normalized.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      if (num >= 100 && num < 200) return allZones.find((z) => z.id === 'zona-a') || allZones[0];
      if (num >= 200 && num < 300) return allZones.find((z) => z.id === 'zona-b') || allZones[1] || allZones[0];
      if (num >= 300 && num < 400) return allZones.find((z) => z.id === 'zona-c') || allZones[2] || allZones[0];
      if (num >= 400 && num < 500) return allZones.find((z) => z.id === 'zona-d') || allZones[3] || allZones[0];
    }

    // Retornar primera zona por defecto si no se encuentra match
    return allZones[0] || null;
  } catch (err) {
    console.warn('Error resolviendo zona por sección:', err);
    return INITIAL_ZONES[0];
  }
}

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { VenueZone, VenueLayoutShape, SeatSection } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';

const VENUE_ZONES_COLLECTION = 'venueZones';
const VENUES_COLLECTION = 'venues';

/**
 * Paleta de colores recomendada para zonas de estadio (elegantes, de alto contraste)
 */
export const SUGGESTED_ZONE_COLORS = [
  { name: 'Ámbar VIP / Deluxe', hex: '#D97706' },
  { name: 'Púrpura Platino', hex: '#7C3AED' },
  { name: 'Azul Diamante', hex: '#0284C7' },
  { name: 'Dorado Oro', hex: '#EAB308' },
  { name: 'Cian Sky Plus', hex: '#06B6D4' },
  { name: 'Azul Real Plus', hex: '#3B82F6' },
  { name: 'Esmeralda Fan', hex: '#10B981' },
  { name: 'Verde Oscuro Fan Plus', hex: '#059669' },
  { name: 'Índigo Sky', hex: '#6366F1' },
  { name: 'Rojo Pasión / Cabecera Sur', hex: '#DC2626' },
  { name: 'Naranja Tribuna', hex: '#EA580C' },
  { name: 'Gris Pizarra General', hex: '#64748B' },
];

/**
 * Escuchar en tiempo real las zonas de un recinto
 */
export function subscribeVenueZones(
  venueId: string,
  onUpdate: (zones: VenueZone[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, VENUE_ZONES_COLLECTION),
    where('venueId', '==', venueId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VenueZone, 'id'>),
      }));
      // Ordenar por 'order' ascendente
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      onUpdate(list);
    },
    (err) => {
      console.warn('Error al suscribirse a venueZones:', err);
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, VENUE_ZONES_COLLECTION);
    }
  );
}

/**
 * Obtener las zonas de un recinto (one-time)
 */
export async function getVenueZones(venueId: string): Promise<VenueZone[]> {
  try {
    const q = query(
      collection(db, VENUE_ZONES_COLLECTION),
      where('venueId', '==', venueId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<VenueZone, 'id'>),
    }));
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return list;
  } catch (err) {
    console.warn('Error fetching venue zones:', err);
    return [];
  }
}

/**
 * Crear una nueva zona para un recinto
 */
export async function createVenueZone(
  venueId: string,
  data: { name: string; color: string; order: number }
): Promise<VenueZone> {
  const sanitized = sanitizeFirestoreData(data);
  const docRef = doc(collection(db, VENUE_ZONES_COLLECTION));
  const newZone: VenueZone = {
    id: docRef.id,
    venueId,
    name: sanitized.name.trim(),
    color: sanitized.color.trim() || '#3B82F6',
    order: Number(sanitized.order) || 1,
  };

  await setDoc(docRef, newZone);
  return newZone;
}

/**
 * Actualizar una zona existente
 */
export async function updateVenueZone(
  zoneId: string,
  updates: Partial<Omit<VenueZone, 'id' | 'venueId'>>
): Promise<void> {
  const sanitized = sanitizeFirestoreData(updates);
  const docRef = doc(db, VENUE_ZONES_COLLECTION, zoneId);
  await updateDoc(docRef, sanitized);
}

/**
 * Eliminar una zona
 */
export async function deleteVenueZone(zoneId: string): Promise<void> {
  const docRef = doc(db, VENUE_ZONES_COLLECTION, zoneId);
  await deleteDoc(docRef);
}

/**
 * Actualizar la forma arquitectónica (layoutShape) de un recinto en Firestore
 */
export async function saveVenueLayoutShape(
  venueId: string,
  layoutShape: VenueLayoutShape
): Promise<void> {
  const docRef = doc(db, VENUES_COLLECTION, venueId);
  await setDoc(docRef, { layoutShape, updatedAt: new Date().toISOString() }, { merge: true });
}

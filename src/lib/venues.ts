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
} from 'firebase/firestore';
import { db } from './firebase';
import { Venue, VenueEvent, EventType } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID, DEFAULT_FALLBACK_EVENT } from './defaultVenue';
import { normalizeGoogleDriveImageUrl, DEFAULT_STORE_PROMO_BANNER } from './imageUtils';

const VENUES_COLLECTION = 'venues';
const EVENTS_COLLECTION = 'venueEvents';

/**
 * Escuchar todos los recintos (Venues) en tiempo real
 */
export function subscribeVenues(
  onUpdate: (venues: Venue[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, VENUES_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([
          {
            id: DEFAULT_VENUE_ID,
            name: 'Estadio Teodoro Mariscal',
            city: 'Mazatlán',
            state: 'Sinaloa',
            address: 'Av. Justo Sierra s/n, Estadio, 82140 Mazatlán, Sin.',
            active: true,
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      const venuesList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Venue[];
      onUpdate(venuesList);
    },
    (err) => {
      console.warn('Error al escuchar sedes en tiempo real:', err);
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, VENUES_COLLECTION);
    }
  );
}

/**
 * Obtener todos los recintos (Venues)
 */
export async function getAllVenues(): Promise<Venue[]> {
  try {
    const snap = await getDocs(collection(db, VENUES_COLLECTION));
    if (snap.empty) {
      return [
        {
          id: DEFAULT_VENUE_ID,
          name: 'Estadio Teodoro Mariscal',
          city: 'Mazatlán',
          state: 'Sinaloa',
          address: 'Av. Justo Sierra s/n, Estadio, 82140 Mazatlán, Sin.',
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Venue[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, VENUES_COLLECTION);
    return [];
  }
}

/**
 * Obtener recinto por ID
 */
export async function getVenueById(venueId: string): Promise<Venue | null> {
  try {
    const snap = await getDoc(doc(db, VENUES_COLLECTION, venueId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Venue;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${VENUES_COLLECTION}/${venueId}`);
    return null;
  }
}

/**
 * Crear un nuevo recinto (Exclusivo Superadmin)
 */
export async function createVenue(venueData: Omit<Venue, 'id' | 'createdAt'> & { id?: string }): Promise<Venue> {
  const now = new Date().toISOString();
  try {
    const docRef = venueData.id ? doc(db, VENUES_COLLECTION, venueData.id) : doc(collection(db, VENUES_COLLECTION));
    const newVenue: Venue = {
      id: docRef.id,
      name: venueData.name,
      city: venueData.city,
      state: venueData.state,
      address: venueData.address,
      active: venueData.active !== undefined ? venueData.active : true,
      createdAt: now,
    };
    await setDoc(docRef, sanitizeFirestoreData(newVenue));
    return newVenue;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, VENUES_COLLECTION);
    throw err;
  }
}

/**
 * Actualizar un recinto (Exclusivo Superadmin)
 */
export async function updateVenue(venueId: string, updates: Partial<Venue>): Promise<void> {
  try {
    const docRef = doc(db, VENUES_COLLECTION, venueId);
    await updateDoc(docRef, sanitizeFirestoreData(updates));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${VENUES_COLLECTION}/${venueId}`);
    throw err;
  }
}

/**
 * Actualizar la promoción de la tienda oficial de un recinto para el Hero de bienvenida / login.
 * Permite a los Administradores de Sede y Superadmins configurar un póster/banner oficial (con soporte para Google Drive).
 */
export async function updateVenueStorePromo(
  venueId: string,
  promoData: {
    storePromoBannerUrl?: string;
    storePromoTitle?: string;
    storePromoSubtitle?: string;
    storePromoActive?: boolean;
  }
): Promise<void> {
  try {
    const docRef = doc(db, VENUES_COLLECTION, venueId);
    const normalizedBanner = promoData.storePromoBannerUrl !== undefined
      ? normalizeGoogleDriveImageUrl(promoData.storePromoBannerUrl)
      : undefined;

    const updates: Partial<Venue> = {
      ...(normalizedBanner !== undefined ? { storePromoBannerUrl: normalizedBanner } : {}),
      ...(promoData.storePromoTitle !== undefined ? { storePromoTitle: promoData.storePromoTitle } : {}),
      ...(promoData.storePromoSubtitle !== undefined ? { storePromoSubtitle: promoData.storePromoSubtitle } : {}),
      ...(promoData.storePromoActive !== undefined ? { storePromoActive: promoData.storePromoActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, sanitizeFirestoreData(updates));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${VENUES_COLLECTION}/${venueId}`);
    throw err;
  }
}

/**
 * Eliminar un recinto (Exclusivo Superadmin)
 */
export async function deleteVenue(venueId: string): Promise<void> {
  try {
    const docRef = doc(db, VENUES_COLLECTION, venueId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${VENUES_COLLECTION}/${venueId}`);
    throw err;
  }
}

/**
 * Obtener eventos, opcionalmente filtrados por recinto
 */
export async function getVenueEvents(venueId?: string): Promise<VenueEvent[]> {
  try {
    let q = query(collection(db, EVENTS_COLLECTION));
    if (venueId) {
      q = query(collection(db, EVENTS_COLLECTION), where('venueId', '==', venueId));
    }
    const snap = await getDocs(q);
    if (snap.empty && (!venueId || venueId === DEFAULT_VENUE_ID)) {
      return [DEFAULT_FALLBACK_EVENT];
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as VenueEvent[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, EVENTS_COLLECTION);
    return [];
  }
}

export {
  createVenueEvent,
  updateVenueEvent,
  deleteVenueEvent,
  getActiveEventsForVenue,
  subscribeVenueEvents,
} from './venueEvents';


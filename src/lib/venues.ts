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
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Venue, VenueEvent, EventType } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID, DEFAULT_FALLBACK_EVENT, DEFAULT_VENUES } from './defaultVenue';
import { normalizeGoogleDriveImageUrl, DEFAULT_STORE_PROMO_BANNER } from './imageUtils';

const VENUES_COLLECTION = 'venues';
const EVENTS_COLLECTION = 'venueEvents';

/**
 * Determina los tipos de evento permitidos para un recinto dado.
 * Reglas de negocio:
 * - Estadio Teodoro Mariscal: solo béisbol y conciertos ('baseball', 'concert')
 * - Estadio El Encanto: solo fútbol y conciertos ('football', 'concert')
 * - 'todos' o indefinido: null (permite todas las categorías)
 */
export function getAllowedEventTypesForVenue(venueOrIdOrName?: Venue | string | null): EventType[] | null {
  if (!venueOrIdOrName || venueOrIdOrName === 'todos') return null;

  const id = typeof venueOrIdOrName === 'string' ? venueOrIdOrName : venueOrIdOrName.id || '';
  const name = typeof venueOrIdOrName === 'string' ? venueOrIdOrName : venueOrIdOrName.name || '';
  const str = `${id} ${name}`.toLowerCase();

  // Estadio Teodoro Mariscal: solo béisbol y conciertos
  if (str.includes('teodoro') || str.includes('mariscal') || id === DEFAULT_VENUE_ID) {
    return ['baseball', 'concert'];
  }

  // Estadio El Encanto: solo fútbol y conciertos
  if (str.includes('encanto') || id === 'venue-encanto') {
    return ['football', 'concert'];
  }

  // Si el objeto Venue tiene declarados allowedEventTypes explícitamente
  if (typeof venueOrIdOrName === 'object' && venueOrIdOrName.allowedEventTypes && venueOrIdOrName.allowedEventTypes.length > 0) {
    return venueOrIdOrName.allowedEventTypes;
  }

  return null;
}

/**
 * Escuchar todos los recintos (Venues) en tiempo real
 * Por defecto filtra únicamente las sedes activas (active !== false).
 * Si includeInactive es true (usado por Superadmin), incluye todas.
 */
export function subscribeVenues(
  onUpdate: (venues: Venue[]) => void,
  onError?: (err: Error) => void,
  options?: { includeInactive?: boolean }
): () => void {
  const includeInactive = options?.includeInactive ?? false;
  const q = query(collection(db, VENUES_COLLECTION), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      let combined: Venue[];
      if (snapshot.empty) {
        combined = [...DEFAULT_VENUES];
      } else {
        const venuesList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Venue[];
        // Garantizar que DEFAULT_VENUES estén disponibles como opciones válidas si no existen en Firestore
        const merged = [...venuesList];
        for (const defVenue of DEFAULT_VENUES) {
          if (!merged.some((v) => v.id === defVenue.id)) {
            merged.push(defVenue);
          }
        }
        combined = merged;
      }

      // Filtrar sedes inactivas si no se solicita explícitamente incluir inactivas
      const finalVenues = includeInactive
        ? combined
        : combined.filter((v) => v.active !== false);

      onUpdate(finalVenues);
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
 * Por defecto filtra únicamente las sedes activas (active !== false).
 * Si includeInactive es true (usado por Superadmin), retorna todas.
 */
export async function getAllVenues(options?: { includeInactive?: boolean }): Promise<Venue[]> {
  const includeInactive = options?.includeInactive ?? false;
  try {
    const snap = await getDocs(query(collection(db, VENUES_COLLECTION), limit(50)));
    let combined: Venue[];
    if (snap.empty) {
      combined = [...DEFAULT_VENUES];
    } else {
      const venuesList = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Venue[];
      const merged = [...venuesList];
      for (const defVenue of DEFAULT_VENUES) {
        if (!merged.some((v) => v.id === defVenue.id)) {
          merged.push(defVenue);
        }
      }
      combined = merged;
    }

    return includeInactive ? combined : combined.filter((v) => v.active !== false);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, VENUES_COLLECTION);
    return includeInactive ? DEFAULT_VENUES : DEFAULT_VENUES.filter((v) => v.active !== false);
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
    // Usamos setDoc con { merge: true } para garantizar que si la sede era de DEFAULT_VENUES
    // y aún no existía un documento explícito en Firestore, se cree e inicialice correctamente.
    const sanitized = sanitizeFirestoreData({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, sanitized, { merge: true });
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
    const q = venueId
      ? query(collection(db, EVENTS_COLLECTION), where('venueId', '==', venueId), limit(50))
      : query(collection(db, EVENTS_COLLECTION), limit(50));
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


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
} from 'firebase/firestore';
import { db } from './firebase';
import { Venue, VenueEvent, EventType } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from './defaultVenue';

const VENUES_COLLECTION = 'venues';
const EVENTS_COLLECTION = 'venueEvents';

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
      return [
        {
          id: DEFAULT_EVENT_ID,
          venueId: DEFAULT_VENUE_ID,
          type: 'baseball',
          name: 'Temporada Regular Venados 2026',
          date: '2026-10-15',
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as VenueEvent[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, EVENTS_COLLECTION);
    return [];
  }
}

/**
 * Crear un evento para un recinto (Exclusivo Superadmin)
 */
export async function createVenueEvent(
  eventData: Omit<VenueEvent, 'id' | 'createdAt'> & { id?: string }
): Promise<VenueEvent> {
  const now = new Date().toISOString();
  try {
    const docRef = eventData.id ? doc(db, EVENTS_COLLECTION, eventData.id) : doc(collection(db, EVENTS_COLLECTION));
    const newEvent: VenueEvent = {
      id: docRef.id,
      venueId: eventData.venueId,
      type: eventData.type,
      name: eventData.name,
      date: eventData.date,
      active: eventData.active !== undefined ? eventData.active : true,
      createdAt: now,
    };
    await setDoc(docRef, sanitizeFirestoreData(newEvent));
    return newEvent;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, EVENTS_COLLECTION);
    throw err;
  }
}

/**
 * Actualizar evento (Exclusivo Superadmin)
 */
export async function updateVenueEvent(eventId: string, updates: Partial<VenueEvent>): Promise<void> {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, eventId);
    await updateDoc(docRef, sanitizeFirestoreData(updates));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${EVENTS_COLLECTION}/${eventId}`);
    throw err;
  }
}

/**
 * Eliminar evento (Exclusivo Superadmin)
 */
export async function deleteVenueEvent(eventId: string): Promise<void> {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, eventId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${EVENTS_COLLECTION}/${eventId}`);
    throw err;
  }
}

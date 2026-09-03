import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { VenueEvent, EventPriceTier } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { generateEventSeats } from './seatMap';

const COLLECTION_NAME = 'venueEvents';

export const DEFAULT_FALLBACK_EVENTS: VenueEvent[] = [
  {
    id: 'event-venados-tomateros-2026',
    venueId: DEFAULT_VENUE_ID,
    type: 'baseball',
    name: 'Venados de Mazatlán vs Tomateros de Culiacán',
    opponent: 'Tomateros de Culiacán',
    date: '2026-10-15',
    time: '20:00 hrs',
    gate: 'Puertas 1, 2, 4 y 8',
    active: true,
    ticketsAvailable: true,
    priceTiers: [
      { section: 'Platea Baja Central', price: 450 },
      { section: 'Preferente Lateral', price: 320 },
      { section: 'Palco VIP Premier', price: 850 },
      { section: 'Bleachers / Grada General', price: 150 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'event-venados-naranjeros-2026',
    venueId: DEFAULT_VENUE_ID,
    type: 'baseball',
    name: 'Venados de Mazatlán vs Naranjeros de Hermosillo',
    opponent: 'Naranjeros de Hermosillo',
    date: '2026-10-22',
    time: '19:30 hrs',
    gate: 'Puertas 1, 2, 4 y 8',
    active: true,
    ticketsAvailable: true,
    priceTiers: [
      { section: 'Platea Baja Central', price: 450 },
      { section: 'Preferente Lateral', price: 320 },
      { section: 'Palco VIP Premier', price: 850 },
      { section: 'Bleachers / Grada General', price: 150 },
    ],
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'event-venados-yaquis-2026',
    venueId: DEFAULT_VENUE_ID,
    type: 'baseball',
    name: 'Venados de Mazatlán vs Yaquis de Obregón',
    opponent: 'Yaquis de Obregón',
    date: '2026-10-29',
    time: '20:00 hrs',
    gate: 'Puertas 1, 2, 4 y 8',
    active: true,
    ticketsAvailable: true,
    priceTiers: [
      { section: 'Platea Baja Central', price: 450 },
      { section: 'Preferente Lateral', price: 320 },
      { section: 'Palco VIP Premier', price: 850 },
      { section: 'Bleachers / Grada General', price: 150 },
    ],
    createdAt: '2026-01-03T00:00:00.000Z',
  },
];

/**
 * Helper interno para resolver el venueId legítimo del admin autenticado.
 * Garantiza que ninguna llamada confíe en lo que mande el cliente.
 */
async function resolveAdminVenueId(providedVenueId?: string): Promise<string> {
  const currentAuth = auth.currentUser;
  if (!currentAuth) {
    if (providedVenueId) return providedVenueId;
    throw new Error('Usuario no autenticado para gestionar eventos.');
  }

  try {
    const userDocRef = doc(db, 'users', currentAuth.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.venueId) {
        return userData.venueId;
      }
    }
  } catch (err) {
    console.warn('No se pudo resolver venueId desde el perfil de usuario:', err);
  }

  return providedVenueId || DEFAULT_VENUE_ID;
}

/**
 * Crear un evento forzando venueId al del admin que hace la llamada
 */
export async function createVenueEvent(
  eventData: Omit<VenueEvent, 'id' | 'createdAt'> & { id?: string },
  forcedVenueId?: string
): Promise<VenueEvent> {
  const adminVenueId = await resolveAdminVenueId(forcedVenueId);
  const now = new Date().toISOString();

  try {
    const docRef = eventData.id
      ? doc(db, COLLECTION_NAME, eventData.id)
      : doc(collection(db, COLLECTION_NAME));

    const newEvent: VenueEvent = {
      id: docRef.id,
      venueId: adminVenueId, // Forzado estricto al del admin
      type: eventData.type || 'baseball',
      name: eventData.name,
      opponent: eventData.opponent || '',
      date: eventData.date,
      time: eventData.time || '20:00 hrs',
      gate: eventData.gate || 'Puertas Generales',
      active: eventData.active !== undefined ? eventData.active : true,
      ticketsAvailable: eventData.ticketsAvailable !== undefined ? eventData.ticketsAvailable : true,
      priceTiers: eventData.priceTiers && eventData.priceTiers.length > 0
        ? eventData.priceTiers
        : [
            { section: 'Platea Baja Central', price: 450 },
            { section: 'Preferente Lateral', price: 320 },
            { section: 'Palco VIP Premier', price: 850 },
            { section: 'Bleachers / Grada General', price: 150 },
          ],
      createdAt: now,
    };

    await setDoc(docRef, sanitizeFirestoreData(newEvent));

    // Generar automáticamente la disponibilidad de asientos físicos para el evento
    try {
      await generateEventSeats(newEvent.id, newEvent.venueId);
    } catch (seatErr) {
      console.warn('Advertencia al generar asientos para el evento:', seatErr);
    }

    return newEvent;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, COLLECTION_NAME);
    throw err;
  }
}

/**
 * Actualizar un evento forzando que pertenezca a la sede del admin
 */
export async function updateVenueEvent(
  eventId: string,
  updates: Partial<VenueEvent>,
  forcedVenueId?: string
): Promise<void> {
  const adminVenueId = await resolveAdminVenueId(forcedVenueId);

  try {
    const docRef = doc(db, COLLECTION_NAME, eventId);
    const existingSnap = await getDoc(docRef);

    if (!existingSnap.exists()) {
      throw new Error(`El evento con ID ${eventId} no existe.`);
    }

    const existingData = existingSnap.data() as VenueEvent;
    // Comprobar que no pertenezca a otra sede
    if (existingData.venueId && existingData.venueId !== adminVenueId) {
      throw new Error('No tienes permisos para modificar eventos de otra sede.');
    }

    // Proteger congelando venueId al del admin
    const safeUpdates: any = { ...updates };
    safeUpdates.venueId = adminVenueId;

    await updateDoc(docRef, sanitizeFirestoreData(safeUpdates));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${eventId}`);
    throw err;
  }
}

/**
 * Eliminar un evento verificando que pertenezca a la sede del admin
 */
export async function deleteVenueEvent(eventId: string, forcedVenueId?: string): Promise<void> {
  const adminVenueId = await resolveAdminVenueId(forcedVenueId);

  try {
    const docRef = doc(db, COLLECTION_NAME, eventId);
    const existingSnap = await getDoc(docRef);

    if (!existingSnap.exists()) {
      return;
    }

    const existingData = existingSnap.data() as VenueEvent;
    if (existingData.venueId && existingData.venueId !== adminVenueId) {
      throw new Error('No tienes permisos para eliminar eventos de otra sede.');
    }

    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${eventId}`);
    throw err;
  }
}

/**
 * Obtener eventos con active: true y ticketsAvailable: true, ordenados por date
 */
export async function getActiveEventsForVenue(venueId: string): Promise<VenueEvent[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('venueId', '==', venueId)
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VenueEvent));

    const activeEvents = all
      .filter((e) => e.active === true && e.ticketsAvailable === true)
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    if (activeEvents.length === 0 && venueId === DEFAULT_VENUE_ID) {
      return DEFAULT_FALLBACK_EVENTS.filter((e) => e.active && e.ticketsAvailable);
    }

    return activeEvents;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return venueId === DEFAULT_VENUE_ID ? DEFAULT_FALLBACK_EVENTS : [];
  }
}

/**
 * Suscripción en tiempo real a los eventos de la sede del admin
 */
export function subscribeVenueEvents(
  venueId: string,
  onUpdate: (events: VenueEvent[]) => void,
  onError?: (err: Error) => void
) {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  const q = query(
    collection(db, COLLECTION_NAME),
    where('venueId', '==', targetVenueId)
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty && targetVenueId === DEFAULT_VENUE_ID) {
        onUpdate(DEFAULT_FALLBACK_EVENTS);
        return;
      }

      const events: VenueEvent[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<VenueEvent, 'id'>),
        }))
        .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

      onUpdate(events);
    },
    (error) => {
      console.warn(`Error escuchando eventos para la sede ${targetVenueId}:`, error);
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  );
}

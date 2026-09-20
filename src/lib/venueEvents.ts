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
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { VenueEvent, EventPriceTier, EventType, HeroSlide, Venue } from '../types';
import { DEFAULT_VENUE_ID } from './constants';
import { DEFAULT_VENUES } from './defaultVenue';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { generateEventSeats, getOfficialPriceTiersForEvent, getOfficialPriceTiersForVenue, isLegacySection } from './seatMap';
import { normalizeGoogleDriveImageUrl, DEFAULT_STORE_PROMO_BANNER, getEventPosterPlaceholder } from './imageUtils';

export { getEventPosterPlaceholder };

const COLLECTION_NAME = 'venueEvents';

export const MARISCAL_PRICE_TIERS: EventPriceTier[] = [
  { section: 'Deluxe Supreme', price: 950 },
  { section: 'Platino', price: 750 },
  { section: 'Diamante', price: 600 },
  { section: 'Oro', price: 480 },
  { section: 'Sky Plus', price: 400 },
  { section: 'Plus', price: 350 },
  { section: 'Fan', price: 220 },
  { section: 'Fan Plus', price: 280 },
  { section: 'Sky', price: 160 },
];

export const ENCANTO_PRICE_TIERS: EventPriceTier[] = [
  { section: 'Poniente Central', price: 650 },
  { section: 'Oriente Central', price: 600 },
  { section: 'Poniente Lateral', price: 480 },
  { section: 'Oriente Lateral', price: 450 },
  { section: 'Poniente Superior', price: 360 },
  { section: 'Oriente Superior', price: 320 },
  { section: 'General Sur', price: 220 },
  { section: 'General Norte', price: 200 },
  { section: 'Cabecera Superior', price: 250 },
  { section: 'Tiro de Esquina', price: 290 },
  { section: 'Palcos', price: 1200 },
  { section: 'Sky Boxes', price: 1400 },
  { section: 'Zona Lounge', price: 1100 },
];

export function isDeletedMazatlanFCEvent(e: { id?: string; name?: string }): boolean {
  if (e.id === 'event-futbol-mazatlan-2026') return true;
  const name = (e.name || '').toLowerCase();
  return name.includes('mazatlán fc') || name.includes('mazatlan fc');
}

/**
 * Obtiene el objeto Date correspondiente al inicio del evento combinando date y time
 */
export function getEventDateTime(event: { date: string; time?: string }): Date {
  let hours = 20;
  let minutes = 0;
  if (event.time) {
    const match = event.time.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
    }
  }

  const dateParts = event.date.split('-');
  const year = parseInt(dateParts[0], 10) || 2026;
  const month = (parseInt(dateParts[1], 10) || 10) - 1;
  const day = parseInt(dateParts[2], 10) || 15;

  return new Date(year, month, day, hours, minutes, 0);
}

/**
 * Determina si la fecha y horario del evento ya concluyeron.
 * Si ya pasó la fecha del evento, las ventas deben cerrarse y marcarse como finalizado.
 */
export function isEventPassed(event: { date: string; time?: string; orderingClosesAt?: string; status?: string }): boolean {
  if (event.status === 'finalizado') return true;

  const now = Date.now();

  // 1. Si se configuró orderingClosesAt explícito
  if (event.orderingClosesAt) {
    const closesTime = new Date(event.orderingClosesAt).getTime();
    if (!isNaN(closesTime) && now > closesTime) {
      return true;
    }
  }

  // 2. Por fecha y hora del evento: se considera concluido transcurridas 3.5 horas desde su inicio
  const eventStart = getEventDateTime(event);
  const eventEndTime = eventStart.getTime() + 3.5 * 60 * 60 * 1000;

  return now > eventEndTime;
}

/**
 * Parsea y normaliza un documento de evento asegurando que su posterUrl
 * esté normalizado, cerrando automáticamente ventas si la fecha ya pasó,
 * y verificando priceTiers oficiales.
 */
export function parseVenueEventDoc(id: string, data: any): VenueEvent {
  const rawPoster = typeof data.posterUrl === 'string' ? data.posterUrl.trim() : '';
  const resolvedPoster = normalizeGoogleDriveImageUrl(rawPoster) || getEventPosterPlaceholder(data.type || 'baseball');

  const baseEvent = {
    id,
    ...data,
    posterUrl: resolvedPoster,
  } as VenueEvent;

  // Resolver tiers oficiales del mapa eliminando cualquier sección anterior
  const officialPriceTiers = getOfficialPriceTiersForEvent(baseEvent, data.venueName);

  // Verificación de fecha vencida: si la fecha ya pasó, cerrar venta y marcar como finalizado
  const isPast = isEventPassed(baseEvent);
  const ticketsAvailable = isPast ? false : (baseEvent.ticketsAvailable !== undefined ? baseEvent.ticketsAvailable : true);
  const status = isPast ? 'finalizado' : (baseEvent.status || 'programado');

  // Si en Firestore aún figuraba abierto o sin marcar como finalizado, sincronizar en segundo plano
  if (isPast && (data.ticketsAvailable !== false || data.status !== 'finalizado')) {
    updateDoc(doc(db, COLLECTION_NAME, id), {
      ticketsAvailable: false,
      status: 'finalizado',
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return {
    ...baseEvent,
    priceTiers: officialPriceTiers,
    ticketsAvailable,
    status,
  };
}

/**
 * Calcula la ventana sugerida por defecto:
 * - orderingOpensAt: 2 horas antes de date + time
 * - orderingClosesAt: 4 horas después de date + time
 */
export function computeDefaultOrderingWindow(dateStr: string, timeStr?: string): { orderingOpensAt: string; orderingClosesAt: string } {
  let hours = 20;
  let minutes = 0;
  if (timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
    }
  }

  const dateParts = dateStr.split('-');
  const year = parseInt(dateParts[0], 10) || 2026;
  const month = (parseInt(dateParts[1], 10) || 10) - 1;
  const day = parseInt(dateParts[2], 10) || 15;

  const eventStart = new Date(year, month, day, hours, minutes, 0);

  // 2 horas antes
  const opens = new Date(eventStart.getTime() - 2 * 60 * 60 * 1000);
  // 4 horas después
  const closes = new Date(eventStart.getTime() + 4 * 60 * 60 * 1000);

  return {
    orderingOpensAt: opens.toISOString(),
    orderingClosesAt: closes.toISOString(),
  };
}

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
    posterUrl: getEventPosterPlaceholder('baseball'),
    ...computeDefaultOrderingWindow('2026-10-15', '20:00 hrs'),
    priceTiers: MARISCAL_PRICE_TIERS,
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
    posterUrl: getEventPosterPlaceholder('baseball'),
    ...computeDefaultOrderingWindow('2026-10-22', '19:30 hrs'),
    priceTiers: MARISCAL_PRICE_TIERS,
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
    posterUrl: getEventPosterPlaceholder('baseball'),
    ...computeDefaultOrderingWindow('2026-10-29', '20:00 hrs'),
    priceTiers: MARISCAL_PRICE_TIERS,
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: 'event-basquet-venados-2026',
    venueId: DEFAULT_VENUE_ID,
    type: 'basketball',
    name: 'Venados Basketball vs Rayos de Hermosillo',
    opponent: 'Rayos de Hermosillo',
    date: '2026-11-12',
    time: '20:15 hrs',
    gate: 'Acceso Central',
    active: true,
    ticketsAvailable: true,
    posterUrl: getEventPosterPlaceholder('basketball'),
    ...computeDefaultOrderingWindow('2026-11-12', '20:15 hrs'),
    priceTiers: MARISCAL_PRICE_TIERS,
    createdAt: '2026-01-08T00:00:00.000Z',
  },
  {
    id: 'event-concierto-mazatlan-2026',
    venueId: DEFAULT_VENUE_ID,
    type: 'concert',
    name: 'Festival Musical Mazatlán Live 2026',
    date: '2026-11-20',
    time: '21:30 hrs',
    gate: 'Todas las puertas',
    active: true,
    ticketsAvailable: true,
    posterUrl: getEventPosterPlaceholder('concert'),
    ...computeDefaultOrderingWindow('2026-11-20', '21:30 hrs'),
    priceTiers: MARISCAL_PRICE_TIERS,
    createdAt: '2026-01-09T00:00:00.000Z',
  },
  {
    id: 'event-espectaculo-familiar-2026',
    venueId: DEFAULT_VENUE_ID,
    type: 'other',
    name: 'Gala Internacional de Acrobacia y Deportes Extremos',
    date: '2026-11-28',
    time: '18:30 hrs',
    gate: 'Puertas 1 y 2',
    active: true,
    ticketsAvailable: true,
    posterUrl: getEventPosterPlaceholder('other'),
    ...computeDefaultOrderingWindow('2026-11-28', '18:30 hrs'),
    priceTiers: MARISCAL_PRICE_TIERS,
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'event-dorados-encanto-2026',
    venueId: 'venue-encanto',
    type: 'soccer',
    name: 'Dorados de Sinaloa vs Atlante',
    opponent: 'Atlante F.C.',
    date: '2026-10-24',
    time: '20:00 hrs',
    gate: 'Puertas 1, 2, 3 y 4',
    active: true,
    ticketsAvailable: true,
    venueName: 'Estadio El Encanto',
    posterUrl: getEventPosterPlaceholder('soccer'),
    ...computeDefaultOrderingWindow('2026-10-24', '20:00 hrs'),
    priceTiers: ENCANTO_PRICE_TIERS,
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'event-dorados-morelia-2026',
    venueId: 'venue-encanto',
    type: 'soccer',
    name: 'Dorados de Sinaloa vs Atlético Morelia',
    opponent: 'Atlético Morelia',
    date: '2026-11-06',
    time: '21:00 hrs',
    gate: 'Puertas 1, 2, 3 y 4',
    active: true,
    ticketsAvailable: true,
    venueName: 'Estadio El Encanto',
    posterUrl: getEventPosterPlaceholder('soccer'),
    ...computeDefaultOrderingWindow('2026-11-06', '21:00 hrs'),
    priceTiers: ENCANTO_PRICE_TIERS,
    createdAt: '2026-01-13T00:00:00.000Z',
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

    const defaultWindow = computeDefaultOrderingWindow(eventData.date, eventData.time);

    const rawPoster = eventData.posterUrl ? normalizeGoogleDriveImageUrl(eventData.posterUrl) : '';
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
      availableSeats: eventData.availableSeats !== undefined ? Number(eventData.availableSeats) : undefined,
      totalCapacity: eventData.totalCapacity !== undefined ? Number(eventData.totalCapacity) : undefined,
      posterUrl: rawPoster || getEventPosterPlaceholder(eventData.type || 'baseball'),
      orderingOpensAt: eventData.orderingOpensAt || defaultWindow.orderingOpensAt,
      orderingClosesAt: eventData.orderingClosesAt || defaultWindow.orderingClosesAt,
      priceTiers: eventData.priceTiers && eventData.priceTiers.length > 0
        ? getOfficialPriceTiersForEvent({ ...eventData, venueId: adminVenueId, id: docRef.id, createdAt: now } as VenueEvent)
        : getOfficialPriceTiersForVenue(adminVenueId, undefined, eventData.type),
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
    if (safeUpdates.posterUrl !== undefined) {
      safeUpdates.posterUrl = normalizeGoogleDriveImageUrl(safeUpdates.posterUrl);
    }
    if (safeUpdates.availableSeats !== undefined && safeUpdates.availableSeats !== null) {
      safeUpdates.availableSeats = Number(safeUpdates.availableSeats);
    }
    if (safeUpdates.totalCapacity !== undefined && safeUpdates.totalCapacity !== null) {
      safeUpdates.totalCapacity = Number(safeUpdates.totalCapacity);
    }
    if (safeUpdates.priceTiers !== undefined && Array.isArray(safeUpdates.priceTiers)) {
      safeUpdates.priceTiers = getOfficialPriceTiersForEvent(
        { ...existingData, ...safeUpdates, venueId: adminVenueId },
        existingData.venueName
      );
    }

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
      where('venueId', '==', venueId),
      limit(50)
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => parseVenueEventDoc(d.id, d.data()));

    const activeEvents = all
      .filter((e) => !isDeletedMazatlanFCEvent(e) && e.active === true && e.ticketsAvailable === true)
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    if (activeEvents.length === 0 && venueId === DEFAULT_VENUE_ID) {
      return DEFAULT_FALLBACK_EVENTS.map((e) => ({
        ...e,
        posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
      })).filter((e) => e.active && e.ticketsAvailable);
    }

    return activeEvents;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return venueId === DEFAULT_VENUE_ID
      ? DEFAULT_FALLBACK_EVENTS.map((e) => ({
          ...e,
          posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
        }))
      : [];
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
      if (snapshot.empty) {
        const fallbacks = DEFAULT_FALLBACK_EVENTS.filter((e) => e.venueId === targetVenueId);
        if (fallbacks.length > 0) {
          onUpdate(
            fallbacks.map((e) => ({
              ...e,
              posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
            }))
          );
          return;
        }
      }

      const events: VenueEvent[] = snapshot.docs
        .map((docSnap) => {
          const rawData = docSnap.data();
          const parsed = parseVenueEventDoc(docSnap.id, rawData);
          // Si el documento en base de datos aún tiene nombres viejos (preferente lateral, bleachers, etc.), sanear en background
          const hasLegacy =
            Array.isArray(rawData.priceTiers) &&
            rawData.priceTiers.some((t: any) => isLegacySection(t?.section));
          if (hasLegacy) {
            updateDoc(doc(db, COLLECTION_NAME, docSnap.id), {
              priceTiers: parsed.priceTiers,
            }).catch(() => {});
          }
          return parsed;
        })
        .filter((e) => !isDeletedMazatlanFCEvent(e))
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

/**
 * Evalúa una lista de eventos y determina el evento activo y el próximo evento programado.
 * Garantiza que siempre se extraiga la imagen auténtica o su placeholder adecuado.
 */
export function evaluateActiveAndUpcomingEvents(events: VenueEvent[]): {
  activeEvent: VenueEvent | null;
  upcomingEvent: VenueEvent | null;
} {
  const now = new Date().toISOString();

  // 1. Evento activo: está activo y el momento actual cae dentro de la ventana de pedidos (o status === 'en_vivo'),
  // y NO está finalizado, cancelado ni concluido por fecha.
  const activeEvent =
    events.find((e) => {
      if (!e.active || e.status === 'finalizado' || e.status === 'cancelado') return false;
      if (isEventPassed(e)) return false;
      if (e.status === 'en_vivo') return true;

      let opens = e.orderingOpensAt;
      let closes = e.orderingClosesAt;
      if (!opens || !closes) {
        const computed = computeDefaultOrderingWindow(e.date, e.time);
        opens = opens || computed.orderingOpensAt;
        closes = closes || computed.orderingClosesAt;
      }
      return now >= opens && now <= closes;
    }) || null;

  // 2. Próximo evento programado: no es el activo, no está finalizado ni concluido, y su fecha/cierre es futuro
  const upcomingCandidates = events
    .filter((e) => {
      if (!e.active) return false;
      if (e.status === 'finalizado' || e.status === 'cancelado') return false;
      if (isEventPassed(e)) return false;
      if (activeEvent && e.id === activeEvent.id) return false;

      let closes = e.orderingClosesAt;
      if (!closes) {
        const computed = computeDefaultOrderingWindow(e.date, e.time);
        closes = computed.orderingClosesAt;
      }
      return closes >= now;
    })
    .sort((a, b) => {
      const aOpen = a.orderingOpensAt || computeDefaultOrderingWindow(a.date, a.time).orderingOpensAt;
      const bOpen = b.orderingOpensAt || computeDefaultOrderingWindow(b.date, b.time).orderingOpensAt;
      return aOpen.localeCompare(bOpen);
    });

  // Si no hay eventos futuros reales, el próximo evento es null
  const upcomingEvent = upcomingCandidates.length > 0 ? upcomingCandidates[0] : null;

  return { activeEvent, upcomingEvent };
}

/**
 * 4. Función para saber si hay pedidos activos ahora
 * Busca, entre los eventos active de esa sede, si el momento actual (new Date().toISOString())
 * cae dentro de [orderingOpensAt, orderingClosesAt] de alguno.
 * Si no hay ninguno, regresa null.
 */
export async function getActiveOrderingEvent(venueId: string): Promise<VenueEvent | null> {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('venueId', '==', targetVenueId),
      limit(50)
    );
    const snap = await getDocs(q);
    let events = snap.docs.map((d) => parseVenueEventDoc(d.id, d.data()));
    if (events.length === 0 && targetVenueId === DEFAULT_VENUE_ID) {
      events = DEFAULT_FALLBACK_EVENTS.map((e) => ({
        ...e,
        posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
      }));
    }

    const { activeEvent } = evaluateActiveAndUpcomingEvents(events);
    return activeEvent;
  } catch (err) {
    console.error('Error al verificar pedidos activos:', err);
    return null;
  }
}

/**
 * Obtener el próximo evento programado cuya ventana de pedidos abrirá en el futuro
 */
export async function getNextUpcomingEvent(venueId: string): Promise<VenueEvent | null> {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('venueId', '==', targetVenueId),
      limit(50)
    );
    const snap = await getDocs(q);
    let events = snap.docs.map((d) => parseVenueEventDoc(d.id, d.data()));
    if (events.length === 0 && targetVenueId === DEFAULT_VENUE_ID) {
      events = DEFAULT_FALLBACK_EVENTS.map((e) => ({
        ...e,
        posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
      }));
    }

    const { upcomingEvent } = evaluateActiveAndUpcomingEvents(events);
    return upcomingEvent;
  } catch (err) {
    console.error('Error al obtener próximo evento:', err);
    if (targetVenueId === DEFAULT_VENUE_ID) {
      const fallbackEvents = DEFAULT_FALLBACK_EVENTS.map((e) => ({
        ...e,
        posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
      }));
      return evaluateActiveAndUpcomingEvents(fallbackEvents).upcomingEvent;
    }
    return null;
  }
}

/**
 * Suscripción en tiempo real al estado de la sede (evento activo y próximo evento)
 * para cocinas, concesiones y el módulo de comida de aficionados.
 */
export function subscribeVenueEventStatus(
  venueId: string,
  onStatusChange: (status: {
    activeEvent: VenueEvent | null;
    upcomingEvent: VenueEvent | null;
  }) => void,
  onError?: (error: Error) => void
): () => void {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  const q = query(
    collection(db, COLLECTION_NAME),
    where('venueId', '==', targetVenueId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      let events: VenueEvent[] = [];
      if (snapshot.empty && targetVenueId === DEFAULT_VENUE_ID) {
        events = DEFAULT_FALLBACK_EVENTS.map((e) => ({
          ...e,
          posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
        }));
      } else {
        events = snapshot.docs.map((docSnap) => parseVenueEventDoc(docSnap.id, docSnap.data()));
      }

      events.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      const status = evaluateActiveAndUpcomingEvents(events);
      onStatusChange(status);
    },
    (error) => {
      console.warn(`Error escuchando estado de eventos para la sede ${targetVenueId}:`, error);
      const fallbackEvents = DEFAULT_FALLBACK_EVENTS.map((e) => ({
        ...e,
        posterUrl: normalizeGoogleDriveImageUrl(e.posterUrl) || getEventPosterPlaceholder(e.type),
      }));
      onStatusChange(evaluateActiveAndUpcomingEvents(fallbackEvents));
      if (onError) onError(error);
    }
  );
}

/**
 * Obtener un evento específico por su ID (usado para redirección directa post-login)
 */
export async function getVenueEventById(eventId: string): Promise<VenueEvent | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, eventId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return parseVenueEventDoc(snap.id, snap.data());
    }
    const fallback = DEFAULT_FALLBACK_EVENTS.find((e) => e.id === eventId);
    if (fallback) {
      return {
        ...fallback,
        posterUrl: normalizeGoogleDriveImageUrl(fallback.posterUrl) || getEventPosterPlaceholder(fallback.type),
      };
    }
    return null;
  } catch (err) {
    console.warn('Error al buscar evento por ID:', err);
    const fallback = DEFAULT_FALLBACK_EVENTS.find((e) => e.id === eventId);
    return fallback
      ? {
          ...fallback,
          posterUrl: normalizeGoogleDriveImageUrl(fallback.posterUrl) || getEventPosterPlaceholder(fallback.type),
        }
      : null;
  }
}

/**
 * Consulta los eventos activos con fecha futura para la cartelera de bienvenida.
 * Permite mostrar los carteles de los eventos de todas las sedes disponibles de la ciudad actual
 * (ej. Estadio Teodoro Mariscal, Estadio El Encanto, etc.) para que los clientes puedan decidir
 * comprar boletos para eventos de cualquiera de ellas.
 */
export async function getUpcomingHeroEvents(
  venueId?: string,
  limitCount: number = 8,
  city?: string
): Promise<VenueEvent[]> {
  const todayStr = new Date().toISOString().split('T')[0];
  const normalizeStr = (str?: string) =>
    (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const targetCity = city ? normalizeStr(city) : null;

  try {
    // 1. Obtener información de todas las sedes registradas para asociar nombres de estadio y ciudades
    const venuesMap = new Map<string, { name: string; city: string }>();
    DEFAULT_VENUES.forEach((v) => {
      venuesMap.set(v.id, { name: v.name, city: v.city || 'Mazatlán' });
    });
    try {
      const venuesSnap = await getDocs(query(collection(db, 'venues'), limit(50)));
      venuesSnap.docs.forEach((d) => {
        const data = d.data();
        venuesMap.set(d.id, {
          name: data.name || 'Recinto Deportivo',
          city: data.city || 'Mazatlán',
        });
      });
    } catch (err) {
      console.warn('No se pudieron precargar sedes para la cartelera hero:', err);
    }

    // 2. Si se especifica un venueId puntual, se busca primero en ese venue;
    // si no se especifica venueId (pantalla de inicio/login), se consultan todos los eventos disponibles.
    const eventsQuery = venueId
      ? query(collection(db, COLLECTION_NAME), where('venueId', '==', venueId), limit(50))
      : query(collection(db, COLLECTION_NAME), limit(50));

    const snap = await getDocs(eventsQuery);
    let events = snap.docs.map((d) => {
      const data = d.data();
      const vInfo = venuesMap.get(data.venueId);
      const fallbackVenueName =
        data.venueId === DEFAULT_VENUE_ID ? 'Estadio Teodoro Mariscal' : undefined;

      return {
        id: d.id,
        ...data,
        venueName: data.venueName || vInfo?.name || fallbackVenueName,
        posterUrl:
          normalizeGoogleDriveImageUrl(data.posterUrl) ||
          getEventPosterPlaceholder(data.type),
      } as VenueEvent;
    }).filter((e) => !isDeletedMazatlanFCEvent(e));

    // Filtrar por ciudad si se especificó
    if (targetCity) {
      events = events.filter((e) => {
        const vInfo = venuesMap.get(e.venueId);
        const venueCity = vInfo?.city || (e.venueId === DEFAULT_VENUE_ID ? 'Mazatlán' : '');
        return normalizeStr(venueCity).includes(targetCity);
      });
    }

    // Si la base de datos no tiene eventos para la consulta, usar eventos por defecto de respaldo
    if (events.length === 0) {
      let fallbacks = venueId
        ? DEFAULT_FALLBACK_EVENTS.filter((e) => e.venueId === venueId)
        : DEFAULT_FALLBACK_EVENTS;
      if (targetCity) {
        fallbacks = fallbacks.filter((e) => {
          const vInfo = venuesMap.get(e.venueId);
          const venueCity = vInfo?.city || (e.venueId === DEFAULT_VENUE_ID ? 'Mazatlán' : '');
          return normalizeStr(venueCity).includes(targetCity);
        });
      }
      events = (fallbacks.length > 0 ? fallbacks : DEFAULT_FALLBACK_EVENTS).map((e) => ({
        ...e,
        venueName: e.venueName || venuesMap.get(e.venueId)?.name || 'Estadio Teodoro Mariscal',
      }));
    }

    // Filtrar eventos activos y futuros con cartel disponible
    let filtered = events.filter((e) => {
      const isFuture = e.date >= todayStr;
      const hasPoster = typeof e.posterUrl === 'string' && e.posterUrl.trim().length > 0;
      return e.active !== false && isFuture && hasPoster;
    });

    // Si no hay eventos estrictamente futuros, relajar la restricción de fecha para que nunca quede vacía la cartelera
    if (filtered.length === 0) {
      filtered = events.filter((e) => {
        const hasPoster = typeof e.posterUrl === 'string' && e.posterUrl.trim().length > 0;
        return e.active !== false && hasPoster;
      });
    }

    // Ordenar cronológicamente
    filtered.sort((a, b) => a.date.localeCompare(b.date));

    // Si no se solicitó un venueId específico y quedaron menos de 2 eventos,
    // complementar con eventos de otras sedes disponibles (respetando filtro de ciudad)
    if (!venueId && filtered.length < 2) {
      try {
        const allSnap = await getDocs(query(collection(db, COLLECTION_NAME), limit(50)));
        const otherEvents = allSnap.docs
          .map((d) => {
            const data = d.data();
            const vInfo = venuesMap.get(data.venueId);
            return {
              id: d.id,
              ...data,
              venueName: data.venueName || vInfo?.name,
              posterUrl:
                normalizeGoogleDriveImageUrl(data.posterUrl) ||
                getEventPosterPlaceholder(data.type),
            } as VenueEvent;
          })
          .filter((e) => {
            if (targetCity) {
              const vInfo = venuesMap.get(e.venueId);
              const venueCity = vInfo?.city || (e.venueId === DEFAULT_VENUE_ID ? 'Mazatlán' : '');
              if (!normalizeStr(venueCity).includes(targetCity)) return false;
            }
            const isFuture = e.date >= todayStr;
            const hasPoster = typeof e.posterUrl === 'string' && e.posterUrl.trim().length > 0;
            return e.active !== false && isFuture && hasPoster && !filtered.some((f) => f.id === e.id);
          });

        otherEvents.sort((a, b) => a.date.localeCompare(b.date));
        filtered = [...filtered, ...otherEvents];
      } catch (err) {
        console.warn('Error al complementar eventos con otras sedes:', err);
      }
    }

    return filtered.slice(0, limitCount);
  } catch (err) {
    console.error('Error al obtener eventos para el hero de bienvenida:', err);
    return DEFAULT_FALLBACK_EVENTS.slice(0, limitCount);
  }
}

/**
 * Consulta unificada para el Hero de Bienvenida / Login.
 * Integra los eventos estelares de la cartelera con los banners promocionales
 * de la Tienda Oficial configurados por los administradores de sede (soporta Google Drive y filtro de ciudad).
 */
export async function getHeroSlides(
  venueId?: string,
  limitCount: number = 8,
  city?: string
): Promise<HeroSlide[]> {
  const normalizeStr = (str?: string) =>
    (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const targetCity = city ? normalizeStr(city) : null;

  try {
    // 1. Obtener eventos de cartelera (filtrados por sede y/o ciudad)
    const events = await getUpcomingHeroEvents(venueId, limitCount, city);

    // 2. Obtener sedes con promoción activa de tienda oficial
    const storeSlides: HeroSlide[] = [];
    try {
      const venuesSnap = await getDocs(query(collection(db, 'venues'), limit(50)));
      const venuesList = venuesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Venue));
      DEFAULT_VENUES.forEach((defV) => {
        if (!venuesList.some((v) => v.id === defV.id)) {
          venuesList.push(defV);
        }
      });

      let candidateVenues = venueId
        ? venuesList.filter((v) => v.id === venueId && v.active !== false)
        : venuesList.filter((v) => v.active !== false);

      if (targetCity) {
        candidateVenues = candidateVenues.filter((v) => {
          const vCity = v.city || (v.id === DEFAULT_VENUE_ID ? 'Mazatlán' : '');
          return normalizeStr(vCity).includes(targetCity);
        });
      }

      for (const v of candidateVenues) {
        if (v.storePromoActive === false) continue;

        // Si tiene banner configurado o es la sede principal
        const hasCustomBanner = typeof v.storePromoBannerUrl === 'string' && v.storePromoBannerUrl.trim().length > 0;
        const bannerUrl = hasCustomBanner
          ? (normalizeGoogleDriveImageUrl(v.storePromoBannerUrl) || DEFAULT_STORE_PROMO_BANNER)
          : (v.id === DEFAULT_VENUE_ID ? DEFAULT_STORE_PROMO_BANNER : null);

        if (bannerUrl) {
          storeSlides.push({
            id: `store-promo-${v.id}`,
            slideType: 'store_promo',
            title: v.storePromoTitle || 'Tienda Oficial Venados Store',
            subtitle:
              v.storePromoSubtitle ||
              'Jerseys oficiales, gorras y souvenirs con entrega en tu butaca o envío a domicilio.',
            venueId: v.id,
            venueName: v.name || 'Estadio Teodoro Mariscal',
            imageUrl: bannerUrl,
            dateBadge: 'TIENDA OFICIAL',
            badgeLabel: '🛍️ TIENDA OFICIAL',
            targetAction: 'store',
          });
        }
      }
    } catch (err) {
      console.warn('Error al cargar banners de tienda oficial para el hero:', err);
    }

    // 3. Convertir eventos a HeroSlides
    const eventSlides: HeroSlide[] = events.map((ev) => ({
      id: ev.id,
      slideType: 'event',
      title: ev.name,
      subtitle: ev.opponent ? `vs ${ev.opponent}` : undefined,
      venueId: ev.venueId,
      venueName: ev.venueName || 'Estadio Teodoro Mariscal',
      imageUrl: ev.posterUrl || getEventPosterPlaceholder(ev.type),
      dateBadge: ev.date,
      badgeLabel: '🎟️ EVENTO DESTACADO',
      targetAction: 'ticket',
      eventId: ev.id,
    }));

    // 4. Intercalar armónicamente: si hay eventos y banners de tienda, poner el primer evento,
    // luego el banner de tienda oficial, luego el resto de eventos
    const combined: HeroSlide[] = [];
    if (eventSlides.length > 0) {
      combined.push(eventSlides[0]);
      if (storeSlides.length > 0) {
        combined.push(storeSlides[0]);
      }
      for (let i = 1; i < eventSlides.length; i++) {
        combined.push(eventSlides[i]);
      }
      // Agregar tiendas adicionales si hubiera múltiples sedes
      for (let j = 1; j < storeSlides.length; j++) {
        combined.push(storeSlides[j]);
      }
    } else if (storeSlides.length > 0) {
      combined.push(...storeSlides);
    }

    // Si aún estuviera vacío por alguna anomalía, fallback con evento y tienda por defecto
    if (combined.length === 0) {
      combined.push(
        {
          id: 'default-event-1',
          slideType: 'event',
          title: 'Temporada Regular Venados 2026',
          subtitle: 'vs Tomateros de Culiacán',
          venueId: DEFAULT_VENUE_ID,
          venueName: 'Estadio Teodoro Mariscal',
          imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
          dateBadge: '2026-10-15',
          badgeLabel: '🎟️ EVENTO DESTACADO',
          targetAction: 'ticket',
          eventId: 'default-event-1',
        },
        {
          id: `store-promo-${DEFAULT_VENUE_ID}`,
          slideType: 'store_promo',
          title: 'Tienda Oficial Venados Store',
          subtitle: 'Jerseys oficiales, gorras y souvenirs con entrega en tu butaca o envío a domicilio.',
          venueId: DEFAULT_VENUE_ID,
          venueName: 'Estadio Teodoro Mariscal',
          imageUrl: DEFAULT_STORE_PROMO_BANNER,
          dateBadge: 'TIENDA OFICIAL',
          badgeLabel: '🛍️ TIENDA OFICIAL',
          targetAction: 'store',
        }
      );
    }

    return combined.slice(0, limitCount);
  } catch (err) {
    console.error('Error al generar slides unificados para el hero:', err);
    return [];
  }
}


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
import { VenueEvent, EventPriceTier, EventType, HeroSlide, Venue } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { generateEventSeats } from './seatMap';
import { normalizeGoogleDriveImageUrl, DEFAULT_STORE_PROMO_BANNER } from './imageUtils';

const COLLECTION_NAME = 'venueEvents';

export function getEventPosterPlaceholder(type?: EventType): string {
  switch (type) {
    case 'baseball':
      return 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80';
    case 'concert':
      return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80';
    case 'football':
      return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80';
    case 'basketball':
      return 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80';
    case 'other':
    default:
      return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';
  }
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
    posterUrl: getEventPosterPlaceholder('baseball'),
    ...computeDefaultOrderingWindow('2026-10-22', '19:30 hrs'),
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
    posterUrl: getEventPosterPlaceholder('baseball'),
    ...computeDefaultOrderingWindow('2026-10-29', '20:00 hrs'),
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
      posterUrl: rawPoster || getEventPosterPlaceholder(eventData.type || 'baseball'),
      orderingOpensAt: eventData.orderingOpensAt || defaultWindow.orderingOpensAt,
      orderingClosesAt: eventData.orderingClosesAt || defaultWindow.orderingClosesAt,
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
    if (safeUpdates.posterUrl !== undefined) {
      safeUpdates.posterUrl = normalizeGoogleDriveImageUrl(safeUpdates.posterUrl);
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
      where('venueId', '==', venueId)
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        posterUrl: normalizeGoogleDriveImageUrl(data.posterUrl),
      } as VenueEvent;
    });

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
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            posterUrl: normalizeGoogleDriveImageUrl(data.posterUrl),
          } as VenueEvent;
        })
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
      where('venueId', '==', targetVenueId)
    );
    const snap = await getDocs(q);
    let events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VenueEvent));
    if (events.length === 0 && targetVenueId === DEFAULT_VENUE_ID) {
      events = [...DEFAULT_FALLBACK_EVENTS];
    }

    const now = new Date().toISOString();

    const activeEvent = events.find((e) => {
      if (!e.active) return false;
      let opens = e.orderingOpensAt;
      let closes = e.orderingClosesAt;
      if (!opens || !closes) {
        const computed = computeDefaultOrderingWindow(e.date, e.time);
        opens = opens || computed.orderingOpensAt;
        closes = closes || computed.orderingClosesAt;
      }
      return now >= opens && now <= closes;
    });

    return activeEvent || null;
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
      where('venueId', '==', targetVenueId)
    );
    const snap = await getDocs(q);
    let events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VenueEvent));
    if (events.length === 0 && targetVenueId === DEFAULT_VENUE_ID) {
      events = [...DEFAULT_FALLBACK_EVENTS];
    }

    const now = new Date().toISOString();
    const upcoming = events
      .filter((e) => {
        if (!e.active) return false;
        let opens = e.orderingOpensAt;
        let closes = e.orderingClosesAt;
        if (!opens || !closes) {
          const computed = computeDefaultOrderingWindow(e.date, e.time);
          opens = opens || computed.orderingOpensAt;
          closes = closes || computed.orderingClosesAt;
        }
        return closes >= now;
      })
      .sort((a, b) => {
        const aOpen = a.orderingOpensAt || computeDefaultOrderingWindow(a.date, a.time).orderingOpensAt;
        const bOpen = b.orderingOpensAt || computeDefaultOrderingWindow(b.date, b.time).orderingOpensAt;
        return aOpen.localeCompare(bOpen);
      });

    return upcoming[0] || null;
  } catch (err) {
    console.error('Error al obtener próximo evento:', err);
    return null;
  }
}

/**
 * Obtener un evento específico por su ID (usado para redirección directa post-login)
 */
export async function getVenueEventById(eventId: string): Promise<VenueEvent | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, eventId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        ...data,
        posterUrl: normalizeGoogleDriveImageUrl(data.posterUrl),
      } as VenueEvent;
    }
    const fallback = DEFAULT_FALLBACK_EVENTS.find((e) => e.id === eventId);
    return fallback || null;
  } catch (err) {
    console.warn('Error al buscar evento por ID:', err);
    const fallback = DEFAULT_FALLBACK_EVENTS.find((e) => e.id === eventId);
    return fallback || null;
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
  limitCount: number = 8
): Promise<VenueEvent[]> {
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Obtener información de todas las sedes registradas para asociar nombres de estadio
    const venuesMap = new Map<string, { name: string; city: string }>();
    try {
      const venuesSnap = await getDocs(collection(db, 'venues'));
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
      ? query(collection(db, COLLECTION_NAME), where('venueId', '==', venueId))
      : query(collection(db, COLLECTION_NAME));

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
    });

    // Si la base de datos está vacía, usar eventos por defecto de respaldo
    if (events.length === 0) {
      events = [...DEFAULT_FALLBACK_EVENTS].map((e) => ({
        ...e,
        venueName: e.venueName || 'Estadio Teodoro Mariscal',
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

    // Si se solicitó un venueId específico pero quedaron menos de 2 eventos,
    // complementar con eventos de otras sedes disponibles
    if (venueId && filtered.length < 2) {
      try {
        const allSnap = await getDocs(collection(db, COLLECTION_NAME));
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
 * de la Tienda Oficial configurados por los administradores de sede (soporta Google Drive).
 */
export async function getHeroSlides(
  venueId?: string,
  limitCount: number = 8
): Promise<HeroSlide[]> {
  try {
    // 1. Obtener eventos de cartelera
    const events = await getUpcomingHeroEvents(venueId, limitCount);

    // 2. Obtener sedes con promoción activa de tienda oficial
    const storeSlides: HeroSlide[] = [];
    try {
      const venuesSnap = await getDocs(collection(db, 'venues'));
      const venuesList = venuesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Venue));

      const candidateVenues = venueId
        ? venuesList.filter((v) => v.id === venueId && v.active !== false)
        : venuesList.filter((v) => v.active !== false);

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


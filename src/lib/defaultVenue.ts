import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Venue, VenueEvent } from '../types';
import { getEventPosterPlaceholder } from './imageUtils';

export const DEFAULT_VENUE_ID = 'venue-teodoro-mariscal';
export const DEFAULT_EVENT_ID = 'event-temporada-2026';

export const DEFAULT_VENUES: Venue[] = [
  {
    id: DEFAULT_VENUE_ID, // 'venue-teodoro-mariscal'
    name: 'Estadio Teodoro Mariscal',
    teamName: 'Venados de Mazatlán',
    storeName: 'Tienda Oficial Venados Store',
    city: 'Mazatlán',
    state: 'Sinaloa',
    address: 'Av. Justo Sierra s/n, Estadio, 82140 Mazatlán, Sin.',
    active: true,
    storePromoTitle: 'Tienda Oficial Venados Store',
    storePromoSubtitle: 'Jerseys originales de juego, gorras New Era y coleccionables oficiales',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'venue-encanto',
    name: 'Estadio El Encanto',
    teamName: 'Mazatlán F.C.',
    storeName: 'Tienda Oficial Mazatlán F.C.',
    city: 'Mazatlán',
    state: 'Sinaloa',
    address: 'Av. Múnich s/n, Fracc. El Conchi, 82136 Mazatlán, Sin.',
    active: true,
    storePromoTitle: 'Tienda Oficial Mazatlán F.C.',
    storePromoSubtitle: 'Jerseys originales Cañoneros, gorras y souvenirs oficiales de la Liga MX',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_FALLBACK_EVENT: VenueEvent = {
  id: DEFAULT_EVENT_ID,
  venueId: DEFAULT_VENUE_ID,
  type: 'baseball',
  name: 'Temporada Regular Venados 2026',
  opponent: 'Tomateros de Culiacán',
  date: '2026-10-15',
  time: '20:00 hrs',
  gate: 'Puertas 1, 2, 4 y 8',
  active: true,
  ticketsAvailable: true,
  posterUrl: getEventPosterPlaceholder('baseball'),
  orderingOpensAt: '2026-10-15T18:00:00.000Z',
  orderingClosesAt: '2026-10-16T00:00:00.000Z',
  priceTiers: [
    { section: 'Platea Baja Central', price: 450 },
    { section: 'Preferente Lateral', price: 320 },
    { section: 'Palco VIP Premier', price: 850 },
    { section: 'Bleachers / Grada General', price: 150 },
  ],
  createdAt: '2026-09-01T00:00:00.000Z',
};

/**
 * Asegura que existan los documentos por defecto en Firestore para el recinto
 * (Estadio Teodoro Mariscal) y el evento principal (Temporada Regular Venados 2026).
 * Se ejecuta solo si hay una sesión activa.
 */
export async function ensureDefaultVenueExists(): Promise<void> {
  if (!auth.currentUser) {
    return;
  }
  try {
    for (const v of DEFAULT_VENUES) {
      const venueRef = doc(db, 'venues', v.id);
      const venueSnap = await getDoc(venueRef);
      if (!venueSnap.exists()) {
        await setDoc(venueRef, v);
      }
    }

    const eventRef = doc(db, 'venueEvents', DEFAULT_EVENT_ID);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      const defaultEvent: VenueEvent = {
        id: DEFAULT_EVENT_ID,
        venueId: DEFAULT_VENUE_ID,
        type: 'baseball',
        name: 'Temporada Regular Venados 2026',
        opponent: 'Tomateros de Culiacán',
        date: '2026-10-15',
        time: '20:00 hrs',
        gate: 'Puertas 1, 2, 4 y 8',
        active: true,
        ticketsAvailable: true,
        posterUrl: getEventPosterPlaceholder('baseball'),
        orderingOpensAt: '2026-10-15T18:00:00.000Z',
        orderingClosesAt: '2026-10-16T00:00:00.000Z',
        priceTiers: [
          { section: 'Platea Baja Central', price: 450 },
          { section: 'Preferente Lateral', price: 320 },
          { section: 'Palco VIP Premier', price: 850 },
          { section: 'Bleachers / Grada General', price: 150 },
        ],
        createdAt: new Date().toISOString(),
      };
      await setDoc(eventRef, defaultEvent);
    } else {
      const data = eventSnap.data() as Partial<VenueEvent>;
      if (!data.posterUrl || !data.orderingOpensAt) {
        await updateDoc(eventRef, {
          posterUrl: data.posterUrl || getEventPosterPlaceholder(data.type || 'baseball'),
          orderingOpensAt: data.orderingOpensAt || '2026-10-15T18:00:00.000Z',
          orderingClosesAt: data.orderingClosesAt || '2026-10-16T00:00:00.000Z',
        });
      }
    }

    // Asegurar evento por defecto de Estadio El Encanto
    const encantoEventRef = doc(db, 'venueEvents', 'event-futbol-mazatlan-2026');
    const encantoSnap = await getDoc(encantoEventRef);
    if (!encantoSnap.exists()) {
      const encantoDefaultEvent: VenueEvent = {
        id: 'event-futbol-mazatlan-2026',
        venueId: 'venue-encanto',
        type: 'football',
        name: 'Mazatlán FC vs Club América',
        opponent: 'Club América',
        date: '2026-11-05',
        time: '21:00 hrs',
        gate: 'Puertas 1, 2, 3, 4, 5 y 6',
        active: true,
        ticketsAvailable: true,
        posterUrl: getEventPosterPlaceholder('football'),
        orderingOpensAt: '2026-11-05T19:00:00.000Z',
        orderingClosesAt: '2026-11-06T01:00:00.000Z',
        priceTiers: [
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
        ],
        createdAt: new Date().toISOString(),
      };
      await setDoc(encantoEventRef, encantoDefaultEvent);
    }
  } catch (err) {
    // Se captura la advertencia en caso de que el usuario no autenticado o no-admin
    // no tenga permisos de escritura en rules aún.
    console.warn('ensureDefaultVenueExists: Nota al verificar recinto o evento en Firestore:', err);
  }
}

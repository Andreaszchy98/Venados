import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Venue, VenueEvent } from '../types';
import { getEventPosterPlaceholder } from './imageUtils';

export const DEFAULT_VENUE_ID = 'venue-teodoro-mariscal';
export const DEFAULT_EVENT_ID = 'event-temporada-2026';

export const DEFAULT_VENUES: Venue[] = [
  {
    id: DEFAULT_VENUE_ID,
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
    id: 'venue-tomateros',
    name: 'Estadio Tomateros',
    teamName: 'Tomateros de Culiacán',
    storeName: 'Tienda Oficial Tomateros BeisShop',
    city: 'Culiacán',
    state: 'Sinaloa',
    address: 'Constitución y Jesús Andrade, Primer Cuadro, 80000 Culiacán, Sin.',
    active: true,
    storePromoTitle: 'Tienda Oficial Tomateros BeisShop',
    storePromoSubtitle: 'Colección Nación Guinda 2026, jerseys de temporada y gorras exclusivas',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'venue-chevron',
    name: 'Estadio Chevron',
    teamName: 'Toros de Tijuana',
    storeName: 'Tienda Oficial Toros Shop',
    city: 'Tijuana',
    state: 'Baja California',
    address: 'Misión de Santo Tomás s/n, El Capistrano, 22223 Tijuana, B.C.',
    active: true,
    storePromoTitle: 'Tienda Oficial Toros Shop',
    storePromoSubtitle: 'Equipamiento Toromanía, gorras de juego y souvenirs de la frontera',
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
  } catch (err) {
    // Se captura la advertencia en caso de que el usuario no autenticado o no-admin
    // no tenga permisos de escritura en rules aún.
    console.warn('ensureDefaultVenueExists: Nota al verificar recinto o evento en Firestore:', err);
  }
}

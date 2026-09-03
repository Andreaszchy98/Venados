import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Venue, VenueEvent } from '../types';

export const DEFAULT_VENUE_ID = 'venue-teodoro-mariscal';
export const DEFAULT_EVENT_ID = 'event-temporada-2026';

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
    const venueRef = doc(db, 'venues', DEFAULT_VENUE_ID);
    const venueSnap = await getDoc(venueRef);

    if (!venueSnap.exists()) {
      const defaultVenue: Venue = {
        id: DEFAULT_VENUE_ID,
        name: 'Estadio Teodoro Mariscal',
        city: 'Mazatlán',
        state: 'Sinaloa',
        address: 'Av. Justo Sierra s/n, Estadio, 82140 Mazatlán, Sin.',
        active: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(venueRef, defaultVenue);
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
        priceTiers: [
          { section: 'Platea Baja Central', price: 450 },
          { section: 'Preferente Lateral', price: 320 },
          { section: 'Palco VIP Premier', price: 850 },
          { section: 'Bleachers / Grada General', price: 150 },
        ],
        createdAt: new Date().toISOString(),
      };
      await setDoc(eventRef, defaultEvent);
    }
  } catch (err) {
    // Se captura la advertencia en caso de que el usuario no autenticado o no-admin
    // no tenga permisos de escritura en rules aún.
    console.warn('ensureDefaultVenueExists: Nota al verificar recinto o evento en Firestore:', err);
  }
}

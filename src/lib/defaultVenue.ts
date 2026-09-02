import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Venue, VenueEvent } from '../types';

export const DEFAULT_VENUE_ID = 'venue-teodoro-mariscal';
export const DEFAULT_EVENT_ID = 'event-temporada-2026';

/**
 * Asegura que existan los documentos por defecto en Firestore para el recinto
 * (Estadio Teodoro Mariscal) y el evento principal (Temporada Regular Venados 2026).
 * Se ejecuta una sola vez al iniciar la app junto con los seeds existentes.
 */
export async function ensureDefaultVenueExists(): Promise<void> {
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
        date: '2026-10-15',
        active: true,
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

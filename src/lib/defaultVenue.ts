import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Venue, VenueEvent } from '../types';
import { getEventPosterPlaceholder } from './imageUtils';
import { getOfficialPriceTiersForVenue, isLegacySection } from './seatMap';

import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from './constants';
export { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from './constants';

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
    allowedEventTypes: ['baseball', 'concert'],
    storePromoTitle: 'Tienda Oficial Venados Store',
    storePromoSubtitle: 'Jerseys originales de juego, gorras New Era y coleccionables oficiales',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'venue-encanto',
    name: 'Estadio El Encanto',
    teamName: 'Dorados de Sinaloa',
    storeName: 'Tienda Oficial Dorados de Sinaloa',
    city: 'Mazatlán',
    state: 'Sinaloa',
    address: 'Av. Múnich s/n, Fracc. El Conchi, 82136 Mazatlán, Sin.',
    active: true,
    allowedEventTypes: ['football', 'concert'],
    storePromoTitle: 'Tienda Oficial Dorados de Sinaloa',
    storePromoSubtitle: 'Jerseys oficiales Dorado y Negro del Gran Pez, gorras y souvenirs de Dorados',
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
    { section: 'Deluxe Supreme', price: 950 },
    { section: 'Platino', price: 750 },
    { section: 'Diamante', price: 600 },
    { section: 'Oro', price: 480 },
    { section: 'Sky Plus', price: 400 },
    { section: 'Plus', price: 350 },
    { section: 'Fan', price: 220 },
    { section: 'Fan Plus', price: 280 },
    { section: 'Sky', price: 160 },
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
      } else if (v.id === 'venue-encanto') {
        const curData = venueSnap.data();
        if (
          curData.teamName !== 'Dorados de Sinaloa' ||
          curData.storeName?.includes('Mazatlán') ||
          curData.storePromoSubtitle?.includes('Cañoneros') ||
          curData.storePromoSubtitle?.includes('Liga MX')
        ) {
          await updateDoc(venueRef, {
            teamName: 'Dorados de Sinaloa',
            storeName: 'Tienda Oficial Dorados de Sinaloa',
            storePromoTitle: 'Tienda Oficial Dorados de Sinaloa',
            storePromoSubtitle: 'Jerseys oficiales Dorado y Negro del Gran Pez, gorras y souvenirs de Dorados',
          });
        }
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
        priceTiers: getOfficialPriceTiersForVenue(DEFAULT_VENUE_ID),
        createdAt: new Date().toISOString(),
      };
      await setDoc(eventRef, defaultEvent);
    } else {
      const data = eventSnap.data() as Partial<VenueEvent>;
      const hasLegacyTiers =
        Array.isArray(data.priceTiers) &&
        data.priceTiers.some((t: any) => isLegacySection(t?.section));

      if (!data.posterUrl || !data.orderingOpensAt || hasLegacyTiers) {
        await updateDoc(eventRef, {
          posterUrl: data.posterUrl || getEventPosterPlaceholder(data.type || 'baseball'),
          orderingOpensAt: data.orderingOpensAt || '2026-10-15T18:00:00.000Z',
          orderingClosesAt: data.orderingClosesAt || '2026-10-16T00:00:00.000Z',
          ...(hasLegacyTiers ? { priceTiers: getOfficialPriceTiersForVenue(DEFAULT_VENUE_ID) } : {}),
        });
      }
    }

    // Limpiar activamente el evento eliminado de Mazatlán FC si aún persiste en Firestore
    try {
      const encantoEventRef = doc(db, 'venueEvents', 'event-futbol-mazatlan-2026');
      const encantoSnap = await getDoc(encantoEventRef);
      if (encantoSnap.exists()) {
        await deleteDoc(encantoEventRef);
      }
      // Asegurar que ningún otro evento remanente de Mazatlán FC persista
      const allEventsSnap = await getDocs(collection(db, 'venueEvents'));
      for (const d of allEventsSnap.docs) {
        const evData = d.data() as Partial<VenueEvent>;
        if (
          d.id === 'event-futbol-mazatlan-2026' ||
          (evData.name && (evData.name.includes('Mazatlán FC') || evData.name.includes('Mazatlan FC')))
        ) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    } catch (cleanEvErr) {
      console.warn('ensureDefaultVenueExists: Nota al verificar eliminación de evento Mazatlán FC:', cleanEvErr);
    }

    // Consolidar concesionarios para mantener únicamente los 3 puestos canónicos
    try {
      const { cleanupDuplicateStands } = await import('./stands');
      await cleanupDuplicateStands();
    } catch (cleanStandsErr) {
      console.warn('ensureDefaultVenueExists: Nota al consolidar puestos:', cleanStandsErr);
    }

    // Limpieza activa: Detectar y corregir usuarios asignados a la sede inexistente Estadio Chevron / venue-chevron
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        if (
          uData.venueId === 'venue-chevron' ||
          uData.venueName === 'Estadio Chevron' ||
          uData.browsingVenueId === 'venue-chevron' ||
          uData.browsingVenueName === 'Estadio Chevron'
        ) {
          await updateDoc(uDoc.ref, {
            venueId: DEFAULT_VENUE_ID,
            venueName: 'Estadio Teodoro Mariscal',
            browsingVenueId: DEFAULT_VENUE_ID,
            browsingVenueName: 'Estadio Teodoro Mariscal',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      // Si existe un documento residual en venues con id 'venue-chevron', eliminarlo
      const chevronVenueRef = doc(db, 'venues', 'venue-chevron');
      const chevronVenueSnap = await getDoc(chevronVenueRef);
      if (chevronVenueSnap.exists()) {
        await deleteDoc(chevronVenueRef).catch(() => {});
      }
    } catch (cleanUsersErr) {
      console.warn('ensureDefaultVenueExists: Nota al sanitizar usuarios asignados a Chevron:', cleanUsersErr);
    }
  } catch (err) {
    // Se captura la advertencia en caso de que el usuario no autenticado o no-admin
    // no tenga permisos de escritura en rules aún.
    console.warn('ensureDefaultVenueExists: Nota al verificar recinto o evento en Firestore:', err);
  }
}

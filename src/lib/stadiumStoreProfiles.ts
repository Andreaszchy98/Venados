import { Venue } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';

export interface StadiumStoreProfile {
  venueId: string;
  stadiumName: string;
  teamName: string;
  storeName: string;
  badgeLabel: string;
  headline: string;
  tagline: string;
  pickupLocation: string;
  headerGradient: string;
  accentBadgeClass: string;
  buttonClass: string;
  membershipName: string;
  membershipSubtitle: string;
  membershipBadge: string;
}

export const STADIUM_STORE_PROFILES: Record<string, StadiumStoreProfile> = {
  [DEFAULT_VENUE_ID]: {
    venueId: DEFAULT_VENUE_ID,
    stadiumName: 'Estadio Teodoro Mariscal',
    teamName: 'Venados de Mazatlán',
    storeName: 'Venados Official Store',
    badgeLabel: 'Tienda Oficial Venados de Mazatlán',
    headline: 'Equipamiento & Souvenirs Oficiales',
    tagline: 'Viste con orgullo los colores del puerto. Envíos a todo México o retiro express en la tienda del Estadio Teodoro Mariscal.',
    pickupLocation: 'Tienda Oficial Estadio Teodoro Mariscal (Mazatlán, Sin.)',
    headerGradient: 'from-slate-900 via-red-950 to-slate-900 border-red-900/40',
    accentBadgeClass: 'bg-red-700/60 text-red-200 border-red-500/30',
    buttonClass: 'bg-red-700 hover:bg-red-800 text-white',
    membershipName: 'Socio Venados',
    membershipSubtitle: 'Abono de Temporada Oficial • Estadio Teodoro Mariscal',
    membershipBadge: 'Club Venados de Mazatlán',
  },
  'venue-tomateros': {
    venueId: 'venue-tomateros',
    stadiumName: 'Estadio Tomateros',
    teamName: 'Tomateros de Culiacán',
    storeName: 'Tomateros BeisShop Oficial',
    badgeLabel: 'Tienda Oficial Tomateros de Culiacán',
    headline: 'Colección Nación Guinda Oficial',
    tagline: 'Lleva la pasión guinda en cada juego. Envíos nacionales o retiro directo en BeisShop Estadio Tomateros.',
    pickupLocation: 'Tienda BeisShop Estadio Tomateros (Culiacán, Sin.)',
    headerGradient: 'from-slate-950 via-rose-950 to-stone-900 border-rose-900/40',
    accentBadgeClass: 'bg-rose-900/70 text-rose-200 border-rose-700/40',
    buttonClass: 'bg-rose-900 hover:bg-rose-800 text-white',
    membershipName: 'Socio Tomatero',
    membershipSubtitle: 'Abono de Temporada Oficial • Estadio Tomateros',
    membershipBadge: 'Club Tomateros de Culiacán',
  },
  'venue-chevron': {
    venueId: 'venue-chevron',
    stadiumName: 'Estadio Chevron',
    teamName: 'Toros de Tijuana',
    storeName: 'Toros Shop Oficial',
    badgeLabel: 'Tienda Oficial Toros de Tijuana',
    headline: 'Equipamiento Oficial Toromanía',
    tagline: 'Viste la fuerza de los astados en la frontera. Envíos a todo el país o retiro express en Estadio Chevron.',
    pickupLocation: 'Tienda Oficial Toros Shop Estadio Chevron (Tijuana, B.C.)',
    headerGradient: 'from-black via-neutral-900 to-red-950 border-neutral-700/50',
    accentBadgeClass: 'bg-neutral-800/90 text-amber-300 border-amber-500/30',
    buttonClass: 'bg-red-800 hover:bg-red-700 text-white',
    membershipName: 'Torobono Oficial',
    membershipSubtitle: 'Abono de Temporada Oficial • Estadio Chevron',
    membershipBadge: 'Club Toros de Tijuana',
  },
};

/**
 * Obtener el perfil de identidad de la tienda y membresía para una sede
 */
export function getStadiumStoreProfile(venueId?: string, venueInfo?: Venue | null): StadiumStoreProfile {
  const vId = venueId || DEFAULT_VENUE_ID;
  if (STADIUM_STORE_PROFILES[vId]) {
    return STADIUM_STORE_PROFILES[vId];
  }

  // Si es una sede personalizada registrada por el administrador
  const name = venueInfo?.name || 'Recinto Deportivo';
  const team = venueInfo?.teamName || name.replace('Estadio ', '');
  const city = venueInfo?.city || 'México';
  const storeName = venueInfo?.storeName || `Tienda Oficial ${team}`;

  return {
    venueId: vId,
    stadiumName: name,
    teamName: team,
    storeName,
    badgeLabel: `Tienda Oficial ${name}`,
    headline: `Equipamiento & Souvenirs de ${team}`,
    tagline: `Artículos y mercancía oficial autorizada. Envíos a domicilio o retiro directo en ${name}.`,
    pickupLocation: `Tienda Oficial ${name} (${city})`,
    headerGradient: 'from-slate-900 via-slate-800 to-red-950 border-slate-700/50',
    accentBadgeClass: 'bg-red-700/70 text-red-200 border-red-500/30',
    buttonClass: 'bg-red-700 hover:bg-red-800 text-white',
    membershipName: `Socio Oficial ${team}`,
    membershipSubtitle: `Abono de Temporada Oficial • ${name}`,
    membershipBadge: `Club Oficial ${team}`,
  };
}

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
  floatingBadgeClass: string;
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
    floatingBadgeClass: 'bg-red-600 text-white shadow-red-600/30',
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
    floatingBadgeClass: 'bg-rose-900 text-white shadow-rose-900/30',
    membershipName: 'Socio Tomatero',
    membershipSubtitle: 'Abono de Temporada Oficial • Estadio Tomateros',
    membershipBadge: 'Club Tomateros de Culiacán',
  },
  'venue-encanto': {
    venueId: 'venue-encanto',
    stadiumName: 'Estadio El Encanto',
    teamName: 'Dorados de Sinaloa',
    storeName: 'Tienda Oficial Dorados de Sinaloa',
    badgeLabel: 'Tienda Oficial Dorados de Sinaloa',
    headline: 'Colección Dorada Oficial',
    tagline: 'Viste los colores dorado y negro de los Dorados de Sinaloa. Envíos nacionales o retiro express en la tienda del Estadio El Encanto.',
    pickupLocation: 'Tienda Oficial Estadio El Encanto (Mazatlán, Sin.)',
    headerGradient: 'from-black via-zinc-900 to-amber-950 border-amber-500/40',
    accentBadgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    buttonClass: 'bg-amber-500 hover:bg-amber-400 text-black font-black',
    floatingBadgeClass: 'bg-amber-500 text-black shadow-amber-500/30 font-black',
    membershipName: 'Bono Dorado',
    membershipSubtitle: 'Abono de Temporada Oficial • Estadio El Encanto',
    membershipBadge: 'Club Dorados de Sinaloa',
  },
  'venue-charros': {
    venueId: 'venue-charros',
    stadiumName: 'Estadio Panamericano',
    teamName: 'Charros de Jalisco',
    storeName: 'Tienda Oficial Charros Store',
    badgeLabel: 'Tienda Oficial Charros de Jalisco',
    headline: 'Colección Todos Somos Charros',
    tagline: 'Viste con honor la franela albiazul de Jalisco. Envíos a todo México o retiro express en la tienda oficial del Estadio Panamericano.',
    pickupLocation: 'Tienda Oficial Estadio Panamericano (Zapopan, Jal.)',
    headerGradient: 'from-slate-950 via-blue-950 to-indigo-950 border-blue-500/40',
    accentBadgeClass: 'bg-blue-600/30 text-blue-200 border-blue-400/40',
    buttonClass: 'bg-blue-600 hover:bg-blue-500 text-white font-black',
    floatingBadgeClass: 'bg-blue-600 text-white shadow-blue-600/30 font-black',
    membershipName: 'Pase Charro',
    membershipSubtitle: 'Abono de Temporada Oficial • Estadio Panamericano',
    membershipBadge: 'Club Charros de Jalisco',
  },
};

// Paletas deportivas dinámicas y armónicas para recintos creados adicionalmente
const DYNAMIC_SPORTS_PALETTES = [
  {
    headerGradient: 'from-slate-950 via-emerald-950 to-teal-950 border-emerald-500/40',
    accentBadgeClass: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white font-black',
    floatingBadgeClass: 'bg-emerald-600 text-white shadow-emerald-600/30 font-black',
  },
  {
    headerGradient: 'from-slate-950 via-purple-950 to-indigo-950 border-purple-500/40',
    accentBadgeClass: 'bg-purple-600/30 text-purple-200 border-purple-500/40',
    buttonClass: 'bg-purple-600 hover:bg-purple-500 text-white font-black',
    floatingBadgeClass: 'bg-purple-600 text-white shadow-purple-600/30 font-black',
  },
  {
    headerGradient: 'from-slate-950 via-cyan-950 to-blue-950 border-cyan-500/40',
    accentBadgeClass: 'bg-cyan-600/30 text-cyan-200 border-cyan-500/40',
    buttonClass: 'bg-cyan-600 hover:bg-cyan-500 text-white font-black',
    floatingBadgeClass: 'bg-cyan-600 text-white shadow-cyan-600/30 font-black',
  },
  {
    headerGradient: 'from-slate-950 via-orange-950 to-amber-950 border-orange-500/40',
    accentBadgeClass: 'bg-orange-600/30 text-orange-200 border-orange-500/40',
    buttonClass: 'bg-orange-600 hover:bg-orange-500 text-white font-black',
    floatingBadgeClass: 'bg-orange-600 text-white shadow-orange-600/30 font-black',
  },
  {
    headerGradient: 'from-slate-950 via-indigo-950 to-violet-950 border-indigo-500/40',
    accentBadgeClass: 'bg-indigo-600/30 text-indigo-200 border-indigo-500/40',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-500 text-white font-black',
    floatingBadgeClass: 'bg-indigo-600 text-white shadow-indigo-600/30 font-black',
  },
];

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

  // Asignación determinista de paleta deportiva para que el nuevo estadio tenga su propia identidad de color
  let hash = 0;
  const hashKey = vId + name;
  for (let i = 0; i < hashKey.length; i++) {
    hash = (hash << 5) - hash + hashKey.charCodeAt(i);
    hash |= 0;
  }
  const paletteIndex = Math.abs(hash) % DYNAMIC_SPORTS_PALETTES.length;
  const palette = DYNAMIC_SPORTS_PALETTES[paletteIndex];

  return {
    venueId: vId,
    stadiumName: name,
    teamName: team,
    storeName,
    badgeLabel: `Tienda Oficial ${name}`,
    headline: `Equipamiento & Souvenirs de ${team}`,
    tagline: `Artículos y mercancía oficial autorizada. Envíos a domicilio o retiro directo en ${name}.`,
    pickupLocation: `Tienda Oficial ${name} (${city})`,
    headerGradient: palette.headerGradient,
    accentBadgeClass: palette.accentBadgeClass,
    buttonClass: palette.buttonClass,
    floatingBadgeClass: palette.floatingBadgeClass,
    membershipName: `Socio Oficial ${team}`,
    membershipSubtitle: `Abono de Temporada Oficial • ${name}`,
    membershipBadge: `Club Oficial ${team}`,
  };
}

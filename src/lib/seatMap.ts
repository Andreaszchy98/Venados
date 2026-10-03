import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  runTransaction,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { SeatSection, EventSeat, SeatStatus, VenueEvent, Ticket } from '../types';
import { DEFAULT_VENUE_ID } from './constants';
import { handleFirestoreError, OperationType } from './errorHandler';
import { getCachedData, setCachedData } from './clientCache';

/**
 * Determina si la fecha y horario del evento ya concluyeron.
 */
function isEventPassed(event: { date: string; time?: string; orderingClosesAt?: string; status?: string }): boolean {
  if (event.status === 'finalizado') return true;
  const now = Date.now();
  if (event.orderingClosesAt) {
    const closesTime = new Date(event.orderingClosesAt).getTime();
    if (!isNaN(closesTime) && now > closesTime) {
      return true;
    }
  }
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
  const eventStart = new Date(year, month, day, hours, minutes, 0);
  return now > (eventStart.getTime() + 3.5 * 60 * 60 * 1000);
}

export interface ZoneMeta {
  name: string;
  defaultPrice: number;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
  fillColor: string;
  strokeColor: string;
  description: string;
  gate?: string;
}

/**
 * Mapeo canónico exacto e incontrovertible de cada número de sección del Estadio Teodoro Mariscal
 * a su zona oficial y color tal como aparecen en el mapa oficial.
 */
export const MARISCAL_SECTION_ZONE_MAP: Record<string, string> = {
  // Deluxe Supreme (Blanco/Lavanda muy claro: Sec. 1-12)
  '1': 'Deluxe Supreme',
  '2': 'Deluxe Supreme',
  '3': 'Deluxe Supreme',
  '4': 'Deluxe Supreme',
  '5': 'Deluxe Supreme',
  '6': 'Deluxe Supreme',
  '7': 'Deluxe Supreme',
  '8': 'Deluxe Supreme',
  '9': 'Deluxe Supreme',
  '10': 'Deluxe Supreme',
  '11': 'Deluxe Supreme',
  '12': 'Deluxe Supreme',

  // Oro (Azul Turquesa: Sec. 101-104 y 118-121)
  '101': 'Oro',
  '102': 'Oro',
  '103': 'Oro',
  '104': 'Oro',
  '118': 'Oro',
  '119': 'Oro',
  '120': 'Oro',
  '121': 'Oro',

  // Platino (Rojo Intenso: Sec. 105-108 y 115-117)
  '105': 'Platino',
  '106': 'Platino',
  '107': 'Platino',
  '108': 'Platino',
  '115': 'Platino',
  '116': 'Platino',
  '117': 'Platino',

  // Fan (Celeste Bleachers Bajas: Sec. 122-133)
  '122': 'Fan',
  '123': 'Fan',
  '124': 'Fan',
  '125': 'Fan',
  '126': 'Fan',
  '127': 'Fan',
  '128': 'Fan',
  '129': 'Fan',
  '130': 'Fan',
  '131': 'Fan',
  '132': 'Fan',
  '133': 'Fan',

  // Plus (Verde Lima Nivel 200 Lateral: Sec. 201-204 y 218-221)
  '201': 'Plus',
  '202': 'Plus',
  '203': 'Plus',
  '204': 'Plus',
  '218': 'Plus',
  '219': 'Plus',
  '220': 'Plus',
  '221': 'Plus',

  // Diamante (Naranja Terracota Nivel 200 Central: Sec. 205-217)
  '205': 'Diamante',
  '206': 'Diamante',
  '207': 'Diamante',
  '208': 'Diamante',
  '209': 'Diamante',
  '210': 'Diamante',
  '211': 'Diamante',
  '212': 'Diamante',
  '213': 'Diamante',
  '214': 'Diamante',
  '215': 'Diamante',
  '216': 'Diamante',
  '217': 'Diamante',

  // Fan Plus (Gris Lavanda Bleachers Altas: Sec. 222-233)
  '222': 'Fan Plus',
  '223': 'Fan Plus',
  '224': 'Fan Plus',
  '225': 'Fan Plus',
  '226': 'Fan Plus',
  '227': 'Fan Plus',
  '228': 'Fan Plus',
  '229': 'Fan Plus',
  '230': 'Fan Plus',
  '231': 'Fan Plus',
  '232': 'Fan Plus',
  '233': 'Fan Plus',

  // Sky (Morado Nivel 300 Lateral: Sec. 301-304 y 313-316)
  '301': 'Sky',
  '302': 'Sky',
  '303': 'Sky',
  '304': 'Sky',
  '313': 'Sky',
  '314': 'Sky',
  '315': 'Sky',
  '316': 'Sky',

  // Sky Plus (Melocotón / Coral Cálido Nivel 300 Central: Sec. 305-307 y 310-312)
  '305': 'Sky Plus',
  '306': 'Sky Plus',
  '307': 'Sky Plus',
  '310': 'Sky Plus',
  '311': 'Sky Plus',
  '312': 'Sky Plus',
};

/**
 * Obtiene la zona oficial de una sección en Estadio Teodoro Mariscal
 */
export function getMariscalSectionZone(sectionNumber?: string | null): string | null {
  if (!sectionNumber) return null;
  const clean = sectionNumber
    .trim()
    .replace(/^sec(?:ci[oó]n)?[\s._#-]+/i, '')
    .replace(/^palco(?:s)?[\s._#-]+/i, '')
    .trim();
  if (MARISCAL_SECTION_ZONE_MAP[clean]) {
    return MARISCAL_SECTION_ZONE_MAP[clean];
  }
  const digits = clean.match(/\d+/);
  if (digits && MARISCAL_SECTION_ZONE_MAP[digits[0]]) {
    return MARISCAL_SECTION_ZONE_MAP[digits[0]];
  }
  return null;
}

export const MARISCAL_ZONES: Record<string, ZoneMeta> = {
  'Deluxe Supreme': {
    name: 'Deluxe Supreme',
    defaultPrice: 950,
    colorHex: '#F8FAFC',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
    badgeText: 'text-slate-800',
    fillColor: '#F8FAFC',
    strokeColor: '#94A3B8',
    gate: 'Puerta Principal / VIP Home Plate',
    description: 'Nivel central bajo exclusivo junto al Home Plate (Sec. 1-12)',
  },
  'Platino': {
    name: 'Platino',
    defaultPrice: 750,
    colorHex: '#DC2626',
    badgeBg: 'bg-red-500/15 text-red-600 border-red-500/30',
    badgeText: 'text-red-500',
    fillColor: '#DC2626',
    strokeColor: '#B91C1C',
    gate: 'Puertas 1 y 2',
    description: 'Laterales bajas del infield en color rojo (Sec. 105-108, 115-117)',
  },
  'Diamante': {
    name: 'Diamante',
    defaultPrice: 600,
    colorHex: '#ED6A26',
    badgeBg: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    badgeText: 'text-orange-500',
    fillColor: '#ED6A26',
    strokeColor: '#C2410C',
    gate: 'Puertas 1 y 2',
    description: 'Herraje central nivel 200 en color naranja terracota (Sec. 205-217)',
  },
  'Oro': {
    name: 'Oro',
    defaultPrice: 480,
    colorHex: '#0284C7',
    badgeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
    badgeText: 'text-sky-500',
    fillColor: '#0284C7',
    strokeColor: '#0369A1',
    gate: 'Puertas 2 y 4',
    description: 'Líneas de 1ra y 3ra base en color azul turquesa (Sec. 101-104, 118-121)',
  },
  'Sky Plus': {
    name: 'Sky Plus',
    defaultPrice: 400,
    colorHex: '#FA8E5C',
    badgeBg: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    badgeText: 'text-orange-600',
    fillColor: '#FA8E5C',
    strokeColor: '#EA580C',
    gate: 'Rampa Nivel 300',
    description: 'Nivel 300 central en color melocotón / coral (Sec. 305-307, 310-312)',
  },
  'Plus': {
    name: 'Plus',
    defaultPrice: 350,
    colorHex: '#84CC16',
    badgeBg: 'bg-lime-500/15 text-lime-700 border-lime-500/30',
    badgeText: 'text-lime-700',
    fillColor: '#84CC16',
    strokeColor: '#65A30D',
    gate: 'Puertas 4 y 8',
    description: 'Nivel 200 lateral en color verde lima (Sec. 201-204, 218-221)',
  },
  'Fan': {
    name: 'Fan',
    defaultPrice: 220,
    colorHex: '#38BDF8',
    badgeBg: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
    badgeText: 'text-cyan-600',
    fillColor: '#38BDF8',
    strokeColor: '#0284C7',
    gate: 'Puertas 6 y 8 (Bleachers)',
    description: 'Jardines bajos en color celeste sobre la barda (Sec. 122-127, 128-133)',
  },
  'Fan Plus': {
    name: 'Fan Plus',
    defaultPrice: 280,
    colorHex: '#94A3B8',
    badgeBg: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
    badgeText: 'text-slate-200',
    fillColor: '#94A3B8',
    strokeColor: '#64748B',
    gate: 'Puertas 6 y 8 (Bleachers)',
    description: 'Jardines altos nivel 200 en color gris lavanda (Sec. 222-227, 228-233)',
  },
  'Sky': {
    name: 'Sky',
    defaultPrice: 160,
    colorHex: '#772582',
    badgeBg: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
    badgeText: 'text-purple-600',
    fillColor: '#772582',
    strokeColor: '#581c87',
    gate: 'Rampa Nivel 300',
    description: 'Nivel 300 lateral en color morado (Sec. 301-304, 313-316)',
  },
};

export const TOMATEROS_ZONES: Record<string, ZoneMeta> = {
  'Deluxe Supreme': {
    name: 'Deluxe Supreme',
    defaultPrice: 950,
    colorHex: '#2a457c',
    badgeBg: 'bg-blue-900/20 text-blue-400 border-blue-800/40',
    badgeText: 'text-blue-400',
    fillColor: '#2a457c',
    strokeColor: '#ffffff',
    description: 'Suites exclusivas, fila inferior (3 bloques)',
    gate: 'Puerta Principal / VIP',
  },
  'Platino': {
    name: 'Platino',
    defaultPrice: 750,
    colorHex: '#2a457c',
    badgeBg: 'bg-indigo-900/20 text-indigo-400 border-indigo-800/40',
    badgeText: 'text-indigo-400',
    fillColor: '#2a457c',
    strokeColor: '#ffffff',
    description: 'Platea en anillo exterior (16 bloques)',
    gate: 'Puertas 1 y 2',
  },
  'Oro': {
    name: 'Oro',
    defaultPrice: 480,
    colorHex: '#2a457c',
    badgeBg: 'bg-amber-900/20 text-amber-400 border-amber-800/40',
    badgeText: 'text-amber-400',
    fillColor: '#2a457c',
    strokeColor: '#ffffff',
    description: 'Numerado detrás de home plate (3 bloques)',
    gate: 'Puerta Central Home',
  },
  'Sky Plus': {
    name: 'Sky Plus',
    defaultPrice: 400,
    colorHex: '#186687',
    badgeBg: 'bg-teal-900/20 text-teal-400 border-teal-800/40',
    badgeText: 'text-teal-400',
    fillColor: '#186687',
    strokeColor: '#ffffff',
    description: 'Numerado bajo lateral (6 bloques)',
    gate: 'Puerta Lateral Baja',
  },
  'Plus': {
    name: 'Plus',
    defaultPrice: 350,
    colorHex: '#2e80bb',
    badgeBg: 'bg-sky-900/20 text-sky-400 border-sky-800/40',
    badgeText: 'text-sky-400',
    fillColor: '#2e80bb',
    strokeColor: '#ffffff',
    description: 'Numerado medio lateral (6 bloques)',
    gate: 'Puerta Lateral Media',
  },
  'Fan Plus': {
    name: 'Fan Plus',
    defaultPrice: 280,
    colorHex: '#4d9dd0',
    badgeBg: 'bg-blue-900/20 text-blue-400 border-blue-800/40',
    badgeText: 'text-blue-400',
    fillColor: '#4d9dd0',
    strokeColor: '#ffffff',
    description: 'Numerado superior / claro (6 bloques)',
    gate: 'Puerta Lateral Alta',
  },
  'Sky': {
    name: 'Sky',
    defaultPrice: 160,
    colorHex: '#626a79',
    badgeBg: 'bg-zinc-800/20 text-zinc-300 border-zinc-700/40',
    badgeText: 'text-zinc-300',
    fillColor: '#626a79',
    strokeColor: '#ffffff',
    description: 'Jardines generales (14 bloques)',
    gate: 'Puerta Jardines / Bleachers',
  },
};

/** Mapeo inverso de atributos data-zone SVG a nombre de zona oficial */
export const TOMATEROS_SVG_ZONE_MAP: Record<string, string> = {
  suite: 'Deluxe Supreme',
  platea: 'Platino',
  num_home: 'Oro',
  num_bajo: 'Sky Plus',
  num_medio: 'Plus',
  num_claro: 'Fan Plus',
  jardin: 'Sky',
};

/** Mapeo de cada bloque de Estadio Tomateros a su zona oficial */
export const TOMATEROS_SECTION_ZONE_MAP: Record<string, string> = {
  'suite-1': 'Deluxe Supreme',
  'suite-2': 'Deluxe Supreme',
  'suite-3': 'Deluxe Supreme',
  ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`platea-${i + 1}`, 'Platino'])),
  ...Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`num_home-${i + 1}`, 'Oro'])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`num_bajo-${i + 1}`, 'Sky Plus'])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`num_medio-${i + 1}`, 'Plus'])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`num_claro-${i + 1}`, 'Fan Plus'])),
  ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`jardin-${i + 1}`, 'Sky'])),
};

/**
 * Zonas oficiales de Estadio Charros de Jalisco (Zapopan / Guadalajara)
 * Conforme a la tabla y mapa oficial de selección de asientos:
 * - magenta → Lateral Base → $420
 * - purple → Palco Esquina → $650
 * - premier → Premier → $850
 * - orange → Lateral Premier → $550
 * - yellow → Butaca Preferente → $380
 * - cyan → VIP / Local / Visitante → $950
 * - steel → Planta Baja → $480
 * - navy → Planta Alta y Suites → $280
 * - gray → Jardín / Esquinas → $160
 */
export const CHARROS_ZONES: Record<string, ZoneMeta> = {
  'VIP / Local / Visitante': {
    name: 'VIP / Local / Visitante',
    defaultPrice: 950,
    colorHex: '#1DA2D0',
    badgeBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    badgeText: 'text-cyan-400',
    fillColor: '#1DA2D0',
    strokeColor: '#0E7490',
    gate: 'Puerta Principal / VIP',
    description: 'Zona VIP central detrás de home plate y dugouts local y visitante',
  },
  'Premier': {
    name: 'Premier',
    defaultPrice: 850,
    colorHex: '#96BB4D',
    badgeBg: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
    badgeText: 'text-lime-400',
    fillColor: '#96BB4D',
    strokeColor: '#65A30D',
    gate: 'Puertas 1 y 2',
    description: 'Zona Premier baja contigua al terreno de juego y dugouts',
  },
  'Palco Esquina': {
    name: 'Palco Esquina',
    defaultPrice: 650,
    colorHex: '#753D87',
    badgeBg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    badgeText: 'text-purple-400',
    fillColor: '#753D87',
    strokeColor: '#581C87',
    gate: 'Puertas 2 y 3',
    description: 'Palcos esquinas laterales con vista privilegiada',
  },
  'Lateral Premier': {
    name: 'Lateral Premier',
    defaultPrice: 550,
    colorHex: '#E59936',
    badgeBg: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    badgeText: 'text-orange-400',
    fillColor: '#E59936',
    strokeColor: '#C2410C',
    gate: 'Puertas 1 y 3',
    description: 'Laterales Premier a lo largo de las líneas de cal',
  },
  'Planta Baja': {
    name: 'Planta Baja',
    defaultPrice: 480,
    colorHex: '#3A74A1',
    badgeBg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    badgeText: 'text-sky-400',
    fillColor: '#3A74A1',
    strokeColor: '#0369A1',
    gate: 'Puertas 2 y 4',
    description: 'Planta baja con excelente visibilidad y cercanía',
  },
  'Lateral Base': {
    name: 'Lateral Base',
    defaultPrice: 420,
    colorHex: '#D50C79',
    badgeBg: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    badgeText: 'text-pink-400',
    fillColor: '#D50C79',
    strokeColor: '#BE185D',
    gate: 'Puertas 1 y 4',
    description: 'Laterales primera y tercera base',
  },
  'Butaca Preferente': {
    name: 'Butaca Preferente',
    defaultPrice: 380,
    colorHex: '#F4E723',
    badgeBg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    badgeText: 'text-yellow-400',
    fillColor: '#F4E723',
    strokeColor: '#CA8A04',
    gate: 'Puertas 2 y 3',
    description: 'Butacas preferentes numeradas',
  },
  'Planta Alta y Suites': {
    name: 'Planta Alta y Suites',
    defaultPrice: 280,
    colorHex: '#2E3A7E',
    badgeBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    badgeText: 'text-indigo-400',
    fillColor: '#2E3A7E',
    strokeColor: '#1E1B4B',
    gate: 'Rampa Nivel Superior',
    description: 'Nivel superior techado y palcos suites superiores',
  },
  'Jardín / Esquinas': {
    name: 'Jardín / Esquinas',
    defaultPrice: 160,
    colorHex: '#939393',
    badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    badgeText: 'text-slate-300',
    fillColor: '#939393',
    strokeColor: '#475569',
    gate: 'Puerta Jardines',
    description: 'Gradas generales en jardines izquierdo y derecho y esquinas',
  },
};

/** Mapeo de clases SVG de Estadio Charros de Jalisco a nombres oficiales de zona */
export const CHARROS_SVG_ZONE_MAP: Record<string, string> = {
  magenta: 'Lateral Base',
  purple: 'Palco Esquina',
  premier: 'Premier',
  orange: 'Lateral Premier',
  yellow: 'Butaca Preferente',
  cyan: 'VIP / Local / Visitante',
  vip: 'VIP / Local / Visitante',
  teal: 'VIP / Local / Visitante',
  steel: 'Planta Baja',
  navy: 'Planta Alta y Suites',
  gray: 'Jardín / Esquinas',
  'Lateral Base': 'Lateral Base',
  'Palco Esquina': 'Palco Esquina',
  'Premier': 'Premier',
  'Lateral Premier': 'Lateral Premier',
  'Butaca Preferente': 'Butaca Preferente',
  'VIP / Local / Visitante': 'VIP / Local / Visitante',
  'Planta Baja': 'Planta Baja',
  'Planta Alta y Suites': 'Planta Alta y Suites',
  'Jardín / Esquinas': 'Jardín / Esquinas',
};

/** Mapeo de polígonos de Estadio Charros a su zona oficial */
export const CHARROS_SECTION_ZONE_MAP: Record<string, string> = {
  // magenta: Lateral Base (6 bloques)
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`magenta-0${i + 1}`, 'Lateral Base'])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`magenta-${i + 1}`, 'Lateral Base'])),

  // purple: Palco Esquina (2 bloques)
  ...Object.fromEntries(Array.from({ length: 2 }, (_, i) => [`purple-0${i + 1}`, 'Palco Esquina'])),
  ...Object.fromEntries(Array.from({ length: 2 }, (_, i) => [`purple-${i + 1}`, 'Palco Esquina'])),

  // premier: Premier (6 bloques)
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`premier-0${i + 1}`, 'Premier'])),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`premier-${i + 1}`, 'Premier'])),

  // orange: Lateral Premier (10 bloques)
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`orange-0${i + 1}`, 'Lateral Premier'])),
  'orange-10': 'Lateral Premier',
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`orange-${i + 1}`, 'Lateral Premier'])),

  // yellow: Butaca Preferente (24 bloques)
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`yellow-0${i + 1}`, 'Butaca Preferente'])),
  ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`yellow-${i + 10}`, 'Butaca Preferente'])),
  ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`yellow-${i + 1}`, 'Butaca Preferente'])),

  // cyan / vip / teal: VIP / Local / Visitante
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`cyan-0${i + 1}`, 'VIP / Local / Visitante'])),
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`cyan-${i + 1}`, 'VIP / Local / Visitante'])),
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`vip-0${i + 1}`, 'VIP / Local / Visitante'])),
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`vip-${i + 1}`, 'VIP / Local / Visitante'])),
  'teal-01': 'VIP / Local / Visitante',
  'teal-1': 'VIP / Local / Visitante',

  // steel: Planta Baja (10 bloques)
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`steel-0${i + 1}`, 'Planta Baja'])),
  'steel-10': 'Planta Baja',
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`steel-${i + 1}`, 'Planta Baja'])),

  // navy: Planta Alta y Suites (43 bloques)
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`navy-0${i + 1}`, 'Planta Alta y Suites'])),
  ...Object.fromEntries(Array.from({ length: 34 }, (_, i) => [`navy-${i + 10}`, 'Planta Alta y Suites'])),
  ...Object.fromEntries(Array.from({ length: 43 }, (_, i) => [`navy-${i + 1}`, 'Planta Alta y Suites'])),

  // gray: Jardín / Esquinas (14 bloques)
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`gray-0${i + 1}`, 'Jardín / Esquinas'])),
  ...Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`gray-${i + 10}`, 'Jardín / Esquinas'])),
  ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`gray-${i + 1}`, 'Jardín / Esquinas'])),
};

/**
 * Obtiene la zona oficial de una sección en Estadio Charros de Jalisco
 */
export function getCharrosSectionZone(sectionNumber?: string | null): string | null {
  if (!sectionNumber) return null;
  const clean = sectionNumber.trim().toLowerCase().replace(/^sec(?:ci[oó]n)?[\s._#-]+/i, '');
  if (CHARROS_SECTION_ZONE_MAP[clean]) {
    return CHARROS_SECTION_ZONE_MAP[clean];
  }
  const prefix = clean.split(/[-_]/)[0];
  if (CHARROS_SVG_ZONE_MAP[prefix]) {
    return CHARROS_SVG_ZONE_MAP[prefix];
  }
  return null;
}

/**
 * Obtiene la zona oficial de una sección en Estadio Tomateros
 */
export function getTomaterosSectionZone(sectionNumber?: string | null): string | null {
  if (!sectionNumber) return null;
  const clean = sectionNumber.trim().toLowerCase().replace(/^sec(?:ci[oó]n)?[\s._#-]+/i, '');
  if (TOMATEROS_SECTION_ZONE_MAP[clean]) {
    return TOMATEROS_SECTION_ZONE_MAP[clean];
  }
  const prefix = clean.split(/[-_]/)[0];
  if (TOMATEROS_SVG_ZONE_MAP[prefix]) {
    return TOMATEROS_SVG_ZONE_MAP[prefix];
  }
  if (clean.startsWith('suite')) return 'Deluxe Supreme';
  if (clean.startsWith('platea')) return 'Platino';
  if (clean.startsWith('num_home') || clean.startsWith('home')) return 'Oro';
  if (clean.startsWith('num_bajo')) return 'Sky Plus';
  if (clean.startsWith('num_medio')) return 'Plus';
  if (clean.startsWith('num_claro')) return 'Fan Plus';
  if (clean.startsWith('jardin')) return 'Sky';
  return null;
}

/**
 * Zonas oficiales de Estadio El Encanto (Dorados de Sinaloa)
 * Conforme a la distribución física oficial y puertas de acceso
 */
export const ENCANTO_ZONES: Record<string, ZoneMeta> = {
  'Poniente Central': {
    name: 'Poniente Central',
    defaultPrice: 650,
    colorHex: '#DC2626',
    badgeBg: 'bg-red-500/15 text-red-600 border-red-500/30',
    badgeText: 'text-red-500',
    fillColor: '#DC2626',
    strokeColor: '#991B1B',
    gate: 'Puerta 1',
    description: 'Nivel central poniente baja, vista directa a bancas y media cancha',
  },
  'Oriente Central': {
    name: 'Oriente Central',
    defaultPrice: 600,
    colorHex: '#0F172A',
    badgeBg: 'bg-slate-800/15 text-slate-800 border-slate-700/30',
    badgeText: 'text-slate-800',
    fillColor: '#0F172A',
    strokeColor: '#000000',
    gate: 'Puerta 1',
    description: 'Nivel central oriente frente al tiro de cámaras de transmisión',
  },
  'Poniente Lateral': {
    name: 'Poniente Lateral',
    defaultPrice: 480,
    colorHex: '#0284C7',
    badgeBg: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
    badgeText: 'text-sky-500',
    fillColor: '#0284C7',
    strokeColor: '#0369A1',
    gate: 'Puerta 1',
    description: 'Grada lateral poniente con excelente ángulo al terreno de juego',
  },
  'Oriente Lateral': {
    name: 'Oriente Lateral',
    defaultPrice: 450,
    colorHex: '#D97706',
    badgeBg: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    badgeText: 'text-amber-500',
    fillColor: '#D97706',
    strokeColor: '#B45309',
    gate: 'Puerta 1',
    description: 'Grada lateral oriente con cercanía a las bandas de juego',
  },
  'Poniente Superior': {
    name: 'Poniente Superior',
    defaultPrice: 360,
    colorHex: '#0D9488',
    badgeBg: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
    badgeText: 'text-teal-500',
    fillColor: '#0D9488',
    strokeColor: '#0F766E',
    gate: 'Puerta 6',
    description: 'Grada alta poniente con visión panorámica completa del campo',
  },
  'Oriente Superior': {
    name: 'Oriente Superior',
    defaultPrice: 320,
    colorHex: '#16A34A',
    badgeBg: 'bg-green-500/15 text-green-600 border-green-500/30',
    badgeText: 'text-green-500',
    fillColor: '#16A34A',
    strokeColor: '#15803D',
    gate: 'Puerta 2',
    description: 'Nivel alto oriente con amplia cobertura del estadio',
  },
  'General Sur': {
    name: 'General Sur',
    defaultPrice: 220,
    colorHex: '#EAB308',
    badgeBg: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
    badgeText: 'text-yellow-600',
    fillColor: '#EAB308',
    strokeColor: '#CA8A04',
    gate: 'Puerta 1',
    description: 'Cabecera sur detrás de portería, zona de la porra y afición local',
  },
  'General Norte': {
    name: 'General Norte',
    defaultPrice: 200,
    colorHex: '#6B7280',
    badgeBg: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
    badgeText: 'text-slate-200',
    fillColor: '#6B7280',
    strokeColor: '#4B5563',
    gate: 'Puerta 3',
    description: 'Cabecera norte baja, ambiente familiar y festivo',
  },
  'Cabecera Superior': {
    name: 'Cabecera Superior',
    defaultPrice: 250,
    colorHex: '#84CC16',
    badgeBg: 'bg-lime-500/15 text-lime-600 border-lime-500/30',
    badgeText: 'text-lime-600',
    fillColor: '#84CC16',
    strokeColor: '#65A30D',
    gate: 'Puerta 5',
    description: 'Grada alta norte detrás de portería con vista elevada',
  },
  'Tiro de Esquina': {
    name: 'Tiro de Esquina',
    defaultPrice: 290,
    colorHex: '#38BDF8',
    badgeBg: 'bg-sky-400/15 text-sky-500 border-sky-400/30',
    badgeText: 'text-sky-500',
    fillColor: '#38BDF8',
    strokeColor: '#0284C7',
    gate: 'Puerta 1',
    description: 'Vértices de tiro de esquina en las cuatro esquinas de la cancha',
  },
  'Palcos': {
    name: 'Palcos',
    defaultPrice: 1200,
    colorHex: '#F97316',
    badgeBg: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    badgeText: 'text-orange-500',
    fillColor: '#F97316',
    strokeColor: '#EA580C',
    gate: 'Puertas 3 y 4',
    description: 'Palcos privados 1 al 22 (Poniente) y 23 al 42 (Oriente) con servicio exclusivo',
  },
  'Sky Boxes': {
    name: 'Sky Boxes',
    defaultPrice: 1400,
    colorHex: '#A1A134',
    badgeBg: 'bg-yellow-600/15 text-yellow-700 border-yellow-600/30',
    badgeText: 'text-yellow-700',
    fillColor: '#A1A134',
    strokeColor: '#858528',
    gate: 'Puertas 3 y 4',
    description: 'Palcos corporativos superiores en nivel club',
  },
  'Zona Lounge': {
    name: 'Zona Lounge',
    defaultPrice: 1100,
    colorHex: '#EC4899',
    badgeBg: 'bg-pink-500/15 text-pink-600 border-pink-500/30',
    badgeText: 'text-pink-500',
    fillColor: '#EC4899',
    strokeColor: '#DB2777',
    gate: 'Puertas 3 y 4',
    description: 'Área lounge VIP con bar y vista a nivel de cancha',
  },
};

export interface StadiumAccessGateInfo {
  gate: string;
  zones: string[];
}

export const ENCANTO_GATES_GUIDE: StadiumAccessGateInfo[] = [
  { gate: 'Puerta 5', zones: ['Cabecera Superior'] },
  { gate: 'Puerta 1', zones: ['General Sur', 'Poniente Central', 'Oriente Central', 'Oriente Lateral', 'Poniente Lateral', 'Tiro de Esquina'] },
  { gate: 'Puerta 3', zones: ['General Norte'] },
  { gate: 'Puerta 2', zones: ['Oriente Superior'] },
  { gate: 'Puerta 6', zones: ['Poniente Superior'] },
  { gate: 'Puertas 3 y 4', zones: ['Sky Boxes', 'Zona Lounge', 'Palcos (1 al 42)'] },
];

/**
 * Detecta si la sede o evento corresponde a Estadio El Encanto
 */
export function isEncantoVenue(venueId?: string, venueName?: string, eventType?: string): boolean {
  if (venueId === 'venue-encanto' || venueId === 'estadio-encanto') {
    return true;
  }
  if (venueId === 'venue-teodoro-mariscal' || venueId === 'venue-tomateros' || venueId === 'venue-charros') {
    return false;
  }
  const name = (venueName || '').toLowerCase();
  if (
    name.includes('teodoro mariscal') ||
    name.includes('mariscal') ||
    name.includes('tomateros') ||
    name.includes('charros') ||
    name.includes('panamericano')
  ) {
    return false;
  }
  if (
    name.includes('encanto') ||
    name.includes('dorados') ||
    name.includes('el gran pez')
  ) {
    return true;
  }
  return false;
}

/**
 * Detecta si la sede o evento corresponde a Estadio Charros de Jalisco
 */
export function isCharrosVenue(venueId?: string, venueName?: string, eventType?: string): boolean {
  if (venueId === 'venue-charros' || venueId === 'estadio-charros') {
    return true;
  }
  if (venueId === 'venue-teodoro-mariscal' || venueId === 'venue-encanto' || venueId === 'venue-tomateros') {
    return false;
  }
  const name = (venueName || '').toLowerCase();
  if (
    name.includes('teodoro mariscal') ||
    name.includes('mariscal') ||
    name.includes('encanto') ||
    name.includes('dorados') ||
    name.includes('tomateros') ||
    name.includes('culiacan') ||
    name.includes('culiacán')
  ) {
    return false;
  }
  if (
    name.includes('estadio panamericano') ||
    name.includes('estadio charros') ||
    name.includes('panamericano charros') ||
    name.includes('charros de jalisco') ||
    name.includes('zapopan') ||
    name.includes('charros') ||
    name.includes('panamericano')
  ) {
    return true;
  }
  return false;
}

/**
 * Detecta si la sede o evento corresponde a Estadio Tomateros de Culiacán
 */
export function isTomaterosVenue(venueId?: string, venueName?: string, eventType?: string): boolean {
  if (venueId === 'venue-tomateros' || venueId === 'estadio-tomateros') {
    return true;
  }
  if (venueId === 'venue-teodoro-mariscal' || venueId === 'venue-encanto' || venueId === 'venue-charros') {
    return false;
  }
  const name = (venueName || '').toLowerCase();
  if (
    name.includes('teodoro mariscal') ||
    name.includes('mariscal') ||
    name.includes('encanto') ||
    name.includes('dorados') ||
    name.includes('charros') ||
    name.includes('panamericano') ||
    name.includes('zapopan')
  ) {
    return false;
  }
  if (
    name.includes('estadio tomateros') ||
    name.includes('nacion guinda') ||
    name.includes('nación guinda') ||
    name.includes('tomateros') ||
    name.includes('culiacan') ||
    name.includes('culiacán')
  ) {
    return true;
  }
  return false;
}

/**
 * Patrones y nombres de secciones obsoletas / anteriores que deben ser eliminadas.
 * (preferente lateral, norte, este, platea baja, bleachers, etc.)
 */
export const LEGACY_SECTION_PATTERNS = [
  /preferente\s*lateral/i,
  /platea\s*baja/i,
  /platea\s*central/i,
  /bleachers/i,
  /palco\s*vip\s*premier/i,
  /gradas?\s*generales?/i,
  /lateral\s*preferente/i,
  /central\s*vip/i,
  /palco\s*corporativo/i,
  /^norte$/i,
  /^este$/i,
  /^sur$/i,
  /^poniente$/i,
  /^oriente$/i,
];

/**
 * Comprueba si un nombre de sección es de las anteriores / obsoletas
 */
export function isLegacySection(sectionName: string): boolean {
  if (!sectionName) return true;
  const clean = sectionName.trim();
  return LEGACY_SECTION_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Retorna las zonas oficiales según el estadio seleccionado
 */
export function getStadiumZones(
  venueId?: string,
  venueName?: string,
  eventType?: string
): Record<string, ZoneMeta> {
  if (isCharrosVenue(venueId, venueName, eventType)) {
    return CHARROS_ZONES;
  }
  if (isTomaterosVenue(venueId, venueName, eventType)) {
    return TOMATEROS_ZONES;
  }
  if (isEncantoVenue(venueId, venueName, eventType)) {
    return ENCANTO_ZONES;
  }
  return MARISCAL_ZONES;
}

/**
 * Obtiene la lista predeterminada de secciones y precios oficiales para un recinto
 * basada 100% en las zonas que aparecen en el mapa físico.
 */
export function getOfficialPriceTiersForVenue(
  venueId?: string,
  venueName?: string,
  eventType?: string
): { section: string; price: number }[] {
  const zones = getStadiumZones(venueId, venueName, eventType);
  return Object.values(zones).map((z) => ({
    section: z.name,
    price: z.defaultPrice,
  }));
}

/**
 * Resuelve y sanitiza la lista de secciones y precios para un evento específico.
 * - Elimina por completo las secciones anteriores (preferente lateral, norte, este, platea baja, bleachers, etc.)
 * - Devuelve exactamente las secciones que aparecen en el mapa del estadio.
 * - Si el evento tiene un precio personalizado para una sección oficial del mapa, lo conserva.
 */
export function getOfficialPriceTiersForEvent(
  event?: VenueEvent | null,
  venueName?: string
): { section: string; price: number }[] {
  const targetVenueId = event?.venueId;
  const targetVenueName = venueName || event?.venueName;
  const targetType = event?.type;
  const officialZones = getStadiumZones(targetVenueId, targetVenueName, targetType);

  // Mapear cada zona oficial del mapa con el precio del evento (si existe y no es legacy) o su precio predeterminado del mapa
  return Object.values(officialZones).map((zone) => {
    let finalPrice = zone.defaultPrice;

    if (event && event.priceTiers && event.priceTiers.length > 0) {
      // Buscar coincidencia exacta con nombre de la zona oficial
      const match = event.priceTiers.find(
        (t) =>
          !isLegacySection(t.section) &&
          t.section.toLowerCase().trim() === zone.name.toLowerCase().trim()
      );
      if (match && typeof match.price === 'number' && match.price > 0) {
        finalPrice = match.price;
      }
    }

    return {
      section: zone.name,
      price: finalPrice,
    };
  });
}

/**
 * Resuelve el precio por zona para un evento específico
 */
export function getZonePrice(zoneName: string, event?: VenueEvent | null): number {
  const cleanZoneName = (zoneName || '').trim().toLowerCase();
  if (event && event.priceTiers && event.priceTiers.length > 0) {
    const match = event.priceTiers.find(
      (t) =>
        !isLegacySection(t.section) &&
        t.section.toLowerCase().trim() === cleanZoneName
    );
    if (match) return match.price;
  }
  const zones = getStadiumZones(event?.venueId, event?.venueName, event?.type);
  
  // Búsqueda insensible a mayúsculas/minúsculas en zones
  const foundZoneKey = Object.keys(zones).find(
    (k) => k.trim().toLowerCase() === cleanZoneName
  );
  if (foundZoneKey) {
    return zones[foundZoneKey].defaultPrice;
  }

  // Respaldo en TOMATEROS_ZONES
  const foundTomaterosKey = Object.keys(TOMATEROS_ZONES).find(
    (k) => k.trim().toLowerCase() === cleanZoneName
  );
  if (foundTomaterosKey) {
    return TOMATEROS_ZONES[foundTomaterosKey].defaultPrice;
  }

  // Respaldo insensible a mayúsculas/minúsculas en MARISCAL_ZONES
  const foundMariscalKey = Object.keys(MARISCAL_ZONES).find(
    (k) => k.trim().toLowerCase() === cleanZoneName
  );
  if (foundMariscalKey) {
    return MARISCAL_ZONES[foundMariscalKey].defaultPrice;
  }

  return 350;
}

/**
 * Generador de las definiciones oficiales del Estadio Teodoro Mariscal
 * tomando la data oficial de venta de boletos del club:
 *
 * Zona            | Secciones
 * ------------------------------------------------------------
 * Deluxe Supreme  | 1-12 (central baja, junto al home)
 * Diamante        | 101, 108, 201, 208
 * Platino         | 104-107, 204-207 (las más cercanas al home)
 * Oro             | 102-103, 202-203
 * Sky Plus        | 109-117, 209-217
 * Plus            | 118-121, 218-221
 * Fan             | 122-127, 222-227
 * Fan Plus        | 128-133, 228-233
 * Sky             | 301-316
 */
export function buildMariscalSectionsData(venueId: string): Omit<SeatSection, 'id'>[] {
  const sections: Omit<SeatSection, 'id'>[] = [];

  const defaultProps = {
    venueId,
    totalSeats: 30,
    rows: 3,
    seatsPerRow: 10,
  };

  // 1. Deluxe Supreme: 1 a 12 (central baja junto a Home Plate)
  for (let i = 1; i <= 12; i++) {
    sections.push({
      ...defaultProps,
      sectionNumber: String(i),
      zoneName: 'Deluxe Supreme',
    });
  }

  // 2. Platino (Rojo): 105-108 (1ra base) y 115-117 (3ra base)
  for (const s of [105, 106, 107, 108, 115, 116, 117]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Platino' });
  }

  // 3. Oro (Azul Turquesa): 101-104 (1ra base) y 118-121 (3ra base)
  for (const s of [101, 102, 103, 104, 118, 119, 120, 121]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Oro' });
  }

  // 4. Diamante (Naranja Terracota): Herraje central nivel 200 (205-217)
  for (let i = 205; i <= 217; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Diamante' });
  }

  // 5. Plus (Verde Lima): Nivel 200 lateral (201-204 y 218-221)
  for (const s of [201, 202, 203, 204, 218, 219, 220, 221]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Plus' });
  }

  // 6. Fan (Celeste): Jardines Bajos sobre barda (122-127 y 128-133)
  for (let i = 122; i <= 133; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan' });
  }

  // 7. Fan Plus (Gris Lavanda): Jardines Altos nivel 200 (222-227 y 228-233)
  for (let i = 222; i <= 233; i++) {
    sections.push({ ...defaultProps, sectionNumber: String(i), zoneName: 'Fan Plus' });
  }

  // 8. Sky (Morado): Nivel 300 lateral (301-304 y 313-316)
  for (const s of [301, 302, 303, 304, 313, 314, 315, 316]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Sky' });
  }

  // 9. Sky Plus (Melocotón): Nivel 300 central (305-307 y 310-312)
  for (const s of [305, 306, 307, 310, 311, 312]) {
    sections.push({ ...defaultProps, sectionNumber: String(s), zoneName: 'Sky Plus' });
  }

  return sections;
}

/**
 * Generador de las definiciones oficiales de secciones de Estadio El Encanto (Dorados de Sinaloa)
 * Conforme a la distribución física oficial:
 *
 * Zona               | Secciones
 * ------------------------------------------------------------
 * Poniente Central   | PC-1 a PC-4 (Nivel central poniente baja, Puerta 1)
 * Poniente Lateral   | PL-1 a PL-6 (Grada lateral poniente, Puerta 1)
 * Poniente Superior  | PS-1 a PS-8 (Grada alta poniente panorámica, Puerta 6)
 * Oriente Central    | OC-1 a OC-4 (Nivel central oriente frente a cámaras, Puerta 1)
 * Oriente Lateral    | OL-1 a OL-6 (Grada lateral oriente, Puerta 1)
 * Oriente Superior   | OS-1 a OS-8 (Nivel alto oriente, Puerta 2)
 * Cabecera Superior  | CS-1 a CS-8 (Grada alta norte detrás de portería, Puerta 5)
 * General Norte      | GN-1 a GN-6 (Cabecera norte baja, Puerta 3)
 * General Sur        | GS-1 a GS-8 (Cabecera sur porra de Dorados y afición local, Puerta 1)
 * Tiro de Esquina    | TE-1 a TE-4 (Vértices de córner, Puerta 1)
 * Sky Boxes          | SB-1 a SB-4 (Palcos corporativos superiores, Puertas 3 y 4)
 * Zona Lounge        | ZL-1, ZL-2  (Área lounge VIP cabecera norte, Puertas 3 y 4)
 * Palcos 1 al 22     | Palco 1 a Palco 22 (Palcos Poniente, Puertas 3 y 4)
 * Palcos 23 al 42    | Palco 23 a Palco 42 (Palcos Oriente, Puertas 3 y 4)
 */
export function buildEncantoSectionsData(venueId: string = 'venue-encanto'): Omit<SeatSection, 'id'>[] {
  const sections: Omit<SeatSection, 'id'>[] = [];

  const addSecs = (prefix: string, count: number, zoneName: string, rows = 3, seatsPerRow = 10) => {
    for (let i = 1; i <= count; i++) {
      sections.push({
        venueId,
        sectionNumber: `${prefix}-${i}`,
        zoneName,
        rows,
        seatsPerRow,
        totalSeats: rows * seatsPerRow,
      });
    }
  };

  // Poniente Central (Puerta 1): PC-1 a PC-4
  addSecs('PC', 4, 'Poniente Central', 3, 10);

  // Poniente Lateral (Puerta 1): PL-1 a PL-6
  addSecs('PL', 6, 'Poniente Lateral', 3, 10);

  // Poniente Superior (Puerta 6): PS-1 a PS-8
  addSecs('PS', 8, 'Poniente Superior', 3, 10);

  // Oriente Central (Puerta 1): OC-1 a OC-4
  addSecs('OC', 4, 'Oriente Central', 3, 10);

  // Oriente Lateral (Puerta 1): OL-1 a OL-6
  addSecs('OL', 6, 'Oriente Lateral', 3, 10);

  // Oriente Superior (Puerta 2): OS-1 a OS-8
  addSecs('OS', 8, 'Oriente Superior', 3, 10);

  // Cabecera Superior (Puerta 5): CS-1 a CS-8
  addSecs('CS', 8, 'Cabecera Superior', 3, 10);

  // General Norte (Puerta 3): GN-1 a GN-6
  addSecs('GN', 6, 'General Norte', 3, 10);

  // General Sur (Puerta 1): GS-1 a GS-8
  addSecs('GS', 8, 'General Sur', 3, 10);

  // Tiro de Esquina (Puerta 1): TE-1 a TE-4
  addSecs('TE', 4, 'Tiro de Esquina', 3, 10);

  // Sky Boxes (Puertas 3 y 4): SB-1 a SB-4
  addSecs('SB', 4, 'Sky Boxes', 2, 8);

  // Zona Lounge (Puertas 3 y 4): ZL-1, ZL-2
  addSecs('ZL', 2, 'Zona Lounge', 2, 10);

  // Palcos 1 al 22 (Poniente, Puertas 3 y 4)
  for (let i = 1; i <= 22; i++) {
    sections.push({
      venueId,
      sectionNumber: `Palco ${i}`,
      zoneName: 'Palcos',
      rows: 2,
      seatsPerRow: 6,
      totalSeats: 12,
    });
  }

  // Palcos 23 al 42 (Oriente, Puertas 3 y 4)
  for (let i = 23; i <= 42; i++) {
    sections.push({
      venueId,
      sectionNumber: `Palco ${i}`,
      zoneName: 'Palcos',
      rows: 2,
      seatsPerRow: 6,
      totalSeats: 12,
    });
  }

  return sections;
}

/**
 * Generador de las definiciones oficiales de secciones de Estadio Tomateros (Culiacán)
 * Conforme a los 54 bloques físicos del mapa SVG:
 * - Suites: suite-1 .. suite-3 (Deluxe Supreme)
 * - Platea: platea-1 .. platea-16 (Platino)
 * - Numerado Home: num_home-1 .. num_home-3 (Oro)
 * - Numerado Bajo: num_bajo-1 .. num_bajo-6 (Sky Plus)
 * - Numerado Medio: num_medio-1 .. num_medio-6 (Plus)
 * - Numerado Claro: num_claro-1 .. num_claro-6 (Fan Plus)
 * - Jardines: jardin-1 .. jardin-14 (Sky)
 */
export function buildTomaterosSectionsData(venueId: string): Omit<SeatSection, 'id'>[] {
  const sections: Omit<SeatSection, 'id'>[] = [];
  const defaultProps = {
    venueId,
    totalSeats: 30,
    rows: 3,
    seatsPerRow: 10,
  };

  // 1. Suites: suite-1 .. suite-3 (Deluxe Supreme)
  for (let i = 1; i <= 3; i++) {
    sections.push({ ...defaultProps, sectionNumber: `suite-${i}`, zoneName: 'Deluxe Supreme' });
  }

  // 2. Platea: platea-1 .. platea-16 (Platino)
  for (let i = 1; i <= 16; i++) {
    sections.push({ ...defaultProps, sectionNumber: `platea-${i}`, zoneName: 'Platino' });
  }

  // 3. Numerado Home: num_home-1 .. num_home-3 (Oro)
  for (let i = 1; i <= 3; i++) {
    sections.push({ ...defaultProps, sectionNumber: `num_home-${i}`, zoneName: 'Oro' });
  }

  // 4. Numerado Bajo: num_bajo-1 .. num_bajo-6 (Sky Plus)
  for (let i = 1; i <= 6; i++) {
    sections.push({ ...defaultProps, sectionNumber: `num_bajo-${i}`, zoneName: 'Sky Plus' });
  }

  // 5. Numerado Medio: num_medio-1 .. num_medio-6 (Plus)
  for (let i = 1; i <= 6; i++) {
    sections.push({ ...defaultProps, sectionNumber: `num_medio-${i}`, zoneName: 'Plus' });
  }

  // 6. Numerado Claro: num_claro-1 .. num_claro-6 (Fan Plus)
  for (let i = 1; i <= 6; i++) {
    sections.push({ ...defaultProps, sectionNumber: `num_claro-${i}`, zoneName: 'Fan Plus' });
  }

  // 7. Jardines: jardin-1 .. jardin-14 (Sky)
  for (let i = 1; i <= 14; i++) {
    sections.push({ ...defaultProps, sectionNumber: `jardin-${i}`, zoneName: 'Sky' });
  }

  return sections;
}

/**
 * Generador de las definiciones oficiales de secciones de Estadio Charros de Jalisco
 * Conforme a los polígonos del mapa SVG:
 * - Lateral Base (magenta): magenta-01 .. magenta-06
 * - Palco Esquina (purple): purple-01 .. purple-02
 * - Premier (premier): premier-01 .. premier-06
 * - Lateral Premier (orange): orange-01 .. orange-10
 * - Butaca Preferente (yellow): yellow-01 .. yellow-24
 * - VIP / Local / Visitante (cyan): cyan-01 .. cyan-09, vip-01 .. vip-08, teal-01
 * - Planta Baja (steel): steel-01 .. steel-10
 * - Planta Alta y Suites (navy): navy-01 .. navy-43
 * - Jardín / Esquinas (gray): gray-01 .. gray-14
 */
export function buildCharrosSectionsData(venueId: string = 'venue-charros'): Omit<SeatSection, 'id'>[] {
  const sections: Omit<SeatSection, 'id'>[] = [];
  const defaultProps = {
    venueId,
    totalSeats: 30,
    rows: 3,
    seatsPerRow: 10,
  };

  // 1. Lateral Base: magenta-01 .. magenta-06
  for (let i = 1; i <= 6; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `magenta-${num}`, zoneName: 'Lateral Base' });
  }

  // 2. Palco Esquina: purple-01 .. purple-02
  for (let i = 1; i <= 2; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `purple-${num}`, zoneName: 'Palco Esquina' });
  }

  // 3. Premier: premier-01 .. premier-06
  for (let i = 1; i <= 6; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `premier-${num}`, zoneName: 'Premier' });
  }

  // 4. Lateral Premier: orange-01 .. orange-10
  for (let i = 1; i <= 10; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `orange-${num}`, zoneName: 'Lateral Premier' });
  }

  // 5. Butaca Preferente: yellow-01 .. yellow-24
  for (let i = 1; i <= 24; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `yellow-${num}`, zoneName: 'Butaca Preferente' });
  }

  // 6. VIP / Local / Visitante: cyan-01 .. cyan-09, vip-01 .. vip-08, teal-01
  for (let i = 1; i <= 9; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `cyan-${num}`, zoneName: 'VIP / Local / Visitante' });
  }
  for (let i = 1; i <= 8; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `vip-${num}`, zoneName: 'VIP / Local / Visitante' });
  }
  sections.push({ ...defaultProps, sectionNumber: 'teal-01', zoneName: 'VIP / Local / Visitante' });

  // 7. Planta Baja: steel-01 .. steel-10
  for (let i = 1; i <= 10; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `steel-${num}`, zoneName: 'Planta Baja' });
  }

  // 8. Planta Alta y Suites: navy-01 .. navy-43
  for (let i = 1; i <= 43; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `navy-${num}`, zoneName: 'Planta Alta y Suites' });
  }

  // 9. Jardín / Esquinas: gray-01 .. gray-14
  for (let i = 1; i <= 14; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    sections.push({ ...defaultProps, sectionNumber: `gray-${num}`, zoneName: 'Jardín / Esquinas' });
  }

  return sections;
}

/**
 * Selecciona la función generadora de secciones según la sede
 */
export function buildSectionsForVenue(venueId: string, eventType?: string): Omit<SeatSection, 'id'>[] {
  if (isCharrosVenue(venueId, undefined, eventType)) {
    return buildCharrosSectionsData(venueId);
  }
  if (isEncantoVenue(venueId, undefined, eventType)) {
    return buildEncantoSectionsData(venueId);
  }
  if (isTomaterosVenue(venueId, undefined, eventType)) {
    return buildTomaterosSectionsData(venueId);
  }
  return buildMariscalSectionsData(venueId);
}

/**
 * Registra o asegura el seed de las secciones del estadio correspondiente en Firestore
 */
export async function seedSeatMapForVenue(venueId: string = DEFAULT_VENUE_ID): Promise<SeatSection[]> {
  try {
    const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
    }

    const sectionsData = buildSectionsForVenue(venueId);
    const batch = writeBatch(db);
    const createdSections: SeatSection[] = [];

    for (const data of sectionsData) {
      const docId = `${venueId}_sec_${(data.sectionNumber || '').replace(/\s+/g, '_')}`;
      const docRef = doc(db, 'seatSections', docId);
      const section: SeatSection = {
        id: docId,
        ...data,
      };
      batch.set(docRef, section);
      createdSections.push(section);
    }

    await batch.commit();
    return createdSections;
  } catch (err) {
    console.warn('Aviso al sincronizar secciones en Firestore (usando catálogo físico maestro):', err);
    // Retorna los datos en memoria para que la UI funcione de forma fluida
    const localData = buildSectionsForVenue(venueId);
    return localData.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
  }
}

/** Alias para compatibilidad con código existente */
export const seedMariscalSeatMap = seedSeatMapForVenue;

/**
 * Filtra y sanitiza las secciones asegurando coherencia total con el estadio correspondiente.
 */
export function sanitizeVenueSections(venueId: string, rawSections: SeatSection[], eventType?: string): SeatSection[] {
  const isCharros = isCharrosVenue(venueId, undefined, eventType);
  const isEncanto = isEncantoVenue(venueId, undefined, eventType);
  const isTomateros = isTomaterosVenue(venueId, undefined, eventType);

  if (isCharros) {
    const valid = rawSections
      .filter((s) => {
        const num = (s.sectionNumber || '').trim().toLowerCase();
        return (
          num.startsWith('magenta') ||
          num.startsWith('purple') ||
          num.startsWith('premier') ||
          num.startsWith('orange') ||
          num.startsWith('yellow') ||
          num.startsWith('cyan') ||
          num.startsWith('vip') ||
          num.startsWith('teal') ||
          num.startsWith('steel') ||
          num.startsWith('navy') ||
          num.startsWith('gray')
        );
      })
      .map((s) => {
        const officialZone = getCharrosSectionZone(s.sectionNumber);
        if (officialZone) {
          return { ...s, zoneName: officialZone };
        }
        return s;
      });
    if (valid.length > 0) return valid;
    const master = buildCharrosSectionsData(venueId);
    return master.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
  } else if (isEncanto) {
    const valid = rawSections.filter((s) => {
      const num = (s.sectionNumber || '').trim().toUpperCase();
      const zone = (s.zoneName || '').trim().toLowerCase();
      if (zone === 'norte' || zone === 'este') return false;
      return (
        num.startsWith('PC-') ||
        num.startsWith('PL-') ||
        num.startsWith('PS-') ||
        num.startsWith('OC-') ||
        num.startsWith('OL-') ||
        num.startsWith('OS-') ||
        num.startsWith('CS-') ||
        num.startsWith('GN-') ||
        num.startsWith('GS-') ||
        num.startsWith('TE-') ||
        num.startsWith('SB-') ||
        num.startsWith('ZL-') ||
        num.startsWith('PALCO')
      );
    });
    if (valid.length > 0) return valid;
    const master = buildEncantoSectionsData(venueId);
    return master.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
  } else if (isTomateros) {
    const valid = rawSections
      .filter((s) => {
        const num = (s.sectionNumber || '').trim().toLowerCase();
        return (
          num.startsWith('suite') ||
          num.startsWith('platea') ||
          num.startsWith('num_home') ||
          num.startsWith('num_bajo') ||
          num.startsWith('num_medio') ||
          num.startsWith('num_claro') ||
          num.startsWith('jardin')
        );
      })
      .map((s) => {
        const officialZone = getTomaterosSectionZone(s.sectionNumber);
        if (officialZone) {
          return { ...s, zoneName: officialZone };
        }
        return s;
      });
    if (valid.length > 0) return valid;
    const master = buildTomaterosSectionsData(venueId);
    return master.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
  } else {
    // Teodoro Mariscal
    const valid = rawSections
      .filter((s) => {
        const num = (s.sectionNumber || '').trim().toUpperCase();
        return (
          !num.startsWith('PC-') &&
          !num.startsWith('PL-') &&
          !num.startsWith('TE-') &&
          !num.startsWith('GN-') &&
          !num.startsWith('GS-') &&
          !num.startsWith('SUITE') &&
          !num.startsWith('PLATEA') &&
          !num.startsWith('JARDIN')
        );
      })
      .map((s) => {
        const officialZone = getMariscalSectionZone(s.sectionNumber);
        if (officialZone) {
          return { ...s, zoneName: officialZone };
        }
        return s;
      });
    if (valid.length > 0) return valid;
    const master = buildMariscalSectionsData(venueId);
    return master.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
  }
}

/**
 * Obtener las secciones del estadio para una sede (con caché local de 30 minutos)
 */
export async function getSeatSectionsForVenue(venueId: string = DEFAULT_VENUE_ID): Promise<SeatSection[]> {
  const cacheKey = `stadium_sections_${venueId}`;
  const cached = getCachedData<SeatSection[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
    const snap = await getDocs(q);

    if (snap.empty) {
      const seeded = await seedSeatMapForVenue(venueId);
      setCachedData(cacheKey, seeded, 30);
      return seeded;
    }

    const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
    const sanitized = sanitizeVenueSections(venueId, raw);
    setCachedData(cacheKey, sanitized, 30);
    return sanitized;
  } catch (err) {
    console.warn('Error fetching seat sections:', err);
    const localData = buildSectionsForVenue(venueId);
    const fallback = localData.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
    setCachedData(cacheKey, fallback, 10);
    return fallback;
  }
}

/**
 * Escuchar secciones en tiempo real con soporte de caché previo
 */
export function subscribeSeatSections(
  venueId: string,
  callback: (sections: SeatSection[]) => void,
  onError?: (err: any) => void
): () => void {
  const cacheKey = `stadium_sections_${venueId}`;
  const cached = getCachedData<SeatSection[]>(cacheKey);
  if (cached && cached.length > 0) {
    callback(cached);
  }

  const q = query(collection(db, 'seatSections'), where('venueId', '==', venueId));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        const localData = buildSectionsForVenue(venueId);
        const fallback = localData.map((d) => ({ id: `${venueId}_sec_${(d.sectionNumber || '').replace(/\s+/g, '_')}`, ...d }));
        setCachedData(cacheKey, fallback, 30);
        callback(fallback);
      } else {
        const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SeatSection, 'id'>) }));
        const sanitized = sanitizeVenueSections(venueId, raw);
        setCachedData(cacheKey, sanitized, 30);
        callback(sanitized);

        // Sanación en segundo plano de cualquier discrepancia en Firestore
        if (isTomaterosVenue(venueId)) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const canonicalZone = getTomaterosSectionZone(data.sectionNumber);
            if (canonicalZone && data.zoneName !== canonicalZone) {
              updateDoc(docSnap.ref, { zoneName: canonicalZone }).catch(() => {});
            }
          });
        } else if (!isEncantoVenue(venueId)) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const canonicalZone = getMariscalSectionZone(data.sectionNumber);
            if (canonicalZone && data.zoneName !== canonicalZone) {
              updateDoc(docSnap.ref, { zoneName: canonicalZone }).catch(() => {});
            }
          });
        }
      }
    },
    (err) => {
      console.warn('Snapshot error on seat sections:', err);
      if (onError) onError(err);
      getSeatSectionsForVenue(venueId).then(callback);
    }
  );
}

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/**
 * Genera la disponibilidad de asientos (EventSeat) para un evento nuevo o existente.
 * Crea un documento EventSeat por cada asiento (status: 'disponible').
 */
export async function generateEventSeats(
  eventId: string,
  venueId: string = DEFAULT_VENUE_ID
): Promise<{ createdCount: number; totalSeats: number }> {
  try {
    // 1. Verificar si ya existen asientos para este evento
    const qCheck = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
    const existingSnap = await getDocs(qCheck);

    if (!existingSnap.empty) {
      return { createdCount: 0, totalSeats: existingSnap.size };
    }

    // 2. Obtener las secciones de la sede
    let sections = await getSeatSectionsForVenue(venueId);
    if (!sections || sections.length === 0) {
      sections = await seedSeatMapForVenue(venueId);
    }

    // 3. Preparar los asientos
    const seatsToCreate: EventSeat[] = [];

    for (const section of sections) {
      const numRows = section.rows || 3;
      const seatsPerRow = section.seatsPerRow || 10;

      for (let r = 0; r < numRows; r++) {
        const rowLabel = ROW_LABELS[r] || String.fromCharCode(65 + r);
        for (let s = 1; s <= seatsPerRow; s++) {
          const seatId = `${eventId}_${section.sectionNumber.replace(/\s+/g, '_')}_${rowLabel}_${s}`;
          seatsToCreate.push({
            id: seatId,
            eventId,
            sectionId: section.id,
            sectionNumber: section.sectionNumber,
            zoneName: section.zoneName,
            rowLabel,
            seatNumber: s,
            status: 'disponible',
          });
        }
      }
    }

    // 4. Guardar en Firestore en batches de 400 (límite máximo de Firestore es 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < seatsToCreate.length; i += BATCH_SIZE) {
      const chunk = seatsToCreate.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const seat of chunk) {
        const docRef = doc(db, 'eventSeats', seat.id);
        batch.set(docRef, seat);
      }
      await batch.commit();
    }

    return { createdCount: seatsToCreate.length, totalSeats: seatsToCreate.length };
  } catch (err) {
    console.warn('Aviso al generar asientos de evento:', err);
    return { createdCount: 0, totalSeats: 0 };
  }
}

/**
 * Obtener todos los asientos de un evento
 */
export async function getEventSeats(eventId: string): Promise<EventSeat[]> {
  try {
    const q = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventSeat, 'id'>) }));
  } catch (err) {
    console.warn('Error fetching event seats:', err);
    return [];
  }
}

/**
 * Escuchar en tiempo real los asientos de un evento
 */
export function subscribeEventSeats(
  eventId: string,
  callback: (seats: EventSeat[]) => void,
  onError?: (err: any) => void
): () => void {
  const cacheKey = `stadium_event_seats_${eventId}`;
  const cached = getCachedData<EventSeat[]>(cacheKey);
  if (cached && cached.length > 0) {
    callback(cached);
  }

  const q = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
  return onSnapshot(
    q,
    (snap) => {
      const seats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventSeat, 'id'>) }));
      setCachedData(cacheKey, seats, 10);
      callback(seats);
    },
    (err) => {
      console.warn('Snapshot error on event seats:', err);
      if (onError) onError(err);
    }
  );
}

export interface SeatPurchaseItem {
  seatId: string;
  sectionId: string;
  sectionNumber: string;
  zoneName: string;
  rowLabel: string;
  seatNumber: number;
  price: number;
}

export const SEAT_LOCK_DURATION_MS = 8 * 60 * 1000; // 8 minutos

/** Límite máximo oficial de boletos por aficionado en una misma compra */
export const MAX_TICKETS_PER_PURCHASE = 5;

/**
 * Helper para obtener o generar un identificador persistente de dispositivo/navegador.
 * Evita desalineación de reservas si el aficionado selecciona asientos como invitado (guest)
 * y posteriormente inicia sesión con Google para pagar con tarjeta.
 */
export function getClientLockToken(): string {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let token = localStorage.getItem('vxp_client_lock_token');
    if (!token) {
      token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('vxp_client_lock_token', token);
    }
    return token;
  } catch {
    return 'guest_fallback';
  }
}

/**
 * Determina de forma infalible si una butaca está bloqueada por OTRO aficionado.
 * Nunca bloquea al mismo aficionado que la seleccionó, incluso si la seleccionó como 'guest',
 * antes de iniciar sesión con Google o si su token de sesión coincide.
 */
export function isSeatLockedByOther(
  seat: {
    status?: SeatStatus;
    lockedUntil?: number | null;
    lockedBy?: string | null;
    clientLockToken?: string | null;
  },
  currentUserId?: string | null,
  clientLockToken?: string | null,
  currentTimeMs: number = Date.now()
): boolean {
  if (seat.status !== 'reservado') return false;
  if (!seat.lockedUntil || seat.lockedUntil <= currentTimeMs) return false;
  if (!seat.lockedBy) return false;

  // Si el usuario actual coincide con el titular del lock
  if (currentUserId && currentUserId !== 'guest' && seat.lockedBy === currentUserId) {
    return false;
  }

  // Si fue reservada bajo sesión de invitado ('guest' o 'guest_...'), pertenece al flujo
  // de compra del comprador actual que está completando la transacción
  if (
    seat.lockedBy === 'guest' ||
    seat.lockedBy.startsWith('guest_') ||
    seat.lockedBy.startsWith('guest')
  ) {
    return false;
  }

  // Si coincide con el token persistente de este dispositivo/navegador
  if (clientLockToken) {
    if (seat.lockedBy === clientLockToken) return false;
    if (seat.clientLockToken && seat.clientLockToken === clientLockToken) return false;
  }

  return true;
}

export interface LockSeatParams {
  eventId: string;
  seatId: string;
  userId: string;
  sectionNumber: string;
  rowLabel: string;
  seatNumber: number;
  zoneName: string;
  sectionId?: string;
  clientLockToken?: string;
}

/**
 * Bloqueo atómico de asiento por 8 minutos usando runTransaction:
 * Si dos usuarios intentan apartar la misma butaca al mismo milisegundo, la transacción
 * otorga la reserva exclusiva de 8 minutos al primero y rechaza/notifica al segundo.
 */
export async function lockSeatSelectionTransaction(
  params: LockSeatParams
): Promise<{ success: boolean; lockedUntil: number }> {
  const { eventId, seatId, userId, sectionNumber, rowLabel, seatNumber, zoneName, sectionId, clientLockToken } = params;
  const seatRef = doc(db, 'eventSeats', seatId);
  const now = Date.now();
  const lockedUntil = now + SEAT_LOCK_DURATION_MS;
  const effectiveLockUser = userId && userId !== 'guest' ? userId : (clientLockToken || 'guest');

  return await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(seatRef);

    if (snap.exists()) {
      const data = snap.data() as EventSeat;

      // 1. Si ya está vendido, rechazar
      if (data.status === 'vendido') {
        throw new Error('SEAT_ALREADY_SOLD: Esta butaca ya ha sido vendida.');
      }

      // 2. Si está reservado por OTRO usuario y el bloqueo sigue activo
      const lockedByOther = isSeatLockedByOther(data, userId, clientLockToken, now);

      if (lockedByOther) {
        const remainingSeconds = Math.max(1, Math.ceil(((data.lockedUntil || now) - now) / 1000));
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        throw new Error(
          `SEAT_LOCKED_BY_OTHER: Esta butaca está bloqueada por otro usuario (tiempo restante: ${minutes}:${
            seconds < 10 ? '0' : ''
          }${seconds} min). Selecciona otra butaca.`
        );
      }

      // 3. El asiento está libre o el lock expiró o pertenece al mismo usuario: Bloquear por 8 minutos
      transaction.update(seatRef, {
        status: 'reservado',
        lockedUntil,
        lockedBy: effectiveLockUser,
        clientLockToken: clientLockToken || null,
        lockedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
    } else {
      // Si el documento aún no existía en Firestore, crearlo de forma atómica en estado 'reservado'
      transaction.set(seatRef, {
        id: seatId,
        eventId,
        sectionId: sectionId || '',
        sectionNumber,
        zoneName,
        rowLabel,
        seatNumber,
        status: 'reservado',
        lockedUntil,
        lockedBy: effectiveLockUser,
        clientLockToken: clientLockToken || null,
        lockedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      });
    }

    return { success: true, lockedUntil };
  });
}

/**
 * Libera el bloqueo de un asiento cuando el usuario lo deselecciona o cancela su carrito
 */
export async function releaseSeatLockTransaction(
  seatId: string,
  userId: string,
  clientLockToken?: string
): Promise<boolean> {
  const seatRef = doc(db, 'eventSeats', seatId);
  const now = Date.now();

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(seatRef);
      if (!snap.exists()) return;

      const data = snap.data() as EventSeat;
      // Solo liberamos si no está vendido y no está retenido por otro aficionado activo
      if (data.status === 'reservado') {
        const lockedByOther = isSeatLockedByOther(data, userId, clientLockToken, now);
        if (!lockedByOther) {
          transaction.update(seatRef, {
            status: 'disponible',
            lockedUntil: null,
            lockedBy: null,
            clientLockToken: null,
            lockedAt: null,
            updatedAt: new Date(now).toISOString(),
          });
        }
      }
    });
    return true;
  } catch (err) {
    console.warn('Advertencia liberando bloqueo de asiento:', err);
    return false;
  }
}

export interface PurchaseSeatsParams {
  userId: string;
  customerName: string;
  customerEmail?: string;
  event: VenueEvent;
  stadiumName: string;
  selectedSeats: SeatPurchaseItem[];
  paymentMethod: string;
  stripePaymentIntentId?: string;
  clientLockToken?: string;
}

export interface PurchaseResult {
  purchaseId: string;
  ticketIds: string[];
  totalAmount: number;
  count: number;
  tickets?: Ticket[];
}

/**
 * Compra múltiple atómica usando runTransaction de Firestore:
 * 1. Verifica en una sola lectura que todos los EventSeat sigan disponibles.
 * 2. Si alguno ya fue vendido, aborta limpiamente e informa los asientos conflictivos.
 * 3. En la misma transacción, marca/crea los asientos como 'vendido' y crea los Tickets
 *    asociados con un purchaseId compartido.
 * 4. Registra la auditoría en la colección sales.
 */
export async function purchaseSeatsTransaction(params: PurchaseSeatsParams): Promise<PurchaseResult> {
  const { userId, customerName, event, stadiumName, selectedSeats, paymentMethod, clientLockToken } = params;

  // 0. Comprobación automática de fecha del evento
  if (isEventPassed(event)) {
    throw new Error('EVENT_EXPIRED: La venta de boletos para este evento ha concluido automáticamente porque el juego o evento ya finalizó.');
  }

  if (!selectedSeats || selectedSeats.length === 0) {
    throw new Error('Debes seleccionar al menos un asiento.');
  }

  if (selectedSeats.length > MAX_TICKETS_PER_PURCHASE) {
    throw new Error(`LÍMITE EXCEDIDO: Solo se permite la compra de un máximo de ${MAX_TICKETS_PER_PURCHASE} boletos por aficionado.`);
  }

  const purchaseId = `PURCHASE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Ejecución atómica
  const result = await runTransaction(db, async (transaction) => {
    // 1. TODAS LAS LECTURAS PRIMERO (Regla estricta de Firestore Transaction)
    const seatSnapshots: { ref: any; seat: SeatPurchaseItem; isNew: boolean }[] = [];
    const unavailableSeats: string[] = [];
    const currentTimeMs = Date.now();

    for (const seat of selectedSeats) {
      const seatRef = doc(db, 'eventSeats', seat.seatId);
      const snap = await transaction.get(seatRef);

      if (!snap.exists()) {
        seatSnapshots.push({ ref: seatRef, seat, isNew: true });
        continue;
      }

      const data = snap.data() as EventSeat;
      const isSold = data.status === 'vendido';
      const isLockedByOther = isSeatLockedByOther(data, userId, clientLockToken, currentTimeMs);

      if (isSold || isLockedByOther) {
        unavailableSeats.push(
          `Sec ${seat.sectionNumber} - Fila ${seat.rowLabel} Asiento ${seat.seatNumber} (${
            isSold ? 'Vendido' : 'Reservado temporalmente por otro aficionado'
          })`
        );
        continue;
      }

      seatSnapshots.push({ ref: seatRef, seat, isNew: false });
    }

    if (unavailableSeats.length > 0) {
      const errorMsg = `SEAT_CONFLICT: Los siguientes asientos no están disponibles: ${unavailableSeats.join(
        ', '
      )}. Por favor deselecciónalos y elige otros asientos.`;
      throw new Error(errorMsg);
    }

    // 2. ESCRITURAS ATÓMICAS (Crear tickets y marcar status del asiento a 'vendido')
    const createdTicketIds: string[] = [];
    const createdTickets: Ticket[] = [];
    const stadiumZones = getStadiumZones(event.venueId, stadiumName, event.type);
    const isEncanto = isEncantoVenue(event.venueId, stadiumName, event.type);
    const qrPrefix = isEncanto ? 'DOR-2026-TKT-' : 'VND-2026-TKT-';

    for (const { ref: seatRef, seat, isNew } of seatSnapshots) {
      const ticketDocRef = doc(collection(db, 'tickets'));
      const qrId = `${qrPrefix}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const claimToken = `CLAIM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const secretSeed = `SEED-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const zoneMeta = stadiumZones[seat.zoneName];
      const gateResolved = zoneMeta?.gate || event.gate || 'Puertas Generales';

      const ticketData: Ticket = {
        id: ticketDocRef.id,
        userId,
        eventId: event.id,
        venueId: event.venueId,
        purchaseId,
        seatId: seat.seatId,
        matchTitle: event.name,
        opponent: event.opponent || '',
        matchDate: event.date,
        matchTime: event.time || '20:00 hrs',
        stadium: stadiumName,
        section: `${seat.zoneName} - Sec. ${seat.sectionNumber}`,
        row: `Fila ${seat.rowLabel}`,
        seat: `Asiento ${seat.seatNumber}`,
        price: seat.price,
        status: 'activo',
        qrId,
        claimToken,
        secretSeed,
        gate: gateResolved,
        createdAt: now,
        stripePaymentIntentId: params.stripePaymentIntentId || undefined,
        paymentStatus: 'paid',
        paymentMethod: paymentMethod || 'Tarjeta en Línea',
        customerName,
        customerEmail: params.customerEmail || undefined,
      };

      transaction.set(ticketDocRef, ticketData);

      if (isNew) {
        transaction.set(seatRef, {
          id: seat.seatId,
          eventId: event.id,
          sectionId: seat.sectionId || `${event.venueId}_sec_${seat.sectionNumber.replace(/\s+/g, '_')}`,
          sectionNumber: seat.sectionNumber,
          zoneName: seat.zoneName,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          status: 'vendido',
          ticketId: ticketDocRef.id,
          purchaseId,
          updatedAt: now,
          userId,
          lockedUntil: null,
          lockedBy: null,
          clientLockToken: null,
        });
      } else {
        transaction.update(seatRef, {
          status: 'vendido',
          ticketId: ticketDocRef.id,
          purchaseId,
          updatedAt: now,
          userId,
          lockedUntil: null,
          lockedBy: null,
          clientLockToken: null,
        });
      }

      createdTicketIds.push(ticketDocRef.id);
      createdTickets.push(ticketData);
    }

    return {
      purchaseId,
      ticketIds: createdTicketIds,
      totalAmount,
      count: selectedSeats.length,
      tickets: createdTickets,
    };
  });

  // 3. Auditoría de venta (en collection 'sales')
  try {
    await addDoc(collection(db, 'sales'), {
      channel: 'boletos',
      userId,
      venueId: event.venueId,
      eventId: event.id,
      referenceId: purchaseId,
      customerName,
      description: `Compra de ${selectedSeats.length} boleto(s) para ${event.name} (${selectedSeats
        .map((s) => `Sec ${s.sectionNumber} ${s.rowLabel}${s.seatNumber}`)
        .join(', ')})`,
      amount: totalAmount,
      paymentMethod,
      stripePaymentIntentId: params.stripePaymentIntentId || null,
      customerEmail: params.customerEmail || null,
      date: now,
      status: 'completada',
    });
  } catch (saleErr) {
    console.warn('Auditoría de venta registrada con advertencia:', saleErr);
  }

  return result;
}

/**
 * Reinicia todos los asientos y elimina los registros de ventas y boletos para un evento específico
 */
export async function resetEventSeatsAndSales(eventId: string): Promise<void> {
  const batch = writeBatch(db);

  // 1. Obtener y eliminar asientos bloqueados/vendidos de 'eventSeats'
  const eventSeatsQ = query(collection(db, 'eventSeats'), where('eventId', '==', eventId));
  const eventSeatsSnap = await getDocs(eventSeatsQ);
  eventSeatsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // 2. Obtener y eliminar boletos emitidos de 'tickets'
  const ticketsQ = query(collection(db, 'tickets'), where('eventId', '==', eventId));
  const ticketsSnap = await getDocs(ticketsQ);
  ticketsSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // 3. Obtener y eliminar registros de ventas de 'sales'
  const salesQ = query(collection(db, 'sales'), where('eventId', '==', eventId));
  const salesSnap = await getDocs(salesQ);
  salesSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // Ejecutar el lote
  await batch.commit();
}

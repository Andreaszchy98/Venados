import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { StadiumStand, MenuItem } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { DEFAULT_VENUE_ID } from './constants';
import { getCachedData, setCachedData, invalidateCache } from './clientCache';
import { normalizeGoogleDriveImageUrl } from './imageUtils';

const STANDS_COLLECTION = 'stands';
const MENU_COLLECTION = 'menuItems';

// =========================================================================================
// ⚠️ DATOS CANÓNICOS POR SEDE - CADA NEGOCIO PERTENECE A UNA SEDE/ESTADIO ESPECÍFICO
// Ningún negocio puede compartirse ni mezclarse entre recintos deportivos.
// =========================================================================================
export const INITIAL_STANDS: StadiumStand[] = [
  // 1. Estadio Teodoro Mariscal (DEFAULT_VENUE_ID)
  {
    id: 'stand-mariscos-muchacho-alegre',
    venueId: DEFAULT_VENUE_ID,
    name: 'Mariscos El Muchacho Alegre - Estadio',
    location: 'Explanada Principal - Puerta 3',
    categoryTag: 'Mariscos & Botaneros',
    active: true,
    estimatedWaitMinutes: 12,
    image: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:01.000Z',
  },
  {
    id: 'stand-asador-venados-bbq',
    venueId: DEFAULT_VENUE_ID,
    name: 'Asador Venados BBQ & Tacos',
    location: 'Zona Central - Planta Baja Pasillo 5',
    categoryTag: 'Tacos & Parrilla',
    active: true,
    estimatedWaitMinutes: 8,
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:02.000Z',
  },
  {
    id: 'stand-barra-pacifico',
    venueId: DEFAULT_VENUE_ID,
    name: 'Barra 21 Cervecería Pacífico',
    location: 'Zona Lateral Poniente y Palcos',
    categoryTag: 'Cerveza & Coctelería',
    active: true,
    estimatedWaitMinutes: 3,
    image: 'https://images.unsplash.com/photo-1608270199996-51f786fa05d8?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:03.000Z',
  },
  // 2. Estadio Tomateros de Culiacán ('venue-tomateros')
  {
    id: 'stand-tomateros-culichi-sushi',
    venueId: 'venue-tomateros',
    name: 'Sushi & Roll Culichi Tomateros',
    location: 'Nivel Central - Pasillo Principal',
    categoryTag: 'Mariscos & Botaneros',
    active: true,
    estimatedWaitMinutes: 10,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:10.000Z',
  },
  {
    id: 'stand-tomateros-asador-guinda',
    venueId: 'venue-tomateros',
    name: 'Asador Nación Guinda BBQ',
    location: 'Zona Lateral 1ra Base',
    categoryTag: 'Tacos & Parrilla',
    active: true,
    estimatedWaitMinutes: 8,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:11.000Z',
  },
  {
    id: 'stand-tomateros-barra-guinda',
    venueId: 'venue-tomateros',
    name: 'Barra Oficial Cerveza Guinda',
    location: 'Herraje Central y Suites',
    categoryTag: 'Cerveza & Coctelería',
    active: true,
    estimatedWaitMinutes: 3,
    image: 'https://images.unsplash.com/photo-1608270199996-51f786fa05d8?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:12.000Z',
  },
  // 3. Estadio El Encanto ('venue-encanto')
  {
    id: 'stand-encanto-tacos-gran-pez',
    venueId: 'venue-encanto',
    name: 'Tacos de Asada El Gran Pez',
    location: 'Cabecera Norte - Puerta 1',
    categoryTag: 'Tacos & Parrilla',
    active: true,
    estimatedWaitMinutes: 7,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:20.000Z',
  },
  {
    id: 'stand-encanto-mariscos-dorados',
    venueId: 'venue-encanto',
    name: 'Mariscos Dorados Sinaloa',
    location: 'Zona Poniente - Planta Baja',
    categoryTag: 'Mariscos & Botaneros',
    active: true,
    estimatedWaitMinutes: 9,
    image: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:21.000Z',
  },
  {
    id: 'stand-encanto-barra-dorada',
    venueId: 'venue-encanto',
    name: 'Barra Dorada Estadio El Encanto',
    location: 'Zona Oriente Alta',
    categoryTag: 'Cerveza & Coctelería',
    active: true,
    estimatedWaitMinutes: 3,
    image: 'https://images.unsplash.com/photo-1608270119293-1b9195b45265?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:22.000Z',
  },
];

const INITIAL_MENU_ITEMS: Record<string, Omit<MenuItem, 'id' | 'standId' | 'createdAt'>[]> = {
  'Mariscos El Muchacho Alegre - Estadio': [
    {
      name: 'Aguachile Negro de Camarón Mazatleco',
      description: 'Camarón fresco curtido en limón con salsa negra de chiltepín, cebolla morada y pepino.',
      price: 195,
      category: 'comida',
      available: true,
      prepTimeMinutes: 10,
      image: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Tostada de Ceviche de Sierra con Zanahoria',
      description: 'El clásico sabor del puerto servido con aguacate y salsa guacamaya.',
      price: 95,
      category: 'comida',
      available: true,
      prepTimeMinutes: 5,
      image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Clamato Preparado con Camarón',
      description: 'Clamato con salsas de la casa, limón, escarchado con tajín y brocheta de camarón.',
      price: 140,
      category: 'bebida',
      available: true,
      prepTimeMinutes: 4,
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Asador Venados BBQ & Tacos': [
    {
      name: 'Orden de 3 Tacos de Asada Mazatlán',
      description: 'Tortilla de maíz recién hecha, carne marinada al carbón, repollo, guacamole y salsa tatemada.',
      price: 160,
      category: 'comida',
      available: true,
      prepTimeMinutes: 8,
      image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Vampiro de Asada con Queso Fundido',
      description: 'Tostada crujiente con base de queso derretido, frijoles refritos y asada norteña.',
      price: 85,
      category: 'comida',
      available: true,
      prepTimeMinutes: 6,
      image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Papas Asadas Rellenas con Carne',
      description: 'Papa envuelta en aluminio con mantequilla, crema, tocino, queso y carne asada.',
      price: 135,
      category: 'comida',
      available: true,
      prepTimeMinutes: 7,
      image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Snacks & Hot Dogs Teodoro Mariscal': [
    {
      name: 'Hot Dog Jumbo Venados Especial',
      description: 'Salchicha de res envuelta en tocino, cebolla caramelizada, tomate, jalapeño y aderezo especial.',
      price: 110,
      category: 'comida',
      available: true,
      prepTimeMinutes: 5,
      image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Nachos con Queso Caliente y Jalapeño',
      description: 'Totopos crujientes de maíz bañados en queso cheddar derretido.',
      price: 85,
      category: 'snack',
      available: true,
      prepTimeMinutes: 3,
      image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Palomitas Grandes con Mantequilla',
      description: 'Cubeta jumbo con mantequilla derretida.',
      price: 75,
      category: 'snack',
      available: true,
      prepTimeMinutes: 2,
      image: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Barra 21 Cervecería Pacífico': [
    {
      name: 'Cerveza Pacífico Clara de Barril (Litro)',
      description: 'Fría de barril en vaso conmemorativo Venados 1 Litro.',
      price: 120,
      category: 'cerveza',
      available: true,
      prepTimeMinutes: 2,
      image: 'https://images.unsplash.com/photo-1608270199996-51f786fa05d8?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Michelada Especial Pacífico 1L',
      description: 'Preparada con limón, sal, salsas negras y escarchada de chamoy.',
      price: 150,
      category: 'cerveza',
      available: true,
      prepTimeMinutes: 3,
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Agua Embotellada 1L / Refresco',
      description: 'Agua purificada fría o refresco de lata a elegir.',
      price: 45,
      category: 'bebida',
      available: true,
      prepTimeMinutes: 1,
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    },
  ],
  // 2. Estadio Tomateros de Culiacán ('venue-tomateros')
  'Sushi & Roll Culichi Tomateros': [
    {
      name: 'Roll Culichi Especial Estadio',
      description: 'Rollo empanizado relleno de carne asada y camarón con aguacate y queso crema, bañado en salsa de anguila.',
      price: 185,
      category: 'comida',
      available: true,
      prepTimeMinutes: 12,
      image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Roll Horneado Nación Guinda',
      description: 'Rollo horneado con topping de salmón y cangrejo bañado en aderezo spicy y ajonjolí tostado.',
      price: 195,
      category: 'comida',
      available: true,
      prepTimeMinutes: 14,
      image: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Kushiages de Queso Manchego (3 pzas)',
      description: 'Brochetas empanizadas de queso derretido acompañadas de salsa kushiage.',
      price: 95,
      category: 'snack',
      available: true,
      prepTimeMinutes: 5,
      image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Té Jazmín Frío con Limón 1L',
      description: 'Té negro con jazmín helado, toque de limón y endulzado al gusto.',
      price: 60,
      category: 'bebida',
      available: true,
      prepTimeMinutes: 2,
      image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Asador Nación Guinda BBQ': [
    {
      name: 'Tacos de Asada Culiacán (3 pzas)',
      description: 'Carne de res selecta asada al carbón en tortilla de harina con frijoles puercos y guacamole.',
      price: 170,
      category: 'comida',
      available: true,
      prepTimeMinutes: 8,
      image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Dogo Culichi Gigante con Tocino',
      description: 'Salchicha de res envuelta en tocino crujiente, cebolla guisada, tomate y aderezo especial.',
      price: 110,
      category: 'comida',
      available: true,
      prepTimeMinutes: 6,
      image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Nachos con Carne Asada y Queso',
      description: 'Totopos bañados en queso caliente con porción generosa de carne asada y jalapeños.',
      price: 135,
      category: 'snack',
      available: true,
      prepTimeMinutes: 5,
      image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Barra Oficial Cerveza Guinda': [
    {
      name: 'Cerveza de Barril Guinda 1L',
      description: 'Cerveza bien fría servida en vaso conmemorativo Tomateros.',
      price: 120,
      category: 'cerveza',
      available: true,
      prepTimeMinutes: 2,
      image: 'https://images.unsplash.com/photo-1608270199996-51f786fa05d8?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Michelada Guinda Especial 1L',
      description: 'Preparada con clamato, salsa inglesa, limón, sal y escarchado de chamoy.',
      price: 155,
      category: 'cerveza',
      available: true,
      prepTimeMinutes: 3,
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Agua Purificada / Refresco 600ml',
      description: 'Bebidas refrescantes frías.',
      price: 45,
      category: 'bebida',
      available: true,
      prepTimeMinutes: 1,
      image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    },
  ],
  // 3. Estadio El Encanto ('venue-encanto')
  'Tacos de Asada El Gran Pez': [
    {
      name: 'Orden de 3 Tacos Dorados de Asada El Gran Pez',
      description: 'Tortilla dorada al comal con carne asada, repollo, guacamole y salsa tatemada.',
      price: 160,
      category: 'comida',
      available: true,
      prepTimeMinutes: 7,
      image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Quesadilla Gigante El Gran Pez',
      description: 'Tortilla de harina grande con costra de queso y carne asada marinada.',
      price: 140,
      category: 'comida',
      available: true,
      prepTimeMinutes: 7,
      image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Mariscos Dorados Sinaloa': [
    {
      name: 'Ceviche de Camarón El Encanto',
      description: 'Camarón fresco con tomate, cebolla, pepino y cilantro bañado en jugo de limón.',
      price: 180,
      category: 'comida',
      available: true,
      prepTimeMinutes: 8,
      image: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Tostada de Atún Marinado Fresco',
      description: 'Atún fresco en cubos marinado con soya, limón, aguacate y ajonjolí.',
      price: 120,
      category: 'comida',
      available: true,
      prepTimeMinutes: 5,
      image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    },
  ],
  'Barra Dorada Estadio El Encanto': [
    {
      name: 'Cerveza de Barril El Encanto 1L',
      description: 'Cerveza clara helada servida en vaso conmemorativo del estadio.',
      price: 120,
      category: 'cerveza',
      available: true,
      prepTimeMinutes: 2,
      image: 'https://images.unsplash.com/photo-1608270119293-1b9195b45265?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Michelada El Gran Pez 1L',
      description: 'Preparada al estilo sinaloense con limón, sal y salsas negras.',
      price: 150,
      category: 'cerveza',
      available: true,
      prepTimeMinutes: 3,
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
    },
  ],
};

/**
 * Ordena puestos/negocios cronológicamente según su fecha de creación ascendente
 * (el primer negocio creado se ubica en 1° lugar, luego el 2°, 3°, 4°, etc.)
 */
export function sortStandsChronologically(a: StadiumStand, b: StadiumStand): number {
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (!isNaN(timeA) && !isNaN(timeB) && timeA > 0 && timeB > 0 && timeA !== timeB) {
    return timeA - timeB; // Ascendente: más antiguo / primer creado primero
  }
  if (timeA > 0 && (!timeB || isNaN(timeB) || timeB === 0)) return -1;
  if (timeB > 0 && (!timeA || isNaN(timeA) || timeA === 0)) return 1;
  return (a.name || '').localeCompare(b.name || '');
}

export async function getStadiumStands(venueId?: string): Promise<StadiumStand[]> {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  const isMariscal = targetVenueId === DEFAULT_VENUE_ID;
  const cacheKey = `concessions_stands_${targetVenueId}`;

  // 1. Revisar caché local primero
  const cached = getCachedData<StadiumStand[]>(cacheKey);
  if (cached && cached.length > 0) {
    const sortedCached = [...cached].sort(sortStandsChronologically);
    return sortedCached;
  }

  try {
    const q = query(
      collection(db, STANDS_COLLECTION),
      where('venueId', '==', targetVenueId),
      limit(150)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      // Si hay negocios iniciales definidos para esta sede, sembrarlos con su sede exacta
      const initialForVenue = INITIAL_STANDS.filter(
        (s) => (s.venueId || DEFAULT_VENUE_ID) === targetVenueId
      );

      if (initialForVenue.length > 0) {
        try {
          const seeded = await seedInitialStandsAndMenu(targetVenueId);
          const match = seeded.filter(
            (s) => (s.venueId || DEFAULT_VENUE_ID) === targetVenueId
          );
          match.sort(sortStandsChronologically);
          setCachedData(cacheKey, match, 15);
          return match;
        } catch (seedErr) {
          console.warn('Error sembrando puestos para la sede:', seedErr);
          const fallback = [...initialForVenue].sort(sortStandsChronologically);
          setCachedData(cacheKey, fallback, 15);
          return fallback;
        }
      }

      return [];
    }

    const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StadiumStand[];

    // Aislamiento estricto: asegurar en memoria que no haya puestos de otra sede
    const venueFilteredDocs = allDocs.filter(
      (s) => (s.venueId || DEFAULT_VENUE_ID) === targetVenueId
    );

    if (venueFilteredDocs.length === 0) {
      return [];
    }

    // Deduplicar únicamente por ID de documento
    const uniqueMap = new Map<string, StadiumStand>();
    for (const s of venueFilteredDocs) {
      if (!uniqueMap.has(s.id)) {
        uniqueMap.set(s.id, s);
      }
    }
    const deduplicated = Array.from(uniqueMap.values());

    // Ordenar de manera cronológica estricta: primer creado -> segundo -> tercero -> etc.
    deduplicated.sort(sortStandsChronologically);

    setCachedData(cacheKey, deduplicated, 15);
    return deduplicated;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, STANDS_COLLECTION);
    const initialForVenue = INITIAL_STANDS.filter(
      (s) => (s.venueId || DEFAULT_VENUE_ID) === targetVenueId
    );
    if (initialForVenue.length > 0) {
      const fallback = [...initialForVenue].sort(sortStandsChronologically);
      setCachedData(cacheKey, fallback, 10);
      return fallback;
    }
    return [];
  }
}

/**
 * Mantenimiento de puestos: nunca elimina negocios legítimos creados por el administrador
 */
export async function cleanupDuplicateStands(): Promise<void> {
  // No-op de seguridad para no eliminar ningún negocio creado por el administrador
}

// =========================================================================================
// ⚠️ DATOS POR DEFECTO - DETERMINISTAS EXCLUSIVOS POR CADA SEDE
// Cada negocio pertenece a una sede/estadio en específico y preserva su propio venueId.
// =========================================================================================
export async function seedInitialStandsAndMenu(targetVenueId?: string): Promise<StadiumStand[]> {
  const createdStands: StadiumStand[] = [];
  const now = new Date().toISOString();

  const standsToSeed = targetVenueId
    ? INITIAL_STANDS.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === targetVenueId)
    : INITIAL_STANDS;

  for (const standData of standsToSeed) {
    const standDocRef = doc(db, STANDS_COLLECTION, standData.id);
    const snap = await getDoc(standDocRef);
    const standVenue = standData.venueId || DEFAULT_VENUE_ID;

    if (!snap.exists()) {
      const fullStand: StadiumStand = {
        ...standData,
        venueId: standVenue,
        createdAt: standData.createdAt || now,
        updatedAt: now,
      };
      await setDoc(standDocRef, fullStand);
      createdStands.push(fullStand);

      // Sembrar menú solo si el stand es nuevo
      const menuList = INITIAL_MENU_ITEMS[standData.name] || [];
      for (let idx = 0; idx < menuList.length; idx++) {
        const item = menuList[idx];
        const itemDocRef = doc(db, MENU_COLLECTION, `menu-${standData.id}-${idx + 1}`);
        const itemSnap = await getDoc(itemDocRef);
        if (!itemSnap.exists()) {
          const fullItem: MenuItem = {
            ...item,
            id: `menu-${standData.id}-${idx + 1}`,
            standId: standData.id,
            venueId: standVenue,
            createdAt: now,
          };
          await setDoc(itemDocRef, fullItem);
        }
      }
    } else {
      createdStands.push({ id: snap.id, ...snap.data() } as StadiumStand);
    }
  }

  return createdStands;
}

export async function getMenuItemsByStand(standId: string): Promise<MenuItem[]> {
  const cacheKey = `concessions_menu_stand_${standId}`;
  const cached = getCachedData<MenuItem[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const q = query(
      collection(db, MENU_COLLECTION),
      where('standId', '==', standId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      // Fallback con datos de muestra para el puesto si aún no se han sembrado en Firestore
      const initialStand = INITIAL_STANDS.find((s) => s.id === standId);
      if (initialStand && INITIAL_MENU_ITEMS[initialStand.name]) {
        const fallbackItems = INITIAL_MENU_ITEMS[initialStand.name].map((item, idx) => ({
          ...item,
          id: `menu-${standId}-${idx + 1}`,
          standId,
          venueId: initialStand.venueId || DEFAULT_VENUE_ID,
          createdAt: '2026-01-01T00:00:00.000Z',
          image: normalizeGoogleDriveImageUrl(item.image) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
        })) as MenuItem[];
        setCachedData(cacheKey, fallbackItems, 15);
        return fallbackItems;
      }
      return [];
    }

    const result = snap.docs.map((d) => {
      const data = d.data() as MenuItem;
      return {
        ...data,
        id: d.id,
        image: normalizeGoogleDriveImageUrl(data.image) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
      };
    });
    setCachedData(cacheKey, result, 15);
    return result;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, MENU_COLLECTION);
    const initialStand = INITIAL_STANDS.find((s) => s.id === standId);
    if (initialStand && INITIAL_MENU_ITEMS[initialStand.name]) {
      return INITIAL_MENU_ITEMS[initialStand.name].map((item, idx) => ({
        ...item,
        id: `menu-${standId}-${idx + 1}`,
        standId,
        venueId: initialStand.venueId || DEFAULT_VENUE_ID,
        createdAt: '2026-01-01T00:00:00.000Z',
        image: normalizeGoogleDriveImageUrl(item.image) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
      })) as MenuItem[];
    }
    return [];
  }
}

export async function getAllMenuItems(venueId?: string): Promise<MenuItem[]> {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  const cacheKey = `concessions_menu_venue_${targetVenueId}`;
  const cached = getCachedData<MenuItem[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const q = venueId
      ? query(collection(db, MENU_COLLECTION), where('venueId', '==', venueId), limit(150))
      : query(collection(db, MENU_COLLECTION), limit(150));
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => {
      const data = d.data() as MenuItem;
      return {
        ...data,
        id: d.id,
        image: normalizeGoogleDriveImageUrl(data.image) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
      };
    });

    // Si no hay items con venueId explícito guardados en Firestore,
    // filtrar según los stands registrados para esta sede
    if (items.length === 0 && venueId) {
      const stands = await getStadiumStands(venueId);
      const standIds = new Set(stands.map((s) => s.id));
      if (standIds.size > 0) {
        const allSnap = await getDocs(query(collection(db, MENU_COLLECTION), limit(150)));
        items = allSnap.docs.map((d) => {
          const data = d.data() as MenuItem;
          return {
            ...data,
            id: d.id,
            image: normalizeGoogleDriveImageUrl(data.image) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
          };
        }).filter((i) => standIds.has(i.standId));
      } else {
        items = [];
      }
    }
    setCachedData(cacheKey, items, 15);
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, MENU_COLLECTION);
    return [];
  }
}

export async function toggleMenuItemAvailability(itemId: string, available: boolean): Promise<void> {
  try {
    const docRef = doc(db, MENU_COLLECTION, itemId);
    await setDoc(docRef, { available, updatedAt: new Date().toISOString() }, { merge: true });
    invalidateCache('concessions_menu_');
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${MENU_COLLECTION}/${itemId}`);
  }
}

export async function saveMenuItem(
  itemData: Partial<MenuItem> & { name: string; price: number; standId: string; venueId?: string }
): Promise<MenuItem> {
  const now = new Date().toISOString();
  try {
    let itemId = itemData.id;
    let docRef: any;
    const normalizedImage = itemData.image ? normalizeGoogleDriveImageUrl(itemData.image) : undefined;
    const cleanedData = {
      ...(itemData as Record<string, any>),
      ...(normalizedImage ? { image: normalizedImage } : {}),
      updatedAt: now,
    };

    if (itemId) {
      docRef = doc(db, MENU_COLLECTION, itemId);
      await setDoc(docRef, sanitizeFirestoreData(cleanedData), { merge: true });
    } else {
      docRef = doc(collection(db, MENU_COLLECTION));
      itemId = docRef.id;
      const newItem: MenuItem = {
        id: itemId,
        standId: itemData.standId,
        venueId: itemData.venueId || DEFAULT_VENUE_ID,
        name: itemData.name,
        description: itemData.description || '',
        price: Number(itemData.price) || 0,
        category: itemData.category || 'comida',
        available: itemData.available !== undefined ? itemData.available : true,
        image: normalizedImage || itemData.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
        prepTimeMinutes: Number(itemData.prepTimeMinutes) || 5,
        createdAt: now,
      };
      await setDoc(docRef, sanitizeFirestoreData(newItem));
    }

    const snap = await getDoc(docRef);
    const rawData = (snap.data() as Record<string, any>) || {};
    const saved: MenuItem = {
      id: docRef.id,
      ...rawData,
      image: normalizeGoogleDriveImageUrl(rawData.image) || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
    } as MenuItem;

    invalidateCache('concessions_menu_');
    invalidateCache('concessions_');
    return saved;
  } catch (err) {
    handleFirestoreError(err, itemData.id ? OperationType.UPDATE : OperationType.CREATE, MENU_COLLECTION);
    throw err;
  }
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  try {
    const docRef = doc(db, MENU_COLLECTION, itemId);
    await deleteDoc(docRef);
    invalidateCache('concessions_menu_');
    invalidateCache('concessions_');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${MENU_COLLECTION}/${itemId}`);
  }
}

/**
 * Crear un nuevo puesto / negocio de estadio
 */
export async function createStadiumStand(
  standData: Omit<StadiumStand, 'id' | 'createdAt'> | (Omit<StadiumStand, 'id' | 'createdAt' | 'venueId'> & { venueId?: string })
): Promise<StadiumStand> {
  try {
    const docRef = doc(collection(db, STANDS_COLLECTION));
    const now = new Date().toISOString();
    const newStand: StadiumStand = {
      ...standData,
      venueId: (standData as any).venueId || DEFAULT_VENUE_ID,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(docRef, sanitizeFirestoreData(newStand));
    invalidateCache('concessions_');
    return newStand;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, STANDS_COLLECTION);
    throw err;
  }
}

/**
 * Actualizar datos de un puesto / negocio de estadio
 */
export async function updateStadiumStand(
  standId: string,
  updates: Partial<StadiumStand>
): Promise<void> {
  try {
    const docRef = doc(db, STANDS_COLLECTION, standId);
    const initialDefault = INITIAL_STANDS.find((s) => s.id === standId);
    const payload = {
      ...(initialDefault || {}),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, sanitizeFirestoreData(payload), { merge: true });
    invalidateCache('concessions_');
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${STANDS_COLLECTION}/${standId}`);
  }
}

/**
 * Activar / Desactivar operaciones de un puesto
 */
export async function toggleStandActive(standId: string, active: boolean): Promise<void> {
  try {
    const docRef = doc(db, STANDS_COLLECTION, standId);
    const initialDefault = INITIAL_STANDS.find((s) => s.id === standId);
    const payload = {
      ...(initialDefault || {}),
      active,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, sanitizeFirestoreData(payload), { merge: true });
    invalidateCache('concessions_');
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${STANDS_COLLECTION}/${standId}`);
  }
}

/**
 * Eliminar un puesto del estadio (y opcionalmente sus platillos de menú)
 */
export async function deleteStadiumStand(standId: string): Promise<void> {
  try {
    const docRef = doc(db, STANDS_COLLECTION, standId);
    await deleteDoc(docRef);

    // Eliminar items del menú asociados
    try {
      const q = query(collection(db, MENU_COLLECTION), where('standId', '==', standId));
      const snap = await getDocs(q);
      for (const itemDoc of snap.docs) {
        await deleteDoc(itemDoc.ref);
      }
    } catch (e) {
      console.warn('Error limpiando items del menú para stand eliminado:', e);
    }
    invalidateCache('concessions_');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${STANDS_COLLECTION}/${standId}`);
  }
}

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

const STANDS_COLLECTION = 'stands';
const MENU_COLLECTION = 'menuItems';

// =========================================================================================
// ⚠️ DATOS DE MUESTRA CANÓNICOS - EXCLUSIVOS DEL ESTADIO TEODORO MARISCAL (DEFAULT_VENUE_ID)
// Estos negocios son propios y representativos exclusivamente del Estadio Teodoro Mariscal
// en Mazatlán. NO son un fallback genérico ni deben sembrarse o devolverse para ninguna
// otra sede deportiva o estadio (ej. venue-encanto).
// =========================================================================================
export const INITIAL_STANDS: StadiumStand[] = [
  {
    id: 'stand-mariscos-muchacho-alegre',
    venueId: DEFAULT_VENUE_ID,
    name: 'Mariscos El Muchacho Alegre - Estadio',
    location: 'Explanada Principal - Puerta 3',
    categoryTag: 'Mariscos & Botaneros',
    active: true,
    estimatedWaitMinutes: 12,
    image: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
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
    createdAt: '2026-01-01T00:00:00.000Z',
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
    createdAt: '2026-01-01T00:00:00.000Z',
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
};

export async function getStadiumStands(venueId?: string): Promise<StadiumStand[]> {
  const isMariscal = !venueId || venueId === DEFAULT_VENUE_ID;
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  const cacheKey = `concessions_stands_${targetVenueId}`;

  // 1. Revisar caché local primero
  const cached = getCachedData<StadiumStand[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const q = venueId
      ? query(collection(db, STANDS_COLLECTION), where('venueId', '==', venueId), limit(50))
      : query(collection(db, STANDS_COLLECTION), limit(50));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Si la sede solicitada es distinta al Mariscal (ej. venue-encanto) y no tiene negocios
      // registrados en Firestore, DEBE devolverse un arreglo VACÍO. NUNCA sembrar ni retornar
      // los negocios del Mariscal como fallback.
      if (!isMariscal) {
        return [];
      }

      // Únicamente para el Estadio Teodoro Mariscal sembramos sus datos de muestra iniciales
      try {
        const seeded = await seedInitialStandsAndMenu();
        const match = seeded.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === DEFAULT_VENUE_ID);
        const result = match.slice(0, 3);
        setCachedData(cacheKey, result, 15);
        return result;
      } catch (seedErr) {
        console.warn('No se pudieron sembrar los puestos en Firestore para Mariscal. Usando datos iniciales:', seedErr);
        const fallback = INITIAL_STANDS.slice(0, 3);
        setCachedData(cacheKey, fallback, 15);
        return fallback;
      }
    }

    const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StadiumStand[];

    // Si se especificó una sede, asegurar en memoria que no haya puestos de otra sede
    const venueFilteredDocs = venueId
      ? allDocs.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === venueId)
      : allDocs;

    if (venueFilteredDocs.length === 0) {
      return [];
    }

    // Deduplicar estrictamente por nombre o ID para garantizar exactamente un puesto por concepto
    const uniqueMap = new Map<string, StadiumStand>();
    for (const s of venueFilteredDocs) {
      const key = (s.name || '').trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    }
    const deduplicated = Array.from(uniqueMap.values());

    // Solo para el Mariscal limitamos canónicamente a 3 y realizamos mantenimiento si acumuló duplicados
    if (isMariscal) {
      if (allDocs.length > 3) {
        cleanupDuplicateStands().catch(() => {});
      }
      const result = deduplicated.slice(0, 3);
      setCachedData(cacheKey, result, 15);
      return result;
    }

    setCachedData(cacheKey, deduplicated, 15);
    return deduplicated;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, STANDS_COLLECTION);
    // En caso de fallo de red: solo devolver datos de muestra si es la sede del Mariscal.
    // Para cualquier otra sede solicitada explícitamente, siempre retornar arreglo vacío.
    if (isMariscal) {
      const fallback = INITIAL_STANDS.slice(0, 3);
      setCachedData(cacheKey, fallback, 10);
      return fallback;
    }
    return [];
  }
}

/**
 * Limpia y consolida puestos en Firestore dejando únicamente los 3 concesionarios canónicos del Teodoro Mariscal.
 * Respeta escrupulosamente los negocios de otras sedes (ej. venue-encanto) sin tocarlos ni eliminarlos.
 */
export async function cleanupDuplicateStands(): Promise<void> {
  try {
    const standsSnap = await getDocs(collection(db, STANDS_COLLECTION));
    const canonicalIds = new Set(INITIAL_STANDS.map((s) => s.id));
    const seenNames = new Set<string>();

    for (const d of standsSnap.docs) {
      const data = d.data() as StadiumStand;
      const standVenue = data.venueId || DEFAULT_VENUE_ID;

      // NUNCA tocar o eliminar puestos creados para otras sedes
      if (standVenue !== DEFAULT_VENUE_ID) {
        continue;
      }

      const normalizedName = (data.name || '').trim().toLowerCase();

      // Si no es un ID canónico o ya procesamos un puesto con este nombre en Mariscal, borrar duplicado
      const isExtraOrDuplicate = !canonicalIds.has(d.id) || seenNames.has(normalizedName);
      if (isExtraOrDuplicate) {
        await deleteDoc(d.ref).catch(() => {});
        // Limpiar items de menú que dependían del ID duplicado
        try {
          const menuSnap = await getDocs(
            query(collection(db, MENU_COLLECTION), where('standId', '==', d.id))
          );
          for (const mDoc of menuSnap.docs) {
            await deleteDoc(mDoc.ref).catch(() => {});
          }
        } catch {}
      } else {
        seenNames.add(normalizedName);
      }
    }

    // Asegurar que los 3 concesionarios canónicos de Mariscal existen con sus IDs deterministas
    await seedInitialStandsAndMenu();
  } catch (err) {
    console.warn('cleanupDuplicateStands: Nota durante la consolidación de puestos del Mariscal:', err);
  }
}

// =========================================================================================
// ⚠️ DATOS POR DEFECTO - DETERMINISTAS EXCLUSIVOS DEL ESTADIO TEODORO MARISCAL (DEFAULT_VENUE_ID)
// Sembrado determinista únicamente para el Estadio Teodoro Mariscal.
// =========================================================================================
export async function seedInitialStandsAndMenu(): Promise<StadiumStand[]> {
  const createdStands: StadiumStand[] = [];
  const now = new Date().toISOString();

  for (const standData of INITIAL_STANDS) {
    const standDocRef = doc(db, STANDS_COLLECTION, standData.id);
    const fullStand: StadiumStand = {
      ...standData,
      venueId: DEFAULT_VENUE_ID,
      createdAt: standData.createdAt || now,
      updatedAt: now,
    };
    await setDoc(standDocRef, fullStand, { merge: true });
    createdStands.push(fullStand);

    // Sembrar menú con IDs deterministas para evitar duplicados
    const menuList = INITIAL_MENU_ITEMS[standData.name] || [];
    for (let idx = 0; idx < menuList.length; idx++) {
      const item = menuList[idx];
      const itemDocRef = doc(db, MENU_COLLECTION, `menu-${standData.id}-${idx + 1}`);
      const fullItem: MenuItem = {
        ...item,
        id: `menu-${standData.id}-${idx + 1}`,
        standId: standData.id,
        venueId: DEFAULT_VENUE_ID,
        createdAt: now,
      };
      await setDoc(itemDocRef, fullItem, { merge: true });
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
    const result = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];
    setCachedData(cacheKey, result, 15);
    return result;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, MENU_COLLECTION);
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
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];

    // Si no hay items con venueId explícito guardados en Firestore,
    // filtrar según los stands registrados para esta sede
    if (items.length === 0 && venueId) {
      const stands = await getStadiumStands(venueId);
      const standIds = new Set(stands.map((s) => s.id));
      if (standIds.size > 0) {
        const allSnap = await getDocs(query(collection(db, MENU_COLLECTION), limit(150)));
        items = (allSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[]).filter((i) => standIds.has(i.standId));
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
    await updateDoc(docRef, { available });
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
    if (itemData.id) {
      const docRef = doc(db, MENU_COLLECTION, itemData.id);
      await updateDoc(docRef, sanitizeFirestoreData(itemData));
      return itemData as MenuItem;
    } else {
      const docRef = doc(collection(db, MENU_COLLECTION));
      const newItem: MenuItem = {
        id: docRef.id,
        standId: itemData.standId,
        venueId: itemData.venueId || DEFAULT_VENUE_ID,
        name: itemData.name,
        description: itemData.description || '',
        price: Number(itemData.price) || 0,
        category: itemData.category || 'comida',
        available: itemData.available !== undefined ? itemData.available : true,
        image: itemData.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
        prepTimeMinutes: Number(itemData.prepTimeMinutes) || 5,
        createdAt: now,
      };
      await setDoc(docRef, sanitizeFirestoreData(newItem));
      return newItem;
    }
  } catch (err) {
    handleFirestoreError(err, itemData.id ? OperationType.UPDATE : OperationType.CREATE, MENU_COLLECTION);
  }
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  try {
    const docRef = doc(db, MENU_COLLECTION, itemId);
    await deleteDoc(docRef);
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
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, sanitizeFirestoreData(payload));
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
    await updateDoc(docRef, {
      active,
      updatedAt: new Date().toISOString(),
    });
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

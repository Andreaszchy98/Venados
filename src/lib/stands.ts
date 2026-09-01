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
} from 'firebase/firestore';
import { db } from './firebase';
import { StadiumStand, MenuItem } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';

const STANDS_COLLECTION = 'stands';
const MENU_COLLECTION = 'menuItems';

const INITIAL_STANDS: Omit<StadiumStand, 'id' | 'createdAt'>[] = [
  {
    name: 'Mariscos El Muchacho Alegre - Estadio',
    location: 'Explanada Principal - Puerta 3',
    categoryTag: 'Mariscos & Botaneros',
    active: true,
    estimatedWaitMinutes: 12,
    image: 'https://images.unsplash.com/photo-1535400255456-984241443b29?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Asador Venados BBQ & Tacos',
    location: 'Zona Central - Planta Baja Pasillo 5',
    categoryTag: 'Tacos & Parrilla',
    active: true,
    estimatedWaitMinutes: 8,
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Snacks & Hot Dogs Teodoro Mariscal',
    location: 'Bleachers - Nivel 2 y Puerta 8',
    categoryTag: 'Hot Dogs & Snacks',
    active: true,
    estimatedWaitMinutes: 5,
    image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Barra 21 Cervecería Pacífico',
    location: 'Zona Lateral Poniente y Palcos',
    categoryTag: 'Cerveza & Coctelería',
    active: true,
    estimatedWaitMinutes: 3,
    image: 'https://images.unsplash.com/photo-1608270199996-51f786fa05d8?w=600&auto=format&fit=crop&q=80',
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

export async function getStadiumStands(): Promise<StadiumStand[]> {
  try {
    const snap = await getDocs(collection(db, STANDS_COLLECTION));
    if (snap.empty) {
      try {
        return await seedInitialStandsAndMenu();
      } catch (seedErr) {
        console.warn('No se pudieron sembrar los puestos en Firestore (permiso restringido). Usando datos iniciales:', seedErr);
        return INITIAL_STANDS.map((s, idx) => ({
          ...s,
          id: `stand-init-${idx + 1}`,
          createdAt: new Date().toISOString(),
        }));
      }
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StadiumStand[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, STANDS_COLLECTION);
  }
}

// ⚠️ DATOS DE PRUEBA - eliminar antes de producción
export async function seedInitialStandsAndMenu(): Promise<StadiumStand[]> {
  const createdStands: StadiumStand[] = [];
  const now = new Date().toISOString();

  for (const standData of INITIAL_STANDS) {
    const standDocRef = doc(collection(db, STANDS_COLLECTION));
    const fullStand: StadiumStand = {
      ...standData,
      id: standDocRef.id,
      createdAt: now,
    };
    await setDoc(standDocRef, fullStand);
    createdStands.push(fullStand);

    // Sembrar menú para este puesto
    const menuList = INITIAL_MENU_ITEMS[standData.name] || [];
    for (const item of menuList) {
      const itemDocRef = doc(collection(db, MENU_COLLECTION));
      const fullItem: MenuItem = {
        ...item,
        id: itemDocRef.id,
        standId: fullStand.id,
        createdAt: now,
      };
      await setDoc(itemDocRef, fullItem);
    }
  }

  return createdStands;
}

export async function getMenuItemsByStand(standId: string): Promise<MenuItem[]> {
  try {
    const q = query(
      collection(db, MENU_COLLECTION),
      where('standId', '==', standId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, MENU_COLLECTION);
  }
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  try {
    const snap = await getDocs(collection(db, MENU_COLLECTION));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, MENU_COLLECTION);
  }
}

export async function toggleMenuItemAvailability(itemId: string, available: boolean): Promise<void> {
  try {
    const docRef = doc(db, MENU_COLLECTION, itemId);
    await updateDoc(docRef, { available });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${MENU_COLLECTION}/${itemId}`);
  }
}

export async function saveMenuItem(itemData: Partial<MenuItem> & { name: string; price: number; standId: string }): Promise<MenuItem> {
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

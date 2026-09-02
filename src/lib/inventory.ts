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
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { InventoryProduct, ProductCost } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';

const COLLECTION_NAME = 'inventory';

interface InitialProductWithCost extends Omit<InventoryProduct, 'id' | 'createdAt' | 'updatedAt'> {
  initialCost: number;
}

const INITIAL_VENADOS_PRODUCTS: InitialProductWithCost[] = [
  {
    sku: 'VEN-JER-ROJ-26',
    name: 'Jersey Oficial Venados de Mazatlán Rojo 2026',
    category: 'Jerseys',
    price: 1699,
    initialCost: 850,
    stock: 45,
    minStockAlert: 10,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    image: 'https://images.unsplash.com/photo-1577210897949-1f56f943502f?w=600&auto=format&fit=crop&q=80',
    description: 'Jersey oficial de juego con tecnología transpirable y escudo bordado de Venados de Mazatlán.',
    supplier: 'El Siglo Deportes / Venados Store',
    active: true,
  },
  {
    sku: 'VEN-JER-NEG-26',
    name: 'Jersey Alternativo Black Edition',
    category: 'Jerseys',
    price: 1799,
    initialCost: 900,
    stock: 28,
    minStockAlert: 8,
    sizes: ['M', 'L', 'XL'],
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
    description: 'Edición conmemorativa nocturna en negro mate con detalles en rojo carmesí.',
    supplier: 'New Era / Venados Store',
    active: true,
  },
  {
    sku: 'VEN-GOR-59F-ROJ',
    name: 'Gorra Oficial 59FIFTY Fitted Venados',
    category: 'Gorras',
    price: 949,
    initialCost: 420,
    stock: 62,
    minStockAlert: 15,
    sizes: ['7', '7 1/8', '7 1/4', '7 3/8', '7 1/2', '7 5/8'],
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&auto=format&fit=crop&q=80',
    description: 'Gorra oficial New Era 59FIFTY con la tradicional "V" frontal y parche conmemorativo LMP.',
    supplier: 'New Era Cap Co.',
    active: true,
  },
  {
    sku: 'VEN-GOR-9FO-NEG',
    name: 'Gorra 9FORTY Snapback Ajustable',
    category: 'Gorras',
    price: 799,
    initialCost: 350,
    stock: 14,
    minStockAlert: 15, // Stock bajo
    sizes: ['Ajustable / Unitalla'],
    image: 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=600&auto=format&fit=crop&q=80',
    description: 'Corona estructurada con cierre ajustable trasero y silueta curvada.',
    supplier: 'New Era Cap Co.',
    active: true,
  },
  {
    sku: 'VEN-CHA-WIN-26',
    name: 'Chamarra Rompevientos Mazatlán Béisbol',
    category: 'Sudaderas',
    price: 1450,
    initialCost: 700,
    stock: 18,
    minStockAlert: 5,
    sizes: ['M', 'L', 'XL'],
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600&auto=format&fit=crop&q=80',
    description: 'Protección ligera contra la brisa marina del malecón con gorro oculto.',
    supplier: 'Venados Apparel',
    active: true,
  },
  {
    sku: 'VEN-PEL-OFIC-LMP',
    name: 'Pelota Oficial Rawlings LMP Venados',
    category: 'Coleccionables',
    price: 380,
    initialCost: 150,
    stock: 120,
    minStockAlert: 25,
    sizes: ['Oficial'],
    image: 'https://images.unsplash.com/photo-1508802959524-40759c8f79f4?w=600&auto=format&fit=crop&q=80',
    description: 'Pelota oficial con costuras en rojo y caja de exhibición protectora acrílica.',
    supplier: 'Rawlings Sports',
    active: true,
  },
  {
    sku: 'VEN-TAR-CER-EST',
    name: 'Tarro Cervecero Estadio Teodoro Mariscal 1 Litro',
    category: 'Souvenirs',
    price: 249,
    initialCost: 85,
    stock: 5, // Alerta stock crítico
    minStockAlert: 20,
    sizes: ['1 Litro'],
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
    description: 'Tarro de acrílico reforzado con relieve del venado para bebidas frías en el estadio.',
    supplier: 'Concesiones Pacífico',
    active: true,
  },
];

export async function getInventoryProducts(): Promise<InventoryProduct[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snap = await getDocs(q);

    if (snap.empty) {
      try {
        return await seedInitialProducts();
      } catch (seedErr) {
        console.warn('No se pudo sembrar el inventario en Firestore (permiso restringido). Usando catálogo estático:', seedErr);
        return INITIAL_VENADOS_PRODUCTS.map((p, idx) => {
          const { initialCost, ...rest } = p;
          return {
            ...rest,
            id: `prod-init-${idx + 1}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
      }
    }

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as InventoryProduct[];
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

/**
 * Lee el costo confidencial de un producto desde la subcolección cost/data.
 * Restringido por Firestore Rules exclusivamente para el rol admin.
 */
export async function getProductCost(productId: string): Promise<number | null> {
  try {
    const costDocRef = doc(db, COLLECTION_NAME, productId, 'cost', 'data');
    const snap = await getDoc(costDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return typeof data.costPrice === 'number' ? data.costPrice : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTION_NAME}/${productId}/cost/data`);
    return null;
  }
}

/**
 * Guarda o actualiza el costo confidencial de un producto en la subcolección cost/data.
 * Restringido por Firestore Rules exclusivamente para el rol admin.
 */
export async function setProductCost(productId: string, costPrice: number): Promise<void> {
  try {
    const costDocRef = doc(db, COLLECTION_NAME, productId, 'cost', 'data');
    const costData: ProductCost = {
      productId,
      costPrice: Number(costPrice) || 0,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(costDocRef, sanitizeFirestoreData(costData));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${productId}/cost/data`);
  }
}

// ⚠️ DATOS DE PRUEBA - eliminar antes de producción
export async function seedInitialProducts(): Promise<InventoryProduct[]> {
  const seeded: InventoryProduct[] = [];
  const now = new Date().toISOString();

  for (const item of INITIAL_VENADOS_PRODUCTS) {
    const { initialCost, ...productData } = item;
    const docRef = doc(collection(db, COLLECTION_NAME));
    const product: InventoryProduct = {
      ...productData,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(docRef, sanitizeFirestoreData(product));

    // Sembrar costo confidencial en la subcolección cost/data
    if (initialCost !== undefined) {
      try {
        const costDocRef = doc(db, COLLECTION_NAME, docRef.id, 'cost', 'data');
        const costData: ProductCost = {
          productId: docRef.id,
          costPrice: initialCost,
          updatedAt: now,
        };
        await setDoc(costDocRef, sanitizeFirestoreData(costData));
      } catch (costErr) {
        console.warn(`No se pudo sembrar el costo de ${docRef.id}:`, costErr);
      }
    }

    seeded.push(product);
  }

  return seeded;
}

export async function saveInventoryProduct(
  productData: Partial<InventoryProduct> & {
    name: string;
    sku: string;
    price: number;
    stock: number;
    costPrice?: number;
  }
): Promise<InventoryProduct> {
  const now = new Date().toISOString();
  const { costPrice, ...rootData } = productData;

  try {
    let savedProduct: InventoryProduct;

    if (rootData.id) {
      const docRef = doc(db, COLLECTION_NAME, rootData.id);
      const updatePayload = {
        ...rootData,
        updatedAt: now,
      };
      await updateDoc(docRef, sanitizeFirestoreData(updatePayload));
      savedProduct = { ...rootData, updatedAt: now } as InventoryProduct;
    } else {
      const docRef = doc(collection(db, COLLECTION_NAME));
      const newProduct: InventoryProduct = {
        id: docRef.id,
        sku: rootData.sku,
        name: rootData.name,
        category: (rootData.category as any) || 'Jerseys',
        price: Number(rootData.price) || 0,
        stock: Number(rootData.stock) || 0,
        minStockAlert: Number(rootData.minStockAlert) || 5,
        sizes: rootData.sizes || ['Unitalla'],
        image: rootData.image || 'https://images.unsplash.com/photo-1577210897949-1f56f943502f?w=600&auto=format&fit=crop&q=80',
        description: rootData.description || '',
        supplier: rootData.supplier || 'Venados Store',
        active: rootData.active !== undefined ? rootData.active : true,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, sanitizeFirestoreData(newProduct));
      savedProduct = newProduct;
    }

    // Si viene costPrice en los datos, guardarlo por separado en la subcolección cost
    if (costPrice !== undefined && savedProduct.id) {
      await setProductCost(savedProduct.id, costPrice);
    }

    return savedProduct;
  } catch (err) {
    handleFirestoreError(
      err,
      productData.id ? OperationType.UPDATE : OperationType.CREATE,
      `${COLLECTION_NAME}/${productData.id || ''}`
    );
  }
}

export async function adjustProductStock(productId: string, quantityChange: number, reason?: string): Promise<number> {
  try {
    const docRef = doc(db, COLLECTION_NAME, productId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Producto no encontrado');

    const currentStock = snap.data().stock || 0;
    const newStock = Math.max(0, currentStock + quantityChange);

    await updateDoc(docRef, {
      stock: newStock,
      updatedAt: new Date().toISOString(),
    });

    return newStock;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${productId}`);
  }
}

export async function deleteInventoryProduct(productId: string): Promise<void> {
  try {
    // Intentar borrar la subcolección de costo confidencial si existe
    try {
      const costDocRef = doc(db, COLLECTION_NAME, productId, 'cost', 'data');
      await deleteDoc(costDocRef);
    } catch {
      // Ignorar si no existe subcolección
    }

    const docRef = doc(db, COLLECTION_NAME, productId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${productId}`);
  }
}

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { MerchOrder, MerchOrderStatus, CarrierCompany } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { recordSaleTransaction } from './sales';

const COLLECTION_NAME = 'merchOrders';

export async function getAllMerchOrders(): Promise<MerchOrder[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snap = await getDocs(q);

    if (snap.empty) {
      return await seedInitialMerchOrders();
    }

    const orders = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MerchOrder[];

    return orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function getUserMerchOrders(userId: string): Promise<MerchOrder[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const orders = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MerchOrder[];

    return orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

export async function createMerchOrder(orderData: Omit<MerchOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchOrder> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const newOrder: MerchOrder = {
      ...orderData,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    const cleanData = sanitizeFirestoreData(newOrder);
    await setDoc(docRef, cleanData);

    // Intentar registrar en auditoría de ventas global
    try {
      await recordSaleTransaction({
        channel: 'tienda_merch',
        referenceId: newOrder.id,
        customerName: newOrder.customerName,
        description: `Pedido Tienda: ${newOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
        amount: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        date: now,
        status: 'completada',
      });
    } catch {
      // Ignorar si el usuario no tiene permisos directos para escribir en /sales
    }

    return newOrder;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, COLLECTION_NAME);
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: MerchOrderStatus,
  carrier?: CarrierCompany,
  trackingNumber?: string
): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const updatePayload: Partial<MerchOrder> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (carrier) updatePayload.carrier = carrier;
    if (trackingNumber) updatePayload.trackingNumber = trackingNumber;

    await updateDoc(docRef, sanitizeFirestoreData(updatePayload));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${orderId}`);
  }
}

// ⚠️ DATOS DE PRUEBA - eliminar antes de producción
export async function seedInitialMerchOrders(): Promise<MerchOrder[]> {
  const now = new Date();
  const sampleOrders: Omit<MerchOrder, 'id'>[] = [
    {
      userId: 'user_sample_1',
      customerName: 'Jorge Andrés Morales',
      customerEmail: 'jorgeandres980706@gmail.com',
      customerPhone: '6699123456',
      items: [
        {
          productId: 'p1',
          name: 'Jersey Oficial Venados de Mazatlán Rojo 2026',
          sku: 'VEN-JER-ROJ-26',
          price: 1699,
          quantity: 1,
          size: 'L',
          image: 'https://images.unsplash.com/photo-1577210897949-1f56f943502f?w=600&auto=format&fit=crop&q=80',
        },
        {
          productId: 'p3',
          name: 'Gorra Oficial 59FIFTY Fitted Venados',
          sku: 'VEN-GOR-59F-ROJ',
          price: 949,
          quantity: 1,
          size: '7 1/4',
          image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&auto=format&fit=crop&q=80',
        },
      ],
      subtotal: 2648,
      shippingCost: 150,
      total: 2798,
      shippingType: 'domicilio',
      shippingAddress: {
        recipientName: 'Jorge Andrés Morales',
        street: 'Av. Del Mar 1200, Depto 402',
        neighborhood: 'Zona Dorada',
        city: 'Mazatlán',
        state: 'Sinaloa',
        zipCode: '82110',
        phone: '6699123456',
        referenceNotes: 'Frente al malecón, edificio torre blanca',
      },
      carrier: 'DHL Express',
      trackingNumber: 'DHL-MZT-892183920',
      status: 'en_transito',
      paymentMethod: 'Tarjeta',
      paymentStatus: 'pagado',
      createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000).toISOString(),
    },
    {
      userId: 'user_sample_2',
      customerName: 'Roberto Lizárraga',
      customerEmail: 'roberto.liz@mazatlan.com',
      customerPhone: '6691456789',
      items: [
        {
          productId: 'p2',
          name: 'Jersey Alternativo Black Edition',
          sku: 'VEN-JER-NEG-26',
          price: 1799,
          quantity: 1,
          size: 'XL',
          image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
        },
      ],
      subtotal: 1799,
      shippingCost: 0,
      total: 1799,
      shippingType: 'tienda',
      carrier: 'Recoger en Tienda Estadio',
      status: 'empacado',
      paymentMethod: 'MercadoPago',
      paymentStatus: 'pagado',
      notes: 'Aficionado recogerá en el 5to inning del partido de inauguración',
      createdAt: new Date(now.getTime() - 86400000 * 1).toISOString(),
      updatedAt: new Date(now.getTime() - 3600000 * 4).toISOString(),
    },
    {
      userId: 'user_sample_3',
      customerName: 'Mariana Zatarain',
      customerEmail: 'mariana.z@gmail.com',
      items: [
        {
          productId: 'p4',
          name: 'Chamarra Rompevientos Mazatlán Béisbol',
          sku: 'VEN-CHA-WIN-26',
          price: 1450,
          quantity: 2,
          size: 'M',
          image: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600&auto=format&fit=crop&q=80',
        },
      ],
      subtotal: 2900,
      shippingCost: 120,
      total: 3020,
      shippingType: 'domicilio',
      shippingAddress: {
        recipientName: 'Mariana Zatarain',
        street: 'Calle Benito Juárez 45',
        neighborhood: 'Centro Histórico',
        city: 'Culiacán',
        state: 'Sinaloa',
        zipCode: '80000',
        phone: '6677981234',
      },
      carrier: 'Paquetexpress',
      trackingNumber: 'PE-CUL-7749210',
      status: 'entregado',
      paymentMethod: 'Tarjeta',
      paymentStatus: 'pagado',
      createdAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
      updatedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
    },
  ];

  const createdOrders: MerchOrder[] = [];
  for (const o of sampleOrders) {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const fullOrder: MerchOrder = {
      ...o,
      id: docRef.id,
    };
    await setDoc(docRef, fullOrder);
    createdOrders.push(fullOrder);
  }
  return createdOrders;
}

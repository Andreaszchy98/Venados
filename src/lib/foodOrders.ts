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
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { FoodOrder, FoodOrderStatus } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { recordSaleTransaction } from './sales';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from './defaultVenue';

const COLLECTION_NAME = 'foodOrders';

export async function createFoodOrder(
  orderData: Omit<FoodOrder, 'id' | 'pickupCode' | 'createdAt' | 'updatedAt' | 'statusHistory' | 'status' | 'runnerId'> | (Omit<FoodOrder, 'id' | 'pickupCode' | 'createdAt' | 'updatedAt' | 'statusHistory' | 'status' | 'runnerId' | 'venueId'> & { venueId?: string })
): Promise<FoodOrder> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    // Generar un código de retiro / entrega corto y legible: V- seguido de 3 dígitos
    const codeNum = Math.floor(100 + Math.random() * 900);
    const pickupCode = `V-${codeNum}`;

    const newOrder: FoodOrder = {
      ...orderData,
      venueId: (orderData as any).venueId || DEFAULT_VENUE_ID,
      id: docRef.id,
      pickupCode,
      status: 'pendiente',
      runnerId: null,
      statusHistory: [
        {
          status: 'pendiente',
          timestamp: now,
          note:
            orderData.orderType === 'in-seat'
              ? `Orden in-seat recibida (Sección ${orderData.section || '-'}, Fila ${orderData.row || '-'}, Asiento ${orderData.seat || '-'})`
              : 'Orden recibida en cocina para Pickup Express',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const cleanData = sanitizeFirestoreData(newOrder);
    await setDoc(docRef, cleanData);

    // Intentar registrar en auditoría de ventas
    try {
      await recordSaleTransaction({
        channel: 'concesion_alimentos',
        venueId: (orderData as any).venueId || DEFAULT_VENUE_ID,
        eventId: DEFAULT_EVENT_ID,
        referenceId: newOrder.id,
        customerName: newOrder.customerName,
        description: `[${newOrder.orderType.toUpperCase()}] ${newOrder.standName} (${newOrder.pickupCode}): ${newOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
        amount: newOrder.total,
        paymentMethod: newOrder.paymentMethod || 'Tarjeta',
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

export async function getUserFoodOrders(userId: string): Promise<FoodOrder[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FoodOrder[];
    return orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

export function listenToStandFoodOrders(
  standId: string | null,
  onUpdate: (orders: FoodOrder[]) => void,
  onError?: (err: any) => void,
  venueId?: string
): () => void {
  try {
    let q = query(collection(db, COLLECTION_NAME));
    if (standId) {
      q = query(collection(db, COLLECTION_NAME), where('standId', '==', standId));
    }

    return onSnapshot(
      q,
      (snap) => {
        let orders = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FoodOrder[];

        if (venueId) {
          orders = orders.filter((o) => (o.venueId || DEFAULT_VENUE_ID) === venueId);
        }

        orders.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        onUpdate(orders);
      },
      (error) => {
        console.warn('Error en snapshot de órdenes de comida:', error);
        if (onError) {
          onError(error);
        } else {
          handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
        }
      }
    );
  } catch (err) {
    console.warn('Error al iniciar listener de órdenes:', err);
    if (onError) {
      onError(err);
    } else {
      handleFirestoreError(err, OperationType.GET, COLLECTION_NAME);
    }
    return () => {};
  }
}

export async function advanceFoodOrderStatus(
  orderId: string,
  newStatus: FoodOrderStatus,
  note?: string,
  extraFields?: Partial<FoodOrder>
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Orden no encontrada');

    const data = snap.data() as FoodOrder;
    const history = data.statusHistory || [];
    history.push({
      status: newStatus,
      timestamp: now,
      note: note || `Estado actualizado a ${newStatus}`,
    });

    const updatePayload: any = {
      status: newStatus,
      statusHistory: history,
      updatedAt: now,
      ...extraFields,
    };

    const cleanPayload = sanitizeFirestoreData(updatePayload);
    await updateDoc(docRef, cleanPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${orderId}`);
  }
}

/**
 * Runner toma una orden in-seat disponible en su zona
 */
export async function claimInSeatOrder(
  orderId: string,
  runnerId: string,
  runnerName?: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Orden no encontrada');

    const data = snap.data() as FoodOrder;
    if (data.status !== 'listo') {
      throw new Error('La orden no está lista para ser tomada por un runner');
    }
    if (data.runnerId) {
      throw new Error('La orden ya fue tomada por otro runner');
    }

    const history = data.statusHistory || [];
    history.push({
      status: 'en-camino',
      timestamp: now,
      note: `Tomado por runner ${runnerName || runnerId} para entrega a butaca`,
    });

    await updateDoc(docRef, {
      status: 'en-camino',
      runnerId: runnerId,
      statusHistory: history,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${orderId}`);
  }
}

/**
 * Runner marca una orden in-seat como entregada en la butaca
 */
export async function deliverInSeatOrder(
  orderId: string,
  runnerId: string,
  note?: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(db, COLLECTION_NAME, orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Orden no encontrada');

    const data = snap.data() as FoodOrder;
    const history = data.statusHistory || [];
    history.push({
      status: 'entregado',
      timestamp: now,
      note: note || 'Entregado en butaca del aficionado',
    });

    await updateDoc(docRef, {
      status: 'entregado',
      statusHistory: history,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${orderId}`);
  }
}

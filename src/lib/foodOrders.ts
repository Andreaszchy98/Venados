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
import { handleFirestoreError, OperationType } from './errorHandler';
import { recordSaleTransaction } from './sales';

const COLLECTION_NAME = 'foodOrders';

export async function createFoodOrder(
  orderData: Omit<FoodOrder, 'id' | 'pickupCode' | 'createdAt' | 'updatedAt' | 'statusHistory' | 'status'>
): Promise<FoodOrder> {
  const now = new Date().toISOString();
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    // Generar un código de retiro corto y legible: V- seguido de 3 dígitos
    const codeNum = Math.floor(100 + Math.random() * 900);
    const pickupCode = `V-${codeNum}`;

    const newOrder: FoodOrder = {
      ...orderData,
      id: docRef.id,
      pickupCode,
      status: 'pendiente',
      statusHistory: [
        {
          status: 'pendiente',
          timestamp: now,
          note: 'Orden recibida en cocina del puesto',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, newOrder);

    // Registrar en auditoría de ventas
    await recordSaleTransaction({
      channel: 'concesion_alimentos',
      referenceId: newOrder.id,
      customerName: newOrder.customerName,
      description: `${newOrder.standName} (${newOrder.pickupCode}): ${newOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`,
      amount: newOrder.total,
      paymentMethod: newOrder.paymentMethod || 'Tarjeta',
      date: now,
      status: 'completada',
    });

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
  onError?: (err: any) => void
): () => void {
  try {
    let q = query(collection(db, COLLECTION_NAME));
    if (standId) {
      q = query(collection(db, COLLECTION_NAME), where('standId', '==', standId));
    }

    return onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FoodOrder[];
        orders.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        onUpdate(orders);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, COLLECTION_NAME);
  }
}

export async function advanceFoodOrderStatus(
  orderId: string,
  newStatus: FoodOrderStatus,
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
      status: newStatus,
      timestamp: now,
      note: note || `Estado actualizado a ${newStatus}`,
    });

    await updateDoc(docRef, {
      status: newStatus,
      statusHistory: history,
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${orderId}`);
  }
}

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { SaleTransaction, SaleChannel } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';
import { DEFAULT_VENUE_ID, DEFAULT_EVENT_ID } from './defaultVenue';

const COLLECTION_NAME = 'sales';

export async function recordSaleTransaction(
  sale: Omit<SaleTransaction, 'id'>
): Promise<SaleTransaction | null> {
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const transaction: SaleTransaction = {
      ...sale,
      venueId: sale.venueId || DEFAULT_VENUE_ID,
      eventId: sale.eventId || DEFAULT_EVENT_ID,
      id: docRef.id,
    };
    await setDoc(docRef, sanitizeFirestoreData(transaction));
    return transaction;
  } catch (err) {
    console.warn('No se pudo registrar la venta en la colección de auditoría:', err);
    return null;
  }
}

export function calculateMetricsFromTransactions(transactions: SaleTransaction[]) {
  let totalGrossRevenue = 0;
  let ticketsRevenue = 0;
  let merchRevenue = 0;
  let foodRevenue = 0;

  for (const t of transactions) {
    if (t.status === 'reembolsada') continue;
    const amt = Number(t.amount) || 0;
    totalGrossRevenue += amt;
    if (t.channel === 'boletos') ticketsRevenue += amt;
    else if (t.channel === 'tienda_merch') merchRevenue += amt;
    else if (t.channel === 'concesion_alimentos') foodRevenue += amt;
  }

  return {
    totalGrossRevenue,
    ticketsRevenue,
    merchRevenue,
    foodRevenue,
    totalTransactions: transactions.length,
  };
}

/**
 * Escucha transacciones de venta en tiempo real (onSnapshot).
 * Si la colección está vacía en primer arranque, genera datos iniciales de auditoría.
 */
export function subscribeToSalesAuditLog(
  onUpdate: (sales: SaleTransaction[]) => void,
  onError?: (err: any) => void,
  venueId?: string
): () => void {
  const q = query(collection(db, COLLECTION_NAME));

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        try {
          const seeded = await seedInitialSales();
          const filtered = venueId ? seeded.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === venueId) : seeded;
          onUpdate(filtered);
          return;
        } catch (e) {
          onUpdate([]);
          return;
        }
      }

      let sales = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SaleTransaction[];

      if (venueId) {
        sales = sales.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === venueId);
      }

      const sorted = sales.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      onUpdate(sorted);
    },
    (err) => {
      console.error('Error escuchando auditoría de ventas en tiempo real:', err);
      if (onError) onError(err);
    }
  );
}

export async function getAllSalesTransactions(venueId?: string): Promise<SaleTransaction[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snap = await getDocs(q);

    if (snap.empty) {
      try {
        const seeded = await seedInitialSales();
        if (venueId) {
          return seeded.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === venueId);
        }
        return seeded;
      } catch {
        return [];
      }
    }

    let sales = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SaleTransaction[];

    if (venueId) {
      sales = sales.filter((s) => (s.venueId || DEFAULT_VENUE_ID) === venueId);
    }

    return sales.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return [];
  }
}

export const getSalesAuditLog = getAllSalesTransactions;

export async function getSalesMetrics(venueId?: string): Promise<{
  totalGrossRevenue: number;
  ticketsRevenue: number;
  merchRevenue: number;
  foodRevenue: number;
  totalTransactions: number;
}> {
  const transactions = await getAllSalesTransactions(venueId);
  return calculateMetricsFromTransactions(transactions);
}

// ⚠️ DATOS DE PRUEBA - eliminar antes de producción
export async function seedInitialSales(): Promise<SaleTransaction[]> {
  const now = new Date();
  const sampleSales: Omit<SaleTransaction, 'id'>[] = [
    {
      channel: 'boletos',
      venueId: DEFAULT_VENUE_ID,
      eventId: DEFAULT_EVENT_ID,
      referenceId: 't-101',
      customerName: 'Jorge Andrés Morales',
      description: '2x Boletos Zona Diamante (Inauguración)',
      amount: 900,
      paymentMethod: 'Tarjeta',
      date: new Date(now.getTime() - 86400000 * 3).toISOString(),
      status: 'completada',
    },
    {
      channel: 'tienda_merch',
      venueId: DEFAULT_VENUE_ID,
      eventId: DEFAULT_EVENT_ID,
      referenceId: 'ord-551',
      customerName: 'Jorge Andrés Morales',
      description: 'Jersey Oficial + Gorra 59FIFTY',
      amount: 2798,
      paymentMethod: 'Tarjeta',
      date: new Date(now.getTime() - 86400000 * 2).toISOString(),
      status: 'completada',
    },
    {
      channel: 'concesion_alimentos',
      venueId: DEFAULT_VENUE_ID,
      eventId: DEFAULT_EVENT_ID,
      referenceId: 'food-201',
      customerName: 'Carlos Valdez',
      description: 'Aguachile de Camarón + 2x Cerveza Pacífico',
      amount: 430,
      paymentMethod: 'Tarjeta',
      date: new Date(now.getTime() - 3600000 * 12).toISOString(),
      status: 'completada',
    },
    {
      channel: 'boletos',
      venueId: DEFAULT_VENUE_ID,
      eventId: DEFAULT_EVENT_ID,
      referenceId: 't-102',
      customerName: 'Ana Sofía R.',
      description: '4x Boletos Butaca Central vs Tomateros',
      amount: 1400,
      paymentMethod: 'Transferencia SPEI',
      date: new Date(now.getTime() - 3600000 * 6).toISOString(),
      status: 'completada',
    },
    {
      channel: 'tienda_merch',
      venueId: DEFAULT_VENUE_ID,
      eventId: DEFAULT_EVENT_ID,
      referenceId: 'ord-552',
      customerName: 'Roberto Lizárraga',
      description: 'Jersey Alternativo Black Edition',
      amount: 1799,
      paymentMethod: 'MercadoPago',
      date: new Date(now.getTime() - 3600000 * 4).toISOString(),
      status: 'completada',
    },
    {
      channel: 'concesion_alimentos',
      venueId: DEFAULT_VENUE_ID,
      eventId: DEFAULT_EVENT_ID,
      referenceId: 'food-202',
      customerName: 'Esteban Ríos',
      description: 'Combo Doble Hot Dog Teodoro + Refresco',
      amount: 210,
      paymentMethod: 'Efectivo',
      date: new Date(now.getTime() - 1800000).toISOString(),
      status: 'completada',
    },
  ];

  const created: SaleTransaction[] = [];
  for (const s of sampleSales) {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const item: SaleTransaction = { ...s, id: docRef.id };
    await setDoc(docRef, item);
    created.push(item);
  }
  return created;
}

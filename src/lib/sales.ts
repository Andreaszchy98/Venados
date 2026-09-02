import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { SaleTransaction, SaleChannel } from '../types';
import { handleFirestoreError, OperationType, sanitizeFirestoreData } from './errorHandler';

const COLLECTION_NAME = 'sales';

export async function recordSaleTransaction(
  sale: Omit<SaleTransaction, 'id'>
): Promise<SaleTransaction | null> {
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const transaction: SaleTransaction = {
      ...sale,
      id: docRef.id,
    };
    await setDoc(docRef, sanitizeFirestoreData(transaction));
    return transaction;
  } catch (err) {
    console.warn('No se pudo registrar la venta en la colección de auditoría (permiso restringido a operadores):', err);
    return null;
  }
}

export async function getAllSalesTransactions(): Promise<SaleTransaction[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const snap = await getDocs(q);

    if (snap.empty) {
      try {
        return await seedInitialSales();
      } catch {
        return [];
      }
    }

    const sales = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SaleTransaction[];

    return sales.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    return [];
  }
}

export const getSalesAuditLog = getAllSalesTransactions;

export async function getSalesMetrics(): Promise<{
  totalGrossRevenue: number;
  ticketsRevenue: number;
  merchRevenue: number;
  foodRevenue: number;
  totalTransactions: number;
}> {
  const transactions = await getAllSalesTransactions();
  let totalGrossRevenue = 0;
  let ticketsRevenue = 0;
  let merchRevenue = 0;
  let foodRevenue = 0;

  for (const t of transactions) {
    if (t.status === 'reembolsada') continue;
    totalGrossRevenue += t.amount || 0;
    if (t.channel === 'boletos') ticketsRevenue += t.amount || 0;
    else if (t.channel === 'tienda_merch') merchRevenue += t.amount || 0;
    else if (t.channel === 'concesion_alimentos') foodRevenue += t.amount || 0;
  }

  return {
    totalGrossRevenue,
    ticketsRevenue,
    merchRevenue,
    foodRevenue,
    totalTransactions: transactions.length,
  };
}

// ⚠️ DATOS DE PRUEBA - eliminar antes de producción
export async function seedInitialSales(): Promise<SaleTransaction[]> {
  const now = new Date();
  const sampleSales: Omit<SaleTransaction, 'id'>[] = [
    {
      channel: 'boletos',
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

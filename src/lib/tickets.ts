import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Ticket } from '../types';

/**
 * Obtener boletos de un usuario específico en tiempo real
 */
export function subscribeUserTickets(
  userId: string,
  onUpdate: (tickets: Ticket[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, 'tickets'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tickets: Ticket[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Ticket, 'id'>),
      }));
      onUpdate(tickets);
    },
    (err) => {
      console.error('Error fetching tickets:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Obtener todos los boletos (para admin y taquilla)
 */
export async function getAllTickets(): Promise<Ticket[]> {
  const snapshot = await getDocs(collection(db, 'tickets'));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<Ticket, 'id'>),
  }));
}

/**
 * Generar boletos de prueba para el aficionado
 */
export async function createSampleTicketsForUser(userId: string): Promise<void> {
  const sampleTickets: Omit<Ticket, 'id'>[] = [
    {
      userId,
      matchTitle: 'Venados de Mazatlán vs Tomateros de Culiacán',
      opponent: 'Tomateros de Culiacán',
      matchDate: '2026-10-15',
      matchTime: '20:00 hrs',
      stadium: 'Estadio Teodoro Mariscal',
      section: 'Platea Baja Central',
      row: 'Fila E',
      seat: 'Asiento 14',
      price: 450,
      status: 'activo',
      qrId: `VND-2026-TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      gate: 'Acceso Puerta 2',
      createdAt: new Date().toISOString(),
    },
    {
      userId,
      matchTitle: 'Venados de Mazatlán vs Naranjeros de Hermosillo',
      opponent: 'Naranjeros de Hermosillo',
      matchDate: '2026-10-22',
      matchTime: '19:30 hrs',
      stadium: 'Estadio Teodoro Mariscal',
      section: 'Preferente Lateral',
      row: 'Fila C',
      seat: 'Asiento 08',
      price: 320,
      status: 'activo',
      qrId: `VND-2026-TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      gate: 'Acceso Puerta 4',
      createdAt: new Date().toISOString(),
    },
  ];

  for (const tkt of sampleTickets) {
    await addDoc(collection(db, 'tickets'), tkt);
  }
}

/**
 * Actualizar estado de boleto (para taquilla / validación)
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: 'activo' | 'usado' | 'cancelado'
): Promise<void> {
  const ticketRef = doc(db, 'tickets', ticketId);
  await updateDoc(ticketRef, {
    status: newStatus,
  });
}

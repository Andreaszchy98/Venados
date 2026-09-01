import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { Membership } from '../types';

/**
 * Suscribirse a la membresía del usuario
 */
export function subscribeUserMembership(
  userId: string,
  onUpdate: (membership: Membership | null) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, 'memberships'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(null);
      } else {
        const docSnap = snapshot.docs[0];
        onUpdate({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Membership, 'id'>),
        });
      }
    },
    (err) => {
      console.error('Error fetching membership:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Generar membresía de prueba Socio Venados
 */
export async function createSampleMembershipForUser(
  userId: string,
  tier: 'General' | 'Oro' | 'Platino' | 'Diamante' = 'Platino'
): Promise<void> {
  const sampleMembership: Omit<Membership, 'id'> = {
    userId,
    memberNumber: `SV-${Math.floor(100000 + Math.random() * 900000)}`,
    tier,
    status: 'activa',
    startDate: '2026-01-15',
    renewalDate: '2027-01-15',
    seatAssigned: 'Platea Baja - Fila D, Asiento 12',
    benefits: [
      'Acceso exclusivo por Puerta VIP',
      'Descuento del 15% en tienda oficial',
      'Preventa prioritaria para playoffs',
      'Pase de estacionamiento preferencial',
    ],
    createdAt: new Date().toISOString(),
  };

  await addDoc(collection(db, 'memberships'), sampleMembership);
}

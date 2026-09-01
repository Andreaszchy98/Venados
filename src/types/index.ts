/**
 * Venados App - Tipos y Modelos de Datos Centralizados
 * Fase 1: MVP Base
 */

export type UserRole = 'aficionado' | 'admin' | 'taquilla';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type TicketStatus = 'activo' | 'usado' | 'cancelado';

export interface Ticket {
  id: string;
  userId: string;
  matchTitle: string;
  opponent?: string;
  matchDate: string;
  matchTime?: string;
  stadium: string;
  section: string;
  row: string;
  seat: string;
  price: number;
  status: TicketStatus;
  qrId: string;
  gate?: string;
  createdAt: string;
}

export type MembershipTier = 'General' | 'Oro' | 'Platino' | 'Diamante';
export type MembershipStatus = 'activa' | 'vencida' | 'suspendida';

export interface Membership {
  id: string;
  userId: string;
  memberNumber: string;
  tier: MembershipTier;
  status: MembershipStatus;
  renewalDate: string;
  startDate: string;
  seatAssigned?: string;
  benefits?: string[];
  createdAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: import('firebase/auth').User | null;
  loading: boolean;
  error: string | null;
}

import { Ticket } from '../types';

export interface StripeTicketPayload {
  eventId: string;
  venueId?: string;
  matchTitle?: string;
  eventTitle?: string;
  stadium?: string;
  stadiumName?: string;
  sectionId?: string;
  section?: string;
  seatRow?: string;
  row?: string;
  seatNumber?: string;
  seat?: string;
  price: number;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  gate?: string;
  seatId?: string;
  selectedSeats?: any[];
}

export interface CreateCheckoutResult {
  sessionId: string;
  sessionUrl: string;
  isDemoMode?: boolean;
  message?: string;
  error?: string;
}

export interface FulfillCheckoutResult {
  success: boolean;
  ticketId?: string;
  qrId?: string;
  alreadyFulfilled?: boolean;
  ticket?: Ticket;
  error?: string;
  paymentStatus?: string;
}

export interface PendingStripeSession {
  id: string;
  paymentIntentId: string;
  amountTotal: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  eventName: string;
  section: string;
  seat: string;
  created: string;
  isDemo?: boolean;
}

/**
 * 1. Solicita al backend crear una sesión de pago en Stripe Checkout (o simulación demo)
 */
export async function createStripeCheckoutSession(
  ticketData: StripeTicketPayload,
  customerEmail?: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<CreateCheckoutResult> {
  const origin = window.location.origin;
  const res = await fetch('/api/stripe/createCheckoutSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticketData,
      customerEmail: customerEmail || ticketData.customerEmail,
      successUrl: successUrl || `${origin}/?stripe_status=success`,
      cancelUrl: cancelUrl || `${origin}/?stripe_status=cancelled`,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Error del servidor al crear sesión de pago' }));
    throw new Error(errData.error || errData.message || 'Error al conectar con el procesador de pagos Stripe');
  }

  return res.json();
}

/**
 * 2. Verifica en Stripe que el pago esté confirmado ('paid') y emite el boleto en Firestore
 */
export async function verifyAndFulfillStripeCheckout(
  sessionId: string
): Promise<FulfillCheckoutResult> {
  const res = await fetch('/api/stripe/verifyAndFulfillCheckout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  const data = await res.json().catch(() => ({ success: false, error: 'Error procesando respuesta del servidor' }));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'No se pudo verificar el pago en Stripe');
  }

  return data;
}

/**
 * 3. Consulta sesiones completadas en Stripe sin boleto emitido (para administración)
 */
export async function fetchPendingStripeSessions(): Promise<{
  configured: boolean;
  pendingSessions: PendingStripeSession[];
}> {
  const res = await fetch('/api/stripe/pendingSessions');
  if (!res.ok) {
    throw new Error('Error al consultar pagos pendientes en Stripe');
  }
  return res.json();
}

/**
 * 4. Completar sesión en modo demo de prueba
 */
export async function completeSimulatedPayment(sessionId: string): Promise<void> {
  const res = await fetch('/api/stripe/simulatedComplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    throw new Error('Error al confirmar pago simulado');
  }
}

export interface ProcessDirectPaymentParams {
  amount: number;
  concept: string;
  customerName: string;
  customerEmail?: string;
  cardLast4: string;
  cardBrand: string;
  orderType: 'boletos' | 'tienda' | 'comida';
  metadata?: Record<string, string>;
}

export interface DirectPaymentResult {
  success: boolean;
  paymentIntentId: string;
  authCode: string;
  amount: number;
  currency: string;
  cardLast4: string;
  cardBrand: string;
  timestamp: string;
}

/**
 * 5. Procesa el pago directo con tarjeta bancaria dentro de la aplicación
 */
export async function processDirectCardPayment(
  params: ProcessDirectPaymentParams
): Promise<DirectPaymentResult> {
  const res = await fetch('/api/stripe/processDirectPayment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Error autorizando el pago con tarjeta' }));
    throw new Error(errData.error || 'No se pudo completar el pago con tarjeta.');
  }

  return res.json();
}


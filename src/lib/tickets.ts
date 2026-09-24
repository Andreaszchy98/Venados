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
  limit,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Ticket } from '../types';
import { DEFAULT_EVENT_ID, DEFAULT_VENUE_ID } from './defaultVenue';

/**
 * Obtener boletos de un usuario específico en tiempo real
 */
export function subscribeUserTickets(
  userId: string,
  onUpdate: (tickets: Ticket[]) => void,
  onError?: (error: Error) => void
) {
  const cacheKey = `vxp_offline_tickets_${userId}`;
  // Cargar caché local de inmediato para soporte offline-first
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed);
      }
    }
  } catch (e) {}

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
      try {
        localStorage.setItem(cacheKey, JSON.stringify(tickets));
      } catch (e) {}
      onUpdate(tickets);
    },
    (err) => {
      console.warn('Modo offline detectado, utilizando caché local:', err);
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          onUpdate(JSON.parse(cached));
        }
      } catch (e) {}
      if (onError) onError(err);
    }
  );
}

/**
 * Obtener boletos del aficionado actual (Filtrado estricto por userId y acotado por limit)
 */
export async function getUserTickets(userId: string): Promise<Ticket[]> {
  try {
    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', userId),
      limit(100)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Ticket, 'id'>),
    }));
  } catch (err) {
    console.error('Error al obtener boletos del usuario:', err);
    return [];
  }
}

/**
 * Obtener boletos de un evento específico (para validación de aforo y acceso)
 */
export async function getEventTickets(eventId: string): Promise<Ticket[]> {
  try {
    const q = query(
      collection(db, 'tickets'),
      where('eventId', '==', eventId),
      limit(150)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Ticket, 'id'>),
    }));
  } catch (err) {
    console.error('Error al obtener boletos del evento:', err);
    return [];
  }
}

/**
 * Obtener boletos de una sede específica (para taquilla y control de accesos de la sede)
 */
export async function getVenueTickets(venueId: string, eventId?: string): Promise<Ticket[]> {
  try {
    const q = eventId
      ? query(
          collection(db, 'tickets'),
          where('venueId', '==', venueId),
          where('eventId', '==', eventId),
          limit(150)
        )
      : query(
          collection(db, 'tickets'),
          where('venueId', '==', venueId),
          limit(150)
        );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Ticket, 'id'>),
    }));
  } catch (err) {
    console.error('Error al obtener boletos de la sede:', err);
    return [];
  }
}

/**
 * Consulta de boletos para administración y taquilla con filtrado por sede y salvaguarda limit.
 * NUNCA lee la base de datos completa de tickets sin acotar.
 */
export async function getAllTickets(venueId?: string): Promise<Ticket[]> {
  const targetVenueId = venueId || DEFAULT_VENUE_ID;
  return getVenueTickets(targetVenueId);
}

/**
 * Generar boletos de prueba para el aficionado
 */
export async function createSampleTicketsForUser(userId: string): Promise<void> {
  const sampleTickets: Omit<Ticket, 'id'>[] = [
    {
      userId,
      eventId: DEFAULT_EVENT_ID,
      matchTitle: 'Venados de Mazatlán vs Tomateros de Culiacán',
      opponent: 'Tomateros de Culiacán',
      matchDate: '2026-10-15',
      matchTime: '20:00 hrs',
      stadium: 'Estadio Teodoro Mariscal',
      section: 'Platino',
      row: 'Fila E',
      seat: 'Asiento 14',
      price: 750,
      status: 'activo',
      qrId: `VND-2026-TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      gate: 'Acceso Puerta 2',
      createdAt: new Date().toISOString(),
    },
    {
      userId,
      eventId: DEFAULT_EVENT_ID,
      matchTitle: 'Venados de Mazatlán vs Naranjeros de Hermosillo',
      opponent: 'Naranjeros de Hermosillo',
      matchDate: '2026-10-22',
      matchTime: '19:30 hrs',
      stadium: 'Estadio Teodoro Mariscal',
      section: 'Oro',
      row: 'Fila C',
      seat: 'Asiento 08',
      price: 480,
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
 * Actualizar estado de boleto (para taquilla / validación).
 * Si el boleto pertenece a una compra conjunta (purchaseId), actualiza TODOS los boletos
 * de esa misma compra para que se validen/usen juntos en un solo escaneo.
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: 'activo' | 'usado' | 'cancelado',
  purchaseId?: string
): Promise<void> {
  // Si tenemos purchaseId o lo podemos consultar, validar todos los boletos de la compra
  if (purchaseId) {
    try {
      const q = query(
        collection(db, 'tickets'),
        where('purchaseId', '==', purchaseId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const updatePromises = snap.docs.map((d) =>
          updateDoc(doc(db, 'tickets', d.id), { status: newStatus })
        );
        await Promise.all(updatePromises);
        return;
      }
    } catch (err) {
      console.warn('Error al actualizar por purchaseId, actualizando por ID individual:', err);
    }
  }

  // Si no hay purchaseId o no se encontró, actualizar por ID directo
  const ticketRef = doc(db, 'tickets', ticketId);
  await updateDoc(ticketRef, {
    status: newStatus,
  });
}

/**
 * Comprar boleto y registrar la venta en la auditoría del estadio
 */
export async function purchaseTicketWithSaleRecord(
  ticketData: Omit<Ticket, 'id' | 'createdAt' | 'status' | 'qrId'> | (Omit<Ticket, 'id' | 'createdAt' | 'status' | 'qrId' | 'eventId'> & { eventId?: string }),
  paymentMethod: string,
  customerName: string
): Promise<string> {
  const qrId = `VND-2026-TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const secretSeed = `SEED-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const now = new Date().toISOString();

  const newTicket: Omit<Ticket, 'id'> = {
    ...ticketData,
    eventId: (ticketData as any).eventId || DEFAULT_EVENT_ID,
    status: 'activo',
    qrId,
    secretSeed,
    createdAt: now,
  };

  const ticketDocRef = await addDoc(collection(db, 'tickets'), newTicket);

  // Registrar venta
  try {
    const venueIdToRecord = (ticketData as any).venueId || DEFAULT_VENUE_ID;
    await addDoc(collection(db, 'sales'), {
      channel: 'boletos',
      userId: ticketData.userId,
      venueId: venueIdToRecord,
      eventId: (ticketData as any).eventId || DEFAULT_EVENT_ID,
      referenceId: ticketDocRef.id,
      customerName,
      description: `Boleto: ${ticketData.matchTitle} - ${ticketData.section} (${ticketData.seat})`,
      amount: ticketData.price,
      paymentMethod,
      date: now,
      status: 'completada',
    });
  } catch (saleErr) {
    console.warn('No se pudo registrar la venta en auditoría:', saleErr);
  }

  return ticketDocRef.id;
}

export interface ValidationScanResult {
  success: boolean;
  status: 'valido' | 'invalido' | 'usado' | 'especial';
  message: string;
  tickets: Ticket[];
  usedAt?: string;
  usedGate?: string;
}

/**
 * Generar código TOTP dinámico basado en secretSeed y ventana de tiempo (30s)
 */
export function generateTotpCode(secretSeed: string, timeStepSeconds: number = 30, offsetSteps: number = 0): string {
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / timeStepSeconds) + offsetSteps;
  let hash = 0;
  const str = `${secretSeed}-${counter}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  return (absHash % 1000000).toString().padStart(6, '0');
}

/**
 * Verificar si un código escaneado coincide con el TOTP actual (con tolerancia ±1 intervalo) o qrId/purchaseId/claimToken
 */
export function verifyTotpOrCode(scannedCode: string, ticket: Ticket): boolean {
  if (scannedCode === ticket.qrId || scannedCode === ticket.purchaseId || scannedCode === ticket.claimToken || scannedCode === ticket.id) {
    return true;
  }
  if (!ticket.secretSeed) return false;

  // Tolerancia de ±1 intervalo de tiempo (30s)
  for (let offset = -1; offset <= 1; offset++) {
    const validTotp = generateTotpCode(ticket.secretSeed, 30, offset);
    if (scannedCode === validTotp || scannedCode === `${ticket.qrId}-${validTotp}` || scannedCode.endsWith(validTotp)) {
      return true;
    }
  }
  return false;
}

/**
 * Extraer token o identificador de reclamo/boleto desde la URL actual
 * Soporta /reclamo/:id, /boleto/:id, /ticket/:id, /butaca/:id, query params y hashes
 */
export function extractClaimTokenFromUrl(): string | null {
  try {
    if (typeof window === 'undefined') return null;

    // 1. Revisar query parameters en window.location.search
    const params = new URLSearchParams(window.location.search);
    const queryCandidates = ['reclamo', 'claim', 'claimToken', 'ticket', 'boleto', 'token', 't', 'pass'];
    for (const key of queryCandidates) {
      const val = params.get(key);
      if (val && val.trim().length > 0) {
        return cleanTokenString(val);
      }
    }

    // 2. Revisar hash (#/reclamo/TOKEN o #reclamo=...)
    const hash = window.location.hash;
    if (hash) {
      if (hash.includes('reclamo=') || hash.includes('claim=')) {
        const hashParams = new URLSearchParams(hash.replace(/^#\/?\??/, ''));
        for (const key of queryCandidates) {
          const val = hashParams.get(key);
          if (val && val.trim().length > 0) {
            return cleanTokenString(val);
          }
        }
      }
      const hashPathMatches = hash.match(/#(?:!|\/)?(?:reclamo|boleto|ticket|pase|butaca|asiento)\/([^\/?#]+)/i);
      if (hashPathMatches && hashPathMatches[1]) {
        return cleanTokenString(hashPathMatches[1]);
      }
    }

    // 3. Revisar pathname (/reclamo/TOKEN, /boleto/TOKEN, etc.)
    const pathname = window.location.pathname;
    const pathMatches = pathname.match(/\/(?:reclamo|reclamos|boleto|boletos|ticket|tickets|pase|pases|butaca|butacas|asiento|asientos)\/([^\/?#]+)/i);
    if (pathMatches && pathMatches[1]) {
      return cleanTokenString(pathMatches[1]);
    }

    return null;
  } catch (err) {
    console.warn('Error al extraer claim token de la URL:', err);
    return null;
  }
}

function cleanTokenString(token: string): string {
  try {
    const decoded = decodeURIComponent(token);
    return decoded.trim().replace(/\/+$/, '');
  } catch {
    return token.trim().replace(/\/+$/, '');
  }
}

/**
 * Obtener la URL base pública adecuada para compartir con invitados
 * Si se genera desde el entorno de desarrollo de AI Studio (ais-dev-),
 * se reemplaza automáticamente por el entorno público (ais-pre-) para evitar que Google
 * solicite inicio de sesión en Google Cloud al invitado.
 */
export function getPublicAppBaseUrl(overrideDomain?: string): string {
  if (overrideDomain && overrideDomain.trim()) {
    return overrideDomain.trim().replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') return 'https://venados-vxp.web.app';

  try {
    const savedDomain = localStorage.getItem('vxp_public_domain');
    if (savedDomain && savedDomain.trim()) {
      return savedDomain.trim().replace(/\/+$/, '');
    }
  } catch {}

  const origin = window.location.origin;

  // Si estamos en el entorno de desarrollo privado de AI Studio (ais-dev-),
  // convertirlo automáticamente al entorno público compartido (ais-pre-)
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }

  return origin;
}

export interface ClaimLinkDetails {
  claimToken: string;
  claimUrl: string;
  whatsappUrl: string;
  shareTitle: string;
  shareText: string;
  baseUrl: string;
}

/**
 * Desglosar y generar enlace completo de reclamo (URL directa, WhatsApp, texto)
 */
export async function generateTicketClaimData(ticketId: string, customDomain?: string): Promise<ClaimLinkDetails> {
  const ticketRef = doc(db, 'tickets', ticketId);
  const ticketSnap = await getDoc(ticketRef);
  
  let claimToken = '';
  let matchTitle = 'Partido Oficial';
  let seatDesc = '';

  if (ticketSnap.exists()) {
    const data = ticketSnap.data() as Ticket;
    matchTitle = data.matchTitle || 'Partido Oficial';
    seatDesc = `${data.section || ''} - ${data.row || ''} - ${data.seat || ''}`.trim();
    // Si ya tenía un claimToken asignado, reutilizarlo para no invalidar enlaces previos
    if (data.claimToken) {
      claimToken = data.claimToken;
    }
  }

  if (!claimToken) {
    claimToken = `CLAIM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    await updateDoc(ticketRef, {
      claimToken,
      purchaseId: '', // Desvincula del grupo principal si era parte de una compra grupal
    });
  }

  const baseUrl = getPublicAppBaseUrl(customDomain);
  const claimUrl = `${baseUrl}/reclamo/${claimToken}`;
  const shareTitle = `🎟️ Tu Boleto Oficial: ${matchTitle}`;
  const shareText = `¡Hola! Te comparto tu boleto oficial para ${matchTitle} (${seatDesc}). Puedes abrirlo y mostrar tu código QR de acceso en los torniquetes sin necesidad de registrarte aquí: ${claimUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return {
    claimToken,
    claimUrl,
    whatsappUrl,
    shareTitle,
    shareText,
    baseUrl,
  };
}

/**
 * Desglosar y generar enlace de reclamo por WhatsApp para un boleto individual
 */
export async function generateTicketClaimLink(ticketId: string): Promise<string> {
  const details = await generateTicketClaimData(ticketId);
  return details.whatsappUrl;
}

/**
 * Validar y consumir boleto(s) de forma atómica con runTransaction de Firestore.
 * Si el código pertenece a una compra conjunta (purchaseId), valida y consume TODOS los boletos de la compra.
 */
export async function validateAndConsumeTicketByCode(
  code: string,
  gateName: string,
  userName: string
): Promise<ValidationScanResult> {
  const cleanCode = code.trim();
  if (!cleanCode) {
    return {
      success: false,
      status: 'invalido',
      message: 'Código de boleto vacío o inválido.',
      tickets: [],
    };
  }

  try {
    const ticketsCol = collection(db, 'tickets');
    
    // 1. Buscar por qrId
    let qSnap = await getDocs(query(ticketsCol, where('qrId', '==', cleanCode), limit(20)));
    let matchingDocs = qSnap.docs;

    // 2. Si no hay, buscar por purchaseId
    if (matchingDocs.length === 0) {
      qSnap = await getDocs(query(ticketsCol, where('purchaseId', '==', cleanCode), limit(20)));
      matchingDocs = qSnap.docs;
    }

    // 3. Si no hay, buscar por claimToken
    if (matchingDocs.length === 0) {
      qSnap = await getDocs(query(ticketsCol, where('claimToken', '==', cleanCode), limit(5)));
      matchingDocs = qSnap.docs;
    }

    // 4. Si no hay, buscar por ID de documento directo
    if (matchingDocs.length === 0) {
      try {
        const docRef = doc(db, 'tickets', cleanCode);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          matchingDocs = [docSnap as any];
        }
      } catch (e) {
        // Ignorar
      }
    }

    // 5. Si aún no hay, verificar si es un código TOTP dinámico entre boletos activos
    if (matchingDocs.length === 0) {
      const activeSnap = await getDocs(query(ticketsCol, where('status', '==', 'activo'), limit(150)));
      for (const d of activeSnap.docs) {
        const tktData = { id: d.id, ...(d.data() as Omit<Ticket, 'id'>) };
        if (verifyTotpOrCode(cleanCode, tktData)) {
          matchingDocs = [d as any];
          break;
        }
      }
    }

    if (matchingDocs.length === 0) {
      return {
        success: false,
        status: 'invalido',
        message: 'Boleto no encontrado en el sistema.',
        tickets: [],
      };
    }

    const ticketRefs = matchingDocs.map((d) => doc(db, 'tickets', d.id));
    const nowIso = new Date().toISOString();

    const result = await runTransaction(db, async (transaction) => {
      const ticketSnapshots = await Promise.all(ticketRefs.map((ref) => transaction.get(ref)));
      const fetchedTickets: Ticket[] = [];

      for (const snap of ticketSnapshots) {
        if (!snap.exists()) {
          throw new Error('NOT_FOUND');
        }
        fetchedTickets.push({ id: snap.id, ...(snap.data() as Omit<Ticket, 'id'>) });
      }

      // Verificar estados previos
      for (const t of fetchedTickets) {
        if (t.status === 'cancelado') {
          return {
            success: false,
            status: 'invalido' as const,
            message: 'Este boleto se encuentra cancelado.',
            tickets: fetchedTickets,
          };
        }
        if (t.status === 'usado') {
          const usedTimeStr = t.usedAt
            ? new Date(t.usedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'hora desconocida';
          return {
            success: false,
            status: 'usado' as const,
            message: `Boleto ya utilizado previamente en ${t.usedGate || 'otra puerta'} a las ${usedTimeStr}.`,
            tickets: fetchedTickets,
            usedAt: t.usedAt,
            usedGate: t.usedGate,
          };
        }
      }

      const hasSpecial = fetchedTickets.some((t) => !!t.specialType);

      // Consumir atómicamente
      for (const ref of ticketRefs) {
        transaction.update(ref, {
          status: 'usado',
          usedAt: nowIso,
          usedGate: gateName,
          usedBy: userName,
        });
      }

      return {
        success: true,
        status: hasSpecial ? ('especial' as const) : ('valido' as const),
        message: hasSpecial
          ? 'Boleto especial / cortesía. Requiere verificación de identificación.'
          : '¡Acceso Válido! Pase adelante.',
        tickets: fetchedTickets.map((t) => ({
          ...t,
          status: 'usado' as const,
          usedAt: nowIso,
          usedGate: gateName,
          usedBy: userName,
        })),
      };
    });

    return result;
  } catch (err: any) {
    console.error('Error en validación atómica:', err);
    if (err.message === 'NOT_FOUND') {
      return {
        success: false,
        status: 'invalido',
        message: 'El boleto o compra ya no existe en el sistema.',
        tickets: [],
      };
    }
    return {
      success: false,
      status: 'invalido',
      message: err.message || 'Error al procesar la validación del boleto.',
      tickets: [],
    };
  }
}

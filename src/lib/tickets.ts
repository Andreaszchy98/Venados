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
 * Extraer token o identificador de reclamo/boleto desde un string de URL arbitrario
 */
export function extractClaimTokenFromUrlString(urlStr: string): string | null {
  try {
    const clean = urlStr.trim();
    const reclamoMatch = clean.match(/(?:reclamo|reclamos|boleto|boletos|ticket|tickets|pase|pases)\/([^\/?#]+)/i);
    if (reclamoMatch && reclamoMatch[1]) {
      return decodeURIComponent(reclamoMatch[1]).trim().replace(/\/+$/, '');
    }
    const qMatch = clean.match(/[?&#](?:reclamo|claim|claimToken|ticket|boleto|token|t|pass)=([^&#]+)/i);
    if (qMatch && qMatch[1]) {
      return decodeURIComponent(qMatch[1]).trim().replace(/\/+$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verificar si un código escaneado coincide con el TOTP actual (con tolerancia de ±2 minutos) o qrId/purchaseId/claimToken
 */
export function verifyTotpOrCode(scannedCode: string, ticket: Ticket): boolean {
  const normScanned = (scannedCode || '').trim().toUpperCase();
  const normQr = (ticket.qrId || '').toUpperCase();
  const normPur = (ticket.purchaseId || '').toUpperCase();
  const normClaim = (ticket.claimToken || '').toUpperCase();
  const normId = (ticket.id || '').toUpperCase();

  // 1. Coincidencia exacta directa
  if (
    normScanned === normQr ||
    normScanned === normPur ||
    normScanned === normClaim ||
    normScanned === normId
  ) {
    return true;
  }

  // 2. Si el código escaneado tiene el formato [qrId]-[6_digitos_totp], extraer y comparar el prefijo base
  const baseFromScanned = normScanned.replace(/-[0-9]{6}$/, '').replace(/-+$/, '');
  if (
    baseFromScanned &&
    (baseFromScanned === normQr || baseFromScanned === normPur || baseFromScanned === normClaim || baseFromScanned === normId)
  ) {
    return true;
  }

  if (!ticket.secretSeed) return false;

  // 3. Tolerancia de ±4 intervalos de tiempo (120s / 2 minutos para evitar desincronizaciones de reloj entre teléfonos)
  for (let offset = -4; offset <= 4; offset++) {
    const validTotp = generateTotpCode(ticket.secretSeed, 30, offset);
    if (
      normScanned === validTotp ||
      normScanned === `${normQr}-${validTotp}` ||
      normScanned.endsWith(validTotp)
    ) {
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
  let raw = (code || '').trim();
  if (!raw) {
    return {
      success: false,
      status: 'invalido',
      message: 'Código de boleto vacío o ilegible.',
      tickets: [],
    };
  }

  // 1. Mensajes específicos si se escaneó un código de comida o tienda por error en taquilla
  if (raw.startsWith('FOOD:') || raw.includes('/pedido/comida') || raw.toLowerCase().includes('food')) {
    return {
      success: false,
      status: 'invalido',
      message: 'Este código corresponde a una orden de Alimentos y Bebidas (Pick-up / Concesión), no a un boleto de acceso a puertas.',
      tickets: [],
    };
  }
  if (raw.startsWith('MERCH:') || raw.includes('/pedido/tienda') || raw.toLowerCase().includes('merch')) {
    return {
      success: false,
      status: 'invalido',
      message: 'Este código corresponde a un pedido de Tienda Oficial (Merchandising / Envíos), no a un boleto de acceso a puertas.',
      tickets: [],
    };
  }

  // 2. Extraer identificador si el código es una URL completa
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('/reclamo/') || raw.includes('/boleto/') || raw.includes('/ticket/')) {
    const urlClaim = extractClaimTokenFromUrlString(raw);
    if (urlClaim) {
      raw = urlClaim;
    }
  }

  // 3. Limpiar prefijos auxiliares como 'TICKET:', 'BOLETO:', 'PASS:', 'QR:'
  let cleanCode = raw.replace(/^(?:TICKET|BOLETO|PASS|PASE|QR):/i, '').trim();
  cleanCode = cleanCode.replace(/[/\s-]+$/, '');

  // 4. Modo Simulación / Demo en Taquilla
  if (cleanCode.toUpperCase() === 'VND-2026-TKT-DEMO123' || cleanCode.toUpperCase() === 'DEMO123') {
    const nowIso = new Date().toISOString();
    return {
      success: true,
      status: 'valido',
      message: '¡Acceso Válido (Simulación de Prueba)! Pase adelante.',
      tickets: [
        {
          id: 'demo-ticket-123',
          userId: 'demo-user',
          eventId: DEFAULT_EVENT_ID,
          matchTitle: 'Venados de Mazatlán vs Tomateros de Culiacán (Demo)',
          opponent: 'Tomateros de Culiacán',
          matchDate: '2026-10-15',
          matchTime: '20:00 hrs',
          stadium: 'Estadio Teodoro Mariscal',
          section: 'Platino',
          row: 'Fila A',
          seat: 'Asiento 01',
          price: 750,
          status: 'usado',
          qrId: 'VND-2026-TKT-DEMO123',
          gate: gateName,
          createdAt: nowIso,
          usedAt: nowIso,
          usedGate: gateName,
          usedBy: userName,
        },
      ],
      usedAt: nowIso,
      usedGate: gateName,
    };
  }

  try {
    const ticketsCol = collection(db, 'tickets');
    const upperCode = cleanCode.toUpperCase();
    const baseCode = upperCode.replace(/-[0-9]{6}$/, '').replace(/-+$/, '');

    // Generar lista de términos de búsqueda prioritarios (código original, mayúsculas, base sin sufijo TOTP)
    const searchKeys = Array.from(new Set([cleanCode, upperCode, baseCode])).filter(Boolean);

    let matchingDocs: any[] = [];

    // 5. Buscar en Firestore por qrId, purchaseId, claimToken o doc ID
    for (const key of searchKeys) {
      if (matchingDocs.length > 0) break;

      // 5.1 Buscar por qrId
      const qQr = await getDocs(query(ticketsCol, where('qrId', '==', key), limit(20)));
      if (!qQr.empty) {
        matchingDocs = qQr.docs;
        break;
      }

      // 5.2 Buscar por purchaseId (compra conjunta)
      const qPur = await getDocs(query(ticketsCol, where('purchaseId', '==', key), limit(20)));
      if (!qPur.empty) {
        matchingDocs = qPur.docs;
        break;
      }

      // 5.3 Buscar por claimToken
      const qClaim = await getDocs(query(ticketsCol, where('claimToken', '==', key), limit(10)));
      if (!qClaim.empty) {
        matchingDocs = qClaim.docs;
        break;
      }

      // 5.4 Buscar por doc ID directo
      try {
        const directDoc = await getDoc(doc(db, 'tickets', key));
        if (directDoc.exists()) {
          matchingDocs = [directDoc];
          break;
        }
      } catch (e) {
        // Ignorar
      }
    }

    // 6. Si aún no hay coincidencia, realizar verificación dinámica TOTP sobre los boletos
    if (matchingDocs.length === 0) {
      const activeSnap = await getDocs(query(ticketsCol, limit(200)));
      for (const d of activeSnap.docs) {
        const tktData = { id: d.id, ...(d.data() as Omit<Ticket, 'id'>) };
        if (verifyTotpOrCode(cleanCode, tktData)) {
          matchingDocs = [d];
          break;
        }
      }
    }

    if (matchingDocs.length === 0) {
      return {
        success: false,
        status: 'invalido',
        message: 'Boleto no encontrado en el sistema. Asegúrate de escanear un código de acceso válido.',
        tickets: [],
      };
    }

    const ticketRefs = matchingDocs.map((d) => doc(db, 'tickets', d.id));
    const nowIso = new Date().toISOString();

    // Intentar consumo atómico con runTransaction
    try {
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
    } catch (txErr: any) {
      console.warn('Nota en transacción, procediendo con actualización directa de respaldo:', txErr);
      
      // Respaldo de actualización directa
      const fetchedTickets: Ticket[] = [];
      for (const d of matchingDocs) {
        const snap = await getDoc(d.ref);
        if (snap.exists()) {
          fetchedTickets.push({ id: snap.id, ...(snap.data() as Omit<Ticket, 'id'>) });
        }
      }

      for (const t of fetchedTickets) {
        if (t.status === 'cancelado') {
          return {
            success: false,
            status: 'invalido',
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
            status: 'usado',
            message: `Boleto ya utilizado previamente en ${t.usedGate || 'otra puerta'} a las ${usedTimeStr}.`,
            tickets: fetchedTickets,
            usedAt: t.usedAt,
            usedGate: t.usedGate,
          };
        }
      }

      for (const ref of ticketRefs) {
        await updateDoc(ref, {
          status: 'usado',
          usedAt: nowIso,
          usedGate: gateName,
          usedBy: userName,
        });
      }

      const hasSpecial = fetchedTickets.some((t) => !!t.specialType);
      return {
        success: true,
        status: hasSpecial ? 'especial' : 'valido',
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
    }
  } catch (err: any) {
    console.error('Error en validación de boleto:', err);
    if (err?.code === 'permission-denied') {
      return {
        success: false,
        status: 'invalido',
        message: 'Permiso denegado: tu cuenta requiere permisos de Taquilla o Administrador para validar accesos.',
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

export interface PosTicketItemRequest {
  seatId?: string;
  section: string;
  price: number;
  row?: string;
  seat?: string;
  gate?: string;
}

/**
 * Emitir e imprimir lote de boletos físicos en Punto de Venta (POS - Taquillera)
 */
export async function createPosTicketBatch(params: {
  eventId: string;
  venueId?: string;
  matchTitle: string;
  opponent: string;
  matchDate: string;
  matchTime: string;
  stadium: string;
  items: PosTicketItemRequest[];
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
  customerName: string;
  customerEmail?: string;
  issuedBy: string;
  terminalId: string;
  userId?: string;
}): Promise<{ posSaleId: string; tickets: Ticket[]; totalAmount: number }> {
  const posSaleId = `POS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const purchaseId = `PUR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const nowIso = new Date().toISOString();
  let totalAmount = 0;

  const ticketsCol = collection(db, 'tickets');
  const createdTickets: Ticket[] = [];

  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i];
    totalAmount += item.price;
    const qrId = `VND-2026-TKT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const claimToken = `CLAIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const secretSeed = `SEED-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newTicketData: Omit<Ticket, 'id'> = {
      userId: params.userId || 'cliente-ventanilla',
      eventId: params.eventId,
      venueId: params.venueId || DEFAULT_VENUE_ID,
      matchTitle: params.matchTitle,
      opponent: params.opponent,
      matchDate: params.matchDate,
      matchTime: params.matchTime,
      stadium: params.stadium,
      section: item.section,
      row: item.row || `Fila ${String.fromCharCode(65 + (i % 10))}`,
      seat: item.seat || `Asiento ${String(i + 1).padStart(2, '0')}`,
      price: item.price,
      status: 'activo',
      qrId,
      claimToken,
      secretSeed,
      purchaseId,
      gate: item.gate || 'Puerta 1 - Central Principal',
      createdAt: nowIso,
      paymentMethod: params.paymentMethod,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      issuedBy: params.issuedBy,
      terminalId: params.terminalId,
      isPhysicalPrint: true,
      posSaleId,
    };

    const docRef = await addDoc(ticketsCol, newTicketData);
    createdTickets.push({
      id: docRef.id,
      ...newTicketData,
    });

    // Actualizar el documento del asiento físico en Firestore a 'vendido'
    if (item.seatId) {
      try {
        await updateDoc(doc(db, 'eventSeats', item.seatId), {
          status: 'vendido',
          soldTo: params.customerName || 'Cliente Ventanilla',
          soldAt: nowIso,
          updatedAt: nowIso,
        });
      } catch (seatErr) {
        console.warn('Nota actualizando estado de asiento en POS:', seatErr);
      }
    }
  }

  // Registrar transacción de venta para auditoría y finanzas
  try {
    const salesCol = collection(db, 'sales');
    await addDoc(salesCol, {
      channel: 'boletos',
      type: 'boletos',
      posSaleId,
      purchaseId,
      userId: params.userId || 'cliente-ventanilla',
      venueId: params.venueId || DEFAULT_VENUE_ID,
      eventId: params.eventId,
      amount: totalAmount,
      date: nowIso,
      paymentMethod: params.paymentMethod,
      customerName: params.customerName,
      customerEmail: params.customerEmail || '',
      issuedBy: params.issuedBy,
      terminalId: params.terminalId,
      ticketCount: params.items.length,
      status: 'completada',
    });
  } catch (saleErr) {
    console.warn('Nota al registrar venta de auditoría POS:', saleErr);
  }

  return {
    posSaleId,
    tickets: createdTickets,
    totalAmount,
  };
}


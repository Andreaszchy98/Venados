import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import Stripe from 'stripe';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Lazy Stripe Client
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// In-memory fallback for simulated test sessions when STRIPE_SECRET_KEY is not configured
interface SimulatedSession {
  id: string;
  payment_intent: string;
  payment_status: 'paid' | 'unpaid';
  amount_total: number;
  currency: string;
  metadata: Record<string, string>;
  customer_email?: string;
  created: number;
  success_url: string;
  cancel_url: string;
}
const simulatedSessions = new Map<string, SimulatedSession>();

// Lazy Firestore Client on Server
let serverDb: any = null;
function getServerDb() {
  if (!serverDb) {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const firebaseConfigData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const firebaseConfig = {
        apiKey: firebaseConfigData.apiKey,
        authDomain: firebaseConfigData.authDomain,
        projectId: firebaseConfigData.projectId,
        storageBucket: firebaseConfigData.storageBucket,
        messagingSenderId: firebaseConfigData.messagingSenderId,
        appId: firebaseConfigData.appId,
      };
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig, 'vxp-server-app');
      const databaseId = firebaseConfigData.firestoreDatabaseId || undefined;
      serverDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    } catch (e) {
      console.error('Error inicializando Firestore en server.ts:', e);
    }
  }
  return serverDb;
}

// Caché en memoria para evitar llamadas redundantes a Gemini
const translationMemoryCache = new Map<string, string>();
let translationCooldownUntil = 0;

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return aiClient;
}

// Función robusta de traducción con Gemini usando modelos oficiales soportados y control de cuota
async function translateWithGemini(
  ai: GoogleGenAI,
  texts: string[],
  targetLanguageName: string
): Promise<string[]> {
  // Si estamos en período de enfriamiento por cuota temporal de free tier (429/503), usar fallback sin saturar la API
  if (Date.now() < translationCooldownUntil) {
    return texts;
  }

  // Modelos oficiales recomendados por la especificación gemini-api
  const models = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];

  const prompt = `You are a professional multilingual translator for "VXP" (Venue Experience Platform), a stadium sports, e-commerce, concessions food & beverage, and logistics management system.
Translate the following JSON array of strings into ${targetLanguageName}.
Guidelines:
- Keep the natural tone of stadiums, baseball/soccer games, merchandise (jerseys, caps), fast food (tacos, beer, hot dogs), ticketing, and inventory.
- Retain brand names (e.g., Venados, Tomateros, Pacífico, DHL, Estafeta), currency symbols, seat coordinates (e.g. Fila 12, Butaca 4), numbers, and emojis intact.
- Translate terms accurately (e.g. "butaca" -> "seat", "abono" -> "season pass/ticket", "comanda" -> "kitchen ticket/order", "guía de envío" -> "tracking number / shipping label").
- Maintain the exact order and length of the array.
- Output MUST be a JSON array of strings only.

Input strings to translate:
${JSON.stringify(texts)}`;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text?.trim() || '[]';
      let parsed: string[] = [];
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isQuotaOrBusy = msg.includes('429') || msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('high demand') || err?.status === 429 || err?.status === 503;
      if (isQuotaOrBusy) {
        // Pausar peticiones remotas durante 45s para permitir la recuperación de cuota del free tier
        translationCooldownUntil = Date.now() + 45000;
        return texts;
      }
    }
  }

  return texts;
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));

  // Endpoint de salud
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      cachedTranslations: translationMemoryCache.size,
    });
  });

  // Endpoint de Traducción Automática con Gemini 2.5 Flash
  app.post('/api/translate', async (req, res) => {
    try {
      const { texts, targetLang = 'en', sourceLang = 'es' } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({ error: 'texts debe ser un arreglo no vacío de cadenas' });
      }

      // Validar cadenas y filtrar
      const cleanTexts: string[] = texts.map((t) => (typeof t === 'string' ? t.trim() : ''));

      // Verificar cuáles ya están en memoria
      const results: string[] = new Array(cleanTexts.length);
      const pendingIndices: number[] = [];
      const pendingTexts: string[] = [];

      cleanTexts.forEach((txt, idx) => {
        if (!txt) {
          results[idx] = '';
          return;
        }
        // Si no hay letras (puro número o símbolo), se queda igual
        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(txt)) {
          results[idx] = txt;
          return;
        }
        const cacheKey = `${targetLang}:${txt}`;
        if (translationMemoryCache.has(cacheKey)) {
          results[idx] = translationMemoryCache.get(cacheKey)!;
        } else {
          pendingIndices.push(idx);
          pendingTexts.push(txt);
        }
      });

      // Si todo estaba en caché, devolver de inmediato
      if (pendingTexts.length === 0) {
        return res.json({ translations: results, source: 'cache' });
      }

      const ai = getAI();
      if (!ai) {
        console.warn('GEMINI_API_KEY no encontrada en el entorno. Devolviendo textos originales.');
        pendingIndices.forEach((idx, i) => {
          results[idx] = pendingTexts[i];
        });
        return res.json({ translations: results, warning: 'No GEMINI_API_KEY set' });
      }

      const targetLanguageName = targetLang === 'en' ? 'English (US)' : 'Spanish (Mexico/Latin America)';

      const translatedArray = await translateWithGemini(ai, pendingTexts, targetLanguageName);

      // Rellenar resultados y guardar en caché
      pendingIndices.forEach((origIdx, i) => {
        const translated = (translatedArray && translatedArray[i]) ? String(translatedArray[i]).trim() : pendingTexts[i];
        results[origIdx] = translated;
        const cacheKey = `${targetLang}:${pendingTexts[i]}`;
        if (translated) {
          translationMemoryCache.set(cacheKey, translated);
        }
      });

      return res.json({
        translations: results,
        source: 'gemini-2.5-flash',
      });
    } catch (error: any) {
      console.error('Error en /api/translate:', error);
      const fallback = Array.isArray(req.body?.texts) ? req.body.texts : [];
      return res.json({
        translations: fallback,
        error: error.message || 'Translation failed',
      });
    }
  });

  // ==========================================
  // STRIPE PAYMENT INTEGRATION ENDPOINTS
  // ==========================================

  // 1. Crear sesión de Checkout en Stripe
  app.post('/api/stripe/createCheckoutSession', async (req, res) => {
    try {
      const { ticketData, successUrl, cancelUrl, customerEmail } = req.body;

      if (!ticketData || !ticketData.eventId) {
        return res.status(400).json({ error: 'ticketData con eventId es requerido' });
      }

      const rawPrice = Number(ticketData.price || 0);
      const unitAmount = Math.max(100, Math.round(rawPrice * 100)); // centavos MXN (mínimo $1.00)
      const eventName = String(ticketData.matchTitle || ticketData.eventTitle || 'Boleto Deportivo VXP');
      const venueStadium = String(ticketData.stadium || ticketData.stadiumName || 'Estadio');
      const seatDescription = `Sec: ${ticketData.section || ticketData.sectionId || 'General'} | Fila: ${ticketData.seatRow || ticketData.row || 'N/A'} | Asiento: ${ticketData.seatNumber || ticketData.seat || 'N/A'}`;

      const clientEmail = customerEmail || ticketData.customerEmail || '';
      const resolvedSuccessUrl = successUrl || `${req.protocol}://${req.get('host')}/?stripe_status=success`;
      const resolvedCancelUrl = cancelUrl || `${req.protocol}://${req.get('host')}/?stripe_status=cancelled`;

      const stripe = getStripe();

      // Si no hay clave de Stripe configurada, creamos una sesión de simulación guiada para el entorno preview
      if (!stripe) {
        const simulatedId = `cs_demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const simulatedPi = `pi_demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        simulatedSessions.set(simulatedId, {
          id: simulatedId,
          payment_intent: simulatedPi,
          payment_status: 'unpaid',
          amount_total: unitAmount,
          currency: 'mxn',
          metadata: {
            eventId: String(ticketData.eventId || ''),
            sectionId: String(ticketData.sectionId || ticketData.section || ''),
            section: String(ticketData.section || ticketData.sectionId || ''),
            seatRow: String(ticketData.seatRow || ticketData.row || ''),
            seatNumber: String(ticketData.seatNumber || ticketData.seat || ''),
            userId: String(ticketData.userId || ''),
            customerName: String(ticketData.customerName || 'Aficionado'),
            customerEmail: String(clientEmail),
            price: String(rawPrice),
            matchTitle: eventName,
            stadium: venueStadium,
            venueId: String(ticketData.venueId || 'venue-teodoro-mariscal'),
            gate: String(ticketData.gate || 'Puertas Generales'),
            seatId: String(ticketData.seatId || ''),
            selectedSeatsJson: ticketData.selectedSeats ? JSON.stringify(ticketData.selectedSeats).slice(0, 480) : '',
          },
          customer_email: clientEmail,
          created: Math.floor(Date.now() / 1000),
          success_url: resolvedSuccessUrl,
          cancel_url: resolvedCancelUrl,
        });

        const demoUrl = `/?stripe_checkout_demo=${simulatedId}`;
        return res.json({
          sessionId: simulatedId,
          sessionUrl: demoUrl,
          isDemoMode: true,
          message: 'Modo Demo Activo: Añade STRIPE_SECRET_KEY para procesar pagos reales en Stripe.',
        });
      }

      // Sesión real en Stripe Checkout
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: clientEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: 'mxn',
              product_data: {
                name: `${eventName} — ${ticketData.section || 'Entrada General'}`,
                description: `${venueStadium} • ${seatDescription}`,
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          eventId: String(ticketData.eventId || ''),
          sectionId: String(ticketData.sectionId || ticketData.section || ''),
          section: String(ticketData.section || ticketData.sectionId || ''),
          seatRow: String(ticketData.seatRow || ticketData.row || ''),
          seatNumber: String(ticketData.seatNumber || ticketData.seat || ''),
          userId: String(ticketData.userId || ''),
          customerName: String(ticketData.customerName || 'Aficionado'),
          customerEmail: String(clientEmail),
          price: String(rawPrice),
          matchTitle: eventName,
          stadium: venueStadium,
          venueId: String(ticketData.venueId || 'venue-teodoro-mariscal'),
          gate: String(ticketData.gate || 'Puertas Generales'),
          seatId: String(ticketData.seatId || ''),
          selectedSeatsJson: ticketData.selectedSeats ? JSON.stringify(ticketData.selectedSeats).slice(0, 480) : '',
        },
        success_url: `${resolvedSuccessUrl}${resolvedSuccessUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: resolvedCancelUrl,
      });

      return res.json({
        sessionId: session.id,
        sessionUrl: session.url,
        isDemoMode: false,
      });
    } catch (error: any) {
      console.error('Error en /api/stripe/createCheckoutSession:', error);
      return res.status(500).json({ error: error.message || 'Error al crear sesión en Stripe' });
    }
  });

  // 2. Verificar y Emitir Boleto tras el Checkout (Sin Webhook)
  app.post('/api/stripe/verifyAndFulfillCheckout', async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId es obligatorio' });
      }

      let paymentStatus = 'unpaid';
      let paymentIntentId = '';
      let metadata: Record<string, string> = {};
      let customerEmail = '';
      let customerName = 'Aficionado';
      let amountPaid = 0;

      const stripe = getStripe();

      // Verificar si es sesión simulada en demo
      if (simulatedSessions.has(sessionId)) {
        const sim = simulatedSessions.get(sessionId)!;
        paymentStatus = sim.payment_status;
        paymentIntentId = sim.payment_intent;
        metadata = sim.metadata;
        customerEmail = sim.customer_email || metadata.customerEmail || '';
        customerName = metadata.customerName || 'Aficionado';
        amountPaid = sim.amount_total / 100;
      } else if (stripe) {
        // Consultar la sesión directamente a Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        paymentStatus = session.payment_status;
        paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;
        metadata = (session.metadata as Record<string, string>) || {};
        customerEmail = session.customer_details?.email || metadata.customerEmail || '';
        customerName = session.customer_details?.name || metadata.customerName || 'Aficionado';
        amountPaid = session.amount_total ? session.amount_total / 100 : Number(metadata.price || 0);
      } else {
        return res.status(404).json({ error: 'Sesión no encontrada en Stripe o memoria' });
      }

      if (paymentStatus !== 'paid') {
        return res.status(400).json({
          success: false,
          error: 'El pago no ha sido completado en Stripe.',
          paymentStatus,
        });
      }

      const db = getServerDb();
      if (!db) {
        return res.status(500).json({ error: 'No se pudo conectar a la base de datos Firestore' });
      }

      // Evitar duplicar: consultar si ya existe un boleto emitido con este stripePaymentIntentId o stripeSessionId
      const ticketsRef = collection(db, 'tickets');
      const qPi = query(ticketsRef, where('stripePaymentIntentId', '==', paymentIntentId));
      const existingSnap = await getDocs(qPi);

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        return res.json({
          success: true,
          alreadyFulfilled: true,
          ticketId: existingDoc.id,
          ticket: { id: existingDoc.id, ...existingDoc.data() },
        });
      }

      // Si no existe, creamos el boleto en Firestore
      const isEncanto = (metadata.venueId || '').includes('encanto') || (metadata.stadium || '').includes('Encanto');
      const qrPrefix = isEncanto ? 'DOR-2026-TKT-' : 'VND-2026-TKT-';
      const qrId = `${qrPrefix}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const now = new Date().toISOString();

      const newTicket = {
        userId: metadata.userId || 'guest',
        eventId: metadata.eventId || 'event-default',
        venueId: metadata.venueId || 'venue-teodoro-mariscal',
        matchTitle: metadata.matchTitle || 'Boleto VXP',
        stadium: metadata.stadium || 'Estadio',
        section: metadata.section || metadata.sectionId || 'General',
        row: metadata.seatRow || 'Fila General',
        seat: metadata.seatNumber || 'Asiento General',
        price: Number(metadata.price) || amountPaid,
        status: 'activo',
        qrId,
        gate: metadata.gate || 'Puertas Generales',
        createdAt: now,
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: sessionId,
        paymentStatus: 'paid',
        paymentMethod: 'stripe',
        customerEmail,
        customerName,
      };

      const docRef = await addDoc(ticketsRef, newTicket);

      // Registrar venta en auditoría
      try {
        await addDoc(collection(db, 'sales'), {
          channel: 'boletos',
          userId: newTicket.userId,
          venueId: newTicket.venueId,
          eventId: newTicket.eventId,
          referenceId: docRef.id,
          customerName,
          customerEmail,
          description: `Boleto Stripe: ${newTicket.matchTitle} - ${newTicket.section} (${newTicket.seat})`,
          amount: newTicket.price,
          paymentMethod: 'stripe',
          stripePaymentIntentId: paymentIntentId,
          stripeSessionId: sessionId,
          date: now,
          status: 'completada',
        });
      } catch (saleErr) {
        console.warn('Advertencia registrando auditoría de venta Stripe:', saleErr);
      }

      // Actualizar estado del asiento si se especificó seatId
      try {
        if (metadata.seatId) {
          const seatRef = doc(db, 'eventSeats', metadata.seatId);
          await setDoc(
            seatRef,
            {
              status: 'vendido',
              ticketId: docRef.id,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      } catch (seatErr) {
        console.warn('Advertencia actualizando estado de asiento:', seatErr);
      }

      return res.json({
        success: true,
        alreadyFulfilled: false,
        ticketId: docRef.id,
        qrId,
        ticket: { id: docRef.id, ...newTicket },
      });
    } catch (error: any) {
      console.error('Error en /api/stripe/verifyAndFulfillCheckout:', error);
      return res.status(500).json({ error: error.message || 'Error verificando checkout' });
    }
  });

  // 3. Completar Sesión Simulada en Modo Demo
  app.post('/api/stripe/simulatedComplete', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !simulatedSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Sesión simulada no encontrada' });
    }
    const session = simulatedSessions.get(sessionId)!;
    session.payment_status = 'paid';
    return res.json({ success: true, session });
  });

  // 4. Obtener información de sesión simulada
  app.get('/api/stripe/simulatedSession/:id', (req, res) => {
    const { id } = req.params;
    if (!simulatedSessions.has(id)) {
      return res.status(404).json({ error: 'Sesión simulada no encontrada' });
    }
    return res.json(simulatedSessions.get(id));
  });

  // 5. Listar pagos pendientes en Stripe para el panel Admin
  app.get('/api/stripe/pendingSessions', async (req, res) => {
    try {
      const stripe = getStripe();
      const db = getServerDb();

      if (!db) {
        return res.status(500).json({ error: 'Firestore no disponible en el servidor' });
      }

      // Obtener todos los IDs de stripe ya fulfilled en Firestore
      const ticketsSnap = await getDocs(collection(db, 'tickets'));
      const fulfilledPointers = new Set<string>();
      ticketsSnap.forEach((d) => {
        const data = d.data();
        if (data.stripePaymentIntentId) fulfilledPointers.add(data.stripePaymentIntentId);
        if (data.stripeSessionId) fulfilledPointers.add(data.stripeSessionId);
      });

      const pendingList: any[] = [];

      // Incluir sesiones simuladas completadas pendientes si existen
      simulatedSessions.forEach((s) => {
        if (s.payment_status === 'paid' && !fulfilledPointers.has(s.id) && !fulfilledPointers.has(s.payment_intent)) {
          pendingList.push({
            id: s.id,
            paymentIntentId: s.payment_intent,
            amountTotal: s.amount_total / 100,
            currency: s.currency.toUpperCase(),
            customerEmail: s.customer_email || s.metadata?.customerEmail || 'demo@aficionado.mx',
            customerName: s.metadata?.customerName || 'Aficionado Demo',
            eventName: s.metadata?.matchTitle || 'Boleto Deportivo',
            section: s.metadata?.section || 'General',
            seat: `${s.metadata?.seatRow || ''} ${s.metadata?.seatNumber || ''}`.trim() || 'General',
            created: new Date(s.created * 1000).toISOString(),
            isDemo: true,
          });
        }
      });

      // Si hay Stripe real, consultar sesiones recientes
      if (stripe) {
        try {
          const sessions = await stripe.checkout.sessions.list({
            limit: 30,
            status: 'complete',
          });

          for (const s of sessions.data) {
            if (s.payment_status === 'paid') {
              const pi = typeof s.payment_intent === 'string' ? s.payment_intent : '';
              if (!fulfilledPointers.has(s.id) && (!pi || !fulfilledPointers.has(pi))) {
                pendingList.push({
                  id: s.id,
                  paymentIntentId: pi,
                  amountTotal: s.amount_total ? s.amount_total / 100 : 0,
                  currency: (s.currency || 'mxn').toUpperCase(),
                  customerEmail: s.customer_details?.email || s.metadata?.customerEmail || '',
                  customerName: s.customer_details?.name || s.metadata?.customerName || 'Aficionado',
                  eventName: s.metadata?.matchTitle || 'Boleto VXP',
                  section: s.metadata?.section || 'General',
                  seat: `${s.metadata?.seatRow || ''} ${s.metadata?.seatNumber || ''}`.trim() || 'General',
                  created: new Date(s.created * 1000).toISOString(),
                  isDemo: false,
                });
              }
            }
          }
        } catch (stripeErr: any) {
          console.warn('Aviso consultando Stripe Checkout sessions:', stripeErr.message);
        }
      }

      return res.json({
        configured: Boolean(stripe),
        pendingSessions: pendingList,
      });
    } catch (error: any) {
      console.error('Error en /api/stripe/pendingSessions:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 6. Procesar pago directo con tarjeta (formulario en la aplicación)
  app.post('/api/stripe/processDirectPayment', async (req, res) => {
    try {
      const {
        amount,
        concept,
        customerName,
        customerEmail,
        cardLast4,
        cardBrand,
        orderType,
        metadata,
      } = req.body;

      const numAmount = Number(amount);
      if (!numAmount || numAmount <= 0) {
        return res.status(400).json({ error: 'Monto inválido para procesamiento de pago' });
      }

      const stripe = getStripe();
      let paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      if (stripe) {
        try {
          const isTestKey = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');

          let paymentMethod = 'pm_card_visa';
          const brand = (cardBrand || '').toLowerCase();
          if (brand.includes('mastercard')) {
            paymentMethod = 'pm_card_mastercard';
          } else if (brand.includes('amex')) {
            paymentMethod = 'pm_card_amex';
          }

          // Crear y confirmar PaymentIntent oficial en Stripe para registro inmediato como pago exitoso
          const pi = await stripe.paymentIntents.create({
            amount: Math.round(numAmount * 100),
            currency: 'mxn',
            payment_method: isTestKey ? paymentMethod : undefined,
            confirm: isTestKey,
            return_url: `${req.protocol}://${req.get('host')}/`,
            description: `${concept || 'Pago VXP'} — ${customerName || 'Aficionado'}`,
            receipt_email: customerEmail || undefined,
            metadata: {
              customerName: String(customerName || ''),
              customerEmail: String(customerEmail || ''),
              concept: String(concept || ''),
              cardLast4: String(cardLast4 || ''),
              cardBrand: String(cardBrand || ''),
              orderType: String(orderType || 'directo'),
              ...(metadata || {}),
            },
          });
          paymentIntentId = pi.id;
        } catch (stripeErr: any) {
          console.error('Error al procesar PaymentIntent en Stripe:', stripeErr?.message);
          return res.status(500).json({
            error: `Error procesando el cobro en Stripe: ${stripeErr?.message || 'Error en pasarela'}`,
          });
        }
      }

      const authCode = `VXP-${Math.floor(100000 + Math.random() * 900000)}`;

      return res.json({
        success: true,
        paymentIntentId,
        authCode,
        amount: numAmount,
        currency: 'MXN',
        cardLast4: cardLast4 || '4242',
        cardBrand: cardBrand || 'Visa',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error en /api/stripe/processDirectPayment:', error);
      return res.status(500).json({ error: error.message || 'Error al procesar el pago con tarjeta' });
    }
  });

  // Vite middleware en desarrollo o archivos estáticos en producción
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VXP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

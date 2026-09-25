import express from 'express';
import path from 'path';
import fs from 'fs';
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
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS headers para Vercel y clientes remotos
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Client Stripe perezoso
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// Fallback en memoria para sesiones simuladas de prueba
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

// Client Firestore en el servidor
let serverDb: any = null;
function getServerDb() {
  if (!serverDb) {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const firebaseConfigData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const firebaseConfig = {
          apiKey: firebaseConfigData.apiKey,
          authDomain: firebaseConfigData.authDomain,
          projectId: firebaseConfigData.projectId,
          storageBucket: firebaseConfigData.storageBucket,
          messagingSenderId: firebaseConfigData.messagingSenderId,
          appId: firebaseConfigData.appId,
        };
        const appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig, 'vxp-server-app');
        const databaseId = firebaseConfigData.firestoreDatabaseId || undefined;
        serverDb = databaseId ? getFirestore(appInstance, databaseId) : getFirestore(appInstance);
      }
    } catch (e) {
      console.error('Error inicializando Firestore en el servidor:', e);
    }
  }
  return serverDb;
}

// Caché de traducción
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

async function translateWithGemini(
  ai: GoogleGenAI,
  texts: string[],
  targetLanguageName: string
): Promise<string[]> {
  if (Date.now() < translationCooldownUntil) {
    return texts;
  }
  const models = ['gemini-flash-latest', 'gemini-3.1-flash-lite'];
  const prompt = `You are a professional multilingual translator for "VXP" (Venue Experience Platform).
Translate the following JSON array of strings into ${targetLanguageName}.
Maintain exact length and order. Output MUST be a JSON array of strings only.
Input: ${JSON.stringify(texts)}`;

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
      if (msg.includes('429') || msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED')) {
        translationCooldownUntil = Date.now() + 45000;
        return texts;
      }
    }
  }
  return texts;
}

// Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasStripeKey: Boolean(process.env.STRIPE_SECRET_KEY),
    cachedTranslations: translationMemoryCache.size,
  });
});

// Translate Endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { texts, targetLang = 'en' } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'texts debe ser un arreglo no vacío' });
    }
    const cleanTexts: string[] = texts.map((t) => (typeof t === 'string' ? t.trim() : ''));
    const results: string[] = new Array(cleanTexts.length);
    const pendingIndices: number[] = [];
    const pendingTexts: string[] = [];

    cleanTexts.forEach((txt, idx) => {
      if (!txt || !/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(txt)) {
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

    if (pendingTexts.length === 0) {
      return res.json({ translations: results, source: 'cache' });
    }

    const ai = getAI();
    if (!ai) {
      pendingIndices.forEach((idx, i) => {
        results[idx] = pendingTexts[i];
      });
      return res.json({ translations: results, warning: 'No GEMINI_API_KEY set' });
    }

    const targetLanguageName = targetLang === 'en' ? 'English (US)' : 'Spanish (Mexico)';
    const translatedArray = await translateWithGemini(ai, pendingTexts, targetLanguageName);

    pendingIndices.forEach((origIdx, i) => {
      const translated = (translatedArray && translatedArray[i]) ? String(translatedArray[i]).trim() : pendingTexts[i];
      results[origIdx] = translated;
      const cacheKey = `${targetLang}:${pendingTexts[i]}`;
      if (translated) translationMemoryCache.set(cacheKey, translated);
    });

    return res.json({ translations: results, source: 'gemini' });
  } catch (error: any) {
    const fallback = Array.isArray(req.body?.texts) ? req.body.texts : [];
    return res.json({ translations: fallback, error: error.message || 'Translation failed' });
  }
});

// ==========================================
// ENDPOINTS DE PAGO STRIPE
// ==========================================

// 1. Crear checkout session
app.post('/api/stripe/createCheckoutSession', async (req, res) => {
  try {
    const { ticketData, successUrl, cancelUrl, customerEmail } = req.body;
    if (!ticketData || !ticketData.eventId) {
      return res.status(400).json({ error: 'ticketData con eventId es requerido' });
    }

    const rawPrice = Number(ticketData.price || 0);
    const unitAmount = Math.max(100, Math.round(rawPrice * 100));
    const eventName = String(ticketData.matchTitle || ticketData.eventTitle || 'Boleto Deportivo VXP');
    const venueStadium = String(ticketData.stadium || ticketData.stadiumName || 'Estadio');
    const seatDescription = `Sec: ${ticketData.section || ticketData.sectionId || 'General'} | Fila: ${ticketData.seatRow || ticketData.row || 'N/A'} | Asiento: ${ticketData.seatNumber || ticketData.seat || 'N/A'}`;

    const clientEmail = customerEmail || ticketData.customerEmail || '';
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const resolvedSuccessUrl = successUrl || `${protocol}://${host}/?stripe_status=success`;
    const resolvedCancelUrl = cancelUrl || `${protocol}://${host}/?stripe_status=cancelled`;

    const stripe = getStripe();

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
        message: 'Modo Demo Activo: Configura STRIPE_SECRET_KEY en Vercel para cobros reales en Stripe.',
      });
    }

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

// 2. Verificar y emitir boleto tras Checkout
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

    if (simulatedSessions.has(sessionId)) {
      const sim = simulatedSessions.get(sessionId)!;
      paymentStatus = sim.payment_status;
      paymentIntentId = sim.payment_intent;
      metadata = sim.metadata;
      customerEmail = sim.customer_email || metadata.customerEmail || '';
      customerName = metadata.customerName || 'Aficionado';
      amountPaid = sim.amount_total / 100;
    } else if (stripe) {
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
    const isEncanto = (metadata.venueId || '').includes('encanto') || (metadata.stadium || '').includes('Encanto');
    const qrPrefix = isEncanto ? 'DOR-2026-TKT-' : 'VND-2026-TKT-';
    const qrId = `${qrPrefix}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const now = new Date().toISOString();

    const newTicketData = {
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

    if (!db) {
      return res.json({
        success: true,
        alreadyFulfilled: false,
        ticketId: `tkt_demo_${Date.now()}`,
        qrId,
        ticket: { id: `tkt_demo_${Date.now()}`, ...newTicketData },
      });
    }

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

    const docRef = await addDoc(ticketsRef, newTicketData);

    try {
      await addDoc(collection(db, 'sales'), {
        channel: 'boletos',
        userId: newTicketData.userId,
        venueId: newTicketData.venueId,
        eventId: newTicketData.eventId,
        referenceId: docRef.id,
        customerName,
        customerEmail,
        description: `Boleto Stripe: ${newTicketData.matchTitle} - ${newTicketData.section} (${newTicketData.seat})`,
        amount: newTicketData.price,
        paymentMethod: 'stripe',
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: sessionId,
        date: now,
        status: 'completada',
      });
    } catch {}

    try {
      if (metadata.seatId) {
        const seatRef = doc(db, 'eventSeats', metadata.seatId);
        await setDoc(seatRef, { status: 'vendido', ticketId: docRef.id, updatedAt: now }, { merge: true });
      }
    } catch {}

    return res.json({
      success: true,
      alreadyFulfilled: false,
      ticketId: docRef.id,
      qrId,
      ticket: { id: docRef.id, ...newTicketData },
    });
  } catch (error: any) {
    console.error('Error en /api/stripe/verifyAndFulfillCheckout:', error);
    return res.status(500).json({ error: error.message || 'Error verificando checkout' });
  }
});

// 3. Completar sesión simulada
app.post('/api/stripe/simulatedComplete', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !simulatedSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Sesión simulada no encontrada' });
  }
  const session = simulatedSessions.get(sessionId)!;
  session.payment_status = 'paid';
  return res.json({ success: true, session });
});

// 4. Obtener sesión simulada
app.get('/api/stripe/simulatedSession/:id', (req, res) => {
  const { id } = req.params;
  if (!simulatedSessions.has(id)) {
    return res.status(404).json({ error: 'Sesión simulada no encontrada' });
  }
  return res.json(simulatedSessions.get(id));
});

// 5. Sesiones pendientes
app.get('/api/stripe/pendingSessions', async (req, res) => {
  try {
    const stripe = getStripe();
    const pendingList: any[] = [];

    simulatedSessions.forEach((s) => {
      if (s.payment_status === 'paid') {
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

    if (stripe) {
      try {
        const sessions = await stripe.checkout.sessions.list({ limit: 20, status: 'complete' });
        for (const s of sessions.data) {
          if (s.payment_status === 'paid') {
            const pi = typeof s.payment_intent === 'string' ? s.payment_intent : '';
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
      } catch {}
    }

    return res.json({
      configured: Boolean(stripe),
      pendingSessions: pendingList,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. Procesar pago directo con tarjeta
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
        const secretKey = process.env.STRIPE_SECRET_KEY || '';
        const isTestKey = secretKey.startsWith('sk_test_');

        let paymentMethod = 'pm_card_visa';
        const brand = (cardBrand || '').toLowerCase();
        if (brand.includes('mastercard')) {
          paymentMethod = 'pm_card_mastercard';
        } else if (brand.includes('amex')) {
          paymentMethod = 'pm_card_amex';
        }

        if (isTestKey) {
          const pi = await stripe.paymentIntents.create({
            amount: Math.round(numAmount * 100),
            currency: 'mxn',
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never',
            },
            payment_method: paymentMethod,
            confirm: true,
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
        } else {
          const pi = await stripe.paymentIntents.create({
            amount: Math.round(numAmount * 100),
            currency: 'mxn',
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
        }
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

export default app;

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Caché en memoria para evitar llamadas redundantes a Gemini
const translationMemoryCache = new Map<string, string>();

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

// Función robusta de traducción con Gemini 2.5 Flash y fallback a Gemini 2.5 Flash Lite
async function translateWithGemini(
  ai: GoogleGenAI,
  texts: string[],
  targetLanguageName: string
): Promise<string[]> {
  const models = ['gemini-3.6-flash', 'gemini-3.8-flash'];

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

  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
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
        lastError = err;
        const msg = String(err?.message || '');
        const isUnavailable = msg.includes('503') || msg.includes('429') || msg.includes('high demand') || err?.status === 503;
        if (isUnavailable) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
  }

  console.warn('Aviso en traducción con Gemini (usando fallback original):', lastError?.message || 'Error de modelo');
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

/**
 * VXP - Cliente Cache Optimizado para Eventos Masivos
 * Almacena en memoria y localStorage catálogos estáticos
 * (mapas del estadio, secciones, menú de concesiones, catálogo de jerseys)
 * reduciendo drásticamente lecturas repetitivas a Firestore.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number; // timestamp en ms
}

// Caché en memoria para acceso ultra-rápido en la misma sesión
const memoryCache = new Map<string, CacheEntry<any>>();

const CACHE_PREFIX = 'vxp_cache_';

/**
 * Obtener un valor del caché (memoria primero, luego localStorage)
 */
export function getCachedData<T>(key: string): T | null {
  const now = Date.now();

  // 1. Revisar memoria
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    if (memEntry.expiry > now) {
      return memEntry.data as T;
    }
    memoryCache.delete(key);
  }

  // 2. Revisar localStorage
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.expiry > now) {
      // Repoblar memoria
      memoryCache.set(key, entry);
      return entry.data;
    }

    // Expirado
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (err) {
    console.warn(`Error leyendo caché local [${key}]:`, err);
  }

  return null;
}

/**
 * Guardar un valor en caché con tiempo de vida (TTL) en minutos
 */
export function setCachedData<T>(key: string, data: T, ttlMinutes = 15): void {
  const expiry = Date.now() + ttlMinutes * 60 * 1000;
  const entry: CacheEntry<T> = { data, expiry };

  // Guardar en memoria
  memoryCache.set(key, entry);

  // Guardar en localStorage
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (err) {
    console.warn(`Error guardando en caché local [${key}]:`, err);
  }
}

/**
 * Invalidar una clave específica o todas las claves con un prefijo
 */
export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    memoryCache.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
    return;
  }

  // Borrar de memoria
  for (const k of Array.from(memoryCache.keys())) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      memoryCache.delete(k);
    }
  }

  // Borrar de localStorage
  try {
    const fullPrefix = `${CACHE_PREFIX}${keyOrPrefix}`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === fullPrefix || k.startsWith(fullPrefix))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

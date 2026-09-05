/**
 * Utilidades para normalización y manejo de imágenes
 */

/**
 * Detecta enlaces compartidos de Google Drive y los convierte a URLs directas de imagen (CDN de Google)
 * para que las etiquetas <img> del navegador puedan renderizarlas sin restricciones ni páginas intermedias HTML.
 *
 * Enlaces soportados:
 * - https://drive.google.com/file/d/{FILE_ID}/view?usp=...
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID} o uc?export=view&id={FILE_ID}
 * - https://drive.google.com/thumbnail?id={FILE_ID}
 * - https://docs.google.com/...
 *
 * Retorna:
 * - https://lh3.googleusercontent.com/d/{FILE_ID}
 */
export function normalizeGoogleDriveImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Si ya es un URL directo de Google User Content, retornarlo tal cual
  if (trimmed.includes('googleusercontent.com/d/')) {
    return trimmed;
  }

  // 1. Patrón común de Google Drive: /file/d/{FILE_ID} o /file/u/0/d/{FILE_ID}
  const fileDMatch = trimmed.match(/(?:drive|docs)\.google\.com\/(?:.*\/)?file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  // 2. Patrón con parámetro de consulta id={FILE_ID}
  const idMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  // 3. Patrón directo /d/{FILE_ID}
  const directDMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/i);
  if (directDMatch && directDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${directDMatch[1]}`;
  }

  return trimmed;
}

/**
 * Retorna true si la URL proporcionada corresponde a un enlace de Google Drive
 */
export function isGoogleDriveUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return /(?:drive|docs)\.google\.com/i.test(url);
}

/**
 * Extrae el ID del archivo de Google Drive si existe
 */
export function extractGoogleDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const fileDMatch = trimmed.match(/(?:drive|docs)\.google\.com\/(?:.*\/)?file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];
  const idMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) return idMatch[1];
  const directDMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/i);
  if (directDMatch && directDMatch[1]) return directDMatch[1];
  return null;
}

/**
 * Imágenes por defecto por categoría de inventario / tienda oficial
 */
export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  Jerseys: 'https://images.unsplash.com/photo-1577210897949-1f56f943502f?w=600&auto=format&fit=crop&q=80',
  Gorras: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&auto=format&fit=crop&q=80',
  Sudaderas: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600&auto=format&fit=crop&q=80',
  Souvenirs: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&auto=format&fit=crop&q=80',
  Coleccionables: 'https://images.unsplash.com/photo-1508802959524-40759c8f79f4?w=600&auto=format&fit=crop&q=80',
  Accesorios: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1577210897949-1f56f943502f?w=600&auto=format&fit=crop&q=80',
};

export function getDefaultProductPlaceholder(category?: string): string {
  if (category && DEFAULT_PRODUCT_IMAGES[category]) {
    return DEFAULT_PRODUCT_IMAGES[category];
  }
  return DEFAULT_PRODUCT_IMAGES.default;
}

export const DEFAULT_STORE_PROMO_BANNER =
  'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&auto=format&fit=crop&q=80';


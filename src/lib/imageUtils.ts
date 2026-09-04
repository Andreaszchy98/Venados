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

  // 1. Patrón común de Google Drive: /file/d/{FILE_ID}
  const fileDMatch = trimmed.match(/(?:drive|docs)\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  // 2. Patrón con parámetro de consulta id={FILE_ID}
  const idMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
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
  const fileDMatch = trimmed.match(/(?:drive|docs)\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];
  const idMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) return idMatch[1];
  return null;
}

/**
 * Utilidades para formatear y limpiar la nomenclatura de asientos, filas y secciones.
 * Evita duplicidades como "Fila Fila A", "Asiento Asiento 2" o "Fila Sección General".
 */

/**
 * Limpia el valor de la fila eliminando el prefijo redundante "Fila" o "Fila:"
 */
export function cleanRowValue(row?: string): string {
  if (!row) return '';
  const trimmed = row.trim();
  return trimmed.replace(/^fila\s*:?\s*/i, '').trim();
}

/**
 * Limpia el valor del asiento eliminando el prefijo "Asiento" o "Butaca"
 */
export function cleanSeatValue(seat?: string): string {
  if (!seat) return '';
  const trimmed = seat.trim();
  return trimmed.replace(/^(asiento|butaca)\s*:?\s*/i, '').trim();
}

/**
 * Limpia el valor de la sección eliminando "Sección" si ya lo trae
 */
export function cleanSectionValue(section?: string): string {
  if (!section) return '';
  const trimmed = section.trim();
  return trimmed.replace(/^secci[oó]n\s*:?\s*/i, '').trim();
}

/**
 * Determina si la fila o valor especificado corresponde a una zona general sin fila numerada
 */
export function isGeneralAdmissionRow(row?: string): boolean {
  if (!row) return false;
  return /general|grada|libre|sin fila/i.test(row);
}

/**
 * Formatea la ubicación completa para la entrega a butaca (in-seat delivery)
 * Evita "Fila Fila", "Asiento Asiento" y "Fila Sección General".
 */
export function formatDeliverySeat(section?: string, row?: string, seat?: string): string {
  const parts: string[] = [];

  const rawSec = (section || '').trim();
  const rawRow = (row || '').trim();
  const rawSeat = (seat || '').trim();

  // 1. Procesar Sección
  const cSec = cleanSectionValue(rawSec);
  if (cSec && cSec !== '-') {
    parts.push(`Sección ${cSec}`);
  }

  // 2. Procesar Fila
  const cRow = cleanRowValue(rawRow);
  if (cRow && cRow !== '-') {
    if (isGeneralAdmissionRow(cRow)) {
      // Si la sección ya contiene la palabra General, no duplicar
      const sectionHasGeneral = parts.some((p) => /general/i.test(p));
      if (!sectionHasGeneral) {
        parts.push(/^zona/i.test(cRow) ? cRow : `Zona ${cRow}`);
      }
    } else {
      parts.push(`Fila ${cRow}`);
    }
  }

  // 3. Procesar Asiento / Butaca
  const cSeat = cleanSeatValue(rawSeat);
  if (cSeat && cSeat !== '-') {
    parts.push(`Asiento ${cSeat}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Asiento no especificado';
}

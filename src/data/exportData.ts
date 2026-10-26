import { z } from 'zod';
import { persistedStateSchema, type PersistedState } from '../domain/model';

export const EXPORT_FORMAT = 'foco5-export';
export const EXPORT_VERSION = 1;

const exportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  data: persistedStateSchema,
});

/**
 * Exporta todos tus datos en JSON legible. Es un derecho del RGPD (portabilidad) y no tiene coste.
 * No incluye datos de facturación ni el plan del día, que se regeneran solos.
 */
export function buildExport(state: PersistedState, now: Date): string {
  const file = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    data: { ...state, dailyPlan: null, demoBilling: null },
  };
  return JSON.stringify(file, null, 2);
}

/** Lee y valida un archivo exportado. Lanza un error con mensaje humano si no es válido. */
export function parseExport(text: string): PersistedState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Este archivo no es una exportación de Foco Mente.');
  }
  return { ...parsed.data.data, dailyPlan: null, demoBilling: null };
}

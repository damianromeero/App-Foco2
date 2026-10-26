import { z } from 'zod';
import { isHabitId } from './habits';

/* ------------------------------------------------------------------
 * Modelo de datos. Los esquemas zod son la fuente de verdad: validan lo que
 * se lee del almacenamiento, de una importación o de la nube, y de ellos salen los tipos.
 * ------------------------------------------------------------------ */

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const levelSchema = z.number().int().min(1).max(10);

export const GAME_IDS = [
  'vigilancia',
  'semaforo',
  'secuencia',
  'busqueda',
  'stroop',
  'cambio',
  'reflejo',
  'espera-la-senal',
  'casilla-iluminada',
  'diferencia-cuadricula',
  'cual-no-encaja',
  'siguiente-figura',
  'espejo-o-giro',
  'simetria',
  'mismo-tono',
  'contar-pitidos',
  'agudo-o-grave',
  'seguir-puntos',
  'busqueda-formas',
] as const;
export const gameIdSchema = z.enum(GAME_IDS);
export type GameId = z.infer<typeof gameIdSchema>;

export const GOALS = [
  'concentrarme',
  'menos-movil',
  'estudiar',
  'trabajar-mejor',
  'mente-activa',
] as const;
export const goalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof goalSchema>;

export const settingsSchema = z.object({
  theme: z.enum(['sistema', 'claro', 'oscuro']).default('sistema'),
  textSize: z.enum(['normal', 'grande']).default('normal'),
  reduceMotion: z.enum(['sistema', 'si', 'no']).default('sistema'),
  /** Sin límite de tiempo en los juegos y estímulos más lentos. */
  calmMode: z.boolean().default(false),
  /** Sustituye los juegos que dependen del color por alternativas con forma y texto. */
  sinColor: z.boolean().default(false),
  /** Hora del recordatorio en HH:MM, o null si no hay recordatorio. */
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  haptics: z.boolean().default(true),
});
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export const gameResultSchema = z.object({
  gameId: gameIdSchema,
  level: levelSchema,
  accuracy: z.number().min(0).max(1),
  medianRtMs: z.number().nonnegative().nullable(),
  scorable: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  calm: z.boolean(),
  completedAt: isoDateTimeSchema,
});
export type GameResultRecord = z.infer<typeof gameResultSchema>;

export const reflectionSchema = z.object({
  mood: z.enum(['calmado', 'igual', 'disperso']),
  phoneUse: z.enum(['menos-30', '30-60', 'mas-60', 'no-se']),
});
export type Reflection = z.infer<typeof reflectionSchema>;

export const sessionRecordSchema = z.object({
  dateKey: dateKeySchema,
  completedAt: isoDateTimeSchema,
  durationSec: z.number().int().nonnegative(),
  games: z.array(gameResultSchema),
  reflection: reflectionSchema.nullable(),
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const focusRecordSchema = z.object({
  id: z.string().min(1).max(64),
  dateKey: dateKeySchema,
  startedAt: isoDateTimeSchema,
  plannedMinutes: z.number().int().min(5).max(120),
  focusedSeconds: z.number().int().nonnegative(),
  /** Veces que la pestaña dejó de estar visible durante el modo foco. */
  exits: z.number().int().nonnegative(),
});
export type FocusRecord = z.infer<typeof focusRecordSchema>;

export const baselineRecordSchema = z.object({
  completedAt: isoDateTimeSchema,
  results: z.array(gameResultSchema),
  startLevels: z.record(z.string(), levelSchema),
});
export type BaselineRecord = z.infer<typeof baselineRecordSchema>;

export const sessionStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('breath'), seconds: z.number().int().positive() }),
  z.object({ kind: z.literal('game'), gameId: gameIdSchema, level: levelSchema }),
  z.object({ kind: z.literal('reflection') }),
  z.object({ kind: z.literal('lesson'), lessonId: z.string().min(1) }),
]);
export type SessionStep = z.infer<typeof sessionStepSchema>;

export const dailyPlanSchema = z.object({
  dateKey: dateKeySchema,
  steps: z.array(sessionStepSchema).min(1),
});
export type DailyPlan = z.infer<typeof dailyPlanSchema>;

export const subscriptionStatusSchema = z.enum([
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'unpaid',
]);

export const subscriptionSnapshotSchema = z.object({
  status: subscriptionStatusSchema,
  plan: z.enum(['monthly', 'annual']).nullable(),
  trialEndsAt: isoDateTimeSchema.nullable(),
  currentPeriodEnd: isoDateTimeSchema.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  firstPaidAt: isoDateTimeSchema.nullable(),
});
export type SubscriptionSnapshot = z.infer<typeof subscriptionSnapshotSchema>;

export const NO_SUBSCRIPTION: SubscriptionSnapshot = {
  status: 'none',
  plan: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  firstPaidAt: null,
};

/** Nombre para saludar: opcional y de hasta 40 caracteres (cuenta caracteres, no unidades de código). */
export const DISPLAY_NAME_MAX = 40;

/** Normaliza lo que escribe la persona: sin espacios sobrantes, internos colapsados, cortado a 40. Vacío => null. */
export function normalizeDisplayName(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  const cut = Array.from(collapsed).slice(0, DISPLAY_NAME_MAX).join('').trim();
  return cut === '' ? null : cut;
}

/** Al leer: texto sin espacios sobrantes de hasta 40 caracteres; si no cumple, queda sin nombre. */
export const displayNameSchema = z
  .string()
  .trim()
  .max(DISPLAY_NAME_MAX)
  .transform((value) => value || null)
  .nullable()
  .catch(null);

/**
 * Lista tolerante: los elementos que no validan se descartan en lugar de borrar todo el historial.
 */
function lenientList<T extends z.ZodType>(item: T) {
  return z
    .unknown()
    .optional()
    .transform((value): z.output<T>[] => {
      if (!Array.isArray(value)) return [];
      const entries: unknown[] = value;
      return entries.flatMap((entry) => {
        const parsed = item.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
    });
}

function isKnownHabitId(item: unknown): item is string {
  return typeof item === 'string' && isHabitId(item);
}

/**
 * Hábitos marcados por día. Se descartan las fechas mal escritas, las listas que no lo son
 * y los ids que no están en el catálogo; si el campo entero está roto, queda vacío.
 */
const habitChecksSchema = z
  .record(z.string(), z.unknown())
  .transform((entries): Record<string, string[]> => {
    const checks: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(entries)) {
      const dateKey = dateKeySchema.safeParse(key);
      if (!dateKey.success || !Array.isArray(value)) continue;
      const items: unknown[] = value;
      const ids = [...new Set(items.filter(isKnownHabitId))];
      if (ids.length > 0) checks[dateKey.data] = ids;
    }
    return checks;
  })
  .catch({});

/**
 * Estado persistido en el dispositivo. Cada campo tiene su propio valor de respaldo (catch),
 * así un dato dañado no reinicia el resto de la app.
 */
export const persistedStateSchema = z.object({
  onboardedAt: isoDateTimeSchema.nullable().catch(null),
  goal: goalSchema.nullable().catch(null),
  displayName: displayNameSchema,
  settings: settingsSchema.catch(DEFAULT_SETTINGS),
  baseline: baselineRecordSchema.nullable().catch(null),
  levels: z.record(z.string(), levelSchema).catch({}),
  lastPlayed: z.record(z.string(), dateKeySchema).catch({}),
  sessions: lenientList(sessionRecordSchema),
  focusSessions: lenientList(focusRecordSchema),
  lessonsRead: z.array(z.string()).catch([]),
  habitChecks: habitChecksSchema,
  dailyPlan: dailyPlanSchema.nullable().catch(null),
  demoBilling: subscriptionSnapshotSchema.nullable().catch(null),
});
export type PersistedState = z.infer<typeof persistedStateSchema>;

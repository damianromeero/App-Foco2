import { z } from 'zod';
import { sessionRecordSchema, type SessionRecord } from '../domain/model';
import { mergeSessionRecords, sessionsToPush } from '../domain/sync';
import { llamarApi, RUTA_SINCRONIZACION } from './sesion';
import { isCloudEnabled } from './supabase';

/** Tamaño máximo de cada envío: lo que acepta la ruta /api/sincronizacion en una petición. */
const LOTE = 500;

const remoteRowSchema = z.object({
  date_key: z.string(),
  completed_at: z.string(),
  duration_sec: z.number(),
  payload: z.object({
    games: z.array(z.unknown()),
    reflection: z.unknown().nullable(),
  }),
});

const respuestaSchema = z.object({ filas: z.array(z.unknown()) });

/**
 * Sesiones guardadas en la nube, leídas por el servidor con el token de la persona. Las filas que no validan se
 * descartan. Sin sesión (401) no hay datos remotos; cualquier otro fallo lanza y la app conserva los datos locales.
 */
async function fetchRemoteSessions(): Promise<SessionRecord[]> {
  if (!isCloudEnabled()) return [];
  const respuesta = await llamarApi(RUTA_SINCRONIZACION, 'GET');
  if (respuesta === null) throw new Error('Sin conexión con la nube.');
  if (respuesta.status === 401) return [];
  if (!respuesta.ok) throw new Error('No se pudieron leer las sesiones de la nube.');
  const cuerpo = respuestaSchema.safeParse(await respuesta.json());
  if (!cuerpo.success) return [];
  const rows = z.array(remoteRowSchema).safeParse(cuerpo.data.filas);
  if (!rows.success) return [];
  const sessions: SessionRecord[] = [];
  for (const row of rows.data) {
    const parsed = sessionRecordSchema.safeParse({
      dateKey: row.date_key,
      completedAt: row.completed_at,
      durationSec: row.duration_sec,
      games: row.payload.games,
      reflection: row.payload.reflection ?? null,
    });
    if (parsed.success) sessions.push(parsed.data);
  }
  return sessions;
}

/** Sube las sesiones en lotes. El servidor pone el identificador de la persona a partir de su token. */
async function pushSessions(sessions: readonly SessionRecord[]): Promise<void> {
  if (!isCloudEnabled() || sessions.length === 0) return;
  for (let inicio = 0; inicio < sessions.length; inicio += LOTE) {
    const filas = sessions.slice(inicio, inicio + LOTE).map((session) => ({
      date_key: session.dateKey,
      completed_at: session.completedAt,
      duration_sec: session.durationSec,
      payload: { games: session.games, reflection: session.reflection },
    }));
    const respuesta = await llamarApi(RUTA_SINCRONIZACION, 'POST', { filas });
    if (respuesta === null) throw new Error('Sin conexión con la nube.');
    if (respuesta.status === 401) return;
    if (!respuesta.ok) throw new Error('No se pudieron guardar las sesiones en la nube.');
  }
}

/**
 * Sincroniza las sesiones: descarga lo que falta aquí, sube lo que falta allí y devuelve la lista fusionada.
 * Sin backend o sin conexión lanza un error, y la app conserva los datos locales.
 */
export async function syncSessions(local: readonly SessionRecord[]): Promise<SessionRecord[]> {
  const remote = await fetchRemoteSessions();
  const merged = mergeSessionRecords(local, remote);
  await pushSessions(sessionsToPush(merged, remote));
  return merged;
}

/** Borra en la nube todas las sesiones de la persona. Se usa al borrar datos con cuenta. */
export async function deleteRemoteSessions(): Promise<void> {
  if (!isCloudEnabled()) return;
  const respuesta = await llamarApi(RUTA_SINCRONIZACION, 'DELETE');
  if (respuesta === null) throw new Error('Sin conexión con la nube.');
  if (respuesta.status === 401) return;
  if (!respuesta.ok) throw new Error('No se pudieron borrar las sesiones de la nube.');
}

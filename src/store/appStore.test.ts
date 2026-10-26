import { STORAGE_KEY } from '../data/persistence';
import type { SessionRecord } from '../domain/model';
import { useAppStore } from './appStore';

const session = (dateKey: string, accuracy: number, level = 3): SessionRecord => ({
  dateKey,
  completedAt: `${dateKey}T10:00:00.000Z`,
  durationSec: 300,
  reflection: null,
  games: [
    {
      gameId: 'vigilancia',
      level,
      accuracy,
      medianRtMs: 450,
      scorable: 36,
      correct: Math.round(accuracy * 36),
      calm: false,
      completedAt: `${dateKey}T10:01:00.000Z`,
    },
  ],
});

describe('almacén de la aplicación', () => {
  beforeEach(() => {
    useAppStore.getState().deleteAllData();
  });

  it('registrar una sesión ajusta el nivel del juego según la precisión', () => {
    const store = useAppStore.getState();
    store.recordSession(session('2026-10-15', 0.92, 3));
    expect(useAppStore.getState().levels.vigilancia).toBe(4);
    expect(useAppStore.getState().lastPlayed.vigilancia).toBe('2026-10-15');
  });

  it('registrar otra sesión del mismo día la sustituye en lugar de duplicarla', () => {
    const store = useAppStore.getState();
    store.recordSession(session('2026-10-15', 0.5));
    store.recordSession(session('2026-10-15', 0.9));
    expect(useAppStore.getState().sessions).toHaveLength(1);
    expect(useAppStore.getState().sessions[0]?.games[0]?.accuracy).toBe(0.9);
  });

  it('fusionar sesiones de la nube no duplica los días que ya existen', () => {
    const store = useAppStore.getState();
    store.recordSession(session('2026-10-15', 0.7));
    store.mergeSessions([session('2026-10-15', 0.8), session('2026-10-14', 0.6)]);
    expect(useAppStore.getState().sessions.map((item) => item.dateKey)).toEqual([
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('borrar todos los datos deja el estado inicial y elimina la clave guardada', () => {
    const store = useAppStore.getState();
    store.recordSession(session('2026-10-15', 0.7));
    store.updateSettings({ calmMode: true });
    store.deleteAllData();
    const state = useAppStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.settings.calmMode).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('el nombre se recorta, colapsa espacios y se guarda en el dispositivo', async () => {
    useAppStore.getState().setDisplayName('  Ana    Lucía ');
    expect(useAppStore.getState().displayName).toBe('Ana Lucía');
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      state: { displayName: string | null };
    };
    expect(saved.state.displayName).toBe('Ana Lucía');

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { goal: 'estudiar', displayName: 'Ana Lucía' }, version: 1 }),
    );
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().displayName).toBe('Ana Lucía');
    expect(useAppStore.getState().goal).toBe('estudiar');
  });

  it('un nombre vacío o solo con espacios se guarda como null', () => {
    useAppStore.getState().setDisplayName('Ana');
    useAppStore.getState().setDisplayName('   ');
    expect(useAppStore.getState().displayName).toBeNull();
  });

  it('el nombre no supera 40 caracteres', () => {
    useAppStore.getState().setDisplayName('a'.repeat(55));
    expect(useAppStore.getState().displayName).toBe('a'.repeat(40));
  });

  it('borrar todos los datos también borra el nombre', () => {
    useAppStore.getState().setDisplayName('Ana');
    useAppStore.getState().deleteAllData();
    expect(useAppStore.getState().displayName).toBeNull();
  });

  it('marcar una lección como leída no la repite', () => {
    const store = useAppStore.getState();
    store.markLessonRead('cambiar-cuesta');
    store.markLessonRead('cambiar-cuesta');
    expect(useAppStore.getState().lessonsRead).toEqual(['cambiar-cuesta']);
  });

  it('un desafío de hábito se marca y se desmarca por día', () => {
    const store = useAppStore.getState();
    store.toggleHabit('2026-10-17', 'cerrar-pestana');
    expect(useAppStore.getState().habitChecks).toEqual({ '2026-10-17': ['cerrar-pestana'] });
    store.toggleHabit('2026-10-17', 'cerrar-pestana');
    expect(useAppStore.getState().habitChecks['2026-10-17']).toEqual([]);
  });

  it('los ids de hábito desconocidos y las fechas no válidas se ignoran', () => {
    const store = useAppStore.getState();
    store.toggleHabit('2026-10-17', 'no-existe');
    store.toggleHabit('17/10/2026', 'cerrar-pestana');
    expect(useAppStore.getState().habitChecks).toEqual({});
  });

  it('borrar todos los datos también borra los hábitos marcados', () => {
    useAppStore.getState().toggleHabit('2026-10-17', 'cerrar-pestana');
    useAppStore.getState().deleteAllData();
    expect(useAppStore.getState().habitChecks).toEqual({});
  });
});

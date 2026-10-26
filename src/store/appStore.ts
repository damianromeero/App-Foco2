import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nextLevel, START_LEVEL } from '../domain/adaptive';
import { isHabitId } from '../domain/habits';
import { mergeSessionRecords } from '../domain/sync';
import {
  dateKeySchema,
  normalizeDisplayName,
  persistedStateSchema,
  type BaselineRecord,
  type DailyPlan,
  type FocusRecord,
  type GameResultRecord,
  type Goal,
  type PersistedState,
  type SessionRecord,
  type Settings,
  type SubscriptionSnapshot,
} from '../domain/model';
import { safeStorage, STORAGE_KEY } from '../data/persistence';

export function emptyState(): PersistedState {
  return persistedStateSchema.parse({});
}

export interface AppActions {
  completeOnboarding: (payload: {
    goal: Goal;
    reminderTime: string | null;
    settings: Partial<Settings>;
  }) => void;
  saveBaseline: (baseline: BaselineRecord) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setDisplayName: (name: string) => void;
  setDailyPlan: (plan: DailyPlan) => void;
  recordSession: (session: SessionRecord) => void;
  mergeSessions: (incoming: SessionRecord[]) => void;
  recordPractice: (result: GameResultRecord, dateKey: string) => void;
  markLessonRead: (lessonId: string) => void;
  /** Marca o desmarca un desafío de hábito de un día. Los ids desconocidos se ignoran. */
  toggleHabit: (dateKey: string, habitId: string) => void;
  addFocusSession: (focus: FocusRecord) => void;
  setDemoBilling: (subscription: SubscriptionSnapshot | null) => void;
  replaceData: (data: PersistedState) => void;
  deleteAllData: () => void;
}

export type AppState = PersistedState & AppActions;

function selectPersisted(state: AppState): PersistedState {
  return {
    onboardedAt: state.onboardedAt,
    goal: state.goal,
    displayName: state.displayName,
    settings: state.settings,
    baseline: state.baseline,
    levels: state.levels,
    lastPlayed: state.lastPlayed,
    sessions: state.sessions,
    focusSessions: state.focusSessions,
    lessonsRead: state.lessonsRead,
    habitChecks: state.habitChecks,
    dailyPlan: state.dailyPlan,
    demoBilling: state.demoBilling,
  };
}

/** Valida lo que llega del almacenamiento. Si es irrecuperable, guarda una copia de respaldo. */
function parsePersisted(raw: unknown): PersistedState {
  const parsed = persistedStateSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  safeStorage.setItem(`${STORAGE_KEY}.respaldo`, JSON.stringify(raw ?? null));
  return emptyState();
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...emptyState(),

      completeOnboarding: ({ goal, reminderTime, settings }) =>
        set((state) => ({
          onboardedAt: state.onboardedAt ?? new Date().toISOString(),
          goal,
          settings: { ...state.settings, ...settings, reminderTime },
        })),

      saveBaseline: (baseline) =>
        set((state) => ({
          baseline,
          levels: { ...state.levels, ...baseline.startLevels },
        })),

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      setDisplayName: (name) => set({ displayName: normalizeDisplayName(name) }),

      setDailyPlan: (plan) => set({ dailyPlan: plan }),

      recordSession: (session) =>
        set((state) => {
          const levels = { ...state.levels };
          const lastPlayed = { ...state.lastPlayed };
          for (const game of session.games) {
            levels[game.gameId] = nextLevel(game.level, game.accuracy);
            lastPlayed[game.gameId] = session.dateKey;
          }
          return {
            sessions: [
              ...state.sessions.filter((item) => item.dateKey !== session.dateKey),
              session,
            ],
            levels,
            lastPlayed,
          };
        }),

      mergeSessions: (incoming) =>
        set((state) => ({ sessions: mergeSessionRecords(state.sessions, incoming) })),

      recordPractice: (result, dateKey) =>
        set((state) => ({
          levels: { ...state.levels, [result.gameId]: nextLevel(result.level, result.accuracy) },
          lastPlayed: { ...state.lastPlayed, [result.gameId]: dateKey },
        })),

      markLessonRead: (lessonId) =>
        set((state) => ({
          lessonsRead: state.lessonsRead.includes(lessonId)
            ? state.lessonsRead
            : [...state.lessonsRead, lessonId],
        })),

      toggleHabit: (dateKey, habitId) =>
        set((state) => {
          if (!isHabitId(habitId) || !dateKeySchema.safeParse(dateKey).success) return state;
          const checked = state.habitChecks[dateKey] ?? [];
          const next = checked.includes(habitId)
            ? checked.filter((id) => id !== habitId)
            : [...checked, habitId];
          return { habitChecks: { ...state.habitChecks, [dateKey]: next } };
        }),

      addFocusSession: (focus) =>
        set((state) => ({ focusSessions: [...state.focusSessions, focus] })),

      setDemoBilling: (subscription) => set({ demoBilling: subscription }),

      replaceData: (data) => set({ ...data }),

      deleteAllData: () => {
        set(emptyState());
        safeStorage.removeItem(STORAGE_KEY);
        safeStorage.removeItem(`${STORAGE_KEY}.respaldo`);
        safeStorage.removeItem(`${STORAGE_KEY}.ilegible`);
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: selectPersisted,
      merge: (persisted, current) => ({ ...current, ...parsePersisted(persisted) }),
    },
  ),
);

/** Nivel de un juego: el guardado, o el de partida inicial del test base. */
export function levelFor(levels: Record<string, number>, gameId: string): number {
  return levels[gameId] ?? START_LEVEL;
}

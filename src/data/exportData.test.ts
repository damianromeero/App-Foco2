import { emptyState } from '../store/appStore';
import { buildExport, parseExport } from './exportData';

describe('exportación de datos', () => {
  const now = new Date('2026-10-16T10:00:00.000Z');

  it('exporta y vuelve a importar sin perder sesiones ni ajustes', () => {
    const state = {
      ...emptyState(),
      onboardedAt: '2026-10-01T09:00:00.000Z',
      goal: 'concentrarme' as const,
      sessions: [
        {
          dateKey: '2026-10-15',
          completedAt: '2026-10-15T09:00:00.000Z',
          durationSec: 280,
          games: [],
          reflection: { mood: 'calmado' as const, phoneUse: '30-60' as const },
        },
      ],
      settings: { ...emptyState().settings, calmMode: true },
    };
    const restored = parseExport(buildExport(state, now));
    expect(restored.sessions).toEqual(state.sessions);
    expect(restored.settings.calmMode).toBe(true);
    expect(restored.goal).toBe('concentrarme');
  });

  it('no incluye el plan del día ni los datos de facturación', () => {
    const state = {
      ...emptyState(),
      dailyPlan: { dateKey: '2026-10-16', steps: [{ kind: 'reflection' as const }] },
      demoBilling: null,
    };
    const restored = parseExport(buildExport(state, now));
    expect(restored.dailyPlan).toBeNull();
    expect(restored.demoBilling).toBeNull();
  });

  it('el nombre para saludar viaja en la exportación y vuelve al importar', () => {
    const text = buildExport({ ...emptyState(), displayName: 'Ana' }, now);
    expect((JSON.parse(text) as { data: { displayName: string } }).data.displayName).toBe('Ana');
    expect(parseExport(text).displayName).toBe('Ana');
  });

  it('un nombre no válido en el archivo se descarta sin tocar el resto; un archivo antiguo queda sin nombre', () => {
    const file = JSON.parse(
      buildExport({ ...emptyState(), goal: 'estudiar', displayName: 'Ana' }, now),
    ) as { data: Record<string, unknown> };
    file.data.displayName = 'a'.repeat(41);
    const restored = parseExport(JSON.stringify(file));
    expect(restored.displayName).toBeNull();
    expect(restored.goal).toBe('estudiar');

    delete file.data.displayName;
    expect(parseExport(JSON.stringify(file)).displayName).toBeNull();
  });

  it('rechaza un archivo que no es una exportación de la app', () => {
    expect(() => parseExport('{"hola": 1}')).toThrow('no es una exportación de Foco Mente');
  });

  it('rechaza un texto que no es JSON', () => {
    expect(() => parseExport('esto no es json')).toThrow('no es un JSON válido');
  });
});

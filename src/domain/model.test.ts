import { normalizeDisplayName, persistedStateSchema, sessionRecordSchema } from './model';

describe('nombre para saludar', () => {
  it('sin nombre guardado queda en null', () => {
    expect(persistedStateSchema.parse({}).displayName).toBeNull();
  });

  it('valida el texto al leer: recorta espacios y descarta lo que pasa de 40 caracteres', () => {
    expect(persistedStateSchema.parse({ displayName: '  Ana  ' }).displayName).toBe('Ana');
    expect(persistedStateSchema.parse({ displayName: '   ' }).displayName).toBeNull();
    expect(persistedStateSchema.parse({ displayName: 'a'.repeat(41) }).displayName).toBeNull();
    expect(persistedStateSchema.parse({ displayName: 42 }).displayName).toBeNull();
  });

  it('cuenta caracteres y no unidades de código: 40 emojis son válidos', () => {
    const emojis = '😀'.repeat(40);
    expect(persistedStateSchema.parse({ displayName: emojis }).displayName).toBe(emojis);
  });

  it('un nombre dañado no reinicia el resto de datos', () => {
    const state = persistedStateSchema.parse({ displayName: 'a'.repeat(99), goal: 'estudiar' });
    expect(state.displayName).toBeNull();
    expect(state.goal).toBe('estudiar');
  });

  it('normalizar: colapsa espacios internos, corta a 40 y nunca devuelve vacío', () => {
    expect(normalizeDisplayName('  Ana    María  ')).toBe('Ana María');
    expect(normalizeDisplayName('a'.repeat(50))).toBe('a'.repeat(40));
    expect(normalizeDisplayName('a'.repeat(39) + ' b')).toBe('a'.repeat(39));
    expect(normalizeDisplayName('  \t ')).toBeNull();
  });
});

describe('persistedStateSchema', () => {
  it('un objeto vacío se completa con valores por defecto', () => {
    const state = persistedStateSchema.parse({});
    expect(state.onboardedAt).toBeNull();
    expect(state.sessions).toEqual([]);
    expect(state.settings.theme).toBe('sistema');
    expect(state.settings.calmMode).toBe(false);
  });

  it('un campo dañado vuelve a su valor por defecto sin tocar el resto', () => {
    const state = persistedStateSchema.parse({
      levels: 'no-es-un-objeto',
      lessonsRead: ['leccion-1'],
    });
    expect(state.levels).toEqual({});
    expect(state.lessonsRead).toEqual(['leccion-1']);
  });

  it('descarta las sesiones inválidas y conserva las válidas', () => {
    const valid = {
      dateKey: '2026-10-15',
      completedAt: '2026-10-15T10:00:00.000Z',
      durationSec: 300,
      games: [],
      reflection: null,
    };
    const state = persistedStateSchema.parse({
      sessions: [valid, { dateKey: 'mal', durationSec: -1 }, 42],
    });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]?.dateKey).toBe('2026-10-15');
  });

  it('valida el formato de las sesiones', () => {
    expect(sessionRecordSchema.safeParse({ dateKey: '15/10/2026' }).success).toBe(false);
  });
});

describe('desafíos de hábito guardados', () => {
  it('sin datos queda vacío', () => {
    expect(persistedStateSchema.parse({}).habitChecks).toEqual({});
  });

  it('descarta ids desconocidos, fechas mal escritas y listas dañadas sin tocar el resto', () => {
    const state = persistedStateSchema.parse({
      habitChecks: {
        '2026-10-17': ['cerrar-pestana', 'no-existe', 42, 'cerrar-pestana'],
        'mal-dia': ['cerrar-pestana'],
        '2026-10-16': 'no-es-lista',
      },
      goal: 'estudiar',
    });
    expect(state.habitChecks).toEqual({ '2026-10-17': ['cerrar-pestana'] });
    expect(state.goal).toBe('estudiar');
  });

  it('si el campo entero está roto no lanza error y queda vacío', () => {
    expect(persistedStateSchema.parse({ habitChecks: 'roto' }).habitChecks).toEqual({});
    expect(persistedStateSchema.parse({ habitChecks: null }).habitChecks).toEqual({});
  });
});

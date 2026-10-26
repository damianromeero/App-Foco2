import { afterEach, describe, expect, it } from 'vitest';
import { safeStorage, STORAGE_KEY } from './persistence';

describe('safeStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('devuelve el valor guardado cuando es JSON válido', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"state":{}}');
    expect(safeStorage.getItem(STORAGE_KEY)).toBe('{"state":{}}');
  });

  it('un valor que no es JSON no se devuelve, y se guarda una copia antes de que una escritura lo sustituya', () => {
    const broken = '{"state":{"onboardedAt":"2026';
    window.localStorage.setItem(STORAGE_KEY, broken);

    expect(safeStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(`${STORAGE_KEY}.ilegible`)).toBe(broken);
  });
});

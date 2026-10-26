import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCloudEnabled } from '../services/supabase';
import { LIMITE_FILAS } from './config';
import { leerCompras, leerResumen, RUTA_DATOS_ADMIN } from './consultas';

vi.mock('../services/supabase', () => ({
  isCloudEnabled: vi.fn(() => true),
}));

/**
 * Simula /api/admin/datos: devuelve las filas de la tabla pedida en la URL. Guarda cada URL pedida para comprobar la
 * forma de la consulta. `estado` fuerza una respuesta de error.
 */
function mockDatos(filasPorTabla: Record<string, unknown[]>, estado?: number) {
  const pedidas: URL[] = [];
  const red = vi.spyOn(globalThis, 'fetch').mockImplementation((entrada: RequestInfo | URL) => {
    const texto =
      typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const url = new URL(texto, 'https://foco.example.com');
    pedidas.push(url);
    if (estado !== undefined) {
      return Promise.resolve(new Response('{"tipo":"error"}', { status: estado }));
    }
    const tabla = url.searchParams.get('tabla') ?? '';
    return Promise.resolve(
      new Response(JSON.stringify(filasPorTabla[tabla] ?? []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  return { red, pedidas };
}

const filaCompra = (parcial: Record<string, unknown> = {}) => ({
  id_hotmart: 'HP-TRANSACCION-000123456',
  plan: 'mensual',
  monto_usd: 19.99,
  estado: 'aprobada',
  correo: 'cliente@example.com',
  creado_en: '2026-10-20T15:00:00.000Z',
  ...parcial,
});

describe('lecturas del panel', () => {
  beforeEach(() => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin nube devuelve null y no hace ninguna petición', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(false);
    const { red } = mockDatos({});
    expect(await leerResumen('7d')).toBeNull();
    expect(await leerCompras('30d')).toBeNull();
    expect(red).not.toHaveBeenCalled();
  });

  it('pide la tabla a /api/admin/datos con su columna de fecha, el rango y el límite', async () => {
    const { pedidas } = mockDatos({ compras: [filaCompra()] });
    await leerCompras('30d');
    const [pedida] = pedidas;
    expect(pedida?.pathname).toBe(RUTA_DATOS_ADMIN);
    expect(pedida?.searchParams.get('tabla')).toBe('compras');
    expect(pedida?.searchParams.get('columnaFecha')).toBe('creado_en');
    expect(pedida?.searchParams.get('limite')).toBe(String(LIMITE_FILAS + 1));
    expect(pedida?.searchParams.get('desde')).toMatch(/Z$/);
    expect(pedida?.searchParams.get('hasta')).toMatch(/Z$/);
  });

  it('enmascara el correo y el identificador: la interfaz nunca recibe los completos', async () => {
    mockDatos({ compras: [filaCompra()] });

    const compras = await leerCompras('30d');

    expect(compras).toEqual([
      {
        referencia: '…123456',
        correoEnmascarado: 'c***@example.com',
        plan: 'mensual',
        montoUsd: 19.99,
        estado: 'aprobada',
        creadoEn: '2026-10-20T15:00:00.000Z',
      },
    ]);
    const texto = JSON.stringify(compras);
    expect(texto).not.toContain('cliente@example.com');
    expect(texto).not.toContain('HP-TRANSACCION');
  });

  it('si hay más filas que el límite, falla con un mensaje en español y no devuelve un recorte', async () => {
    const filas = Array.from({ length: LIMITE_FILAS + 1 }, () => filaCompra());
    mockDatos({ compras: filas });

    await expect(leerCompras('todo')).rejects.toThrow(/Elige un periodo más corto/);
  });

  it('si una fila no encaja con el contrato, falla en lugar de descartarla en silencio', async () => {
    mockDatos({ compras: [filaCompra({ plan: 'vitalicio' })] });

    await expect(leerCompras('30d')).rejects.toThrow(/No pudimos leer los datos del panel/);
  });

  it('si el servidor responde error (por ejemplo, sin segundo factor), muestra el mensaje genérico', async () => {
    mockDatos({}, 403);

    await expect(leerCompras('30d')).rejects.toThrow(/No pudimos leer los datos del panel/);
  });

  it('el resumen lee compras, eventos y avisos del periodo', async () => {
    const { pedidas } = mockDatos({
      compras: [filaCompra()],
      eventos_app: [
        {
          tipo: 'portada_vista',
          dispositivo: '7f3c1d2e-0000-4000-8000-000000000001',
          creado_en: '2026-10-20T15:00:00.000Z',
        },
      ],
      eventos_pago: [
        {
          id_evento: 'EV-000000987654',
          estado: 'sin-correo',
          recibido_en: '2026-10-20T15:00:00.000Z',
        },
      ],
    });

    const resumen = await leerResumen('7d');

    expect(pedidas.map((url) => url.searchParams.get('tabla'))).toEqual(
      expect.arrayContaining(['compras', 'eventos_app', 'eventos_pago']),
    );
    expect(resumen?.avisos).toEqual([
      { referencia: '…987654', estado: 'sin-correo', recibidoEn: '2026-10-20T15:00:00.000Z' },
    ]);
    expect(resumen?.eventos).toHaveLength(1);
  });
});

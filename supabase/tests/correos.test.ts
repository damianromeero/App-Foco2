// Correos de la app: plantillas (supabase/functions/_shared/correos.ts) y su envío desde el aviso de Hotmart
// (handler.ts). Todo inventado: correos con dominio .test, enlaces de ejemplo y un envío falso que solo anota.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  construirCorreo,
  GARANTIA_DIAS,
  MARCA,
  type DatosCorreo,
} from '../functions/_shared/correos.ts';
import type { MensajeCorreo } from '../functions/_shared/email.ts';
import { manejarAviso } from '../functions/hotmart-aviso/handler.ts';
import {
  AHORA,
  compraAprobada,
  CORREO,
  crearBanco,
  entornoCompleto,
  minuto,
  OFERTAS_PRUEBA,
  reembolso,
  TOKEN,
} from './ayudas-hotmart.ts';

const APP = 'https://app.ejemplo.test';
const OPCIONES = { appUrl: APP };

describe('plantillas: contenido, enlaces y tono', () => {
  const tipos: DatosCorreo[] = [
    { tipo: 'bienvenida', plan: 'mensual' },
    { tipo: 'bienvenida', plan: 'anual' },
    { tipo: 'pago-atrasado' },
    { tipo: 'reembolso' },
    { tipo: 'cancelacion', accesoHasta: null },
    { tipo: 'cancelacion', accesoHasta: '2026-11-30T12:00:00Z' },
  ];

  for (const datos of tipos) {
    it(`«${datos.tipo}» tiene asunto, versión HTML y versión de texto`, () => {
      const listo = construirCorreo(datos, OPCIONES);
      expect(listo.asunto.length).toBeGreaterThan(5);
      expect(listo.html).toMatch(/^<!doctype html>/);
      expect(listo.html).toContain('<html lang="es">');
      expect(listo.texto.length).toBeGreaterThan(20);
    });

    it(`«${datos.tipo}» no lleva guiones de script ni texto que prometa lo que no hace`, () => {
      const listo = construirCorreo(datos, OPCIONES);
      expect(listo.html).not.toMatch(/<script/i);
      const todo = `${listo.asunto}\n${listo.texto}`;
      expect(todo).not.toMatch(/urgente|último aviso|ultimo aviso|será eliminada|perderás todo/i);
    });
  }

  it('los enlaces usan la dirección pública de la app, en HTML y en texto', () => {
    const listo = construirCorreo({ tipo: 'bienvenida', plan: 'mensual' }, OPCIONES);
    expect(listo.html).toContain(`${APP}/entrar`);
    expect(listo.texto).toContain(`${APP}/entrar`);
    expect(listo.html).toContain(`${APP}/correo/atenzo-logo-blanco.png`);
  });

  it('la bienvenida cuenta la garantía con el número de días del producto', () => {
    const listo = construirCorreo({ tipo: 'bienvenida', plan: 'anual' }, OPCIONES);
    expect(listo.texto).toContain(`${GARANTIA_DIAS} días de garantía`);
    expect(listo.texto).toContain('Pedir un reembolso no te quita el acceso de inmediato');
  });

  it('el pago atrasado no quita el acceso y no mete presión', () => {
    const listo = construirCorreo({ tipo: 'pago-atrasado' }, OPCIONES);
    expect(listo.texto).toMatch(/acceso se mantiene/);
    expect(listo.texto).not.toMatch(/bloquead|suspendid|perder/i);
  });

  it('la cancelación da la fecha de fin solo si la hay, en español y en hora de Madrid', () => {
    const con = construirCorreo(
      { tipo: 'cancelacion', accesoHasta: '2026-11-30T12:00:00Z' },
      OPCIONES,
    );
    expect(con.texto).toContain('hasta el 30 de noviembre de 2026');
    const sin = construirCorreo({ tipo: 'cancelacion', accesoHasta: null }, OPCIONES);
    expect(sin.texto).not.toMatch(/hasta el \d/);
    expect(sin.texto).toContain('Consulta en tu cuenta de Hotmart');
  });

  it('una fecha inválida no se muestra', () => {
    const listo = construirCorreo({ tipo: 'cancelacion', accesoHasta: 'no-es-fecha' }, OPCIONES);
    expect(listo.texto).toContain('Consulta en tu cuenta de Hotmart');
  });

  it('sin soporte no pone enlace de correo; con soporte, sí, y las respuestas van a él', () => {
    const listo = construirCorreo({ tipo: 'reembolso' }, { appUrl: `${APP}` });
    expect(listo.html).not.toContain('mailto:');
    expect(listo.responderA).toBeUndefined();
    const conSoporte = construirCorreo(
      { tipo: 'reembolso' },
      { appUrl: APP, soporte: 'soporte@ejemplo.test' },
    );
    expect(conSoporte.html).toContain('mailto:soporte@ejemplo.test');
    expect(conSoporte.responderA).toBe('soporte@ejemplo.test');
  });

  it('la marca y la garantía coinciden con src/config/plantilla.ts', () => {
    const fuente = readFileSync(resolve(process.cwd(), 'src/config/plantilla.ts'), 'utf8');
    expect(fuente).toMatch(new RegExp(`nombre:\\s*'${MARCA}'`));
    expect(fuente).toMatch(new RegExp(`garantiaDias:\\s*${GARANTIA_DIAS}\\b`));
  });
});

describe('envío desde el aviso de Hotmart', () => {
  const llamadas = (enviados: MensajeCorreo[]) =>
    enviados.map((m) => ({ to: m.to, subject: m.subject }));

  /** Un aviso de pago atrasado de prueba (OVERDUE) para una transacción. */
  const atrasado = (transaccion = 'TRX-DE-PRUEBA-1', minutos = 150) => ({
    id: `aviso-${transaccion}-atrasado-${minutos}`,
    creation_date: minuto(minutos),
    event: 'PURCHASE_DELAYED',
    data: { purchase: { transaction: transaccion, status: 'OVERDUE' } },
  });

  function escenario() {
    const banco = crearBanco();
    const enviados: MensajeCorreo[] = [];
    const enviar = async (cuerpo: unknown, env = entornoCompleto()) => {
      const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hotmart-hottok': TOKEN },
        body: JSON.stringify(cuerpo),
      });
      return manejarAviso(peticion, {
        env: { ...env, APP_URL: APP },
        fetch: banco.falso.fetch,
        ahora: () => AHORA,
        ofertas: OFERTAS_PRUEBA,
        enviarCorreo: async (mensaje) => {
          enviados.push(mensaje);
          return true;
        },
      });
    };
    return { enviar, enviados };
  }

  it('una compra nueva envía la bienvenida una sola vez, aunque Hotmart reenvíe el aviso', async () => {
    const { enviar, enviados } = escenario();
    const aviso = compraAprobada({ transaccion: 'TRX-B1' });
    expect((await enviar(aviso)).status).toBe(200);
    expect((await enviar(aviso)).status).toBe(200);
    expect(llamadas(enviados)).toEqual([
      { to: CORREO, subject: `Tu acceso a ${MARCA} ya está listo` },
    ]);
  });

  it('una reactivación tras un pago atrasado no vuelve a enviar la bienvenida', async () => {
    const { enviar, enviados } = escenario();
    await enviar(compraAprobada({ transaccion: 'TRX-B2', minutos: 60 }));
    await enviar(atrasado('TRX-B2', 90));
    await enviar(compraAprobada({ transaccion: 'TRX-B2', minutos: 200 }));
    const asuntos = enviados.map((m) => m.subject);
    expect(asuntos.filter((a) => a.includes('ya está listo'))).toHaveLength(1);
    expect(asuntos).toContain('Tu pago no se completó todavía');
  });

  it('un pago atrasado envía su correo, y el reembolso el suyo', async () => {
    const { enviar, enviados } = escenario();
    await enviar(compraAprobada({ transaccion: 'TRX-B3', minutos: 60 }));
    await enviar(atrasado('TRX-B3', 90));
    await enviar(reembolso('TRX-B3', 120));
    expect(enviados.map((m) => m.subject)).toEqual([
      `Tu acceso a ${MARCA} ya está listo`,
      'Tu pago no se completó todavía',
      'Tu reembolso está confirmado',
    ]);
  });

  it('un aviso más antiguo que lo guardado no envía nada', async () => {
    const { enviar, enviados } = escenario();
    await enviar(compraAprobada({ transaccion: 'TRX-B4', minutos: 60 }));
    await enviar(reembolso('TRX-B4', 120));
    const antes = enviados.length;
    await enviar(atrasado('TRX-B4', 30));
    expect(enviados).toHaveLength(antes);
  });

  it('la cancelación de la suscripción envía su correo sin fecha si Hotmart no la trae', async () => {
    const { enviar, enviados } = escenario();
    await enviar(compraAprobada({ transaccion: 'TRX-B5', suscriptor: 'SUS-B5', minutos: 60 }));
    await enviar({
      id: 'aviso-SUS-B5-cancelacion',
      creation_date: minuto(120),
      event: 'SUBSCRIPTION_CANCELLATION',
      data: { subscription: { subscriber: { code: 'SUS-B5' } } },
    });
    const cancelacion = enviados.find((m) => m.subject === 'Tu suscripción está cancelada');
    expect(cancelacion?.to).toBe(CORREO);
    expect(cancelacion?.text).toContain('Consulta en tu cuenta de Hotmart');
  });

  it('un fallo del envío no cambia la respuesta a Hotmart', async () => {
    const banco = crearBanco();
    const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hotmart-hottok': TOKEN },
      body: JSON.stringify(compraAprobada({ transaccion: 'TRX-B6' })),
    });
    const respuesta = await manejarAviso(peticion, {
      env: { ...entornoCompleto(), APP_URL: APP },
      fetch: banco.falso.fetch,
      ahora: () => AHORA,
      ofertas: OFERTAS_PRUEBA,
      enviarCorreo: async () => {
        throw new Error('Resend caído');
      },
    });
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ ok: true, estado: 'aplicado' });
  });

  it('sin APP_URL no envía nada, porque los enlaces no serían válidos', async () => {
    const banco = crearBanco();
    const enviados: MensajeCorreo[] = [];
    const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hotmart-hottok': TOKEN },
      body: JSON.stringify(compraAprobada({ transaccion: 'TRX-B7' })),
    });
    const respuesta = await manejarAviso(peticion, {
      env: entornoCompleto(),
      fetch: banco.falso.fetch,
      ahora: () => AHORA,
      ofertas: OFERTAS_PRUEBA,
      enviarCorreo: async (mensaje) => {
        enviados.push(mensaje);
        return true;
      },
    });
    expect(respuesta.status).toBe(200);
    expect(enviados).toHaveLength(0);
  });

  it('sin enviarCorreo (como en las pruebas del aviso) el aviso se guarda igual y no envía nada', async () => {
    const banco = crearBanco();
    const respuesta = await banco.enviar(compraAprobada({ transaccion: 'TRX-B8' }));
    expect(respuesta.status).toBe(200);
  });
});

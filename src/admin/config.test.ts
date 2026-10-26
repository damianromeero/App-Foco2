import { describe, expect, it } from 'vitest';
import { EVENTOS_APP } from '../config/medicion';
import {
  ESTADOS_AVISO_REVISION,
  ETAPAS_EMBUDO,
  ETIQUETA_AVISO,
  etiquetaEvento,
  LIMITE_FILAS,
} from './config';

describe('deriva con la lista de eventos de la app', () => {
  it('cada etapa del embudo que viene de eventos existe en EVENTOS_APP', () => {
    const tipos = new Set<string>(EVENTOS_APP.map((evento) => evento.tipo));
    for (const etapa of ETAPAS_EMBUDO) {
      if (etapa.origen === 'evento') {
        expect(tipos.has(etapa.id), `la etapa ${etapa.id} no está en EVENTOS_APP`).toBe(true);
      }
    }
  });

  it('la etapa de compra viene de la tabla compras y va la última', () => {
    const ultima = ETAPAS_EMBUDO[ETAPAS_EMBUDO.length - 1];
    expect(ultima).toMatchObject({ id: 'compra_aprobada', origen: 'compras' });
    expect(ETAPAS_EMBUDO.filter((etapa) => etapa.origen === 'compras')).toHaveLength(1);
  });

  it('etiquetaEvento usa el texto de EVENTOS_APP y deja el tipo tal cual si no existe', () => {
    expect(etiquetaEvento('portada_vista')).toBe('Vio la portada');
    expect(etiquetaEvento('evento_nuevo')).toBe('evento_nuevo');
  });
});

describe('avisos de Hotmart', () => {
  it('cada estado de revisión tiene su texto en español', () => {
    for (const estado of ESTADOS_AVISO_REVISION) {
      expect(ETIQUETA_AVISO[estado]).toBeTruthy();
    }
  });
});

describe('límites', () => {
  it('el límite de filas es de 5 000', () => {
    expect(LIMITE_FILAS).toBe(5000);
  });
});

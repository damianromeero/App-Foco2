import type { GameId } from '../model';
import { agudoOGrave } from './agudo-o-grave';
import { busqueda } from './busqueda';
import { busquedaFormas } from './busqueda-formas';
import { cambio } from './cambio';
import { casillaIluminada } from './casilla-iluminada';
import { contarPitidos } from './contar-pitidos';
import { cualNoEncaja } from './cual-no-encaja';
import { diferenciaCuadricula } from './diferencia-cuadricula';
import { espejoOGiro } from './espejo-o-giro';
import { esperaLaSenal } from './espera-la-senal';
import { mismoTono } from './mismo-tono';
import { reflejo } from './reflejo';
import { secuencia } from './secuencia';
import { seguirPuntos } from './seguir-puntos';
import { semaforo } from './semaforo';
import { simetria } from './simetria';
import { siguienteFigura } from './siguiente-figura';
import { stroop } from './stroop';
import type { CategoryId, GameSpec } from './types';
import { vigilancia } from './vigilancia';

/** Catálogo completo. El orden es el que ve la persona en la biblioteca. */
export const GAMES: readonly GameSpec[] = [
  vigilancia,
  semaforo,
  secuencia,
  busqueda,
  stroop,
  cambio,
  reflejo,
  esperaLaSenal,
  casillaIluminada,
  diferenciaCuadricula,
  cualNoEncaja,
  siguienteFigura,
  espejoOGiro,
  simetria,
  mismoTono,
  contarPitidos,
  agudoOGrave,
  seguirPuntos,
  busquedaFormas,
];

export const CATEGORIES: Record<CategoryId, { label: string; description: string }> = {
  'atencion-sostenida': {
    label: 'Atención sostenida',
    description: 'Mantener el foco durante un rato sin distraerte.',
  },
  'control-inhibitorio': {
    label: 'Control de impulsos',
    description: 'Frenar la respuesta automática cuando no toca.',
  },
  'memoria-de-trabajo': {
    label: 'Memoria de trabajo',
    description: 'Retener información y actualizarla mientras avanzas.',
  },
  flexibilidad: {
    label: 'Cambio de tarea',
    description: 'Cambiar de regla sin perder el hilo.',
  },
  'atencion-selectiva': {
    label: 'Atención selectiva',
    description: 'Encontrar lo importante entre lo que distrae.',
  },
};

export function getGame(id: GameId): GameSpec {
  const game = GAMES.find((candidate) => candidate.id === id);
  if (!game) {
    throw new Error(`Juego desconocido: ${id}`);
  }
  return game;
}

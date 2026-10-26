import { plantilla } from '../config/plantilla';

export interface ShareCardInput {
  streak: number;
  days: { label: string; completed: boolean }[];
  sessionsThisWeek: number;
  accuracy: number | null;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const PAPER = '#F7F5F0';
const INK = '#1C2430';
const INK_SOFT = '#4B5563';
const BRAND = '#0F766E';
const BRAND_SOFT = '#D7F0EC';
const AMBER = '#FBBF24';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Tarjeta compartible "Mi semana en 5 minutos". No muestra nada que no quieras enseñar:
 * solo días, racha y precisión media. Se dibuja en canvas, así no sale nada de la app.
 */
export function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.reject(new Error('Tu navegador no permite crear la imagen.'));
  }

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = BRAND;
  roundedRect(ctx, 60, 60, WIDTH - 120, 420, 48);
  ctx.fill();

  ctx.fillStyle = PAPER;
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText('Mi semana en', 120, 200);
  ctx.fillText('5 minutos', 120, 300);

  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(WIDTH - 200, 200, 58, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PAPER;
  ctx.font = `600 52px ${FONT}`;
  const streakText = input.streak === 1 ? '1 día seguido' : `${input.streak} días seguidos`;
  ctx.fillText(streakText, 120, 400);

  const slotWidth = (WIDTH - 200) / 7;
  input.days.forEach((day, index) => {
    const cx = 100 + slotWidth * index + slotWidth / 2;
    const cy = 700;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    if (day.completed) {
      ctx.fillStyle = BRAND;
      ctx.fill();
    } else {
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.fillStyle = INK_SOFT;
    ctx.font = `600 36px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(day.label, cx, 820);
  });
  ctx.textAlign = 'left';

  ctx.fillStyle = INK;
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(`${input.sessionsThisWeek} de 7 días entrenados`, 120, 960);

  ctx.fillStyle = BRAND_SOFT;
  roundedRect(ctx, 120, 1040, WIDTH - 240, 120, 32);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `600 44px ${FONT}`;
  const accuracyText =
    input.accuracy === null
      ? 'Sin juegos esta semana'
      : `Precisión media: ${Math.round(input.accuracy * 100)} %`;
  ctx.fillText(accuracyText, 160, 1114);

  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 40px ${FONT}`;
  ctx.fillText('Sin culpa · Sin trampas · Sin prisa', 120, 1260);
  ctx.textAlign = 'right';
  ctx.fillText(plantilla.nombre, WIDTH - 120, 1260);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo crear la imagen.'));
    }, 'image/png');
  });
}

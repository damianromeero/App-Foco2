"""Genera los iconos PNG de la PWA y la imagen para compartir (Open Graph).

Uso: python3 scripts/generate-icons.py
Las imágenes se escriben en public/. Se dibujan a 4x y se reducen para suavizar bordes.
Paleta "aurora de foco": degradado menta a violeta sobre fondo casi negro, anillo de luz y núcleo dorado.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

AURORA_A = (110, 231, 183)  # #6EE7B7
AURORA_C = (167, 139, 250)  # #A78BFA
CANVAS = (5, 8, 7)  # #050807
INK = (241, 246, 243)  # #F1F6F3
INK_SOFT = (148, 163, 157)  # #94A39D
GOLD = (253, 230, 138)  # #FDE68A
WHITE = (255, 255, 255)
SS = 4  # factor de supersampling


def aurora(size: int) -> Image.Image:
    """Degradado diagonal de menta a violeta."""
    ramp = Image.linear_gradient("L").rotate(45, resample=Image.BICUBIC).resize((size, size))
    start = Image.new("RGBA", (size, size), AURORA_A + (255,))
    end = Image.new("RGBA", (size, size), AURORA_C + (255,))
    return Image.composite(end, start, ramp)


def draw_mark(size: int, safe: float, rounded: bool) -> Image.Image:
    """Dibuja el símbolo: anillo de luz sobre el degradado, con núcleo dorado."""
    big = size * SS
    img = aurora(big)
    if rounded:
        mask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.2), fill=255)
        img.putalpha(mask)
    draw = ImageDraw.Draw(img)
    center = big / 2
    outer = big * safe / 2
    ring_width = max(1, int(outer * 0.2))
    draw.ellipse(
        [center - outer, center - outer, center + outer, center + outer],
        outline=WHITE + (245,),
        width=ring_width,
    )
    core = outer * 0.3
    draw.ellipse([center - core, center - core, center + core, center + core], fill=GOLD + (255,))
    return img.resize((size, size), Image.LANCZOS)


def load_font(size: int, bold: bool) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        # macOS: tiene acentos. Sin ella, Pillow usa una fuente de respaldo sin «ó».
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def build_og_image() -> Image.Image:
    width, height = 1200, 630
    img = Image.new("RGB", (width, height), CANVAS)
    glow = aurora(560).resize((560, 560)).convert("RGB")
    mask = Image.new("L", (560, 560), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 559, 559], fill=60)
    img.paste(glow, (560, -120), mask)
    mark = draw_mark(260, safe=1.0, rounded=True)
    img.paste(mark, (96, (height - 260) // 2), mark)
    draw = ImageDraw.Draw(img)
    title_font = load_font(84, bold=True)
    body_font = load_font(38, bold=False)
    x = 420
    draw.text((x, 210), "Atenzo", font=title_font, fill=INK)
    draw.text((x, 320), "Entrena tu atención en 5 minutos.", font=body_font, fill=INK)
    draw.text((x, 378), "Sin culpa · Sin trampas · Sin prisa", font=body_font, fill=INK_SOFT)
    return img


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    draw_mark(192, safe=0.8, rounded=True).save(PUBLIC / "pwa-192.png", optimize=True)
    draw_mark(512, safe=0.8, rounded=True).save(PUBLIC / "pwa-512.png", optimize=True)
    # Maskable: el símbolo queda dentro de la zona segura (80 %) y el degradado ocupa todo el lienzo.
    maskable = aurora(512).convert("RGBA")
    inner = draw_mark(512, safe=0.6, rounded=False)
    maskable.alpha_composite(inner)
    maskable.convert("RGB").save(PUBLIC / "pwa-maskable-512.png", optimize=True)
    draw_mark(180, safe=0.8, rounded=True).convert("RGB").save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    build_og_image().save(PUBLIC / "og-image.png", optimize=True)
    print("Iconos generados en", PUBLIC)


if __name__ == "__main__":
    main()

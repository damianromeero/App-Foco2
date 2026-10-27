"""Genera los iconos PNG de la PWA y la imagen para compartir (Open Graph) a partir del logo de la marca.

Uso: python3 scripts/generate-icons.py
Lee los PNG de 1024 px de docs/marca/ (dibujados desde los SVG de esa carpeta) y escribe en public/.
Si cambias el logo, vuelve a exportar esos PNG desde los SVG y ejecuta este script.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
MARCA = ROOT / "docs" / "marca"

CANVAS = (5, 8, 7)  # #050807
INK = (241, 246, 243)  # #F1F6F3
INK_SOFT = (148, 163, 157)  # #94A39D
GLOW_A = (4, 183, 120)  # verde del logo
GLOW_C = (112, 57, 250)  # violeta del logo


def load(name: str) -> Image.Image:
    return Image.open(MARCA / name).convert("RGBA")


def resized(img: Image.Image, size: int) -> Image.Image:
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


def glow(size: int) -> Image.Image:
    """Degradado diagonal de verde a violeta para el halo de fondo."""
    ramp = Image.linear_gradient("L").rotate(45, resample=Image.BICUBIC).resize((size, size))
    start = Image.new("RGB", (size, size), GLOW_A)
    end = Image.new("RGB", (size, size), GLOW_C)
    return Image.composite(end, start, ramp)


def build_og_image() -> Image.Image:
    width, height = 1200, 630
    img = Image.new("RGB", (width, height), CANVAS)
    halo = glow(560)
    mask = Image.new("L", (560, 560), 0)
    ImageDraw.Draw(mask).ellipse([80, 80, 479, 479], fill=70)
    mask = mask.filter(ImageFilter.GaussianBlur(60))
    img.paste(halo, (620, -140), mask)

    mark = resized(load("atenzo-icono-1024.png"), 200)
    nombre = load("atenzo-nombre-blanco.png")
    nombre = nombre.resize((round(nombre.width * 200 / nombre.height), 200), Image.LANCZOS)
    x, y = 96, 150
    img.paste(mark, (x, y), mark)
    img.paste(nombre, (x + 232, y), nombre)

    draw = ImageDraw.Draw(img)
    body_font = load_font(44, bold=True)
    soft_font = load_font(34, bold=False)
    draw.text((x, y + 250), "Tu entrenamiento diario de atención.", font=body_font, fill=INK)
    draw.text((x, y + 318), "Cinco minutos al día · Sin culpa · Sin prisa", font=soft_font, fill=INK_SOFT)
    return img


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    icono = load("atenzo-icono-1024.png")
    resized(icono, 192).save(PUBLIC / "pwa-192.png", optimize=True)
    resized(icono, 512).save(PUBLIC / "pwa-512.png", optimize=True)
    # Maskable: el degradado ocupa todo el lienzo y la «A» queda dentro de la zona segura.
    resized(load("atenzo-icono-maskable-1024.png"), 512).convert("RGB").save(
        PUBLIC / "pwa-maskable-512.png", optimize=True
    )
    # iOS redondea las esquinas por su cuenta: el icono va cuadrado y sin transparencia.
    resized(load("atenzo-icono-cuadrado-1024.png"), 180).convert("RGB").save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    resized(icono, 48).save(PUBLIC / "favicon-48.png", optimize=True)
    build_og_image().save(PUBLIC / "og-image.png", optimize=True)
    print("Iconos generados en", PUBLIC)


if __name__ == "__main__":
    main()

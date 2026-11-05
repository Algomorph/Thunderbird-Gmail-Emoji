#!/usr/bin/env python3
"""Render the "React" toolbar button icons from emoji-add-plus-cross-2.webp.

Writes src/icons/react-{16,32}.png (dark strokes, for light themes) and
src/icons/react-on-dark-{16,32}.png (inverted strokes, for dark themes).

Thunderbird's own header-button icons fill the inside of each outline with a faint,
translucent tint of the stroke colour, so on a dark toolbar they read as a light outline
over a slightly lighter patch. The dark-theme icon copies that: the tint is translucent, so
it lightens whatever button state (normal, hover, pressed) sits behind it.

The face outline is an open arc that stops short of the "+" badge, so a flood fill would
leak out through the gap. The fill is instead drawn from circles measured on the 240px
source (least-squares fits to the stroke pixels).

Requires Pillow. Run from anywhere: python3 graphics/make-react-icons.py
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "graphics" / "emoji-add-plus-cross-2.webp"
OUT = ROOT / "src" / "icons"
SIZES = (16, 32)

# Geometry of the 240px source, in source pixels.
FACE_CENTER, FACE_RADIUS = (101.9, 137.1), 95.1    # stroke centreline of the face arc
BADGE_CENTER, BADGE_RADIUS = (182.0, 57.0), 50.6   # stroke centreline of the badge ring
BADGE_CLEARANCE = 74.1  # nearest the face arc gets to the badge centre

LIGHT_THEME_STROKE = (0, 0, 0)
DARK_THEME_STROKE = (255, 255, 255)
DARK_THEME_FILL_OPACITY = 0.2

SUPERSAMPLE = 4  # draw the fill mask large, then downscale, for anti-aliased edges


def disc(draw, center, radius, fill):
    s = SUPERSAMPLE
    cx, cy = center
    draw.ellipse(((cx - radius) * s, (cy - radius) * s,
                  (cx + radius) * s, (cy + radius) * s), fill=fill)


def fill_mask(size):
    big = (size[0] * SUPERSAMPLE, size[1] * SUPERSAMPLE)
    face = Image.new("L", big, 0)
    draw = ImageDraw.Draw(face)
    disc(draw, FACE_CENTER, FACE_RADIUS, 255)
    disc(draw, BADGE_CENTER, BADGE_CLEARANCE, 0)  # keep the gap around the badge clear

    badge = Image.new("L", big, 0)
    disc(ImageDraw.Draw(badge), BADGE_CENTER, BADGE_RADIUS, 255)

    return ImageChops.lighter(face, badge).resize(size, Image.LANCZOS)


def layer(color, alpha):
    img = Image.new("RGBA", alpha.size, color + (0,))
    img.putalpha(alpha)
    return img


def main():
    src = Image.open(SOURCE).convert("RGBA")
    stroke = src.getchannel("A")
    fill = fill_mask(src.size).point(lambda v: round(v * DARK_THEME_FILL_OPACITY))

    light_theme = layer(LIGHT_THEME_STROKE, stroke)
    dark_theme = Image.alpha_composite(layer(DARK_THEME_STROKE, fill),
                                       layer(DARK_THEME_STROKE, stroke))

    for size in SIZES:
        for name, img in (("react", light_theme), ("react-on-dark", dark_theme)):
            path = OUT / f"{name}-{size}.png"
            img.resize((size, size), Image.LANCZOS).save(path, optimize=True)
            print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()

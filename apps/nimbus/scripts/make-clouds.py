# Draws the drifting paper-cut cloud sprites into public/sky/: three shapes in
# five tints, each a flat body over a slightly darker layer peeking out below,
# antialiased by 4x supersampling. Run from the app folder.
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "sky")
SS = 4

# (width, height, puffs as (centre x, radius)); every puff sits on the baseline.
SHAPES = {
    "a": (96, 40, [(14, 9), (32, 14), (54, 17), (78, 10)]),
    "b": (72, 30, [(12, 7), (27, 11), (45, 12), (61, 8)]),
    "c": (128, 48, [(16, 10), (38, 16), (64, 21), (90, 15), (112, 10)]),
}

# (body, under layer), snapped to RGB565.
TINTS = {
    "light": ((248, 252, 248), (208, 228, 232)),
    "pale": ((240, 232, 232), (208, 200, 208)),
    "slate": ((56, 92, 96), (32, 64, 72)),
    "night": ((40, 60, 88), (24, 40, 64)),
    "peach": ((248, 184, 120), (232, 140, 88)),
}

UNDER = 3  # px the under layer drops below the body


def silhouette(draw, width, height, puffs, drop, colour):
    base = (height - UNDER - 1 + drop) * SS
    for cx, r in puffs:
        draw.ellipse(((cx - r) * SS, base - 2 * r * SS, (cx + r) * SS, base), fill=colour)
    first, last = puffs[0], puffs[-1]
    low = min(first[1], last[1])
    draw.rectangle((first[0] * SS, base - low * SS, last[0] * SS, base), fill=colour)


os.makedirs(OUT, exist_ok=True)
for shape, (width, height, puffs) in SHAPES.items():
    for tint, (body, under) in TINTS.items():
        big = Image.new("RGBA", (width * SS, height * SS), (0, 0, 0, 0))
        draw = ImageDraw.Draw(big)
        silhouette(draw, width, height, puffs, UNDER, under + (255,))
        silhouette(draw, width, height, puffs, 0, body + (255,))
        big.resize((width, height), Image.LANCZOS).save(os.path.join(OUT, f"{shape}-{tint}.png"), optimize=True)
print("clouds drawn")

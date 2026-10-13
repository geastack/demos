# Draws the rounded pieces of the glass panels into public/ui/: pill caps,
# the hourly strip's focus slot and the sheet's top corners, in each tone.
# The canvas has no rounded rectangles and a translucent rectangle plus
# circles would double-blend where they overlap, so a panel is assembled
# from these pieces and plain rectangles that never overlap. The alphas are
# multiples of 0.2 so the rectangles' globalAlpha lands on the same byte.
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "ui")
SS = 8

# name: (rgb, alpha) -- keep in step with src/render/palette.ts
TONES = {
    "glass-d": ((248, 252, 248), 0.4),  # frosted glass under dark ink (bright scenes)
    "hi-d": ((248, 252, 248), 0.8),
    "sheet-d": ((240, 244, 240), 0.8),
    "glass-l": ((8, 16, 32), 0.4),  # smoked glass under light type (dark scenes)
    "hi-l": ((248, 252, 248), 0.2),
    "sheet-l": ((8, 16, 32), 0.8),
}


def rounded(width, height, radius, rgb, alpha, corners):
    big = Image.new("L", (width * SS, height * SS), 0)
    draw = ImageDraw.Draw(big)
    draw.rounded_rectangle((0, 0, width * SS - 1, height * SS - 1), radius * SS, fill=255, corners=corners)
    mask = big.resize((width, height), Image.LANCZOS).point(lambda v: round(v * alpha))
    image = Image.new("RGBA", (width, height), rgb + (0,))
    image.putalpha(mask)
    return image


def save(image, name):
    image.save(os.path.join(OUT, f"{name}.png"), optimize=True)


os.makedirs(OUT, exist_ok=True)
for tone in ("glass-d", "hi-d", "glass-l", "hi-l"):
    rgb, alpha = TONES[tone]
    pill = rounded(24, 24, 12, rgb, alpha, None)
    save(pill.crop((0, 0, 12, 24)), f"cap-left-{tone}")
    save(pill.crop((12, 0, 24, 24)), f"cap-right-{tone}")
for tone in ("hi-d", "hi-l"):
    rgb, alpha = TONES[tone]
    save(rounded(48, 58, 14, rgb, alpha, None), f"focus-{tone}")
for tone in ("sheet-d", "sheet-l"):
    rgb, alpha = TONES[tone]
    corner = rounded(36, 36, 18, rgb, alpha, None)
    save(corner.crop((0, 0, 18, 18)), f"corner-left-{tone}")
    save(corner.crop((18, 0, 36, 18)), f"corner-right-{tone}")
print("glass drawn")


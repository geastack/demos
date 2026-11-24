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


# suffix: (pill height, focus slot w/h/radius, sheet corner) -- keep in step
# with src/render/glass.ts and src/layout.ts. "-xl" is the square panel's 1.4x set.
SIZES = {
    "": (24, (48, 58, 14), 18),
    "-xl": (34, (68, 82, 20), 25),
}

os.makedirs(OUT, exist_ok=True)
for size, (pill_h, (focus_w, focus_h, focus_r), corner_r) in SIZES.items():
    cap = pill_h // 2
    for tone in ("glass-d", "hi-d", "glass-l", "hi-l"):
        rgb, alpha = TONES[tone]
        pill = rounded(pill_h, pill_h, cap, rgb, alpha, None)
        save(pill.crop((0, 0, cap, pill_h)), f"cap-left-{tone}{size}")
        save(pill.crop((cap, 0, pill_h, pill_h)), f"cap-right-{tone}{size}")
    for tone in ("hi-d", "hi-l"):
        rgb, alpha = TONES[tone]
        save(rounded(focus_w, focus_h, focus_r, rgb, alpha, None), f"focus-{tone}{size}")
    for tone in ("sheet-d", "sheet-l"):
        rgb, alpha = TONES[tone]
        corner = rounded(2 * corner_r, 2 * corner_r, corner_r, rgb, alpha, None)
        save(corner.crop((0, 0, corner_r, corner_r)), f"corner-left-{tone}{size}")
        save(corner.crop((corner_r, 0, 2 * corner_r, corner_r)), f"corner-right-{tone}{size}")
print("glass drawn")


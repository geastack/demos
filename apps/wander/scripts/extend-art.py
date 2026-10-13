# Extends the 480x272 posters upward to 480x502 (the tallest panel), so one
# image set serves every board: the landscape panel shows the bottom 272 rows
# (the original poster, byte for byte), the square panel the bottom 480 and the
# portrait panel all 502 rows, cropped to its width.
#
# The new sky is synthetic. "flat" skies continue the poster's vertical colour
# trend with a heavily smoothed top row (the median drops thin spires);
# "mirror" skies reflect the top band upward (cloud and aurora texture continues
# without a seam), then pull every row's mean onto the same extrapolated trend.
# New rows are ordered-dithered onto the RGB565 grid like the originals.
#   python3 scripts/extend-art.py          # idempotent: re-crops the original first
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "public", "art")
ORIGINAL_H = 272
TOTAL_H = 502
EXTRA = TOTAL_H - ORIGINAL_H
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

# name: (mode, mirror band)
POSTERS = {
    "kyoto": ("flat", 0),
    "santorini": ("flat", 0),
    "iceland": ("mirror", 100),
    "marrakech": ("flat", 0),
    "patagonia": ("mirror", 34),
}


def trend(rows):
    """Per-channel mean of each of the EXTRA rows above the poster (row 0 = nearest)."""
    top = rows[0:3].mean(axis=(0, 1))
    slope = (rows[0:6].mean(axis=(0, 1)) - rows[30:36].mean(axis=(0, 1))) / 30.0
    damp = 36.0
    k = np.arange(1, EXTRA + 1)[:, None]
    return np.clip(top + slope * damp * (1 - np.exp(-k / damp)), 0, 255)


def smooth_row(rows):
    row = rows[0:3].mean(axis=0)  # (480, 3)
    pad = 30
    padded = np.concatenate([np.repeat(row[:1], pad, 0), row, np.repeat(row[-1:], pad, 0)])
    windows = np.lib.stride_tricks.sliding_window_view(padded, 2 * pad + 1, axis=0)
    med = np.median(windows, axis=-1)  # (480, 3)
    img = Image.fromarray(np.clip(med[None, :, :], 0, 255).astype(np.uint8).repeat(8, 0))
    blurred = np.asarray(img.filter(ImageFilter.GaussianBlur(14)), dtype=float)[0]
    return blurred


def dither(rows):
    out = np.zeros(rows.shape)
    for y in range(rows.shape[0]):
        for x in range(480):
            d = BAYER[y & 3][x & 3] / 16 - 0.5
            out[y, x, 0] = int(min(255, max(0, rows[y, x, 0] + 4 + d * 8))) & 0xF8
            out[y, x, 1] = int(min(255, max(0, rows[y, x, 1] + 2 + d * 4))) & 0xFC
            out[y, x, 2] = int(min(255, max(0, rows[y, x, 2] + 4 + d * 8))) & 0xF8
    return out


def extend(poster, mode, band):
    a = poster.astype(float)
    t = trend(a)
    out = np.zeros((EXTRA, 480, 3))
    if mode == "flat":
        base = smooth_row(a)
        mean = base.mean(axis=0)
        top = a[0:3].mean(axis=(0, 1))
        for k in range(EXTRA):
            fade = np.exp(-(k + 1) / 70.0)
            out[k] = mean + (base - mean) * fade + (t[k] - top)
    else:
        cycle = 2 * band
        for k in range(EXTRA):
            p = (k + 1) % cycle
            src = p if p <= band else cycle - p
            row = a[src]
            out[k] = row + (t[k] - a[src].mean(axis=0))
    # row 0 of `out` is adjacent to the poster; the image stacks the far rows first
    out = out[::-1]
    target = a[0:3].mean(axis=(0, 1))
    fade = np.exp(-(np.arange(EXTRA)[::-1] + 1) / 80.0)[:, None, None]
    shifted = out
    for _ in range(2):  # the snap to the RGB565 grid biases the mean: measure it, correct it
        snapped = dither(shifted)
        error = target - snapped[-3:].mean(axis=(0, 1))
        shifted = shifted + error * fade
    out = dither(shifted)
    return np.concatenate([out.astype(np.uint8), poster], axis=0)


for name, (mode, band) in POSTERS.items():
    path = os.path.join(ART, f"{name}.png")
    image = np.asarray(Image.open(path).convert("RGB"))
    poster = image[-ORIGINAL_H:]  # the original, whether or not it was extended before
    Image.fromarray(extend(poster, mode, band)).save(path, optimize=True)
    print(f"{name}: {mode}")

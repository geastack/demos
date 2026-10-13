# Generates the Nimbus scenes with the OpenAI Images API (key from OPENAI_API_KEY),
# then crops each 1536x1024 render to the panel's 480x272, dithered to RGB565:
#   python3 scripts/generate-art.py            # generate into scripts/gen/, then prepare
#   python3 scripts/generate-art.py --prepare  # only crop the existing renders
import base64, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, "gen")
OUT = os.path.join(HERE, "..", "public", "art")

SKY = ("Wide flat layered paper-cut illustration of the same small hillside Mediterranean town seen from a terrace: "
       "a few white houses with terracotta roofs and a bell tower on the right third, rolling hills and a bay on the left, "
       "large open sky filling the upper two thirds for weather, soft gradients, calm and elegant, "
       "no text, no people, no watermark.")

JOBS = {
    "clear-day": "Bright clear summer day, clean pale-blue sky, crisp light. " + SKY,
    "clear-night": "Clear night with a crescent moon and stars, deep navy sky, warm lit windows. " + SKY,
    "cloudy": "Overcast soft grey sky with layered clouds, muted colours. " + SKY,
    "rain": "Rainy afternoon, dark slate clouds, wet reflective roofs, muted teal palette. " + SKY,
    "snow": "Snowy winter morning, white roofs, pale lilac sky, quiet and soft. " + SKY,
    "sunset": "Warm sunset, coral and gold sky, long soft shadows, the bay glowing. " + SKY,
}

# The panel's aspect cut from the render: a 1536x870 window starting this far down.
CROP_TOP = 96
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def generate(name, prompt):
    path = os.path.join(GEN, f"{name}.png")
    if os.path.exists(path):
        return f"{name}: cached"
    os.makedirs(GEN, exist_ok=True)
    body = {"model": "gpt-image-1", "prompt": prompt, "size": "1536x1024", "quality": "medium", "n": 1}
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
                                          "Content-Type": "application/json"})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=400))
    except urllib.error.HTTPError as error:
        return f"{name}: HTTP {error.code} {error.read()[:300]}"
    with open(path, "wb") as out:
        out.write(base64.b64decode(res["data"][0]["b64_json"]))
    return f"{name}: ok"


# Ordered dither onto the RGB565 grid, so the sky gradients do not band.
def prepare(name):
    from PIL import Image

    image = Image.open(os.path.join(GEN, f"{name}.png")).convert("RGB")
    image = image.crop((0, CROP_TOP, 1536, CROP_TOP + 870)).resize((480, 272), Image.LANCZOS)
    pixels = image.load()
    for y in range(272):
        for x in range(480):
            r, g, b = pixels[x, y]
            t = BAYER[y & 3][x & 3] / 16 - 0.5
            r = min(255, max(0, int(r + t * 8))) & 0xF8
            g = min(255, max(0, int(g + t * 4))) & 0xFC
            b = min(255, max(0, int(b + t * 8))) & 0xF8
            pixels[x, y] = (r, g, b)
    os.makedirs(OUT, exist_ok=True)
    image.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    return f"{name}: prepared"


if "--prepare" not in sys.argv:
    with ThreadPoolExecutor(max_workers=6) as pool:
        for line in pool.map(lambda item: generate(*item), JOBS.items()):
            print(line, flush=True)

for job in JOBS:
    print(prepare(job), flush=True)

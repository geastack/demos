# Generates the Sonora album covers with the OpenAI Images API (key from OPENAI_API_KEY).
# Writes sonora/cover-1..6.png; `npm run art -- sonora` then sizes them into public/art.
import base64, json, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

COVER = ("Square album cover artwork, bold and modern, strong focal shape, rich harmonious palette, "
         "subtle grain, no text, no letters, no logos, no people, no watermark.")

JOBS = {
    "sonora/cover-1": ("Synthwave sunset over calm ocean, magenta and amber, a single palm silhouette. " + COVER, "1024x1024", "low"),
    "sonora/cover-2": ("Minimal jazz cover: a deep blue field with one large cream circle and a thin brass line. " + COVER, "1024x1024", "low"),
    "sonora/cover-3": ("Lo-fi bedroom window at night with rain drops and a glowing desk lamp, teal and orange. " + COVER, "1024x1024", "low"),
    "sonora/cover-4": ("Abstract acoustic folk cover: layered green hills drawn with paper cut-outs and a small sun. " + COVER, "1024x1024", "low"),
    "sonora/cover-5": ("Electronic cover: iridescent liquid chrome waves on black, cyan and violet reflections. " + COVER, "1024x1024", "low"),
    "sonora/cover-6": ("Classical piano cover: a black grand piano lid curve in warm spotlight on velvet red. " + COVER, "1024x1024", "low"),
}


def generate(name, prompt, size, quality):
    path = f"{name}.png"
    if os.path.exists(path):
        return f"{name}: cached"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = {"model": "gpt-image-1", "prompt": prompt, "size": size, "quality": quality, "n": 1}
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


with ThreadPoolExecutor(max_workers=6) as pool:
    for line in pool.map(lambda item: generate(item[0], *item[1]), JOBS.items()):
        print(line, flush=True)

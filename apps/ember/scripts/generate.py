# Generates the Ember food photography with the OpenAI Images API (key from OPENAI_API_KEY).
# Writes ember/<dish>.png (1536x1024); scripts/prepare-art.mjs crops them into public/art.
import base64, json, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

FOOD = ("Overhead editorial food photography on a dark charcoal stone surface, soft window light from the left, "
        "shallow depth of field, rich appetising colour, styled with a linen napkin and a few fresh herbs, "
        "the dish centred with generous dark margin, no text, no people, no hands, no watermark.")

JOBS = {
    "ember/roast-chicken": ("A golden roast chicken with lemon halves, garlic bulbs and rosemary in a cast-iron pan. " + FOOD, "1536x1024", "medium"),
    "ember/pizza": ("A Neapolitan margherita pizza with blistered crust, fresh mozzarella and basil on a wooden peel. " + FOOD, "1536x1024", "medium"),
    "ember/sourdough": ("A crusty sourdough loaf with a deep ear and flour dusting on a wire rack, one slice cut. " + FOOD, "1536x1024", "medium"),
    "ember/salmon": ("Roasted salmon fillet with crispy skin, asparagus and lemon on a dark ceramic plate. " + FOOD, "1536x1024", "medium"),
    "ember/lasagna": ("A bubbling lasagna in a ceramic dish with one square served, melted cheese pulling. " + FOOD, "1536x1024", "medium"),
    "ember/lava-cake": ("A chocolate lava cake with molten centre, raspberries and powdered sugar on a dark plate. " + FOOD, "1536x1024", "medium"),
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

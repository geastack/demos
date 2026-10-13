# Generates the Wander artwork with the OpenAI Images API (key from OPENAI_API_KEY).
import base64, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

STYLE = ("Modern flat-shaded gouache travel-poster illustration with subtle paper grain, clean shapes, "
         "rich but harmonious colour, no text, no letters, no people, no watermark.")
HERO = " Wide cinematic composition with calm open sky in the upper third for a title."
THUMB = " Single subject centred on a soft plain background, generous margin, square vignette."

JOBS = {
    "hero-santorini": ("Santorini at golden hour: white cubic houses and blue domes cascading down the caldera cliff, "
                       "a small bell tower, the Aegean sea below, coral and lilac sunset sky." + HERO, "1536x1024", "medium"),
    "hero-iceland": ("Iceland at night: green and violet aurora ribbons over a glacier lagoon with floating icebergs, "
                     "black-sand shore, snowy mountains, deep teal sky with stars." + HERO, "1536x1024", "medium"),
    "hero-marrakech": ("Sahara near Marrakech at dusk: sweeping orange sand dunes, a small camel caravan silhouette far away, "
                       "a Berber tent glowing, warm rose and amber sky." + HERO, "1536x1024", "medium"),
    "hero-patagonia": ("Patagonia: the granite towers of Torres del Paine above a turquoise glacial lake, golden grass "
                       "and wind-bent trees in front, crisp morning light, pale blue sky with lenticular clouds." + HERO,
                       "1536x1024", "medium"),
    "thumb-kyoto-1": ("A bowl of matcha tea with a wagashi sweet on a wooden tray." + THUMB, "1024x1024", "low"),
    "thumb-kyoto-2": ("A red torii gate path at Fushimi Inari, seen as a small vignette." + THUMB, "1024x1024", "low"),
    "thumb-santorini-1": ("A plate of grilled octopus with lemon and olive oil." + THUMB, "1024x1024", "low"),
    "thumb-santorini-2": ("A blue church dome with a small bell against white walls." + THUMB, "1024x1024", "low"),
    "thumb-iceland-1": ("A steaming blue geothermal pool in a lava field." + THUMB, "1024x1024", "low"),
    "thumb-iceland-2": ("A black-sand beach with basalt columns and a sea stack." + THUMB, "1024x1024", "low"),
    "thumb-marrakech-1": ("A clay tagine pot with steam, apricots and almonds." + THUMB, "1024x1024", "low"),
    "thumb-marrakech-2": ("A carved Moorish arch with zellige tiles and a lantern." + THUMB, "1024x1024", "low"),
    "thumb-patagonia-1": ("A cast-iron grill with Patagonian lamb asado over embers." + THUMB, "1024x1024", "low"),
    "thumb-patagonia-2": ("A trekking trail sign post with a condor gliding above peaks." + THUMB, "1024x1024", "low"),
}


def generate(name, prompt, size, quality):
    if os.path.exists(f"{name}.png"):
        return f"{name}: cached"
    body = {"model": "gpt-image-1", "prompt": f"{prompt} {STYLE}", "size": size, "quality": quality, "n": 1}
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
                                          "Content-Type": "application/json"})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=400))
    except urllib.error.HTTPError as error:
        return f"{name}: HTTP {error.code} {error.read()[:200]}"
    with open(f"{name}.png", "wb") as out:
        out.write(base64.b64decode(res["data"][0]["b64_json"]))
    return f"{name}: ok"


with ThreadPoolExecutor(max_workers=6) as pool:
    for line in pool.map(lambda item: generate(item[0], *item[1]), JOBS.items()):
        print(line, flush=True)

"""Export the game as a single offline HTML document, using only Python's stdlib."""
import argparse
import base64
import json
import re
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / "dist"
ART = re.compile(r"art/([a-z_0-9-]+\.(?:png|webp))")
MIME = {".webp": "image/webp", ".png": "image/png"}


def image_uri(filename):
    path = DIST / "art" / filename
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{MIME[path.suffix]};base64,{payload}"


def embed_images(text):
    return ART.sub(lambda match: image_uri(match[1]), text)


def export(destination):
    html = (DIST / "index.html").read_text(encoding="utf-8")
    styles = re.findall(r'<link rel="stylesheet" href="([\w.-]+)">', html)
    scripts = re.findall(r'<script src="([\w.-]+)" defer></script>', html)
    for filename in styles:
        stylesheet = embed_images((DIST / filename).read_text(encoding="utf-8"))
        html = html.replace(f'<link rel="stylesheet" href="{filename}">', f"<style>\n{stylesheet}\n</style>")
    for filename in scripts:
        html = html.replace(f'<script src="{filename}" defer></script>', "")
    # Dynamic card thumbnails and icons are selected after the hub initializes.
    card_images = ["forest", "harbor", "ruins", "academy", "english", "geography", "history", "chinese"]
    sources = {name: image_uri(name + ".png") for name in card_images}
    bootstrap = "<script>window.HappyLearnImages=" + json.dumps(sources) + ";</script>"
    body_scripts = [bootstrap]
    for filename in scripts:
        source = embed_images((DIST / filename).read_text(encoding="utf-8"))
        # These sources are trusted project code. Keep literal closing tags safe inside inline JS.
        source = re.sub(r"</script", lambda _: r"<\/script", source, flags=re.IGNORECASE)
        body_scripts.append(f"<script>\n{source}\n</script>")
    html = embed_images(html).replace("</body>", "\n".join(body_scripts) + "\n</body>")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    export(parser.parse_args().output)

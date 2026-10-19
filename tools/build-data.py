#!/usr/bin/env python3
"""Собирает vendor/fonts-data.js и assets-data.js (base64), чтобы сайт работал с file:// без запросов."""
import base64, io, os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def b64(p):
    with open(os.path.join(ROOT, p), "rb") as f: return base64.b64encode(f.read()).decode()
fonts = {n: b64("fonts/" + n) for n in sorted(os.listdir(os.path.join(ROOT, "fonts"))) if n.endswith(".ttf")}
with open(os.path.join(ROOT, "vendor/fonts-data.js"), "w") as f:
    f.write("// Сгенерировано tools/build-data.py из fonts/*.ttf. Не править руками.\nwindow.VP_FONT_DATA = " + json.dumps(fonts) + ";\n")
def img(p, width=None):
    if not width: return "data:image/png;base64," + b64(p)
    try:
        from PIL import Image
        im = Image.open(os.path.join(ROOT, p)).convert("RGBA")
        if width and im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return "data:image/png;base64," + b64(p)
assets = {"emblem": img("emblem.png", 480), "stamp": img("stamp.png")}
with open(os.path.join(ROOT, "assets-data.js"), "w") as f:
    f.write("// Сгенерировано tools/build-data.py из emblem.png и stamp.png. Не править руками.\nwindow.VP_ASSETS = " + json.dumps(assets) + ";\n")
print("ok", {k: len(v) for k, v in fonts.items()}, {k: len(v) for k, v in assets.items()})

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
TILE_PATH = ROOT / "src" / "assets" / "hjd" / "wan" / "wan-1.png"

JADE_TOP = (58, 128, 108)
JADE_BOTTOM = (27, 78, 65)
CREAM = (248, 243, 230)
CREAM_EDGE = (218, 205, 180)
RED = (158, 42, 35)


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def gradient(size):
    img = Image.new("RGB", (size, size), JADE_TOP)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(JADE_TOP[i] * (1 - t) + JADE_BOTTOM[i] * t) for i in range(3))
        d.line((0, y, size, y), fill=c)
    return img


def tile_layer(size, scale=0.56):
    """Draw a cream mahjong tile with the 萬 glyph, centered."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tw = int(size * scale)
    th = int(tw * 1.30)
    x = (size - tw) // 2
    y = (size - th) // 2

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (x + int(size * 0.012), y + int(size * 0.022), x + tw + int(size * 0.012), y + th + int(size * 0.022)),
        radius=int(tw * 0.16), fill=(0, 0, 0, 90)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(size * 0.018)))
    layer.alpha_composite(shadow)

    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x, y, x + tw, y + th), radius=int(tw * 0.16), fill=CREAM, outline=CREAM_EDGE, width=max(2, int(size * 0.004)))
    # inner line
    inset = int(tw * 0.035)
    d.rounded_rectangle(
        (x + inset, y + inset, x + tw - inset, y + th - inset),
        radius=int(tw * 0.12), outline=(230, 219, 198), width=max(1, int(size * 0.0025))
    )

    glyph = Image.open(TILE_PATH).convert("RGBA")
    gw = int(tw * 0.70)
    gh = int(glyph.height * gw / glyph.width)
    if gh > th * 0.78:
        gh = int(th * 0.78)
        gw = int(glyph.width * gh / glyph.height)
    glyph = glyph.resize((gw, gh), Image.LANCZOS)
    # The source is red ink on transparent; recolor to warm vermilion.
    px = glyph.load()
    for yy in range(glyph.height):
        for xx in range(glyph.width):
            r, g, b, a = px[xx, yy]
            if a:
                px[xx, yy] = (RED[0], RED[1], RED[2], a)
    layer.alpha_composite(glyph, (x + (tw - gw) // 2, y + (th - gh) // 2))
    return layer


def make_icon_only():
    size = 1024
    img = gradient(size).convert("RGBA")
    # subtle light ring
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((int(size * 0.035), int(size * 0.035), int(size * 0.965), int(size * 0.965)),
                        radius=int(size * 0.20), outline=(235, 224, 198, 90), width=int(size * 0.006))
    img.alpha_composite(tile_layer(size, 0.54))
    img.save(ASSETS / "icon-only.png")


def make_foreground():
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.alpha_composite(tile_layer(size, 0.50))
    img.save(ASSETS / "icon-foreground.png")


def make_background():
    size = 1024
    img = gradient(size).convert("RGBA")
    img.save(ASSETS / "icon-background.png")


def font(size):
    for name in ("msyhbd.ttc", "msyh.ttc", "simhei.ttf", "STXINGKA.TTF"):
        p = Path(r"C:\Windows\Fonts") / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def make_splash():
    size = 2732
    img = gradient(size).convert("RGBA")
    # soft light pool
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((size * 0.18, size * 0.16, size * 0.82, size * 0.80), fill=(255, 255, 255, 18))
    glow = glow.filter(ImageFilter.GaussianBlur(int(size * 0.08)))
    img.alpha_composite(glow)

    logo = tile_layer(size, 0.25)
    img.alpha_composite(logo, (0, -int(size * 0.13)))

    d = ImageDraw.Draw(img)
    title_font = font(int(size * 0.055))
    sub_font = font(int(size * 0.022))
    title = "长沙麻将"
    sub = "青 瓷"
    bbox = d.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    d.text(((size - tw) / 2, int(size * 0.66)), title, font=title_font, fill=(247, 241, 226, 245))
    bbox2 = d.textbbox((0, 0), sub, font=sub_font)
    sw = bbox2[2] - bbox2[0]
    d.text(((size - sw) / 2, int(size * 0.735)), sub, font=sub_font, fill=(225, 214, 188, 200))
    img.save(ASSETS / "splash.png")


make_icon_only()
make_foreground()
make_background()
make_splash()
print("wrote assets/icon-only.png icon-foreground.png icon-background.png splash.png")

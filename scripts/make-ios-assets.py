#!/usr/bin/env python3
"""把 assets/ 里的品牌素材铺到 iOS 工程。

- AppIcon.appiconset/AppIcon-512@2x.png  ← assets/icon-only.png（1024，压平 alpha，App Store 不接受带透明通道的图标）
- Splash.imageset/splash-logo.png        ← assets/icon-foreground.png（1024，透明底，只有「一萬」牌面）

用法：python3 scripts/make-ios-assets.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
IOS = ROOT / "ios" / "App" / "App" / "Assets.xcassets"

APPICON = IOS / "AppIcon.appiconset" / "AppIcon-512@2x.png"
SPLASH_DIR = IOS / "Splash.imageset"
SPLASH_LOGO = SPLASH_DIR / "splash-logo.png"


def flatten_rgb(src: Path, size: int = 1024) -> Image.Image:
    img = Image.open(src).convert("RGBA")
    if img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), (33, 69, 59))
    canvas.paste(img, (0, 0), img)
    return canvas


def main() -> None:
    APPICON.parent.mkdir(parents=True, exist_ok=True)
    SPLASH_DIR.mkdir(parents=True, exist_ok=True)

    flatten_rgb(ASSETS / "icon-only.png").save(APPICON, "PNG", optimize=True)

    logo = Image.open(ASSETS / "icon-foreground.png").convert("RGBA")
    logo.save(SPLASH_LOGO, "PNG", optimize=True)

    # 清掉 Capacitor 模板自带的 3 张白色 splash
    for stale in SPLASH_DIR.glob("splash-2732x2732*.png"):
        stale.unlink()

    print(f"wrote {APPICON.relative_to(ROOT)}")
    print(f"wrote {SPLASH_LOGO.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

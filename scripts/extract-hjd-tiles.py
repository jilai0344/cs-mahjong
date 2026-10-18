#!/usr/bin/env python3
"""从《3D 黄金岛》的 MJFace2.0-High 图集裁出万子毛笔字块。

输出：src/assets/hjd/wan/wan-1.png ... wan-9.png（透明背景）
依赖：pip install UnityPy pillow

说明：图集里的字块带不透明白底，这里按「离白距离」生成 alpha，
保留蓝墨/朱砂的毛笔边缘，便于叠加到本项目的象牙白牌面上。
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import UnityPy
    from PIL import Image
except ImportError:
    sys.exit("缺少依赖：pip install UnityPy pillow")

BUNDLE = "5ef9bcc6b85a369d81b4e09c5a8c5f0f.bundle"
TEXTURE = "MJFace2.0-High"

# 图集里 1–9 万字块的粗裁切框（左, 上, 右, 下）
BOXES = {
    1: (270, 410, 390, 605),
    2: (392, 410, 505, 605),
    3: (512, 410, 625, 605),
    4: (632, 410, 745, 605),
    5: (752, 410, 865, 605),
    6: (872, 410, 985, 605),
    7: (15, 600, 135, 800),
    8: (138, 600, 258, 800),
    9: (262, 600, 382, 800),
}


def strip_white(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            m = min(r, g, b)
            if m >= 248:
                px[x, y] = (r, g, b, 0)
            else:
                px[x, y] = (r, g, b, min(255, int((255 - m) * 2.6)))
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hjd-root", default=r"D:\4a volcano\HJD\3DHJD\3DHJD_Data\StreamingAssets")
    ap.add_argument("--out", default="src/assets/hjd/wan")
    args = ap.parse_args()

    bundle = Path(args.hjd_root) / "aa" / "StandaloneWindows" / BUNDLE
    if not bundle.exists():
        sys.exit(f"找不到图集 bundle：{bundle}")

    env = UnityPy.load(str(bundle))
    atlas = None
    for obj in env.objects:
        if obj.type.name != "Texture2D":
            continue
        data = obj.read()
        if str(getattr(data, "m_Name", "")) == TEXTURE:
            atlas = data.image
            break
    if atlas is None:
        sys.exit(f"图集里找不到 {TEXTURE}")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for n, box in BOXES.items():
        cell = atlas.crop(box)
        bbox = cell.getbbox()
        if bbox:
            cell = cell.crop(bbox)
        strip_white(cell).save(out / f"wan-{n}.png")
        print(f"wan-{n}.png", cell.size)
    print("完成 ->", out.resolve())


if __name__ == "__main__":
    main()

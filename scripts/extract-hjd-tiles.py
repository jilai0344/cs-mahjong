#!/usr/bin/env python3
"""从《3D 黄金岛》的 MJFace2.0-High 图集裁出 27 张牌面。

输出：src/assets/hjd/{wan,tiao,tong}/{suit}-1..9.png（透明背景）
依赖：pip install UnityPy pillow

图集里的字块/图案带不透明白底，这里按「离白距离」生成 alpha，
保留蓝墨/朱砂/竹青的毛笔边缘，便于叠加到本项目的象牙白牌面上。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import UnityPy
    from PIL import Image
except ImportError:
    sys.exit("缺少依赖：pip install UnityPy pillow")

BUNDLE = "5ef9bcc6b85a369d81b4e09c5a8c5f0f.bundle"
TEXTURE = "MJFace2.0-High"

# 图集里每组图案的粗裁切框（左, 上, 右, 下）。图集布局：
# 第 1 行 1–8 筒；第 2 行 9 筒 + 1–7 条；第 3 行左起 8–9 条，然后 1–6 万；
# 第 4 行 7–9 万与字牌。这里只取万/条/筒。
BOXES = {
    "tong": {
        1: (5, 5, 125, 195),
        2: (145, 5, 240, 195),
        3: (250, 5, 365, 195),
        4: (385, 5, 495, 195),
        5: (505, 5, 620, 195),
        6: (640, 5, 760, 195),
        7: (770, 5, 885, 195),
        8: (890, 5, 1005, 195),
        9: (5, 200, 125, 395),
    },
    "tiao": {
        1: (130, 200, 250, 395),
        2: (255, 200, 365, 395),
        3: (380, 200, 495, 395),
        4: (500, 200, 625, 395),
        5: (630, 200, 755, 395),
        6: (755, 200, 875, 395),
        7: (875, 200, 1005, 395),
        8: (5, 395, 130, 600),
        9: (130, 395, 265, 600),
    },
    "wan": {
        1: (270, 410, 390, 605),
        2: (392, 410, 505, 605),
        3: (512, 410, 625, 605),
        4: (632, 410, 745, 605),
        5: (752, 410, 865, 605),
        6: (872, 410, 985, 605),
        7: (15, 600, 135, 800),
        8: (138, 600, 258, 800),
        9: (262, 600, 382, 800),
    },
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
    ap.add_argument("--out", default="src/assets/hjd")
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

    out_root = Path(args.out)
    for suit, boxes in BOXES.items():
        out = out_root / suit
        out.mkdir(parents=True, exist_ok=True)
        for n, box in boxes.items():
            cell = atlas.crop(box)
            cell = strip_white(cell)
            bbox = cell.getbbox()
            if bbox:
                cell = cell.crop(bbox)
            cell.save(out / f"{suit}-{n}.png")
            print(f"{suit}-{n}.png", cell.size)
    print("完成 ->", out_root.resolve())


if __name__ == "__main__":
    main()

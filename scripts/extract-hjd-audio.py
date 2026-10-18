#!/usr/bin/env python3
"""从本地《3D黄金岛》安装目录提取一份轻量长沙话语音 / 牌桌音效。

只导出本项目实际会用到的少量片段（每个 20~300KB），不会复制整个 bundle。
用法：
    python scripts/extract-hjd-audio.py --hjd-root "D:/4a volcano/HJD/3DHJD/3DHJD_Data/StreamingAssets"
依赖：
    pip install UnityPy
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import UnityPy
except ImportError:
    sys.exit("缺少 UnityPy：请先运行 pip install UnityPy")


VOICE_BUNDLE = "announcementvoice_assets_all_8bc66c6a9c7a45c1917aecc579c4f246.bundle"
SFX_BUNDLE = "audiodatabaseclips_assets_all_910d3ae7702b4c7335bea6e46b2d01fe.bundle"

# 两位音色各取一套：0000 女声（清亮）/ 0000 男声（沉稳）
VOICE_IDS = {"f": "female-0000", "m": "male-0000"}

SUITS = {"万": "wan", "条": "tiao", "筒": "tong"}

VOICE_KEYS = {
    # 基础动作（HJD 的录音名不完全统一，这里用实际存在的台词名做别名）
    "吃": "chi",
    "碰呀": "peng",
    "杠": "gang",
    "胡啦": "hu",
    "自摸": "zimo",
    "开杠": "kaigang",
    "抢杠": "qianggang",
    "补张": "buzhang",
    "黄牌": "huang",
    # 长沙特色番型
    "清一色": "qingyise",
    "碰碰胡": "pengpenghu",
    "将将胡": "jiangjianghu",
    "七小对": "qixiaodui",
    "豪华七巧对": "haohuaqiqiaodui",
    "超豪华七巧对": "chaohaohuaqiqiaodui",
    "杠上开花": "gangshangkaihua",
    "杠上炮": "gangshangpao",
    "海底捞月": "haidilaoyue",
    "全求人": "quanqiuren",
    "板板胡": "banbanhu",
    "缺一色": "queyise",
    "六六顺": "liuliushun",
    "四喜": "sixi",
    "天胡": "tianhu",
    "地胡": "dihu",
    # 顺口溜（出牌时偶尔播）
    "四万送给你吃": "line-siwansong",
    "出个两万": "line-chugeliangwan",
    "出个六条": "line-chugeliutiao",
    "九万安全": "line-jiuwan",
    "也出个八筒": "line-batong",
    "五万有人胡不": "line-wuwan",
    "莫急莫急我要吃": "line-mojiang",
}

SFX_KEYS = {
    "sound-machine_开局时升降机": "deal-rise",
    "sound-licensing_开局时发牌": "deal",
    "sound-effect-put-together_梳理牌": "sort",
    "sound-effect-mj-start_开局垒牌": "stack",
    "sound-collision-zp_打出去音效": "discard-fly",
    "sound-effect-fall-down_牌落到桌上": "discard-hit",
    "sound-drag_拖动": "drag",
    "sound-take-it-back_拖动好后落到对应位置": "drop-back",
    "sound-popup_弹出吃碰选项": "popup",
    "sound-effect-chipenggang_吃碰杠": "claim",
    "sound-hu_胡牌": "hu",
    "sound-score_分数跳动": "score",
    "buttonClick": "click",
    "softclick": "soft-click",
    "起手胡": "starting-hu",
    "effect-sound-win_赢": "win",
    "sound-effect-lose_输": "lose",
}


def find_bundle(root: Path, name: str) -> Path | None:
    for base in (root / "aa" / "StandaloneWindows", root / "audio-lib" / "1.3.1" / "win"):
        p = base / name
        if p.exists():
            return p
    return None


def dump_clip(clip, out_dir: Path, stem: str) -> int:
    """写出 AudioClip 的 sample（UnityPy 解出来是 wav），返回字节数。"""
    written = 0
    try:
        samples = clip.samples
    except Exception:
        return 0
    if not samples:
        return 0
    for sample_name, data in samples.items():
        suffix = Path(sample_name).suffix.lower() or ".wav"
        # 只保留第一份采样，避免立体声被拆成两个同名文件
        target = out_dir / f"{stem}{suffix}"
        target.write_bytes(data)
        written += len(data)
        break
    return written


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--hjd-root",
        default=r"D:\4a volcano\HJD\3DHJD\3DHJD_Data\StreamingAssets",
        help="HJD 的 StreamingAssets 目录",
    )
    parser.add_argument("--out", default="public/audio/hjd", help="输出目录")
    args = parser.parse_args()

    root = Path(args.hjd_root)
    out = Path(args.out)
    voice_dir = out / "voice"
    sfx_dir = out / "sfx"
    voice_dir.mkdir(parents=True, exist_ok=True)
    sfx_dir.mkdir(parents=True, exist_ok=True)
    for gender in VOICE_IDS:
        (voice_dir / gender).mkdir(parents=True, exist_ok=True)

    voice_path = find_bundle(root, VOICE_BUNDLE)
    if not voice_path:
        sys.exit(f"找不到语音包：{VOICE_BUNDLE}")
    sfx_path = find_bundle(root, SFX_BUNDLE)
    if not sfx_path:
        sys.exit(f"找不到音效包：{SFX_BUNDLE}")

    # 目标 clip 名 -> (音色, 输出文件名)
    wanted: dict[str, tuple[str, str]] = {}
    for gender, prefix in VOICE_IDS.items():
        for value in range(1, 10):
            for cn, suit in SUITS.items():
                wanted[f"{prefix}-mahjong-{value}{cn}"] = (gender, f"{suit}-{value}")
        for cn, key in VOICE_KEYS.items():
            # 有的台词在 zipai 分类下，有的在普通分类下；两处都登记，能命中哪个算哪个
            wanted[f"{prefix}-mahjong-zipai-{cn}"] = (gender, key)
            wanted[f"{prefix}-mahjong-{cn}"] = (gender, key)

    print(f"语音包：{voice_path}")
    env = UnityPy.load(str(voice_path))
    found = 0
    total = 0
    for obj in env.objects:
        if obj.type.name != "AudioClip":
            continue
        try:
            clip = obj.read()
        except Exception:
            continue
        name = str(getattr(clip, "m_Name", ""))
        if name not in wanted:
            continue
        gender, stem = wanted[name]
        n = dump_clip(clip, voice_dir / gender, stem)
        if n:
            found += 1
            total += n
    print(f"语音：导出 {found} 个片段，共 {total / 1024:.0f} KB")

    print(f"音效包：{sfx_path}")
    env = UnityPy.load(str(sfx_path))
    found = 0
    total = 0
    for obj in env.objects:
        if obj.type.name != "AudioClip":
            continue
        try:
            clip = obj.read()
        except Exception:
            continue
        name = str(getattr(clip, "m_Name", ""))
        stem = SFX_KEYS.get(name)
        if not stem:
            continue
        n = dump_clip(clip, sfx_dir, stem)
        if n:
            found += 1
            total += n
    print(f"音效：导出 {found} 个片段，共 {total / 1024:.0f} KB")
    print(f"完成 -> {out.resolve()}")


if __name__ == "__main__":
    main()

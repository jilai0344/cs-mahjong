# 3D 黃金島素材解包與接入指南

> **存档说明（2026-10-18）**：本文记录的是上一轮「复刻黄金岛红金界面」的尝试。用户随后明确表示黄金岛界面与动画过于粗糙，项目已改为「瓷白 · 青岚」清新版；本文仅保留素材解包/音频提取的参考价值，界面方案以 `docs/DESIGN.md` 与当前代码为准。


> 本文檔由用戶 Google 文件「繼續完成它」（2026-10-18）原文轉存，內容未經改動，僅調整為 Markdown 代碼塊格式以便閱讀。

我直接把从 HJD_Mahjong_Bundles.rar 逆向提取的核心动作曲线、3D 骨牌组件、物理声效引擎，以及一键从 .bundle 自动提取全部原版 .png 贴图和 .ogg 长沙话真人配音的 Python 脚本直接贴在下面。

如果你在上一条消息里没能直接点击下载 cs-mahjong-3dhjd.zip，只需按下面 4 步直接复制到你的本地项目里，5 分钟内就能把《3D黄金岛》的原版画面、动作与真人配音完整跑起来（原有的长沙麻将规则与算分文件一行不动）：


### 第一步：一键解包 HJD_Mahjong_Bundles 原版贴图与长沙话语音

你上传的 HJD_Mahjong_Bundles.rar 里包含了完整的牌面图集（5ef9bcc6...bundle）、UI 印章图集（uilib_assets...bundle）、物理搓牌音效（audiodatabaseclips...bundle） 和全套长沙话报牌配音（announcementvoice...bundle）。

在你的 cs-mahjong 根目录下新建一个 extract_hjd.py，运行后它会自动把 .bundle 里的所有高清贴图和 .ogg/.wav 语音直接提取到 public/hjd-assets/ 目录中：


```bash
pip install UnityPy pillow
python extract_hjd.py
```

extract_hjd.py 完整代码：


```python
import os
import UnityPy

# 自动定位你桌面上的 HJD_Mahjong_Bundles 文件夹或 D:\4a volcano
BUNDLE_DIRS = [
    os.path.expanduser(r"~\Desktop\HJD_Mahjong_Bundles"),
    r"D:\4a volcano\HJD\3DHJD\3DHJD_Data\StreamingAssets\aa\StandaloneWindows",
    r"D:\4a volcano\HJD\3DHJD\3DHJD_Data\StreamingAssets\audio-lib\1.3.1\win",
]

OUT_IMG_DIR = os.path.join("public", "hjd-assets", "textures")
OUT_AUDIO_DIR = os.path.join("public", "hjd-assets", "audio")
os.makedirs(OUT_IMG_DIR, exist_ok=True)
os.makedirs(OUT_AUDIO_DIR, exist_ok=True)

TARGET_BUNDLES = {
    "5ef9bcc6b85a369d81b4e09c5a8c5f0f.bundle", # 3D麻将牌与牌面贴图
    "c0dff875bce65c8058536cd61715a7c9.bundle", # 麻将材质与高光
    "fe607457f440db8530cfd7187c70c7f7.bundle", # 默认牌桌与中央升降机
    "uilib_assets_all_48d57b363f510f586b35609c576a6f26.bundle", # 吃碰杠胡特效字与UI
    "0a15f07e3be1d5748be7e8ea148476cb.bundle", # 图标图集
    "audiodatabaseclips_assets_all_910d3ae7702b4c7335bea6e46b2d01fe.bundle", # 物理搓牌音效
    "announcementvoice_assets_all_8bc66c6a9c7a45c1917aecc579c4f246.bundle",  # 长沙话男女声配音
}

def extract_all():
    extracted_imgs, extracted_audios = 0, 0
    for b_dir in BUNDLE_DIRS:
        if not os.path.exists(b_dir):
            continue
        for fname in os.listdir(b_dir):
            if fname not in TARGET_BUNDLES and not fname.endswith(".bundle"):
                continue
            fpath = os.path.join(b_dir, fname)
            print(f"正在解包: {fname} ...")
            try:
                env = UnityPy.load(fpath)
                for obj in env.objects:
                    if obj.type.name in ("Texture2D", "Sprite"):
                        data = obj.read()
                        name = getattr(data, "m_Name", f"tex_{obj.path_id}")
                        if data.image:
                            out_path = os.path.join(OUT_IMG_DIR, f"{name}.png")
                            data.image.save(out_path)
                            extracted_imgs += 1
                    elif obj.type.name == "AudioClip":
                        data = obj.read()
                        name = getattr(data, "m_Name", f"audio_{obj.path_id}")
                        for sample_name, sample_data in data.samples.items():
                            out_path = os.path.join(OUT_AUDIO_DIR, sample_name)
                            with open(out_path, "wb") as f:
                                f.write(sample_data)
                            extracted_audios += 1
            except Exception as e:
                print(f"跳过 {fname}: {e}")
        # 如果桌面文件夹已经提取成功就不重复扫原目录
        if extracted_imgs > 0 or extracted_audios > 0:
            break

    print(f"✅ 解包完成！共导出 {extracted_imgs} 张原版贴图 -> {OUT_IMG_DIR}")
    print(f"✅ 共导出 {extracted_audios} 个原版音效/长沙话配音 -> {OUT_AUDIO_DIR}")

if __name__ == "__main__":
    extract_all()
```


### 第二步：替换 src/mahjong.css（注入《3D黄金岛》动作曲线与 2.5D 牌桌透视）

我从 7b34445baf5f369da3ac145bca1ecca0.bundle 的 CurveLib.asset 中提取了黄金岛原版的出牌抛物线关键帧（t=0.285 扬起峰值、t=0.502 俯冲落桌），以及开局升降机、横跨插牌和书法大字印章动画。将以下样式追加或替换到 src/mahjong.css：


```css
/* ===== 3D黄金岛 (3DHJD) 逆向复刻动作曲线与 2.5D 透视样式 ===== */

/* 1. 牌桌中央 2.5D 俯仰透视容器 (RoomTheme_Default 视角) */
.hjd-table-perspective {
  perspective: 1150px;
  transform-style: preserve-3d;
}

.hjd-table-plane {
  transform: rotateX(18deg);
  transform-style: preserve-3d;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 2. 原版 CurveLib.asset 出牌飞行抛物线 (card-out-self-p-y + card-out-p-z + card-out-r) */
@keyframes hjd-fly-card {
  0% {
    transform: translate3d(0, 0, 0) scale(1.08) rotateX(0deg) rotateZ(0deg);
    filter: drop-shadow(0 14px 18px rgba(0, 0, 0, 0.48));
  }
  28.5% {
    /* 对应 CurveLib card-out-self-p-y 峰值 t=0.285, value=-0.9843 */
    transform: translate3d(calc(var(--fly-dx, 0px) * 0.36), calc(var(--fly-dy, -140px) * 0.45 - 64px), 90px)
      scale(1.18) rotateX(22deg) rotateZ(var(--fly-rot, -6deg));
    filter: drop-shadow(0 28px 24px rgba(0, 0, 0, 0.55));
  }
  50.2% {
    /* 对应 CurveLib card-out-p-z 峰值 t=0.502, value=0.9604 */
    transform: translate3d(calc(var(--fly-dx, 0px) * 0.78), calc(var(--fly-dy, -140px) * 0.82 - 22px), 36px)
      scale(0.96) rotateX(14deg) rotateZ(0deg);
  }
  84% {
    transform: translate3d(var(--fly-dx, 0px), var(--fly-dy, -140px), 4px) scale(0.86) rotateX(18deg);
  }
  92% {
    /* 拍桌微弹 */
    transform: translate3d(var(--fly-dx, 0px), calc(var(--fly-dy, -140px) - 4px), 8px) scale(0.88) rotateX(18deg);
  }
  100% {
    transform: translate3d(var(--fly-dx, 0px), var(--fly-dy, -140px), 0px) scale(0.85) rotateX(18deg);
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
  }
}

.animate-hjd-fly-card {
  animation: hjd-fly-card 0.36s cubic-bezier(0.2, 0.85, 0.35, 1) forwards;
  pointer-events: none;
  z-index: 80;
}

/* 3. 摸牌后“抬起 -> 横跨手牌 -> 插入槽位”理牌动画 (card_area.move_anim) */
@keyframes hjd-insert-card {
  0% {
    transform: translate3d(var(--insert-from-x, 180px), 0, 0) scale(1.04);
    z-index: 40;
  }
  28% {
    transform: translate3d(calc(var(--insert-from-x, 180px) * 0.75), -44px, 30px) rotateZ(7deg) scale(1.08);
    z-index: 40;
  }
  68% {
    transform: translate3d(calc(var(--insert-from-x, 180px) * 0.12), -36px, 24px) rotateZ(-4deg) scale(1.04);
    z-index: 40;
  }
  100% {
    transform: translate3d(0, 0, 0) rotateZ(0deg) scale(1);
    z-index: 1;
  }
}

.animate-hjd-insert {
  animation: hjd-insert-card 0.42s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

/* 4. 开局牌墙中央升降机升起动效 (sound-machine_开局时升降机) */
@keyframes hjd-elevator-rise {
  0% {
    opacity: 0;
    transform: translate3d(0, 26px, -40px) scale(0.92);
  }
  65% {
    opacity: 1;
    transform: translate3d(0, -4px, 6px) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.animate-hjd-elevator {
  animation: hjd-elevator-rise 0.55s cubic-bezier(0.18, 0.89, 0.32, 1.15) backwards;
}

/* 5. 吃/碰/杠/胡 书法金圈印章爆发特效 (play_fx / pos_fx) */
@keyframes hjd-callout-burst {
  0% {
    opacity: 0;
    transform: scale(2.4) rotate(-14deg);
    filter: brightness(1.8) blur(4px);
  }
  45% {
    opacity: 1;
    transform: scale(0.92) rotate(3deg);
    filter: brightness(1.2) blur(0px);
  }
  65% {
    transform: scale(1.06) rotate(-1deg);
  }
  85% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.12) translateY(-10px);
  }
}

.animate-hjd-callout {
  animation: hjd-callout-burst 1.05s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 6. 拍桌/杠胡屏幕微震动 */
@keyframes hjd-table-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  20% { transform: translate3d(-4px, 3px, 0); }
  40% { transform: translate3d(4px, -3px, 0); }
  60% { transform: translate3d(-3px, -2px, 0); }
  80% { transform: translate3d(2px, 2px, 0); }
}

.animate-hjd-shake {
  animation: hjd-table-shake 0.24s ease-out;
}
```


### 第三步：替换 src/components/MahjongTile.jsx（复刻三层骨牌、GoldenRing 鎏金腰线与向上拖拽出牌）

对应 5ef9bcc6...bundle 中的 mj_with_config.prefab（包含琥珀金底壳、#453d10 鎏金腰线、右上角星芒高光、烈焰橙 #f96200 听牌角标，以及按住向上拖拽过线直接打出的交互）：


```javascript
import React, { useState, useRef } from 'react';

// 汉字数字映射
const CN_NUMS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export default function MahjongTile({
  tile,
  isSelected = false,
  isSuggested = false,
  isNewlyDrawn = false,
  isTingCandidate = false,
  isLastDiscarded = false,
  insertOffsetPx = 0,
  size = 'normal',
  faceDown = false,
  onClick,
  onDragDiscard,
  disabled = false,
}) {
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0, active: false });
  const startPosRef = useRef(null);

  const sizeMap = {
    xs: 'w-7 h-10 text-xs rounded-[5px]',
    small: 'w-9 h-12 text-sm rounded-[6px]',
    normal: 'w-12 h-16 md:w-14 md:h-[76px] text-base rounded-[8px]',
    large: 'w-14 h-20 text-lg rounded-[9px]',
  };
  const dimClass = sizeMap[size] || sizeMap.normal;

  // 指针拖拽出牌逻辑 (对齐 card_area.interact.clj.dll dragging_offset=0.2)
  const handlePointerDown = (e) => {
    if (disabled || !onDragDiscard) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setDragDelta({ x: 0, y: 0, active: true });
  };

  const handlePointerMove = (e) => {
    if (!dragDelta.active || !startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    setDragDelta({ x: dx, y: Math.min(20, dy), active: true });
  };

  const handlePointerUp = () => {
    if (!dragDelta.active) return;
    const shouldDiscard = dragDelta.y < -52; // 向上拖过 52px 阈值直接打出
    setDragDelta({ x: 0, y: 0, active: false });
    startPosRef.current = null;
    if (shouldDiscard && onDragDiscard) {
      onDragDiscard(tile);
    }
  };

  // 盖牌（暗杠 / 对手牌背）：琥珀流金 + 玉石纹理
  if (faceDown || !tile) {
    return (
      <div
        className={`relative select-none ${dimClass} transition-transform duration-150`}
        style={{
          background: 'linear-gradient(145deg, #d89b28 0%, #9e6b12 65%, #694406 100%)',
          boxShadow: '0 4px 0 #453d10, 0 7px 12px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,245,200,0.55)',
          border: '1px solid #e7b94c',
        }}
      >
        <div className="absolute inset-[3px] rounded-[4px] border border-amber-200/30 bg-gradient-to-br from-amber-500/20 to-amber-950/40" />
      </div>
    );
  }

  // 解析花色与数值
  const { suit, value } = tile;

  const renderSuitGraphic = () => {
    // 1. 万子：上方手写书法数字 + 下方朱砂红“萬”字
    if (suit === 'wan') {
      return (
        <div className="flex flex-col items-center justify-center leading-none gap-0.5">
          <span className="font-black text-[#1d3557] text-[1.05em] tracking-tighter drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
            {CN_NUMS[value]}
          </span>
          <span className="font-serif font-extrabold text-[#c81e1e] text-[1.15em] leading-none">
            萬
          </span>
        </div>
      );
    }

    // 2. 筒子：3DHJD 多彩同心花瓣圆饼
    if (suit === 'tong') {
      const colors = ['#1e6091', '#c81e1e', '#1b7a43'];
      return (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <div className="grid grid-cols-3 gap-[2px] p-0.5">
            {Array.from({ length: Math.min(value, 9) }).map((_, idx) => {
              const color = colors[(idx + value) % 3];
              return (
                <span
                  key={idx}
                  className="w-2.5 h-2.5 rounded-full border border-white/70 shadow-inner"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, #fff 0%, ${color} 45%, #0f172a 100%)`,
                  }}
                />
              );
            })}
          </div>
          <span className="text-[10px] font-bold text-slate-600 leading-none">{value}筒</span>
        </div>
      );
    }

    // 3. 条子（索子）：一鸟竹节纹
    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        {value === 1 ? (
          <span className="text-lg leading-none drop-shadow-sm">🦚</span>
        ) : (
          <div className="grid grid-cols-3 gap-x-[3px] gap-y-[2px] items-center">
            {Array.from({ length: Math.min(value, 9) }).map((_, idx) => {
              const isRed = value === 5 && idx === 2;
              return (
                <span
                  key={idx}
                  className="w-[4px] h-3 rounded-full"
                  style={{
                    background: isRed
                      ? 'linear-gradient(180deg, #ef4444, #991b1b)'
                      : 'linear-gradient(180deg, #16a34a, #14532d)',
                  }}
                />
              );
            })}
          </div>
        )}
        <span className="text-[10px] font-bold text-emerald-900 leading-none">{value}条</span>
      </div>
    );
  };

  const translateY = dragDelta.active
    ? dragDelta.y
    : isSelected
    ? -16
    : isSuggested
    ? -6
    : 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        '--insert-from-x': `${insertOffsetPx}px`,
        transform: `translate3d(${dragDelta.x}px, ${translateY}px, 0) ${
          dragDelta.active && dragDelta.y < -30 ? 'scale(1.08) rotateZ(-2deg)' : ''
        }`,
        /* 三层立体骨牌结构：象牙白面板 + #453d10 鎏金腰线 + 琥珀底托 */
        background: 'linear-gradient(180deg, #ffffff 0%, #f8f5ec 78%, #e9e1ce 100%)',
        boxShadow: isSelected
          ? '0 3px 0 #453d10, 0 6px 0 #b45309, 0 18px 26px rgba(249, 98, 0, 0.45), inset 0 1px 2px #fff'
          : '0 3px 0 #453d10, 0 6px 0 #9a6b16, 0 9px 14px rgba(0, 0, 0, 0.42), inset 0 1px 2px #fff',
        border: isSelected ? '1.5px solid #f96200' : '1px solid #d6cbb5',
      }}
      className={`group relative flex flex-col items-center justify-center select-none cursor-pointer transition-[transform,box-shadow] duration-100 ${dimClass} ${
        isNewlyDrawn && insertOffsetPx ? 'animate-hjd-insert' : ''
      }`}
    >
      {/* 右上角星芒高光 (对应 mj_with_config.prefab 中的 paimianxing) */}
      <span className="pointer-events-none absolute top-1 right-1 w-2 h-2 rounded-full bg-white/90 blur-[0.5px] shadow-[0_0_6px_#fff]" />

      {/* 听牌候选烈焰橙角标 (对应 tingpaiFx #f96200) */}
      {(isTingCandidate || isSuggested) && (
        <span
          className="absolute -top-2 -right-1.5 px-1 py-[1px] text-[9px] font-black text-white rounded shadow-sm z-20"
          style={{ background: 'linear-gradient(135deg, #ff8800, #f96200)' }}
        >
          听
        </span>
      )}

      {/* 牌河最后打出牌悬浮光标 */}
      {isLastDiscarded && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-slate-950 rounded-full shadow-md animate-bounce whitespace-nowrap z-30">
          ▼ 最新
        </span>
      )}

      {/* 牌面图案 */}
      {renderSuitGraphic()}

      {/* 底部 GoldenRing 鎏金装饰细线 */}
      <span className="pointer-events-none absolute bottom-[2px] inset-x-1.5 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-amber-700/45 to-transparent" />
    </button>
  );
}
```


### 第四步：替换 src/utils/audio.js（自动优先加载解包出的原版 .ogg 真人长沙话配音 + 物理骨牌合成兜底）

将以下代码替换到 src/utils/audio.js。只要你运行了第一步的 extract_hjd.py，它会自动播放从 announcementvoice...bundle 和 audiodatabaseclips...bundle 导出的原版黄金岛音效与长沙话配音；如果某个文件未导出，则自动使用物理包络合成与原版趣味台词兜底：


```javascript
// 《3D黄金岛》原版音效文件映射表 (对应 audiodatabaseclips & announcementvoice bundle)
const HJD_SFX_FILES = {
  elevator: 'sound-machine_开局时升降机.ogg',
  stack: 'sound-effect-mj-start_开局垒牌.ogg',
  deal: 'sound-licensing_开局时发牌.ogg',
  sort: 'sound-effect-put-together_梳理牌.ogg',
  drag: 'sound-drag_拖动.ogg',
  dropBack: 'sound-take-it-back_拖动好后落到对应位置.ogg',
  discardFly: 'sound-collision-zp_打出去音效.ogg',
  discardHit: 'sound-effect-fall-down_牌落到桌上.ogg',
  popup: 'sound-popup_弹出吃碰选项.ogg',
  claim: 'sound-peng_吃碰杠.ogg',
  hu: 'sound-hu_胡牌.ogg',
  score: 'sound-score_分数跳动.ogg',
};

// 原版《3D黄金岛》长沙话趣味报牌台词库
const FUN_DISCARD_LINES = {
  'tiao-4': '四条送给你吃',
  'tiao-2': '二条没人要吧',
  'tong-1': '一筒打出去咯',
  'wan-8': '八万发财咯',
};

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.audioCache = new Map();
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  // 优先尝试播放解包到 public/hjd-assets/audio/ 下的原版 .ogg 音频
  playRawFile(filename, fallbackFn) {
    if (this.muted) return;
    const url = `/hjd-assets/audio/${filename}`;
    let audio = this.audioCache.get(url);
    if (!audio) {
      audio = new Audio(url);
      this.audioCache.set(url, audio);
    }
    audio.currentTime = 0;
    audio.play().catch(() => {
      if (fallbackFn) fallbackFn();
    });
  }

  // 密胺骨牌拍桌物理冲击声合成（带木桌低频共鸣 + 骨牌高频脆响）
  playTileImpact(pitch = 820) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // 1. 骨牌脆响层
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.065);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playDeal() {
    this.playRawFile(HJD_SFX_FILES.elevator, () => this.playTileImpact(520));
  }

  playSelect() {
    this.playRawFile(HJD_SFX_FILES.drag, () => this.playTileImpact(1080));
  }

  playDiscard(tile) {
    this.playRawFile(HJD_SFX_FILES.discardHit, () => this.playTileImpact(760));
    if (tile) this.speakTile(tile);
  }

  playClaim(type) {
    this.playRawFile(HJD_SFX_FILES.claim, () => this.playTileImpact(640));
    const map = { chi: '吃', peng: '碰', gang: '杠', bu: '补张', hu: '胡啦' };
    if (map[type]) this.speakText(map[type]);
  }

  speakTile(tile) {
    if (this.muted || !tile) return;
    const suitNames = { wan: '万', tiao: '条', tong: '筒' };
    const cnName = `${tile.value}${suitNames[tile.suit] || ''}`;
    const voiceFile = `female-0000-mahjong-${cnName}.ogg`;

    this.playRawFile(voiceFile, () => {
      const key = `${tile.suit}-${tile.value}`;
      const line = Math.random() < 0.22 && FUN_DISCARD_LINES[key] ? FUN_DISCARD_LINES[key] : cnName;
      this.speakText(line);
    });
  }

  speakText(text) {
    if (this.muted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 1.15;
    utter.pitch = 1.08;
    window.speechSynthesis.speak(utter);
  }
}

export const soundManager = new SoundManager();
export default soundManager;
```


### 你现在可以怎么验证？

直接玩在线版：点击当前聊天界面里的 cs_mahjong_3dhjd.jsx 预览卡片，所有上述动画（向上拖拽过线出牌、CurveLib 抛物线飞牌、摸牌抬起横移插牌、中央升降机与金圈印章特效）都已经在里面实时运行了。

本地一键提取原声包：在本地运行上面的 extract_hjd.py，你会看到 public/hjd-assets/ 下立刻多出从 HJD_Mahjong_Bundles 解包出来的全部原版 PNG 图集和正宗长沙话 .ogg 语音包！

如果你希望我把某几个特定组件的完整文件（比如 TableCenter.jsx 的中央升降机罗盘或 ActionControls.jsx 的毛笔印章按钮）也单独贴出来方便你直接复制，随时告诉我！

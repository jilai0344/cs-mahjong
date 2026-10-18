import React, { useRef, useState } from 'react';
import { SUITS, isJiangTile } from '../types/mahjong.js';

import wan1 from '../assets/hjd/wan/wan-1.png';
import wan2 from '../assets/hjd/wan/wan-2.png';
import wan3 from '../assets/hjd/wan/wan-3.png';
import wan4 from '../assets/hjd/wan/wan-4.png';
import wan5 from '../assets/hjd/wan/wan-5.png';
import wan6 from '../assets/hjd/wan/wan-6.png';
import wan7 from '../assets/hjd/wan/wan-7.png';
import wan8 from '../assets/hjd/wan/wan-8.png';
import wan9 from '../assets/hjd/wan/wan-9.png';

import tiao1 from '../assets/hjd/tiao/tiao-1.png';
import tiao2 from '../assets/hjd/tiao/tiao-2.png';
import tiao3 from '../assets/hjd/tiao/tiao-3.png';
import tiao4 from '../assets/hjd/tiao/tiao-4.png';
import tiao5 from '../assets/hjd/tiao/tiao-5.png';
import tiao6 from '../assets/hjd/tiao/tiao-6.png';
import tiao7 from '../assets/hjd/tiao/tiao-7.png';
import tiao8 from '../assets/hjd/tiao/tiao-8.png';
import tiao9 from '../assets/hjd/tiao/tiao-9.png';

import tong1 from '../assets/hjd/tong/tong-1.png';
import tong2 from '../assets/hjd/tong/tong-2.png';
import tong3 from '../assets/hjd/tong/tong-3.png';
import tong4 from '../assets/hjd/tong/tong-4.png';
import tong5 from '../assets/hjd/tong/tong-5.png';
import tong6 from '../assets/hjd/tong/tong-6.png';
import tong7 from '../assets/hjd/tong/tong-7.png';
import tong8 from '../assets/hjd/tong/tong-8.png';
import tong9 from '../assets/hjd/tong/tong-9.png';

// 《3D 黄金岛》MJFace2.0-High 牌面图集裁切（透明背景）。
// 万子是一~九 + 繁体「萬」的毛笔字块；条/筒是原版竹节与圆饼图案。
const FACE = {
  [SUITS.WAN]: { 1: wan1, 2: wan2, 3: wan3, 4: wan4, 5: wan5, 6: wan6, 7: wan7, 8: wan8, 9: wan9 },
  [SUITS.TIAO]: { 1: tiao1, 2: tiao2, 3: tiao3, 4: tiao4, 5: tiao5, 6: tiao6, 7: tiao7, 8: tiao8, 9: tiao9 },
  [SUITS.TONG]: { 1: tong1, 2: tong2, 3: tong3, 4: tong4, 5: tong5, 6: tong6, 7: tong7, 8: tong8, 9: tong9 }
};

// 所有牌面共用同一个内框：x/y/宽/高固定，preserveAspectRatio 负责「水平+垂直都居中」。
// 图源已裁到透明内容的紧边界，因此不会再出现万字偏左/偏上。
function TileFace({ suit, value }) {
  const src = FACE[suit]?.[value];
  if (!src) return null;
  return (
    <image
      href={src}
      x="6"
      y="6"
      width="60"
      height="80"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

export default function MahjongTile({
  tile = null,
  isBack = false,
  size = 'md',
  selected = false,
  highlight = false,
  isTing = false,
  tingCount = null,
  showJiangBadge = false,
  lying = false,
  rotation = 0,
  onClick = null,
  onMouseEnter = null,
  onMouseLeave = null,
  onDragDiscard = null,
  onDragStateChange = null,
  className = '',
  style = {}
}) {
  const isJiang = tile ? isJiangTile(tile) : false;
  const dragStartRef = useRef(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });

  // 尺寸表：保留四个宽度断点，桌面大屏与手机都能看清。
  const sizeMap = {
    hand: 'w-[46px] h-[62px] sm:w-[58px] sm:h-[78px] md:w-[68px] md:h-[92px] lg:w-[78px] lg:h-[106px] xl:w-[86px] xl:h-[116px] 2xl:w-[92px] 2xl:h-[124px]',
    meld: 'w-[38px] h-[52px] sm:w-[44px] sm:h-[60px] md:w-[52px] md:h-[70px] lg:w-[58px] lg:h-[78px] xl:w-[64px] xl:h-[86px]',
    discard: 'w-[30px] h-[41px] sm:w-[36px] sm:h-[49px] md:w-[42px] md:h-[57px] lg:w-[46px] lg:h-[62px] xl:w-[50px] xl:h-[68px]',
    'discard-side': 'w-[26px] h-[36px] sm:w-[30px] sm:h-[41px] md:w-[32px] md:h-[44px] lg:w-[34px] lg:h-[47px] xl:w-[36px] xl:h-[49px]',
    'opp-top': 'w-[32px] h-[44px] sm:w-[38px] sm:h-[52px] md:w-[40px] md:h-[55px] lg:w-[42px] lg:h-[57px] xl:w-[44px] xl:h-[60px]',
    'opp-side': 'w-[22px] h-[30px] sm:w-[24px] sm:h-[33px] md:w-[26px] md:h-[35px] lg:w-[28px] lg:h-[38px] xl:w-[30px] xl:h-[40px]',
    lg: 'w-[78px] h-[106px]',
    md: 'w-[58px] h-[78px]',
    sm: 'w-[38px] h-[52px]',
    mini: 'w-[28px] h-[39px]'
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;

  // 向上拖拽出牌（对齐黄金岛的手感）。拖过 -52px 视为打出；
  // 轻点仍然走原来的「选中 -> 再点一次」防误触逻辑。
  const handlePointerDown = (e) => {
    if (!onDragDiscard || !tile) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragPosRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: true });
    onDragStateChange?.(true);
  };

  const handlePointerMove = (e) => {
    if (!dragStartRef.current) return;
    const x = e.clientX - dragStartRef.current.x;
    const y = Math.min(18, e.clientY - dragStartRef.current.y);
    dragPosRef.current = { x, y };
    setDrag({ x, y, active: true });
  };

  const endDrag = (discard) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    const { y } = dragPosRef.current;
    dragPosRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: false });
    onDragStateChange?.(false);
    if (discard && y < -52 && onDragDiscard) {
      suppressClickRef.current = Date.now() + 320;
      onDragDiscard(tile);
    }
  };

  const handleClick = (e) => {
    if (Date.now() < suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) onClick(e);
  };

  const dragStyle = drag.active
    ? {
        transform: `translate3d(${drag.x}px, ${drag.y}px, 0) scale(1.045)`,
        zIndex: 50,
        transition: 'none',
        animationName: 'none',
        cursor: 'grabbing'
      }
    : {};

  // 牌背：青瓷色 + 细白线，安静但能看出是「牌」
  if (isBack || !tile) {
    return (
      <div
        className={`relative inline-block shrink-0 select-none cursor-default ${currentSizeClass} ${lying ? 'meld-lying' : ''} ${className}`}
        style={style}
        aria-hidden="true"
      >
        <svg viewBox="0 0 72 96" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="tileBackGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-jade-300)" />
              <stop offset="55%" stopColor="var(--color-jade-500)" />
              <stop offset="100%" stopColor="var(--color-jade-600)" />
            </linearGradient>
          </defs>
          <rect x="2" y="8" width="68" height="86" rx="10" fill="var(--color-jade-600)" opacity="0.55" />
          <rect x="2" y="2" width="68" height="86" rx="10" fill="url(#tileBackGrad)" stroke="var(--color-jade-200)" strokeWidth="1" strokeOpacity="0.7" />
          <rect x="8" y="8" width="56" height="74" rx="7" fill="none" stroke="var(--art-white)" strokeWidth="1" strokeOpacity="0.4" />
          <path d="M36 34 L46 48 L36 62 L26 48 Z" fill="var(--art-white)" fillOpacity="0.24" />
          <circle cx="36" cy="48" r="3" fill="var(--art-white)" fillOpacity="0.55" />
        </svg>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => endDrag(true)}
      onPointerCancel={() => endDrag(false)}
      data-suit={tile.suit}
      data-value={tile.value}
      className={`relative inline-block shrink-0 select-none transition-[transform,box-shadow] duration-150 ease-out ${currentSizeClass} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${
        selected
          ? '-translate-y-4 drop-shadow-[0_16px_18px_rgba(20,42,34,0.28)] ring-2 ring-jade-600 ring-offset-2 ring-offset-transparent rounded-[10px]'
          : 'hover:-translate-y-0.5'
      } ${
        highlight ? 'ring-2 ring-white/90 ring-offset-1 ring-offset-transparent brightness-105 rounded-[10px]' : ''
      } ${lying ? 'meld-lying' : ''} ${className}`}
      style={{
        ...style,
        ...dragStyle,
        touchAction: onDragDiscard ? 'none' : undefined
      }}
    >
      <svg viewBox="0 0 72 96" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="ivoryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--art-white)" />
            <stop offset="72%" stopColor="var(--art-face)" />
            <stop offset="100%" stopColor="var(--art-face-shade)" />
          </linearGradient>
          <linearGradient id="tileSideGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--art-face-edge)" />
            <stop offset="100%" stopColor="var(--art-steel-400)" />
          </linearGradient>
        </defs>

        <g transform={rotation ? `rotate(${rotation}, 36, 48)` : undefined}>
          {/* 牌身侧边：只留一道很浅的厚度，不再用金色底座 */}
          <rect x="2" y="8" width="68" height="86" rx="10" fill="url(#tileSideGrad)" />
          <rect
            x="2"
            y="2"
            width="68"
            height="86"
            rx="9"
            fill="url(#ivoryGrad)"
            stroke="var(--art-face-edge)"
            strokeWidth="1"
          />
          <rect x="4.5" y="4.5" width="63" height="81" rx="7" fill="none" stroke="var(--art-white)" strokeWidth="1.2" strokeOpacity="0.9" />

          <TileFace suit={tile.suit} value={tile.value} />
        </g>
      </svg>

      {/* 258 将牌标记：放在牌角外侧，避免压住原版牌面 */}
      {showJiangBadge && isJiang && (
        <span className="pointer-events-none absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-jade-500)] ring-1 ring-white/85" />
      )}

      {isTing && (
        <div className="pointer-events-none absolute -right-1.5 -top-2 z-30 rounded-full bg-rose-600 px-1.5 py-[1px] text-[9px] font-bold leading-tight text-white shadow-sm">
          听{tingCount !== null ? ` ${tingCount}` : ''}
        </div>
      )}
    </div>
  );
}

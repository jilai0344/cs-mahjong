import React from 'react';
import { SUITS, NUMBER_NAMES, isJiangTile } from '../types/mahjong.js';

// -------------------------------------------------------------
// 1. 万字牌：墨色数字 + 朱砂「万」，只保留一点点传统印刷的味道
// -------------------------------------------------------------
function SvgWan({ value }) {
  const numChar = NUMBER_NAMES[value];
  const brushFont = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif';

  return (
    <g transform="translate(0, 0)">
      <text
        x="36"
        y="35"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--art-ink)"
        fontSize="34"
        fontWeight="700"
        fontFamily={brushFont}
      >
        {numChar}
      </text>
      <text
        x="36"
        y="72"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--art-wan-500)"
        fontSize="34"
        fontWeight="700"
        fontFamily={brushFont}
      >
        万
      </text>
      <line x1="22" y1="53" x2="50" y2="53" stroke="var(--art-wan-300)" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </g>
  );
}

// -------------------------------------------------------------
// 2. 条子牌：细竹节，不用金属高光；保留 1 条的小鸟与 8 条的 M 形
// -------------------------------------------------------------
function SvgBamboo({ x, y, width = 10, height = 24, color = 'var(--art-tiao-600)', redJoint = false }) {
  const rx = width / 2;
  return (
    <g>
      <rect x={x - rx} y={y} width={width} height={height} rx={rx} fill={color} />
      <rect x={x - rx + width * 0.22} y={y + 3} width={width * 0.2} height={height - 6} rx={rx * 0.4} fill="var(--art-white)" opacity="0.25" />
      <rect x={x - rx - 0.8} y={y + height * 0.34} width={width + 1.6} height="1.5" rx="0.75" fill={redJoint ? 'var(--art-wan-500)' : 'var(--art-tiao-800)'} opacity="0.7" />
      <rect x={x - rx - 0.8} y={y + height * 0.66} width={width + 1.6} height="1.5" rx="0.75" fill={redJoint ? 'var(--art-wan-500)' : 'var(--art-tiao-800)'} opacity="0.7" />
    </g>
  );
}

function SvgTiao({ value }) {
  if (value === 1) {
    return (
      <g transform="translate(36, 48) scale(0.9)">
        {/* 栖枝 */}
        <rect x="-25" y="26" width="50" height="6" rx="3" fill="var(--art-tiao-700)" />
        <rect x="-3" y="24" width="6" height="10" rx="1.5" fill="var(--art-wan-500)" />

        {/* 双爪 */}
        <path d="M-8 19 L-8 26 M-12 26 L-4 26" stroke="var(--art-wan-500)" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 19 L7 26 M3 26 L11 26" stroke="var(--art-wan-500)" strokeWidth="2" strokeLinecap="round" />

        {/* 身体 */}
        <ellipse cx="-1" cy="4" rx="16" ry="18" fill="var(--art-tiao-600)" />
        <ellipse cx="2" cy="6" rx="10" ry="12" fill="var(--art-white)" opacity="0.45" />

        {/* 尾羽 */}
        <path d="M-13 2 C-24 -4 -27 -16 -22 -23 C-20 -13 -11 -7 -7 -3 Z" fill="var(--art-tiao-800)" />
        <path d="M-12 9 C-21 7 -26 -2 -22 -11 C-18 -4 -9 1 -5 4 Z" fill="var(--art-wan-500)" opacity="0.9" />
        <path d="M-10 13 C-17 15 -22 8 -19 0 C-15 4 -8 7 -4 9 Z" fill="var(--art-tong-600)" opacity="0.9" />

        {/* 颈与头 */}
        <path d="M3 -9 C6 -18 10 -22 16 -22 C23 -22 25 -14 19 -6 C14 -1 9 1 5 3 Z" fill="var(--art-tiao-600)" />
        <circle cx="15" cy="-16" r="9" fill="var(--art-tiao-600)" />

        {/* 眼睛与喙 */}
        <circle cx="18" cy="-18" r="3" fill="var(--art-white)" />
        <circle cx="18.8" cy="-18" r="1.4" fill="var(--art-ink)" />
        <path d="M23 -18 L32 -16 L23 -13 Z" fill="var(--art-wan-500)" />

        {/* 鸡冠与肉垂 */}
        <path d="M11 -23 C10 -31 15 -31 16 -25 C17 -31 22 -30 21 -23 C23 -27 27 -25 25 -19 Z" fill="var(--art-wan-500)" />
        <ellipse cx="20" cy="-10" rx="2.2" ry="3.6" fill="var(--art-wan-500)" />
      </g>
    );
  }

  const green = 'var(--art-tiao-600)';
  const red = 'var(--art-wan-500)';
  const blue = 'var(--art-tong-600)';

  switch (value) {
    case 2:
      return (
        <g>
          <SvgBamboo x={36} y={14} width={11} height={28} color={green} />
          <SvgBamboo x={36} y={52} width={11} height={28} color={green} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgBamboo x={36} y={14} width={10.5} height={27} color={blue} />
          <SvgBamboo x={24} y={51} width={10.5} height={29} color={green} />
          <SvgBamboo x={48} y={51} width={10.5} height={29} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgBamboo x={23} y={15} width={10.5} height={28} color={green} />
          <SvgBamboo x={49} y={15} width={10.5} height={28} color={red} />
          <SvgBamboo x={23} y={51} width={10.5} height={28} color={red} />
          <SvgBamboo x={49} y={51} width={10.5} height={28} color={green} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgBamboo x={21} y={15} width={10} height={26} color={green} />
          <SvgBamboo x={51} y={15} width={10} height={26} color={blue} />
          <SvgBamboo x={36} y={34} width={10.5} height={26} color={red} redJoint />
          <SvgBamboo x={21} y={53} width={10} height={26} color={blue} />
          <SvgBamboo x={51} y={53} width={10} height={26} color={green} />
        </g>
      );
    case 6:
      return (
        <g>
          <SvgBamboo x={20} y={15} width={10} height={27} color={green} />
          <SvgBamboo x={36} y={15} width={10} height={27} color={green} />
          <SvgBamboo x={52} y={15} width={10} height={27} color={green} />
          <SvgBamboo x={20} y={52} width={10} height={27} color={blue} />
          <SvgBamboo x={36} y={52} width={10} height={27} color={blue} />
          <SvgBamboo x={52} y={52} width={10} height={27} color={blue} />
        </g>
      );
    case 7:
      return (
        <g>
          <SvgBamboo x={36} y={11} width={10.5} height={24} color={red} redJoint />
          <SvgBamboo x={20} y={40} width={9.5} height={21} color={green} />
          <SvgBamboo x={36} y={40} width={9.5} height={21} color={green} />
          <SvgBamboo x={52} y={40} width={9.5} height={21} color={green} />
          <SvgBamboo x={20} y={67} width={9.5} height={21} color={green} />
          <SvgBamboo x={36} y={67} width={9.5} height={21} color={green} />
          <SvgBamboo x={52} y={67} width={9.5} height={21} color={green} />
        </g>
      );
    case 8:
      return (
        <g>
          <path
            d="M 18 38 L 27 15 L 36 29 L 45 15 L 54 38"
            stroke={green}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M 18 81 L 27 58 L 36 72 L 45 58 L 54 81"
            stroke={green}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="36" y1="30" x2="36" y2="70" stroke={red} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="36" cy="50" r="2.6" fill={red} />
        </g>
      );
    case 9:
      return (
        <g>
          {[13, 39, 65].map((y, row) =>
            [20, 36, 52].map((x) => (
              <SvgBamboo
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={9.5}
                height={21}
                color={row === 0 ? red : row === 1 ? blue : green}
              />
            ))
          )}
        </g>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// 3. 筒子牌：温和的双环圆饼，保留 1 筒的花心
// -------------------------------------------------------------
function SvgDot({ cx, cy, r = 9, color = 'var(--art-tong-600)' }) {
  const isRed = color === 'var(--art-wan-500)';
  const isGreen = color === 'var(--art-tiao-600)';

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke="var(--art-white)" strokeWidth="1.1" opacity="0.75" />
      <circle cx={cx} cy={cy} r={r * 0.26} fill={isGreen ? 'var(--art-tiao-900)' : isRed ? 'var(--art-wan-700)' : 'var(--art-tong-900)'} />
      <circle cx={cx - r * 0.2} cy={cy - r * 0.2} r={r * 0.16} fill="var(--art-white)" opacity="0.65" />
    </g>
  );
}

function SvgTong({ value }) {
  const blue = 'var(--art-tong-600)';
  const green = 'var(--art-tiao-600)';
  const red = 'var(--art-wan-500)';

  if (value === 1) {
    return (
      <g transform="translate(36, 48)">
        <circle cx="0" cy="0" r="30" fill="var(--art-white)" stroke="var(--art-wan-500)" strokeWidth="3" />
        <circle cx="0" cy="0" r="23" fill="none" stroke="var(--art-wan-300)" strokeWidth="1" />
        {[...Array(8)].map((_, i) => {
          const angle = (i * Math.PI) / 4;
          return (
            <circle
              key={i}
              cx={Math.cos(angle) * 16}
              cy={Math.sin(angle) * 16}
              r="4"
              fill={i % 2 === 0 ? green : blue}
            />
          );
        })}
        <circle cx="0" cy="0" r="9" fill="var(--art-wan-500)" />
        <circle cx="0" cy="0" r="3.4" fill="var(--art-white)" />
      </g>
    );
  }

  switch (value) {
    case 2:
      return (
        <g>
          <SvgDot cx={36} cy={27} r={12} color={green} />
          <SvgDot cx={36} cy={69} r={12} color={blue} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgDot cx={20} cy={22} r={10} color={blue} />
          <SvgDot cx={36} cy={48} r={10} color={red} />
          <SvgDot cx={52} cy={74} r={10} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgDot cx={22} cy={26} r={10.5} color={blue} />
          <SvgDot cx={50} cy={26} r={10.5} color={green} />
          <SvgDot cx={22} cy={70} r={10.5} color={green} />
          <SvgDot cx={50} cy={70} r={10.5} color={blue} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgDot cx={20} cy={23} r={9.5} color={blue} />
          <SvgDot cx={52} cy={23} r={9.5} color={green} />
          <SvgDot cx={36} cy={48} r={11} color={red} />
          <SvgDot cx={20} cy={73} r={9.5} color={green} />
          <SvgDot cx={52} cy={73} r={9.5} color={blue} />
        </g>
      );
    case 6:
      return (
        <g>
          {[22, 48, 74].map((y, row) => (
            <React.Fragment key={y}>
              <SvgDot cx={23} cy={y} r={9} color={row === 0 ? green : red} />
              <SvgDot cx={49} cy={y} r={9} color={row === 0 ? green : red} />
            </React.Fragment>
          ))}
        </g>
      );
    case 7:
      return (
        <g>
          <SvgDot cx={18} cy={20} r={7.5} color={green} />
          <SvgDot cx={36} cy={25} r={7.5} color={green} />
          <SvgDot cx={54} cy={30} r={7.5} color={green} />
          <SvgDot cx={23} cy={54} r={8.5} color={red} />
          <SvgDot cx={49} cy={54} r={8.5} color={red} />
          <SvgDot cx={23} cy={75} r={8.5} color={red} />
          <SvgDot cx={49} cy={75} r={8.5} color={red} />
        </g>
      );
    case 8:
      return (
        <g>
          {[18, 38, 58, 78].map((y) => (
            <React.Fragment key={y}>
              <SvgDot cx={23} cy={y} r={8} color={blue} />
              <SvgDot cx={49} cy={y} r={8} color={blue} />
            </React.Fragment>
          ))}
        </g>
      );
    case 9:
      return (
        <g>
          {[22, 48, 74].map((y, row) => (
            <React.Fragment key={y}>
              <SvgDot cx={19} cy={y} r={8} color={row === 0 ? blue : row === 1 ? red : green} />
              <SvgDot cx={36} cy={y} r={8} color={row === 0 ? blue : row === 1 ? red : green} />
              <SvgDot cx={53} cy={y} r={8} color={row === 0 ? blue : row === 1 ? red : green} />
            </React.Fragment>
          ))}
        </g>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// 4. 牌张统一封装：象牙白面板 + 极浅的侧边，不用金属/流金
// -------------------------------------------------------------
export default function MahjongTile({
  tile = null,
  isBack = false,
  size = 'md',
  selected = false,
  highlight = false,
  isTing = false,
  tingCount = null,
  showJiangBadge = false,
  rotation = 0,
  onClick = null,
  onMouseEnter = null,
  onMouseLeave = null,
  className = '',
  style = {}
}) {
  const isJiang = tile ? isJiangTile(tile) : false;

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

  // 牌背：青瓷色 + 细白线，安静但能看出是「牌」
  if (isBack || !tile) {
    return (
      <div
        className={`relative inline-block shrink-0 select-none cursor-default ${currentSizeClass} ${className}`}
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
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
      } ${className}`}
      style={style}
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

          {tile.suit === SUITS.WAN && <SvgWan value={tile.value} />}
          {tile.suit === SUITS.TIAO && <SvgTiao value={tile.value} />}
          {tile.suit === SUITS.TONG && <SvgTong value={tile.value} />}

          {showJiangBadge && isJiang && (
            <circle cx="11" cy="11" r="4" fill="var(--color-jade-500)" stroke="var(--art-white)" strokeWidth="1.2" />
          )}
        </g>
      </svg>

      {isTing && (
        <div className="pointer-events-none absolute -right-1.5 -top-2 z-30 rounded-full bg-rose-600 px-1.5 py-[1px] text-[9px] font-bold leading-tight text-white shadow-sm">
          听{tingCount !== null ? ` ${tingCount}` : ''}
        </div>
      )}
    </div>
  );
}

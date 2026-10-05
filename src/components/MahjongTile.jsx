import React from 'react';
import { SUITS, NUMBER_NAMES, isJiangTile } from '../types/mahjong.js';

// -------------------------------------------------------------
// 1. 万字牌纯矢量 SVG 渲染 (一万 ~ 九万) - 严格遵循经典书法楷书风格
// -------------------------------------------------------------
function SvgWan({ value }) {
  const numChar = NUMBER_NAMES[value];
  const isRedTop = value === 1 || value === 5 || value === 7 || value === 9;

  // 经典楷书字体族，确保在 Windows、Mac、iOS、Android 均呈现优美楷体书法
  const kaiFont = '"KaiTi", "STKaiti", "楷体", "Kaiti SC", "BiauKai", "Noto Serif SC", serif';

  return (
    <g transform="translate(0, 0)">
      {/* 上方数字 (楷书) */}
      <text
        x="36"
        y="42"
        textAnchor="middle"
        dominantBaseline="central"
        fill={isRedTop ? '#dc2626' : '#18181b'}
        fontSize="34"
        fontWeight="bold"
        fontFamily={kaiFont}
        style={{ letterSpacing: '0px' }}
      >
        {numChar}
      </text>

      {/* 下方“萬”字 (书法繁体楷书) */}
      <text
        x="36"
        y="74"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#b91c1c"
        fontSize="28"
        fontWeight="bold"
        fontFamily={kaiFont}
      >
        萬
      </text>
    </g>
  );
}

// -------------------------------------------------------------
// 2. 条子牌纯矢量 SVG 渲染 - 精致竹节立体感 + 华美孔雀一鸟
// -------------------------------------------------------------
// 高级 3D 雕花竹节棍柱
function SvgBamboo({ x, y, width = 8, height = 24, color = '#15803d', hasRedJoint = false, isAngled = 0 }) {
  const rx = width / 2;
  const jointY = y + height / 2;
  const gradId = color === '#dc2626' ? 'bambooRedGrad' : color === '#1d4ed8' ? 'bambooBlueGrad' : 'bambooGreenGrad';

  return (
    <g transform={isAngled ? `rotate(${isAngled}, ${x}, ${y + height/2})` : undefined}>
      {/* 竹柱主体 */}
      <rect
        x={x - rx}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={`url(#${gradId})`}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.8"
      />
      {/* 上下两端竹节凹痕 */}
      <ellipse cx={x} cy={y + 2.5} rx={rx - 1} ry="1" fill="rgba(255,255,255,0.4)" />
      <ellipse cx={x} cy={y + height - 2.5} rx={rx - 1} ry="1" fill="rgba(0,0,0,0.25)" />
      {/* 中间竹节环凸起 */}
      <rect
        x={x - rx - 0.8}
        y={jointY - 1.2}
        width={width + 1.6}
        height={2.4}
        rx="1"
        fill={hasRedJoint ? '#dc2626' : '#fef08a'}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />
      {/* 纵向立体高光线 */}
      <line
        x1={x - rx * 0.3}
        y1={y + 3}
        x2={x - rx * 0.3}
        y2={y + height - 3}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </g>
  );
}

function SvgTiao({ value }) {
  // 1条：大师级华美孔雀/神鸟，色彩斑斓，身姿优雅
  if (value === 1) {
    return (
      <g transform="translate(36, 48) scale(0.68)">
        {/* 背景祥云竹叶气韵 */}
        <path d="M-28 32 Q-16 26 -8 34" stroke="#10b981" strokeWidth="2" fill="none" opacity="0.6" />
        <path d="M28 32 Q16 26 8 34" stroke="#10b981" strokeWidth="2" fill="none" opacity="0.6" />

        {/* 下垂华丽开屏尾羽 (三层重叠渐变) */}
        <path d="M-10 18 C-30 36 -38 28 -44 48 C-28 32 -16 28 -6 16 Z" fill="#047857" />
        <path d="M-4 20 C-16 42 -22 48 -28 62 C-14 42 -4 36 2 18 Z" fill="#10b981" />
        <path d="M10 18 C30 36 38 28 44 48 C28 32 16 28 6 16 Z" fill="#047857" />
        <path d="M4 20 C16 42 22 48 28 62 C14 42 4 34 -2 18 Z" fill="#10b981" />
        {/* 尾羽眼斑红金翎眼 */}
        <circle cx="-32" cy="40" r="3.5" fill="#f59e0b" />
        <circle cx="-32" cy="40" r="1.8" fill="#dc2626" />
        <circle cx="32" cy="40" r="3.5" fill="#f59e0b" />
        <circle cx="32" cy="40" r="1.8" fill="#dc2626" />

        {/* 孔雀身体翡翠琉璃质感 */}
        <ellipse cx="0" cy="8" rx="19" ry="24" fill="#059669" stroke="#047857" strokeWidth="1.5" />
        {/* 丰润腹部 */}
        <ellipse cx="0" cy="11" rx="13.5" ry="17" fill="#fef9c3" />
        {/* 腹部朱砂红心点与翠纹 */}
        <circle cx="0" cy="7" r="5" fill="#dc2626" />
        <circle cx="-5" cy="17" r="3" fill="#047857" />
        <circle cx="5" cy="17" r="3" fill="#047857" />

        {/* 灵秀头部 */}
        <circle cx="0" cy="-22" r="13" fill="#047857" />
        <circle cx="4" cy="-24" r="3.2" fill="#ffffff" />
        <circle cx="4.8" cy="-24" r="1.6" fill="#09090b" />
        {/* 黄金鸟喙 */}
        <polygon points="10,-24 28,-22 10,-19" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
        {/* 三翎凤冠朱冠 */}
        <path d="M-5 -34 Q-14 -46 -4 -43 Q-7 -35 -2 -34 Z" fill="#dc2626" />
        <path d="M0 -35 Q0 -49 6 -45 Q2 -35 3 -35 Z" fill="#dc2626" />
        <path d="M5 -34 Q14 -46 4 -43 Q7 -35 2 -34 Z" fill="#dc2626" />
      </g>
    );
  }

  const green = '#15803d';
  const red = '#dc2626';
  const blue = '#1d4ed8';

  switch (value) {
    case 2:
      return (
        <g>
          <SvgBamboo x={36} y={15} width={9} height={29} color={green} />
          <SvgBamboo x={36} y={52} width={9} height={29} color={blue} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgBamboo x={36} y={14} width={8} height={25} color={blue} />
          <SvgBamboo x={24} y={53} width={8} height={27} color={green} />
          <SvgBamboo x={48} y={53} width={8} height={27} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgBamboo x={23} y={16} width={8} height={28} color={green} />
          <SvgBamboo x={49} y={16} width={8} height={28} color={red} />
          <SvgBamboo x={23} y={52} width={8} height={28} color={red} />
          <SvgBamboo x={49} y={52} width={8} height={28} color={green} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgBamboo x={21} y={16} width={8} height={26} color={green} />
          <SvgBamboo x={51} y={16} width={8} height={26} color={blue} />
          <SvgBamboo x={36} y={35} width={8} height={26} color={red} hasRedJoint={true} />
          <SvgBamboo x={21} y={54} width={8} height={26} color={blue} />
          <SvgBamboo x={51} y={54} width={8} height={26} color={green} />
        </g>
      );
    case 6:
      return (
        <g>
          <SvgBamboo x={20} y={16} width={7.5} height={26} color={green} />
          <SvgBamboo x={36} y={16} width={7.5} height={26} color={green} />
          <SvgBamboo x={52} y={16} width={7.5} height={26} color={green} />
          <SvgBamboo x={20} y={54} width={7.5} height={26} color={blue} />
          <SvgBamboo x={36} y={54} width={7.5} height={26} color={blue} />
          <SvgBamboo x={52} y={54} width={7.5} height={26} color={blue} />
        </g>
      );
    case 7:
      return (
        <g>
          <SvgBamboo x={36} y={12} width={8} height={24} color={red} hasRedJoint={true} />
          <SvgBamboo x={20} y={42} width={7.5} height={20} color={green} />
          <SvgBamboo x={36} y={42} width={7.5} height={20} color={green} />
          <SvgBamboo x={52} y={42} width={7.5} height={20} color={green} />
          <SvgBamboo x={20} y={67} width={7.5} height={20} color={green} />
          <SvgBamboo x={36} y={67} width={7.5} height={20} color={green} />
          <SvgBamboo x={52} y={67} width={7.5} height={20} color={green} />
        </g>
      );
    case 8:
      return (
        <g>
          {/* 上半部两对斜条 */}
          <SvgBamboo x={24} y={15} width={7} height={26} color={green} isAngled={16} />
          <SvgBamboo x={34} y={15} width={7} height={26} color={green} isAngled={-16} />
          <SvgBamboo x={38} y={15} width={7} height={26} color={green} isAngled={16} />
          <SvgBamboo x={48} y={15} width={7} height={26} color={green} isAngled={-16} />
          {/* 下半部直排 */}
          <SvgBamboo x={18} y={53} width={7} height={27} color={blue} />
          <SvgBamboo x={30} y={53} width={7} height={27} color={blue} />
          <SvgBamboo x={42} y={53} width={7} height={27} color={blue} />
          <SvgBamboo x={54} y={53} width={7} height={27} color={blue} />
        </g>
      );
    case 9:
      return (
        <g>
          <SvgBamboo x={20} y={14} width={7.5} height={22} color={red} />
          <SvgBamboo x={36} y={14} width={7.5} height={22} color={blue} />
          <SvgBamboo x={52} y={14} width={7.5} height={22} color={green} />

          <SvgBamboo x={20} y={40} width={7.5} height={22} color={red} />
          <SvgBamboo x={36} y={40} width={7.5} height={22} color={blue} />
          <SvgBamboo x={52} y={40} width={7.5} height={22} color={green} />

          <SvgBamboo x={20} y={66} width={7.5} height={22} color={red} />
          <SvgBamboo x={36} y={66} width={7.5} height={22} color={blue} />
          <SvgBamboo x={52} y={66} width={7.5} height={22} color={green} />
        </g>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// 3. 筒子牌纯矢量 SVG 渲染 - 华美同心圆盘与四瓣梅花雕纹
// -------------------------------------------------------------
function SvgDot({ cx, cy, r = 7, color = '#1d4ed8' }) {
  const isRed = color === '#dc2626';
  const isGreen = color === '#15803d';
  const fillGrad = isRed ? 'url(#dotRedGrad)' : isGreen ? 'url(#dotGreenGrad)' : 'url(#dotBlueGrad)';

  return (
    <g>
      {/* 齿轮状外圆盘 */}
      <circle cx={cx} cy={cy} r={r} fill={fillGrad} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
      {/* 内部雕花金丝圈 */}
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
      {/* 四瓣梅花心纹 */}
      <circle cx={cx - r * 0.25} cy={cy} r={r * 0.18} fill="#ffffff" opacity="0.85" />
      <circle cx={cx + r * 0.25} cy={cy} r={r * 0.18} fill="#ffffff" opacity="0.85" />
      <circle cx={cx} cy={cy - r * 0.25} r={r * 0.18} fill="#ffffff" opacity="0.85" />
      <circle cx={cx} cy={cy + r * 0.25} r={r * 0.18} fill="#ffffff" opacity="0.85" />
      {/* 中心红/金芯点 */}
      <circle cx={cx} cy={cy} r={r * 0.18} fill={isRed ? '#fef08a' : '#dc2626'} />
    </g>
  );
}

function SvgTong({ value }) {
  const blue = '#1d4ed8';
  const green = '#15803d';
  const red = '#dc2626';

  // 1筒：传世国风大花轮 (大饼)
  if (value === 1) {
    return (
      <g transform="translate(36, 48)">
        {/* 外圈16瓣太阳放射花纹 */}
        <circle cx="0" cy="0" r="31" fill="#dc2626" stroke="#991b1b" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="25" fill="#fef9c3" stroke="#ca8a04" strokeWidth="0.8" />

        {/* 环形翡翠翠珠 (12颗) */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * Math.PI) / 6;
          const px = Math.cos(angle) * 17.5;
          const py = Math.sin(angle) * 17.5;
          return <circle key={i} cx={px} cy={py} r="4.2" fill="#15803d" stroke="#14532d" strokeWidth="0.6" />;
        })}

        {/* 内部深邃青花轮盘 */}
        <circle cx="0" cy="0" r="12" fill="#1d4ed8" stroke="#1e40af" strokeWidth="1.2" />
        {/* 中心八芒星黄金徽记 */}
        <circle cx="0" cy="0" r="5" fill="#f59e0b" />
        <circle cx="0" cy="0" r="2.2" fill="#dc2626" />
      </g>
    );
  }

  switch (value) {
    case 2:
      return (
        <g>
          <SvgDot cx={36} cy={27} r={11.5} color={green} />
          <SvgDot cx={36} cy={69} r={11.5} color={blue} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgDot cx={20} cy={22} r={9.5} color={blue} />
          <SvgDot cx={36} cy={48} r={9.5} color={red} />
          <SvgDot cx={52} cy={74} r={9.5} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgDot cx={22} cy={26} r={10} color={blue} />
          <SvgDot cx={50} cy={26} r={10} color={green} />
          <SvgDot cx={22} cy={70} r={10} color={green} />
          <SvgDot cx={50} cy={70} r={10} color={blue} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgDot cx={20} cy={23} r={9} color={blue} />
          <SvgDot cx={52} cy={23} r={9} color={green} />
          <SvgDot cx={36} cy={48} r={10} color={red} />
          <SvgDot cx={20} cy={73} r={9} color={green} />
          <SvgDot cx={52} cy={73} r={9} color={blue} />
        </g>
      );
    case 6:
      return (
        <g>
          <SvgDot cx={23} cy={22} r={8.5} color={green} />
          <SvgDot cx={49} cy={22} r={8.5} color={green} />
          <SvgDot cx={23} cy={48} r={8.5} color={red} />
          <SvgDot cx={49} cy={48} r={8.5} color={red} />
          <SvgDot cx={23} cy={74} r={8.5} color={red} />
          <SvgDot cx={49} cy={74} r={8.5} color={red} />
        </g>
      );
    case 7:
      return (
        <g>
          <SvgDot cx={18} cy={20} r={7} color={green} />
          <SvgDot cx={36} cy={25} r={7} color={green} />
          <SvgDot cx={54} cy={30} r={7} color={green} />
          <SvgDot cx={23} cy={54} r={8} color={red} />
          <SvgDot cx={49} cy={54} r={8} color={red} />
          <SvgDot cx={23} cy={75} r={8} color={red} />
          <SvgDot cx={49} cy={75} r={8} color={red} />
        </g>
      );
    case 8:
      return (
        <g>
          <SvgDot cx={23} cy={18} r={7.5} color={blue} />
          <SvgDot cx={49} cy={18} r={7.5} color={blue} />
          <SvgDot cx={23} cy={38} r={7.5} color={blue} />
          <SvgDot cx={49} cy={38} r={7.5} color={blue} />
          <SvgDot cx={23} cy={58} r={7.5} color={blue} />
          <SvgDot cx={49} cy={58} r={7.5} color={blue} />
          <SvgDot cx={23} cy={78} r={7.5} color={blue} />
          <SvgDot cx={49} cy={78} r={7.5} color={blue} />
        </g>
      );
    case 9:
      return (
        <g>
          <SvgDot cx={19} cy={22} r={7.5} color={blue} />
          <SvgDot cx={36} cy={22} r={7.5} color={blue} />
          <SvgDot cx={53} cy={22} r={7.5} color={blue} />

          <SvgDot cx={19} cy={48} r={7.5} color={red} />
          <SvgDot cx={36} cy={48} r={7.5} color={red} />
          <SvgDot cx={53} cy={48} r={7.5} color={red} />

          <SvgDot cx={19} cy={74} r={7.5} color={green} />
          <SvgDot cx={36} cy={74} r={7.5} color={green} />
          <SvgDot cx={53} cy={74} r={7.5} color={green} />
        </g>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// 麻将牌统一封装组件 (自适应高清 SVG 矢量渲染)
// -------------------------------------------------------------
export default function MahjongTile({
  tile,
  isBack = false,
  size = 'md', // 'hand' | 'meld' | 'discard' | 'opp-top' | 'opp-side'
  selected = false,
  highlight = false,
  isTing = false,
  tingCount = null,
  showJiangBadge = false,
  onClick = null,
  onMouseEnter = null,
  onMouseLeave = null,
  className = '',
  style = {}
}) {
  const isJiang = tile ? isJiangTile(tile) : false;

  // 严格按像素设定的精细物理比例尺寸规范 (麻将标准宽高比 3:4)
  const sizeMap = {
    // 玩家手牌 (大而清澈，一目了然)
    hand: 'w-[54px] h-[74px] sm:w-[58px] sm:h-[78px]',
    // 碰吃杠面子牌
    meld: 'w-[40px] h-[54px] sm:w-[42px] sm:h-[58px]',
    // 弃牌池牌张 (一行12张精美尺寸)
    discard: 'w-[30px] h-[40px] sm:w-[32px] sm:h-[44px]',
    // 对家手牌背面
    'opp-top': 'w-[32px] h-[44px]',
    // 侧边手牌背面
    'opp-side': 'w-[20px] h-[34px]',
    // 兼容通用尺寸
    lg: 'w-[56px] h-[76px]',
    md: 'w-[42px] h-[56px]',
    sm: 'w-[32px] h-[44px]',
    mini: 'w-[24px] h-[34px]'
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;

  // 牌背渲染 (纯翠玉微晶质感)
  if (isBack || !tile) {
    return (
      <div
        className={`relative inline-block select-none cursor-default shrink-0 transition-transform ${currentSizeClass} ${className}`}
        style={style}
      >
        <svg viewBox="0 0 72 96" className="w-full h-full drop-shadow-md">
          <defs>
            <linearGradient id="jadeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="50%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064e3b" />
            </linearGradient>
          </defs>
          <rect x="2" y="8" width="68" height="86" rx="8" fill="#022c22" />
          <rect x="2" y="2" width="68" height="86" rx="8" fill="url(#jadeGrad)" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.4" />
          <rect x="9" y="9" width="54" height="72" rx="5" fill="none" stroke="#6ee7b7" strokeWidth="1" strokeOpacity="0.35" />
          <polygon points="36,36 44,48 36,60 28,48" fill="#34d399" fillOpacity="0.3" />
        </svg>
      </div>
    );
  }

  // 牌面渲染 (象牙白温润微晶 + 100% 矢量图形)
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative inline-block select-none cursor-pointer shrink-0 transition-all duration-150 ${currentSizeClass} ${
        selected ? '-translate-y-4 filter drop-shadow-xl ring-2 ring-amber-400 rounded-lg' : ''
      } ${
        highlight ? 'filter drop-shadow-lg ring-2 ring-emerald-400 brightness-110 rounded-lg' : ''
      } ${className}`}
      style={style}
    >
      <svg viewBox="0 0 72 96" className="w-full h-full drop-shadow-md overflow-visible">
        <defs>
          {/* 象牙白温润质感渐变 */}
          <linearGradient id="ivoryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#fcfbf7" />
            <stop offset="100%" stopColor="#f3efe4" />
          </linearGradient>
          {/* 牌底翠玉背贴 */}
          <linearGradient id="tileBaseGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>

          {/* 竹子渐变 */}
          <linearGradient id="bambooGreenGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14532d" />
            <stop offset="35%" stopColor="#22c55e" />
            <stop offset="70%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="bambooRedGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#991b1b" />
            <stop offset="35%" stopColor="#ef4444" />
            <stop offset="70%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id="bambooBlueGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="35%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>

          {/* 筒子圆饼渐变 */}
          <radialGradient id="dotRedGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="40%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
          <radialGradient id="dotGreenGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="40%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </radialGradient>
          <radialGradient id="dotBlueGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="40%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
        </defs>

        {/* 1. 3D 底座翡翠厚度 */}
        <rect x="2" y="8" width="68" height="86" rx="8" fill="url(#tileBaseGrad)" />

        {/* 2. 象牙白正面牌面 */}
        <rect
          x="2"
          y="2"
          width="68"
          height="86"
          rx="7"
          fill="url(#ivoryGrad)"
          stroke="#d1ccba"
          strokeWidth="1.2"
        />

        {/* 3. 牌面高光边框 */}
        <rect
          x="4"
          y="4"
          width="64"
          height="82"
          rx="5"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1"
        />

        {/* 4. 核心牌张图形 (万 / 条 / 筒) */}
        {tile.suit === SUITS.WAN && <SvgWan value={tile.value} />}
        {tile.suit === SUITS.TIAO && <SvgTiao value={tile.value} />}
        {tile.suit === SUITS.TONG && <SvgTong value={tile.value} />}

        {/* 5. 将牌角标提示 (2/5/8) */}
        {showJiangBadge && isJiang && (
          <circle cx="12" cy="12" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
        )}
      </svg>

      {/* 听牌右上角勋章角标 */}
      {isTing && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-[10px] leading-tight px-1.5 py-0.5 rounded-full shadow-lg border border-white/60 pointer-events-none z-30 animate-pulse">
          听{tingCount !== null ? ` ${tingCount}张` : ''}
        </div>
      )}
    </div>
  );
}

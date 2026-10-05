import React from 'react';
import { SUITS, NUMBER_NAMES, isJiangTile } from '../types/mahjong.js';

// -------------------------------------------------------------
// 1. 万字牌纯矢量 SVG 渲染 (一万 ~ 九万)
// -------------------------------------------------------------
function SvgWan({ value }) {
  const numChar = NUMBER_NAMES[value];
  const isRedTop = value === 1 || value === 5 || value === 7 || value === 9;

  return (
    <g transform="translate(0, 0)">
      {/* 上方数字 */}
      <text
        x="36"
        y="42"
        textAnchor="middle"
        dominantBaseline="central"
        fill={isRedTop ? '#dc2626' : '#18181b'}
        fontSize="34"
        fontWeight="900"
        fontFamily='"Microsoft YaHei", "PingFang SC", "Heiti SC", system-ui, sans-serif'
        letterSpacing="-1"
      >
        {numChar}
      </text>

      {/* 下方“萬”字 */}
      <text
        x="36"
        y="73"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#b91c1c"
        fontSize="28"
        fontWeight="800"
        fontFamily='"Microsoft YaHei", "PingFang SC", "Heiti SC", system-ui, sans-serif'
      >
        萬
      </text>
    </g>
  );
}

// -------------------------------------------------------------
// 2. 条子牌纯矢量 SVG 渲染 (一条 ~ 九条)
// -------------------------------------------------------------
// 单个竹节棒棒组件
function SvgBamboo({ x, y, width = 8, height = 24, color = '#15803d', hasRedJoint = false }) {
  const rx = width / 2;
  const jointY = y + height / 2;

  return (
    <g>
      {/* 竹柱主体 */}
      <rect
        x={x - rx}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={color}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.8"
      />
      {/* 内部高光浅色带 */}
      <rect
        x={x - rx + 1.5}
        y={y + 1}
        width={width - 3}
        height={height - 2}
        rx={rx - 1}
        fill="rgba(255,255,255,0.22)"
      />
      {/* 竹节凸起线 */}
      <line
        x1={x - rx - 0.5}
        y1={jointY}
        x2={x + rx + 0.5}
        y2={jointY}
        stroke={hasRedJoint ? '#dc2626' : 'rgba(0,0,0,0.35)'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </g>
  );
}

function SvgTiao({ value }) {
  // 1条：高清典雅孔雀/翠鸟
  if (value === 1) {
    return (
      <g transform="translate(36, 48) scale(0.72)">
        {/* 尾羽 */}
        <path d="M-8 20 C-22 36 -32 30 -40 44 C-26 30 -14 26 -6 18 Z" fill="#047857" />
        <path d="M-2 22 C-10 40 -16 46 -22 56 C-12 40 -4 34 2 20 Z" fill="#10b981" />
        <path d="M8 20 C22 36 32 30 40 44 C26 30 14 26 6 18 Z" fill="#047857" />
        <path d="M2 22 C10 40 16 46 22 56 C12 40 4 34 -2 20 Z" fill="#10b981" />
        {/* 身体 */}
        <ellipse cx="0" cy="8" rx="20" ry="24" fill="#059669" stroke="#047857" strokeWidth="1.5" />
        {/* 肚腹 */}
        <ellipse cx="0" cy="12" rx="14" ry="17" fill="#fef3c7" />
        {/* 腹心红点 */}
        <circle cx="0" cy="8" r="4.5" fill="#dc2626" />
        <circle cx="-6" cy="18" r="3" fill="#047857" />
        <circle cx="6" cy="18" r="3" fill="#047857" />
        {/* 头部 */}
        <circle cx="0" cy="-22" r="13" fill="#047857" />
        <circle cx="4" cy="-24" r="3" fill="#ffffff" />
        <circle cx="4.5" cy="-24" r="1.5" fill="#09090b" />
        <polygon points="10,-24 26,-22 10,-19" fill="#f59e0b" stroke="#d97706" strokeWidth="0.5" />
        {/* 冠羽 */}
        <path d="M-4 -34 Q-12 -44 -3 -42 Q-6 -34 -2 -34 Z" fill="#dc2626" />
        <path d="M0 -35 Q0 -47 6 -43 Q1 -35 2 -35 Z" fill="#dc2626" />
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
          <SvgBamboo x={36} y={16} width={9} height={28} color={green} />
          <SvgBamboo x={36} y={52} width={9} height={28} color={blue} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgBamboo x={36} y={14} width={8} height={24} color={blue} />
          <SvgBamboo x={24} y={54} width={8} height={26} color={green} />
          <SvgBamboo x={48} y={54} width={8} height={26} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgBamboo x={24} y={16} width={8} height={28} color={green} />
          <SvgBamboo x={48} y={16} width={8} height={28} color={red} />
          <SvgBamboo x={24} y={52} width={8} height={28} color={red} />
          <SvgBamboo x={48} y={52} width={8} height={28} color={green} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgBamboo x={22} y={16} width={8} height={26} color={green} />
          <SvgBamboo x={50} y={16} width={8} height={26} color={blue} />
          <SvgBamboo x={36} y={35} width={8} height={26} color={red} hasRedJoint={true} />
          <SvgBamboo x={22} y={54} width={8} height={26} color={blue} />
          <SvgBamboo x={50} y={54} width={8} height={26} color={green} />
        </g>
      );
    case 6:
      return (
        <g>
          <SvgBamboo x={20} y={16} width={8} height={26} color={green} />
          <SvgBamboo x={36} y={16} width={8} height={26} color={green} />
          <SvgBamboo x={52} y={16} width={8} height={26} color={green} />
          <SvgBamboo x={20} y={54} width={8} height={26} color={blue} />
          <SvgBamboo x={36} y={54} width={8} height={26} color={blue} />
          <SvgBamboo x={52} y={54} width={8} height={26} color={blue} />
        </g>
      );
    case 7:
      return (
        <g>
          <SvgBamboo x={36} y={12} width={8} height={24} color={red} />
          <SvgBamboo x={20} y={42} width={8} height={20} color={green} />
          <SvgBamboo x={36} y={42} width={8} height={20} color={green} />
          <SvgBamboo x={52} y={42} width={8} height={20} color={green} />
          <SvgBamboo x={20} y={67} width={8} height={20} color={green} />
          <SvgBamboo x={36} y={67} width={8} height={20} color={green} />
          <SvgBamboo x={52} y={67} width={8} height={20} color={green} />
        </g>
      );
    case 8:
      return (
        <g>
          <SvgBamboo x={20} y={14} width={7.5} height={17} color={green} />
          <SvgBamboo x={31} y={14} width={7.5} height={17} color={green} />
          <SvgBamboo x={42} y={14} width={7.5} height={17} color={green} />
          <SvgBamboo x={53} y={14} width={7.5} height={17} color={green} />

          <SvgBamboo x={20} y={39} width={7.5} height={17} color={red} />
          <SvgBamboo x={31} y={39} width={7.5} height={17} color={red} />
          <SvgBamboo x={42} y={39} width={7.5} height={17} color={red} />
          <SvgBamboo x={53} y={39} width={7.5} height={17} color={red} />

          <SvgBamboo x={20} y={64} width={7.5} height={17} color={blue} />
          <SvgBamboo x={31} y={64} width={7.5} height={17} color={blue} />
          <SvgBamboo x={42} y={64} width={7.5} height={17} color={blue} />
          <SvgBamboo x={53} y={64} width={7.5} height={17} color={blue} />
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
// 3. 筒子牌纯矢量 SVG 渲染 (一筒 ~ 九筒)
// -------------------------------------------------------------
function SvgDot({ cx, cy, r = 7, color = '#1d4ed8', innerColor = '#ffffff' }) {
  return (
    <g>
      {/* 外圈 */}
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" />
      {/* 齿轮花瓣小环 */}
      <circle cx={cx} cy={cy} r={r * 0.65} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="2,2" />
      {/* 内芯 */}
      <circle cx={cx} cy={cy} r={r * 0.32} fill={innerColor} />
    </g>
  );
}

function SvgTong({ value }) {
  const blue = '#1d4ed8';
  const green = '#15803d';
  const red = '#dc2626';

  // 1筒：华丽精美大花轮
  if (value === 1) {
    return (
      <g transform="translate(36, 48)">
        {/* 外圈大齿轮 */}
        <circle cx="0" cy="0" r="30" fill={red} stroke="#991b1b" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="23" fill="#ffffff" />
        {/* 环绕花瓣 */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * Math.PI) / 6;
          const px = Math.cos(angle) * 16;
          const py = Math.sin(angle) * 16;
          return <circle key={i} cx={px} cy={py} r="4.2" fill={green} />;
        })}
        {/* 中心同心轮 */}
        <circle cx="0" cy="0" r="11" fill={blue} stroke="#1e40af" strokeWidth="1" />
        <circle cx="0" cy="0" r="4.5" fill="#facc15" />
      </g>
    );
  }

  switch (value) {
    case 2:
      return (
        <g>
          <SvgDot cx={36} cy={27} r={11} color={green} />
          <SvgDot cx={36} cy={69} r={11} color={blue} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgDot cx={20} cy={22} r={9} color={blue} />
          <SvgDot cx={36} cy={48} r={9} color={red} />
          <SvgDot cx={52} cy={74} r={9} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgDot cx={22} cy={26} r={9.5} color={blue} />
          <SvgDot cx={50} cy={26} r={9.5} color={green} />
          <SvgDot cx={22} cy={70} r={9.5} color={green} />
          <SvgDot cx={50} cy={70} r={9.5} color={blue} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgDot cx={20} cy={23} r={8.5} color={blue} />
          <SvgDot cx={52} cy={23} r={8.5} color={green} />
          <SvgDot cx={36} cy={48} r={9.5} color={red} />
          <SvgDot cx={20} cy={73} r={8.5} color={green} />
          <SvgDot cx={52} cy={73} r={8.5} color={blue} />
        </g>
      );
    case 6:
      return (
        <g>
          <SvgDot cx={23} cy={22} r={8} color={green} />
          <SvgDot cx={49} cy={22} r={8} color={green} />
          <SvgDot cx={23} cy={48} r={8} color={red} />
          <SvgDot cx={49} cy={48} r={8} color={red} />
          <SvgDot cx={23} cy={74} r={8} color={red} />
          <SvgDot cx={49} cy={74} r={8} color={red} />
        </g>
      );
    case 7:
      return (
        <g>
          <SvgDot cx={18} cy={20} r={6.8} color={green} />
          <SvgDot cx={36} cy={25} r={6.8} color={green} />
          <SvgDot cx={54} cy={30} r={6.8} color={green} />
          <SvgDot cx={23} cy={54} r={7.5} color={red} />
          <SvgDot cx={49} cy={54} r={7.5} color={red} />
          <SvgDot cx={23} cy={75} r={7.5} color={red} />
          <SvgDot cx={49} cy={75} r={7.5} color={red} />
        </g>
      );
    case 8:
      return (
        <g>
          <SvgDot cx={23} cy={18} r={7} color={blue} />
          <SvgDot cx={49} cy={18} r={7} color={blue} />
          <SvgDot cx={23} cy={38} r={7} color={blue} />
          <SvgDot cx={49} cy={38} r={7} color={blue} />
          <SvgDot cx={23} cy={58} r={7} color={blue} />
          <SvgDot cx={49} cy={58} r={7} color={blue} />
          <SvgDot cx={23} cy={78} r={7} color={blue} />
          <SvgDot cx={49} cy={78} r={7} color={blue} />
        </g>
      );
    case 9:
      return (
        <g>
          <SvgDot cx={19} cy={22} r={7} color={blue} />
          <SvgDot cx={36} cy={22} r={7} color={blue} />
          <SvgDot cx={53} cy={22} r={7} color={blue} />

          <SvgDot cx={19} cy={48} r={7} color={red} />
          <SvgDot cx={36} cy={48} r={7} color={red} />
          <SvgDot cx={53} cy={48} r={7} color={red} />

          <SvgDot cx={19} cy={74} r={7} color={green} />
          <SvgDot cx={36} cy={74} r={7} color={green} />
          <SvgDot cx={53} cy={74} r={7} color={green} />
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
  size = 'md', // 'hand' | 'meld' | 'discard' | 'opp-top' | 'opp-side' | 'sm' | 'md' | 'lg' | 'mini'
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
    // 玩家手牌 (大而清晰)
    hand: 'w-[54px] h-[74px] sm:w-[58px] sm:h-[78px]',
    // 碰吃杠面子牌
    meld: 'w-[42px] h-[58px]',
    // 弃牌池牌张
    discard: 'w-[36px] h-[48px]',
    // 对家手牌背面
    'opp-top': 'w-[34px] h-[46px]',
    // 侧边手牌背面
    'opp-side': 'w-[22px] h-[36px]',
    // 兼容原参数
    lg: 'w-[56px] h-[76px]',
    md: 'w-[44px] h-[60px]',
    sm: 'w-[36px] h-[48px]',
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
          {/* 3D 侧边底座厚度 */}
          <rect x="2" y="8" width="68" height="86" rx="8" fill="#022c22" />
          {/* 翡翠表面 */}
          <rect x="2" y="2" width="68" height="86" rx="8" fill="url(#jadeGrad)" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.4" />
          {/* 内部回纹金丝框 */}
          <rect x="9" y="9" width="54" height="72" rx="5" fill="none" stroke="#6ee7b7" strokeWidth="1" strokeOpacity="0.35" />
          {/* 装饰菱形 */}
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
          {/* 象牙白温润微光 */}
          <linearGradient id="ivoryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#faf9f4" />
            <stop offset="100%" stopColor="#f3efe4" />
          </linearGradient>
          {/* 牌底翠玉背贴 */}
          <linearGradient id="tileBaseGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>
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

        {/* 3. 牌面微弱高光边框 */}
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

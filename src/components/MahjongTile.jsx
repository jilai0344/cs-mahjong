import React from 'react';
import { SUITS, NUMBER_NAMES, isJiangTile } from '../types/mahjong.js';

// -------------------------------------------------------------
// 1. 万字牌纯矢量 SVG 渲染 (一万 ~ 九万) - 黄金岛APP经典特粗高对比书法字
// -------------------------------------------------------------
function SvgWan({ value }) {
  const numChar = NUMBER_NAMES[value];
  const isRedTop = value === 1 || value === 5 || value === 7 || value === 9;

  // 黄金岛标准书法楷黑字库栈
  const hjdFont = '"STKaiti", "KaiTi", "SimSun", "Microsoft YaHei", "PingFang SC", sans-serif';

  return (
    <g transform="translate(0, 0)">
      {/* 上方数字 (黄金岛特粗书法大字，1/5/7/9红，2/3/4/6/8深黑) */}
      <text
        x="36"
        y="39"
        textAnchor="middle"
        dominantBaseline="central"
        fill={isRedTop ? '#dc2626' : '#18181b'}
        fontSize="38"
        fontWeight="900"
        fontFamily={hjdFont}
        style={{ letterSpacing: '0px' }}
      >
        {numChar}
      </text>

      {/* 下方“萬”字 (黄金岛经典繁体大红萬字，方正遒劲) */}
      <text
        x="36"
        y="75"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#b91c1c"
        fontSize="34"
        fontWeight="900"
        fontFamily={hjdFont}
      >
        萬
      </text>
    </g>
  );
}

// -------------------------------------------------------------
// 2. 条子牌纯矢量 SVG 渲染 - 黄金岛经典饱满粗节竹节 + 正统国标幺鸡
// -------------------------------------------------------------
function SvgBamboo({ x, y, width = 11.5, height = 26, color = '#15803d', hasRedJoint = false, isAngled = 0 }) {
  const rx = width / 2;
  const gradId = color === '#dc2626' ? 'bambooRedGrad' : color === '#1d4ed8' || color === '#2563eb' ? 'bambooBlueGrad' : 'bambooGreenGrad';

  return (
    <g transform={isAngled ? `rotate(${isAngled}, ${x}, ${y + height/2})` : undefined}>
      {/* 饱满粗壮竹节主体 (非细签) */}
      <rect
        x={x - rx}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={`url(#${gradId})`}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
      />
      {/* 两端微弧 */}
      <ellipse cx={x} cy={y + 3} rx={rx - 1.5} ry="1.5" fill="rgba(255,255,255,0.45)" />
      <ellipse cx={x} cy={y + height - 3} rx={rx - 1.5} ry="1.5" fill="rgba(0,0,0,0.3)" />

      {/* 黄金岛经典三段式竹节凸环 */}
      <rect
        x={x - rx - 1}
        y={y + height * 0.33 - 1.2}
        width={width + 2}
        height={2.4}
        rx="1"
        fill={hasRedJoint ? '#dc2626' : '#fef08a'}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.6"
      />
      <rect
        x={x - rx - 1}
        y={y + height * 0.67 - 1.2}
        width={width + 2}
        height={2.4}
        rx="1"
        fill={hasRedJoint ? '#dc2626' : '#fef08a'}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.6"
      />

      {/* 中轴雕刻凹槽反光条 (黄金岛标志性细节) */}
      <line
        x1={x}
        y1={y + 4}
        x2={x}
        y2={y + height - 4}
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  );
}

function SvgTiao({ value }) {
  // 1条：黄金岛正统吉祥“幺鸡” (昂首雄鸡立竹竿，绝非孔雀)
  if (value === 1) {
    return (
      <g transform="translate(36, 48) scale(0.92)">
        {/* 底部竹栖木 (绿竹竿与红节) */}
        <rect x="-24" y="27" width="48" height="8.5" rx="4.25" fill="url(#bambooGreenGrad)" stroke="#065f46" strokeWidth="0.8" />
        <rect x="-3" y="26" width="6" height="10.5" rx="1.2" fill="#dc2626" />
        
        {/* 鸡爪 (金爪双抓稳立) */}
        <path d="M-9 20 L-9 27 M-13 27 L-5 27" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M8 20 L8 27 M4 27 L12 27" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" />

        {/* 饱满翡翠鸡身 */}
        <ellipse cx="-1" cy="5" rx="17" ry="19" fill="url(#bambooGreenGrad)" stroke="#047857" strokeWidth="1" />
        <ellipse cx="2" cy="7" rx="11" ry="13" fill="#fef9c3" opacity="0.9" />

        {/* 鸡胸羽纹 */}
        <path d="M-6 0 C-4 8 4 8 6 0" stroke="#047857" strokeWidth="1.2" fill="none" opacity="0.6" />
        <path d="M-5 6 C-3 12 3 12 5 6" stroke="#047857" strokeWidth="1.2" fill="none" opacity="0.6" />

        {/* 展翘五彩翠绿赤红尾羽 */}
        <path d="M-14 3 C-26 -4 -30 -18 -24 -26 C-22 -14 -12 -7 -8 -3 Z" fill="#15803d" stroke="#14532d" strokeWidth="0.8" />
        <path d="M-12 9 C-22 7 -28 -3 -24 -13 C-20 -5 -10 1 -6 5 Z" fill="#dc2626" />
        <path d="M-10 13 C-18 15 -24 7 -20 -1 C-16 3 -8 7 -4 9 Z" fill="#2563eb" />

        {/* 鸡翅膀 (层叠分色羽) */}
        <ellipse cx="-1" cy="3" rx="8" ry="11" fill="#15803d" stroke="#065f46" strokeWidth="0.8" />
        <path d="M-7 3 C-3 13 5 11 7 1" fill="#dc2626" opacity="0.9" />

        {/* 鸡颈与头 (昂首向右) */}
        <path d="M3 -9 C6 -19 10 -23 17 -23 C24 -23 26 -15 20 -7 C15 -1 9 1 5 3 Z" fill="url(#bambooGreenGrad)" stroke="#047857" strokeWidth="0.8" />
        <circle cx="16" cy="-17" r="9.2" fill="url(#bambooGreenGrad)" stroke="#047857" strokeWidth="0.8" />

        {/* 灵动黑白眼 */}
        <circle cx="19" cy="-19" r="3.2" fill="#ffffff" />
        <circle cx="19.8" cy="-19" r="1.6" fill="#18181b" />
        <circle cx="20.4" cy="-19.6" r="0.6" fill="#ffffff" />

        {/* 金色利喙 */}
        <polygon points="23,-18 32,-16 23,-13" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />

        {/* 鲜红三叠大鸡冠 (黄金岛幺鸡标志特征) */}
        <path d="M12 -24 C11 -33 16 -33 17 -26 C18 -33 23 -32 22 -24 C24 -29 28 -27 26 -21 Z" fill="#dc2626" stroke="#b91c1c" strokeWidth="0.8" />

        {/* 鲜红下颚肉垂 */}
        <ellipse cx="20" cy="-11" rx="2.5" ry="4" fill="#dc2626" />
      </g>
    );
  }

  const green = '#15803d';
  const red = '#dc2626';
  const blue = '#2563eb';

  switch (value) {
    // 2条：上下两根粗绿竹
    case 2:
      return (
        <g>
          <SvgBamboo x={36} y={14} width={12} height={28} color={green} />
          <SvgBamboo x={36} y={52} width={12} height={28} color={green} />
        </g>
      );
    // 3条：上1蓝，下2绿
    case 3:
      return (
        <g>
          <SvgBamboo x={36} y={14} width={11.5} height={27} color={blue} />
          <SvgBamboo x={24} y={51} width={11.5} height={29} color={green} />
          <SvgBamboo x={48} y={51} width={11.5} height={29} color={green} />
        </g>
      );
    // 4条：2绿2红错位排列
    case 4:
      return (
        <g>
          <SvgBamboo x={23} y={15} width={11.5} height={28} color={green} />
          <SvgBamboo x={49} y={15} width={11.5} height={28} color={red} />
          <SvgBamboo x={23} y={51} width={11.5} height={28} color={red} />
          <SvgBamboo x={49} y={51} width={11.5} height={28} color={green} />
        </g>
      );
    // 5条：4角绿/蓝 + 中间1根鲜红竹节
    case 5:
      return (
        <g>
          <SvgBamboo x={21} y={15} width={11} height={26} color={green} />
          <SvgBamboo x={51} y={15} width={11} height={26} color={blue} />
          <SvgBamboo x={36} y={34} width={11.5} height={26} color={red} hasRedJoint={true} />
          <SvgBamboo x={21} y={53} width={11} height={26} color={blue} />
          <SvgBamboo x={51} y={53} width={11} height={26} color={green} />
        </g>
      );
    // 6条：上3绿，下3蓝
    case 6:
      return (
        <g>
          <SvgBamboo x={20} y={15} width={11} height={27} color={green} />
          <SvgBamboo x={36} y={15} width={11} height={27} color={green} />
          <SvgBamboo x={52} y={15} width={11} height={27} color={green} />
          <SvgBamboo x={20} y={52} width={11} height={27} color={blue} />
          <SvgBamboo x={36} y={52} width={11} height={27} color={blue} />
          <SvgBamboo x={52} y={52} width={11} height={27} color={blue} />
        </g>
      );
    // 7条：顶中1红，中3绿，底3绿
    case 7:
      return (
        <g>
          <SvgBamboo x={36} y={11} width={11.5} height={24} color={red} hasRedJoint={true} />
          <SvgBamboo x={20} y={40} width={10.5} height={21} color={green} />
          <SvgBamboo x={36} y={40} width={10.5} height={21} color={green} />
          <SvgBamboo x={52} y={40} width={10.5} height={21} color={green} />
          <SvgBamboo x={20} y={67} width={10.5} height={21} color={green} />
          <SvgBamboo x={36} y={67} width={10.5} height={21} color={green} />
          <SvgBamboo x={52} y={67} width={10.5} height={21} color={green} />
        </g>
      );
    // 8条：黄金岛经典八条八节 (4顶对斜绿 + 4底对斜蓝，精准8根)
    case 8:
      return (
        <g>
          <SvgBamboo x={24} y={15} width={10} height={27} color={green} isAngled={18} />
          <SvgBamboo x={34} y={15} width={10} height={27} color={green} isAngled={-18} />
          <SvgBamboo x={38} y={15} width={10} height={27} color={green} isAngled={18} />
          <SvgBamboo x={48} y={15} width={10} height={27} color={green} isAngled={-18} />
          
          <SvgBamboo x={24} y={53} width={10} height={27} color={blue} isAngled={-18} />
          <SvgBamboo x={34} y={53} width={10} height={27} color={blue} isAngled={18} />
          <SvgBamboo x={38} y={53} width={10} height={27} color={blue} isAngled={-18} />
          <SvgBamboo x={48} y={53} width={10} height={27} color={blue} isAngled={18} />
        </g>
      );
    // 9条：3排3列 (上3红，中3蓝，下3绿)
    case 9:
      return (
        <g>
          <SvgBamboo x={20} y={13} width={10.5} height={22} color={red} />
          <SvgBamboo x={36} y={13} width={10.5} height={22} color={red} />
          <SvgBamboo x={52} y={13} width={10.5} height={22} color={red} />

          <SvgBamboo x={20} y={39} width={10.5} height={22} color={blue} />
          <SvgBamboo x={36} y={39} width={10.5} height={22} color={blue} />
          <SvgBamboo x={52} y={39} width={10.5} height={22} color={blue} />

          <SvgBamboo x={20} y={65} width={10.5} height={22} color={green} />
          <SvgBamboo x={36} y={65} width={10.5} height={22} color={green} />
          <SvgBamboo x={52} y={65} width={10.5} height={22} color={green} />
        </g>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// 3. 筒子牌纯矢量 SVG 渲染 - 黄金岛同心大铜钱与饱满梅花圆盘
// -------------------------------------------------------------
function SvgDot({ cx, cy, r = 9.5, color = '#1d4ed8' }) {
  const isRed = color === '#dc2626';
  const isGreen = color === '#15803d';
  const fillGrad = isRed ? 'url(#dotRedGrad)' : isGreen ? 'url(#dotGreenGrad)' : 'url(#dotBlueGrad)';

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fillGrad} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="2,1.5" />
      <circle cx={cx - r * 0.3} cy={cy} r={r * 0.22} fill="#ffffff" opacity="0.9" />
      <circle cx={cx + r * 0.3} cy={cy} r={r * 0.22} fill="#ffffff" opacity="0.9" />
      <circle cx={cx} cy={cy - r * 0.3} r={r * 0.22} fill="#ffffff" opacity="0.9" />
      <circle cx={cx} cy={cy + r * 0.3} r={r * 0.22} fill="#ffffff" opacity="0.9" />
      <circle cx={cx} cy={cy} r={r * 0.24} fill={isRed ? '#fef08a' : '#dc2626'} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
    </g>
  );
}

function SvgTong({ value }) {
  const blue = '#1d4ed8';
  const green = '#15803d';
  const red = '#dc2626';

  // 1筒：黄金岛传世大花轮 (大饼)
  if (value === 1) {
    return (
      <g transform="translate(36, 48)">
        <circle cx="0" cy="0" r="31" fill="#dc2626" stroke="#991b1b" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="25" fill="#fef9c3" stroke="#ca8a04" strokeWidth="0.8" />

        {[...Array(12)].map((_, i) => {
          const angle = (i * Math.PI) / 6;
          const px = Math.cos(angle) * 17.5;
          const py = Math.sin(angle) * 17.5;
          return <circle key={i} cx={px} cy={py} r="4.2" fill="#15803d" stroke="#14532d" strokeWidth="0.6" />;
        })}

        <circle cx="0" cy="0" r="12" fill="#1d4ed8" stroke="#1e40af" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="5" fill="#f59e0b" />
        <circle cx="0" cy="0" r="2.2" fill="#dc2626" />
      </g>
    );
  }

  switch (value) {
    case 2:
      return (
        <g>
          <SvgDot cx={36} cy={27} r={12.5} color={green} />
          <SvgDot cx={36} cy={69} r={12.5} color={blue} />
        </g>
      );
    case 3:
      return (
        <g>
          <SvgDot cx={20} cy={22} r={10.5} color={blue} />
          <SvgDot cx={36} cy={48} r={10.5} color={red} />
          <SvgDot cx={52} cy={74} r={10.5} color={green} />
        </g>
      );
    case 4:
      return (
        <g>
          <SvgDot cx={22} cy={26} r={11} color={blue} />
          <SvgDot cx={50} cy={26} r={11} color={green} />
          <SvgDot cx={22} cy={70} r={11} color={green} />
          <SvgDot cx={50} cy={70} r={11} color={blue} />
        </g>
      );
    case 5:
      return (
        <g>
          <SvgDot cx={20} cy={23} r={10} color={blue} />
          <SvgDot cx={52} cy={23} r={10} color={green} />
          <SvgDot cx={36} cy={48} r={11.5} color={red} />
          <SvgDot cx={20} cy={73} r={10} color={green} />
          <SvgDot cx={52} cy={73} r={10} color={blue} />
        </g>
      );
    case 6:
      return (
        <g>
          <SvgDot cx={23} cy={22} r={9.5} color={green} />
          <SvgDot cx={49} cy={22} r={9.5} color={green} />
          <SvgDot cx={23} cy={48} r={9.5} color={red} />
          <SvgDot cx={49} cy={48} r={9.5} color={red} />
          <SvgDot cx={23} cy={74} r={9.5} color={red} />
          <SvgDot cx={49} cy={74} r={9.5} color={red} />
        </g>
      );
    case 7:
      return (
        <g>
          <SvgDot cx={18} cy={20} r={8} color={green} />
          <SvgDot cx={36} cy={25} r={8} color={green} />
          <SvgDot cx={54} cy={30} r={8} color={green} />
          <SvgDot cx={23} cy={54} r={9} color={red} />
          <SvgDot cx={49} cy={54} r={9} color={red} />
          <SvgDot cx={23} cy={75} r={9} color={red} />
          <SvgDot cx={49} cy={75} r={9} color={red} />
        </g>
      );
    case 8:
      return (
        <g>
          <SvgDot cx={23} cy={18} r={8.5} color={blue} />
          <SvgDot cx={49} cy={18} r={8.5} color={blue} />
          <SvgDot cx={23} cy={38} r={8.5} color={blue} />
          <SvgDot cx={49} cy={38} r={8.5} color={blue} />
          <SvgDot cx={23} cy={58} r={8.5} color={blue} />
          <SvgDot cx={49} cy={58} r={8.5} color={blue} />
          <SvgDot cx={23} cy={78} r={8.5} color={blue} />
          <SvgDot cx={49} cy={78} r={8.5} color={blue} />
        </g>
      );
    case 9:
      return (
        <g>
          <SvgDot cx={19} cy={22} r={8.5} color={blue} />
          <SvgDot cx={36} cy={22} r={8.5} color={blue} />
          <SvgDot cx={53} cy={22} r={8.5} color={blue} />

          <SvgDot cx={19} cy={48} r={8.5} color={red} />
          <SvgDot cx={36} cy={48} r={8.5} color={red} />
          <SvgDot cx={53} cy={48} r={8.5} color={red} />

          <SvgDot cx={19} cy={74} r={8.5} color={green} />
          <SvgDot cx={36} cy={74} r={8.5} color={green} />
          <SvgDot cx={53} cy={74} r={8.5} color={green} />
        </g>
      );
    default:
      return null;
  }
}

// -------------------------------------------------------------
// 4. 麻将牌统一封装组件 (自适应高清矢量渲染，尺寸大幅升级)
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
  rotation = 0, // 0 | 90 | 180 | 270 (其它三家牌朝向自身)
  onClick = null,
  onMouseEnter = null,
  onMouseLeave = null,
  className = '',
  style = {}
}) {
  const isJiang = tile ? isJiangTile(tile) : false;

  // 牌张物理尺寸巨幅升级：手牌布满下方屏幕三分之二，其它三家对应大幅同步增加
  const sizeMap = {
    // 玩家手牌 (巨幅超清，布满下方屏幕的三分之二)
    hand: 'w-[52px] h-[72px] sm:w-[68px] sm:h-[94px] md:w-[80px] md:h-[110px] lg:w-[92px] lg:h-[126px] xl:w-[98px] xl:h-[134px] 2xl:w-[106px] 2xl:h-[144px]',
    // 碰吃杠面子牌 (对应同步大号化)
    meld: 'w-[44px] h-[60px] sm:w-[56px] sm:h-[78px] md:w-[66px] md:h-[90px] lg:w-[74px] lg:h-[102px]',
    // 弃牌池牌张 (大号桌面牌，一眼看清)
    discard: 'w-[38px] h-[52px] sm:w-[46px] sm:h-[64px] md:w-[54px] md:h-[76px] lg:w-[62px] lg:h-[86px] xl:w-[68px] xl:h-[94px]',
    // 对家手牌背面 (大幅增加尺寸)
    'opp-top': 'w-[42px] h-[58px] sm:w-[50px] sm:h-[68px] lg:w-[56px] lg:h-[76px]',
    // 侧边手牌背面 (上家与下家，大幅增加尺寸)
    'opp-side': 'w-[28px] h-[42px] sm:w-[34px] sm:h-[50px] lg:w-[40px] lg:h-[58px]',
    // 兼容原尺寸代码
    lg: 'w-[92px] h-[126px]',
    md: 'w-[64px] h-[88px]',
    sm: 'w-[48px] h-[66px]',
    mini: 'w-[36px] h-[50px]'
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
        selected ? '-translate-y-6 filter drop-shadow-2xl ring-4 ring-amber-400 rounded-xl' : ''
      } ${
        highlight ? 'filter drop-shadow-xl ring-2 ring-emerald-400 brightness-110 rounded-lg' : ''
      } ${className}`}
      style={style}
    >
      <svg viewBox="0 0 72 96" className="w-full h-full drop-shadow-md overflow-visible">
        <defs>
          <linearGradient id="ivoryGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#fcfbf7" />
            <stop offset="100%" stopColor="#f3efe4" />
          </linearGradient>
          <linearGradient id="tileBaseGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>

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

        <rect x="2" y="8" width="68" height="86" rx="8" fill="url(#tileBaseGrad)" />
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

        <g transform={rotation ? `rotate(${rotation}, 36, 48)` : undefined}>
          {tile.suit === SUITS.WAN && <SvgWan value={tile.value} />}
          {tile.suit === SUITS.TIAO && <SvgTiao value={tile.value} />}
          {tile.suit === SUITS.TONG && <SvgTong value={tile.value} />}
        </g>

        {showJiangBadge && isJiang && (
          <circle cx="12" cy="12" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
        )}
      </svg>

      {/* 听牌大号显目勋章角标 */}
      {isTing && (
        <div className="absolute -top-3 -right-3 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-xs sm:text-sm leading-tight px-2.5 py-0.5 rounded-full shadow-xl border border-white/80 pointer-events-none z-30 animate-pulse">
          听{tingCount !== null ? ` ${tingCount}张` : ''}
        </div>
      )}
    </div>
  );
}

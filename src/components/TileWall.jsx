import React from 'react';

/**
 * 单组 3D 黄金双层牌垛 (黄金岛正统牌墙元素)
 * - orientation: 'horizontal' (用于上下牌墙) | 'vertical' (用于左右牌墙)
 */
function SingleWallStack({ orientation = 'horizontal' }) {
  if (orientation === 'horizontal') {
    return (
      <div className="relative w-[18px] sm:w-[22px] md:w-[26px] h-[32px] sm:h-[38px] shrink-0 select-none drop-shadow-md">
        <svg viewBox="0 0 28 42" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="wallGoldGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--art-gold-200)" />
              <stop offset="30%" stopColor="var(--art-gold-500)" />
              <stop offset="70%" stopColor="var(--art-gold-600)" />
              <stop offset="100%" stopColor="var(--art-gold-800)" />
            </linearGradient>
            <linearGradient id="wallIvoryGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--art-white)" />
              <stop offset="100%" stopColor="var(--art-steel-200)" />
            </linearGradient>
            <linearGradient id="wallDarkGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--art-gold-900)" />
              <stop offset="100%" stopColor="var(--art-brown-900)" />
            </linearGradient>
          </defs>

          {/* 下层牌 (底层牌垛) */}
          <rect x="1" y="20" width="26" height="20" rx="3" fill="url(#wallDarkGold)" stroke="var(--art-brown-950)" strokeWidth="0.8" />
          <rect x="1" y="16" width="26" height="8" rx="2" fill="url(#wallIvoryGrad)" stroke="var(--art-steel-400)" strokeWidth="0.6" />
          <rect x="1" y="24" width="26" height="16" rx="2" fill="url(#wallGoldGrad)" stroke="var(--art-gold-200)" strokeWidth="0.7" />

          {/* 上层牌 (顶层牌垛) */}
          <rect x="1" y="4" width="26" height="20" rx="3" fill="url(#wallDarkGold)" stroke="var(--art-brown-950)" strokeWidth="0.8" />
          <rect x="1" y="0" width="26" height="8" rx="2" fill="url(#wallIvoryGrad)" stroke="var(--art-steel-300)" strokeWidth="0.6" />
          <rect x="1" y="8" width="26" height="16" rx="2" fill="url(#wallGoldGrad)" stroke="var(--art-gold-200)" strokeWidth="0.7" />
          <rect x="3" y="10" width="22" height="12" rx="1.5" fill="none" stroke="var(--art-gold-200)" strokeWidth="0.5" strokeOpacity="0.6" />
        </svg>
      </div>
    );
  }

  // 左右竖排牌墙
  return (
    <div className="relative w-[32px] sm:w-[38px] h-[18px] sm:h-[22px] md:h-[26px] shrink-0 select-none drop-shadow-md">
      <svg viewBox="0 0 42 28" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="wallGoldSide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--art-gold-200)" />
            <stop offset="30%" stopColor="var(--art-gold-500)" />
            <stop offset="70%" stopColor="var(--art-gold-600)" />
            <stop offset="100%" stopColor="var(--art-gold-800)" />
          </linearGradient>
          <linearGradient id="wallIvorySide" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--art-white)" />
            <stop offset="100%" stopColor="var(--art-steel-300)" />
          </linearGradient>
        </defs>

        {/* 底层牌 */}
        <rect x="18" y="1" width="22" height="26" rx="3" fill="var(--art-brown-900)" stroke="var(--art-brown-950)" strokeWidth="0.8" />
        <rect x="14" y="1" width="8" height="26" rx="2" fill="url(#wallIvorySide)" stroke="var(--art-steel-400)" strokeWidth="0.6" />
        <rect x="22" y="1" width="18" height="26" rx="2" fill="url(#wallGoldSide)" stroke="var(--art-gold-200)" strokeWidth="0.7" />

        {/* 顶层牌 */}
        <rect x="4" y="1" width="22" height="26" rx="3" fill="var(--art-brown-900)" stroke="var(--art-brown-950)" strokeWidth="0.8" />
        <rect x="0" y="1" width="8" height="26" rx="2" fill="url(#wallIvorySide)" stroke="var(--art-steel-300)" strokeWidth="0.6" />
        <rect x="8" y="1" width="18" height="26" rx="2" fill="url(#wallGoldSide)" stroke="var(--art-gold-200)" strokeWidth="0.7" />
        <rect x="10" y="3" width="14" height="22" rx="1.5" fill="none" stroke="var(--art-gold-200)" strokeWidth="0.5" strokeOpacity="0.6" />
      </svg>
    </div>
  );
}

/**
 * 完整四方黄金牌墙组件 (黄金岛标志性3D长城牌墙)
 * @param {number} wallRemaining 剩余牌数
 * @param {'top' | 'bottom' | 'left' | 'right'} position 方位
 */
export default function TileWall({ position = 'bottom', count = 12 }) {
  const isHorizontal = position === 'top' || position === 'bottom';

  return (
    <div
      className={`flex select-none pointer-events-none ${
        isHorizontal
          ? 'flex-row -space-x-0.5 sm:-space-x-1 items-center justify-center'
          : 'flex-col -space-y-0.5 sm:-space-y-1 items-center justify-center'
      }`}
    >
      {[...Array(Math.max(4, Math.min(count, 14)))].map((_, i) => (
        <SingleWallStack key={i} orientation={isHorizontal ? 'horizontal' : 'vertical'} />
      ))}
    </div>
  );
}

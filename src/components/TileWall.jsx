import React from 'react';

/**
 * 牌墙：象牙白牌沿 + 青瓷侧墙的双层牌垛。
 * 数量由外部按真实牌墙余量传入（不再是固定装饰），会随摸牌逐步缩短。
 */
function SingleWallStack({ orientation = 'horizontal' }) {
  if (orientation === 'horizontal') {
    return (
      <div className="relative h-[32px] w-[18px] shrink-0 select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.18)] sm:h-[38px] sm:w-[22px] md:h-[42px] md:w-[26px]">
        <svg viewBox="0 0 28 42" className="h-full w-full overflow-visible">
          {/* 下层 */}
          <rect x="1" y="21" width="26" height="18" rx="4" fill="var(--color-jade-600)" opacity="0.95" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
          <rect x="1" y="16" width="26" height="8" rx="3" fill="var(--art-face)" stroke="var(--art-face-edge)" strokeWidth="0.6" />
          {/* 上层 */}
          <rect x="1" y="5" width="26" height="18" rx="4" fill="var(--color-jade-600)" opacity="0.95" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
          <rect x="1" y="0" width="26" height="8" rx="3" fill="var(--art-white)" stroke="var(--art-face-edge)" strokeWidth="0.6" />
          <rect x="3" y="1.5" width="22" height="5" rx="2" fill="none" stroke="var(--color-jade-200)" strokeWidth="0.8" opacity="0.7" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative h-[18px] w-[32px] shrink-0 select-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.18)] sm:h-[22px] sm:w-[38px] md:h-[26px] md:w-[42px]">
      <svg viewBox="0 0 42 28" className="h-full w-full overflow-visible">
        {/* 下层 */}
        <rect x="21" y="1" width="18" height="26" rx="4" fill="var(--color-jade-600)" opacity="0.95" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
        <rect x="16" y="1" width="8" height="26" rx="3" fill="var(--art-face)" stroke="var(--art-face-edge)" strokeWidth="0.6" />
        {/* 上层 */}
        <rect x="5" y="1" width="18" height="26" rx="4" fill="var(--color-jade-600)" opacity="0.95" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
        <rect x="0" y="1" width="8" height="26" rx="3" fill="var(--art-white)" stroke="var(--art-face-edge)" strokeWidth="0.6" />
        <rect x="1.5" y="3" width="5" height="22" rx="2" fill="none" stroke="var(--color-jade-200)" strokeWidth="0.8" opacity="0.7" />
      </svg>
    </div>
  );
}

export default function TileWall({ position = 'bottom', count = 12 }) {
  const isHorizontal = position === 'top' || position === 'bottom';
  const stacks = Math.max(4, Math.min(Number(count) || 12, 14));

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none flex select-none ${
        isHorizontal
          ? 'flex-row items-center justify-center gap-[2px]'
          : 'flex-col items-center justify-center gap-[2px]'
      }`}
    >
      {[...Array(stacks)].map((_, i) => (
        <SingleWallStack key={i} orientation={isHorizontal ? 'horizontal' : 'vertical'} />
      ))}
    </div>
  );
}

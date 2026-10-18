import React from 'react';

const ANGLE = {
  bottom: 0,
  top: 180,
  left: 90,
  right: -90
};

/**
 * 起手胡番型条：只写胡牌项目（例：缺一色），按座位旋转，字面朝向胡家。
 * 起手牌本身由 OpponentHand 直接替换暗牌摊开，避免弹窗和重复占位。
 */
export default function StartingHuBadge({ event, facing = 'bottom', className = '' }) {
  if (!event || !event.huList || event.huList.length === 0) return null;
  const names = event.huList.map((hu) => hu.name).join(' · ');
  const side = facing === 'left' || facing === 'right';
  const angle = ANGLE[facing] ?? 0;

  return (
    <div
      role="status"
      aria-label={`起手胡 ${names}，起手牌公开`}
      className={`starting-hu-reveal pointer-events-none flex flex-col items-center gap-1 ${side ? 'w-[3.2rem]' : ''} ${className}`}
    >
      <div className={`flex items-center justify-center overflow-visible ${side ? 'h-[6.2rem] w-full' : ''}`}>
        <div
          className="starting-hu-fan inline-flex items-center justify-center rounded-lg border-2 border-rose-200/90 bg-rose-600 px-2.5 py-1.5 shadow-[0_8px_22px_rgba(140,40,40,0.38)]"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span className="whitespace-nowrap font-brush text-[22px] font-bold leading-none text-white sm:text-[24px]">
            {names}
          </span>
        </div>
      </div>
    </div>
  );
}

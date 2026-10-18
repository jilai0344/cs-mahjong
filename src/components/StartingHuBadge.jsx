import React from 'react';

/**
 * 起手胡座位横幅：不弹窗、不拦停牌局，只在该玩家面前醒目展示胡牌项目。
 * 分数统一挂到本局结算时计算，所以这里只显示项目，不显示 +分。
 */
export default function StartingHuBadge({ event, className = '' }) {
  if (!event || !event.huList || event.huList.length === 0) return null;
  const names = event.huList.map((hu) => hu.name).join(' · ');

  return (
    <div
      role="status"
      aria-label={`起手胡 ${names}，局终结算`}
      className={`starting-hu-badge pointer-events-none flex max-w-[14rem] items-start gap-2 rounded-xl border border-rose-200/80 bg-rose-600 px-3 py-2 text-white shadow-[0_8px_22px_rgba(140,40,40,0.35)] ${className}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 font-brush text-[20px] leading-none">
        胡
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9px] font-semibold tracking-[0.12em] text-white/75">起手胡 · 局终结算</div>
        <div className="mt-0.5 break-words text-[12px] font-bold">{names}</div>
      </div>
    </div>
  );
}

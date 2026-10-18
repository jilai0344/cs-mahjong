import React from 'react';

const DIR_LABELS = ['东', '南', '西', '北'];

function DiceFace({ value = 1, tone = 'light' }) {
  // 1–6 的点位（3×3 网格坐标）
  const layouts = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
  };
  const pips = layouts[value] || layouts[1];
  const dark = tone === 'dark';

  return (
    <div
      className={`relative grid h-7 w-7 grid-cols-3 grid-rows-3 gap-[2px] rounded-md border p-1 shadow-sm ${
        dark
          ? 'border-[var(--color-jade-600)] bg-[var(--color-jade-600)]'
          : 'border-stone-200 bg-white'
      }`}
      aria-label={`骰子 ${value}`}
      role="img"
    >
      {[...Array(9)].map((_, i) => {
        const x = i % 3;
        const y = Math.floor(i / 3);
        const on = pips.some(([px, py]) => px === x && py === y);
        return (
          <span
            key={i}
            className={`h-1 w-1 justify-self-center self-center rounded-full ${
              on ? (dark ? 'bg-white' : 'bg-stone-800') : 'bg-transparent'
            }`}
          />
        );
      })}
    </div>
  );
}

/**
 * 桌心：一枚安静的瓷盘。
 * 方位、倒计时、牌墙余量分层摆放；只用一圈细进度环表达时间与余量。
 */
export default function TableCenter({
  currentTurn = 0,
  dealerId = 0,
  wallRemaining = 108,
  roomLabel = '单机练习',
  wallTotal = 108,
  roundNumber = 0,
  dealerName = '',
  turnTimer = 15,
  diceValues = [3, 4],
  isRollingDice = false,
  statusText = '',
  mySeatId = 0
}) {
  const directionPositions = {
    0: 'bottom-1 left-1/2 -translate-x-1/2',
    1: 'right-2 top-1/2 -translate-y-1/2',
    2: 'top-1 left-1/2 -translate-x-1/2',
    3: 'left-2 top-1/2 -translate-y-1/2'
  };

  const directions = [0, 1, 2, 3].map((id) => {
    const relPos = (id - mySeatId + 4) % 4;
    return { id, label: DIR_LABELS[id], relPos, posClass: directionPositions[relPos] };
  });

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const wallRatio = Math.max(0, Math.min(1, Number(wallRemaining) / Math.max(1, Number(wallTotal))));
  const timeRatio = Math.max(0, Math.min(1, Number(turnTimer) / 15));
  const ringColor = turnTimer <= 5 ? 'var(--ui-accent)' : 'var(--color-jade-500)';

  return (
    <div className="pointer-events-none relative flex shrink-0 select-none flex-col items-center justify-center">
      {/* 方位 + 倒计时 + 余量环 */}
      <div className="relative flex h-[132px] w-[132px] items-center justify-center sm:h-[144px] sm:w-[144px]">
        <svg viewBox="0 0 132 132" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="66" cy="66" r={radius} fill="none" stroke="rgba(34,48,43,0.10)" strokeWidth="5" />
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - timeRatio)}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>

        <div className="table-center-disc relative flex h-[104px] w-[104px] items-center justify-center rounded-full sm:h-[112px] sm:w-[112px]">
          {directions.map((dir) => {
            const isActive = currentTurn === dir.id;
            const isDealer = dealerId === dir.id;
            return (
              <div key={dir.id} className={`absolute ${dir.posClass} flex items-center justify-center`}>
                <span
                  className={`text-[11px] transition-colors ${
                    isActive
                      ? 'font-bold text-[var(--color-jade-600)]'
                      : 'font-medium text-stone-400'
                  }`}
                >
                  {dir.label}
                  {isDealer && (
                    <span className="ml-0.5 inline-block h-1 w-1 -translate-y-1 rounded-full bg-rose-500" />
                  )}
                </span>
              </div>
            );
          })}

          {isRollingDice ? (
            <div className="flex items-center gap-1.5">
              <DiceFace value={diceValues[0] || 1} />
              <DiceFace value={diceValues[1] || 2} tone="dark" />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span
                className={`font-serif text-[32px] font-semibold leading-none tabular-nums ${
                  turnTimer <= 5 ? 'text-[var(--ui-accent)]' : 'text-stone-800'
                }`}
              >
                {turnTimer}
              </span>
              <span className="mt-1 text-[10px] font-medium text-stone-400">秒</span>
            </div>
          )}
        </div>
      </div>

      {/* 局数 / 庄家 / 余牌 */}
      <div className="mt-2 flex flex-col items-center gap-1">
        <span className="text-[10px] font-medium tracking-[0.14em] text-white/70">
          {roomLabel}
        </span>

        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-black/15 px-2.5 py-0.5 text-[10px] font-medium text-white/85">
          {roundNumber > 0 && (
            <>
              <span>第 {roundNumber} 局</span>
              <span className="text-white/35">·</span>
            </>
          )}
          {dealerName ? (
            <>
              <span>庄 {dealerName.slice(0, 4)}</span>
              <span className="text-white/35">·</span>
            </>
          ) : null}
          <span className="font-mono tabular-nums">
            余 {wallRemaining}/{wallTotal}
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="牌墙剩余"
          aria-valuemin={0}
          aria-valuemax={wallTotal}
          aria-valuenow={wallRemaining}
          className="h-1 w-24 overflow-hidden rounded-full bg-black/20 sm:w-28"
        >
          <div
            className="h-full rounded-full bg-white/75 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(wallRatio * 100)}%` }}
          />
        </div>

        {statusText && (
          <span className="max-w-[13rem] text-center text-[10px] text-white/60">{statusText}</span>
        )}
      </div>
    </div>
  );
}

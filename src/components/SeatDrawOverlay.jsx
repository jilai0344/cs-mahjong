import React from 'react';
import { useModalA11y } from '../hooks/useModalA11y.js';

const WIND_LABELS = ['东', '南', '西', '北'];
const POSITION_LABELS = ['我', '下家', '对家', '上家'];

const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
};

function Die({ value = 1, highlight = false }) {
  const pips = PIPS[value] || PIPS[1];
  return (
    <div
      className={`grid h-11 w-11 grid-cols-3 grid-rows-3 gap-[3px] rounded-xl border p-1.5 shadow-sm ${
        highlight
          ? 'border-[var(--color-jade-500)] bg-white ring-2 ring-[var(--color-jade-300)]'
          : 'border-stone-200 bg-[var(--ui-paper)]'
      }`}
      aria-label={`骰子 ${value}`}
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const on = pips.some(([r, c]) => r === row && c === col);
        return (
          <span
            key={i}
            className={`h-1.5 w-1.5 justify-self-center self-center rounded-full ${
              on ? 'bg-[var(--color-jade-600)]' : 'bg-transparent'
            }`}
          />
        );
      })}
    </div>
  );
}

/**
 * 开局定方位：四家各掷一粒骰子，点数从大到小依次坐东、南、西、北。
 * 本家永远在屏幕下方；其余方位的相对顺序按风位排。
 */
export default function SeatDrawOverlay({ draw }) {
  const modalA11y = useModalA11y(null);
  if (!draw) return null;

  const { values = [], winds = [0, 1, 2, 3], localSeat = 0, eastSeat = 0 } = draw;
  const order = [0, 1, 2, 3];

  return (
    <div
      {...modalA11y}
      className="fixed inset-0 z-[65] flex select-none items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
    >
      <div className="animate-modal-in w-full max-w-2xl overflow-hidden rounded-[26px] border border-white/60 bg-[var(--ui-paper)] shadow-[0_30px_90px_rgba(0,0,0,0.4)]">
        <div className="bg-[var(--color-felt-700)] px-6 py-5 text-white">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-white/55">开局定方位</p>
          <h2 className="mt-1 text-[24px] font-bold">四家掷骰 · 点数大者坐东</h2>
          <p className="mt-1 text-[11px] text-white/60">由大到小依次为：东 → 南 → 西 → 北</p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-5">
          {order.map((seat) => {
            const wind = winds[seat] ?? seat;
            const isLocal = seat === localSeat;
            const isEast = seat === eastSeat;
            return (
              <div
                key={seat}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 ${
                  isEast
                    ? 'border-[var(--color-jade-500)] bg-[var(--color-jade-200)]/25'
                    : 'border-stone-200 bg-white/60'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold tracking-[0.08em] text-stone-400">
                    {POSITION_LABELS[seat]}
                  </span>
                  {isLocal && (
                    <span className="rounded-full bg-[var(--color-jade-600)] px-1.5 py-0.5 text-[8px] font-bold text-white">
                      我
                    </span>
                  )}
                </div>
                <Die value={values[seat] || 1} highlight={isLocal} />
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-[22px] font-bold text-stone-800">
                    {WIND_LABELS[wind]}
                  </span>
                  <span className="text-[10px] text-stone-400">家</span>
                </div>
                {isEast && (
                  <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
                    东 · 庄
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-stone-200/70 px-5 py-3 text-center text-[10px] tracking-[0.12em] text-stone-400">
          定方位后自动发牌
        </div>
      </div>
    </div>
  );
}

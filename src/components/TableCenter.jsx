import React from 'react';

export default function TableCenter({
  currentTurn,
  dealerId,
  wallRemaining,
  turnTimer,
  diceValues = [3, 4],
  isRollingDice = false,
  statusText = ''
}) {
  // 方位布局：0: 东(底/我), 1: 南(右/下家), 2: 西(顶/对家), 3: 北(左/上家)
  const seatPositions = [
    { id: 0, wind: '东', style: 'bottom-1 left-1/2 -translate-x-1/2' },
    { id: 1, wind: '南', style: 'right-1 top-1/2 -translate-y-1/2' },
    { id: 2, wind: '西', style: 'top-1 left-1/2 -translate-x-1/2' },
    { id: 3, wind: '北', style: 'left-1 top-1/2 -translate-y-1/2' }
  ];

  return (
    <div className="relative w-32 h-32 rounded-2xl bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 border-2 border-emerald-500/40 shadow-2xl flex flex-col items-center justify-center p-2 select-none shrink-0 z-10">
      {/* 东南西北四个方位的发光指示灯 */}
      {seatPositions.map(pos => {
        const isActive = currentTurn === pos.id;
        const isDealer = dealerId === pos.id;

        return (
          <div
            key={pos.id}
            className={`absolute flex items-center justify-center ${pos.style}`}
          >
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-black transition-all duration-200 ${
                isActive
                  ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/40 shadow-lg scale-110'
                  : 'bg-black/50 text-emerald-300/60 border border-emerald-500/20'
              }`}
            >
              {pos.wind}
              {isDealer && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-600 ring-1 ring-white" />
              )}
            </div>
          </div>
        );
      })}

      {/* 中心数字倒计时或掷骰展示 */}
      <div className="flex flex-col items-center justify-center z-10">
        {isRollingDice ? (
          <div className="flex gap-1.5 items-center animate-bounce">
            <div className="w-6 h-6 rounded bg-white text-slate-950 font-black flex items-center justify-center text-xs shadow-md border border-slate-300">
              {diceValues[0]}
            </div>
            <div className="w-6 h-6 rounded bg-red-600 text-white font-black flex items-center justify-center text-xs shadow-md border border-red-400">
              {diceValues[1]}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center leading-none">
            <span className="text-2xl font-black text-amber-300 font-mono tracking-tight drop-shadow-md">
              {turnTimer}
            </span>
            <span className="text-[9px] text-emerald-300/80 font-bold uppercase tracking-wider mt-0.5">
              SEC
            </span>
          </div>
        )}

        {/* 牌墙剩余张数 */}
        <div className="mt-1 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[10px] text-emerald-200 font-medium">
          <span>余</span>
          <span className="font-bold text-white font-mono">{wallRemaining}</span>
        </div>
      </div>
    </div>
  );
}

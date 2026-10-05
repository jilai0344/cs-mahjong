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
    <div className="relative w-38 h-38 sm:w-42 sm:h-42 rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 border-2 border-emerald-500/50 shadow-2xl flex flex-col items-center justify-center p-3 select-none shrink-0 z-10">
      {/* 东南西北四个方位的大号发光指示标 (字体翻倍) */}
      {seatPositions.map(pos => {
        const isActive = currentTurn === pos.id;
        const isDealer = dealerId === pos.id;

        return (
          <div
            key={pos.id}
            className={`absolute flex items-center justify-center ${pos.style}`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-base font-black transition-all duration-200 ${
                isActive
                  ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/50 shadow-xl scale-110'
                  : 'bg-black/60 text-emerald-300/60 border border-emerald-500/30'
              }`}
            >
              {pos.wind}
              {isDealer && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white" title="庄家" />
              )}
            </div>
          </div>
        );
      })}

      {/* 中心大号数字倒计时 (字体翻倍) */}
      <div className="flex flex-col items-center justify-center z-10">
        {isRollingDice ? (
          <div className="flex gap-2 items-center animate-bounce">
            <div className="w-8 h-8 rounded-lg bg-white text-slate-950 font-black flex items-center justify-center text-base shadow-md border-2 border-slate-300">
              {diceValues[0]}
            </div>
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-base shadow-md border-2 border-red-400">
              {diceValues[1]}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center leading-none">
            <span className="text-4xl sm:text-5xl font-black text-amber-300 font-mono tracking-tight drop-shadow-md">
              {turnTimer}
            </span>
            <span className="text-xs text-emerald-300 font-black uppercase tracking-widest mt-1">
              秒
            </span>
          </div>
        )}

        {/* 牌墙剩余张数 (大号醒目) */}
        <div className="mt-1.5 flex items-center gap-1.5 bg-black/70 px-3 py-1 rounded-full border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 font-bold">
          <span>剩余</span>
          <span className="font-black text-amber-400 font-mono text-sm sm:text-base">{wallRemaining}</span>
          <span>张</span>
        </div>
      </div>
    </div>
  );
}

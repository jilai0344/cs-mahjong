import React from 'react';

/**
 * 黄金岛正统中央罗盘与开局控制区
 * - 八角流金紫晶罗盘
 * - 东南西北四方位指示
 * - 醒目翠绿流光倒计时指向箭头 (高度拟真黄金岛原画)
 * - 桌面底纹金印 (无字无花 长沙麻将 / 房间或模式标识)
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
  // 相对屏幕方位布局 (以本地视角 mySeatId 为基准): 0: 底(我), 1: 右(下家), 2: 顶(对家), 3: 左(上家)
  const dirLabels = ['东', '南', '西', '北'];
  const posClasses = {
    0: 'bottom-2 left-1/2 -translate-x-1/2',
    1: 'right-2 top-1/2 -translate-y-1/2',
    2: 'top-2 left-1/2 -translate-x-1/2',
    3: 'left-2 top-1/2 -translate-y-1/2'
  };

  const directions = [0, 1, 2, 3].map(id => {
    const relPos = (id - mySeatId + 4) % 4;
    return {
      id,
      label: dirLabels[id],
      relPos,
      posClass: posClasses[relPos]
    };
  });

  // 相对当前出牌箭头朝向 (0朝下指向我，1朝右指向下家，2朝上指向对家，3朝左指向上家)
  const relTurn = (currentTurn - mySeatId + 4) % 4;
  const arrowStyles = {
    0: 'bottom-[-16px] left-1/2 -translate-x-1/2 rotate-180',
    1: 'right-[-16px] top-1/2 -translate-y-1/2 rotate-90',
    2: 'top-[-16px] left-1/2 -translate-x-1/2 rotate-0',
    3: 'left-[-16px] top-1/2 -translate-y-1/2 -rotate-90'
  };

  return (
    <div className="relative flex flex-col items-center justify-center select-none shrink-0 pointer-events-none">
      {/* 1. 桌面底纹经典金色横幅水印 (无字无花 长沙麻将) */}
      <div className="absolute -top-12 flex flex-col items-center pointer-events-none opacity-40 select-none">
        <div className="relative px-8 py-1 rounded-full bg-gradient-to-r from-transparent via-amber-900/40 to-transparent border-t border-b border-amber-400/30 flex items-center justify-center">
          <span className="text-[11px] sm:text-xs font-black tracking-widest text-amber-200/90 whitespace-nowrap [text-shadow:_0_1px_4px_rgba(0,0,0,0.8)]">
            无字无花 · 经典番双鸟
          </span>
        </div>
        <span className="text-xl sm:text-2xl font-black tracking-[0.25em] text-amber-500/50 mt-0.5 whitespace-nowrap">
          长 沙 麻 将
        </span>
      </div>

      {/* 2. 罗盘主体 (紫金八角宝石 + 翠绿流光指示箭头) */}
      <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center pointer-events-auto">
        {/* 翠绿出牌流光指向箭头 (黄金岛核心标志：指向当前出牌方位) */}
        {directions.map(d => {
          const isActive = currentTurn === d.id;
          if (!isActive) return null;

          return (
            <div
              key={`arrow-${d.id}`}
              className={`absolute z-20 pointer-events-none flex flex-col items-center animate-pulse ${arrowStyles[d.relPos]}`}
            >
              {/* 翠绿高光辐射气晕 */}
              <div className="w-10 h-10 -mb-6 rounded-full bg-emerald-400/40 blur-md pointer-events-none" />
              {/* 3D 翠绿多边形指示箭头 */}
              <svg viewBox="0 0 32 24" className="w-8 h-6 filter drop-shadow-[0_0_8px_var(--color-jade-500)]">
                <defs>
                  <linearGradient id="neonGreenGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="var(--color-jade-600)" />
                    <stop offset="40%" stopColor="var(--color-jade-500)" />
                    <stop offset="100%" stopColor="var(--color-jade-300)" />
                  </linearGradient>
                </defs>
                <polygon points="16,0 32,20 22,17 16,24 10,17 0,20" fill="url(#neonGreenGrad)" stroke="var(--color-jade-200)" strokeWidth="1" />
              </svg>
            </div>
          );
        })}

        {/* 罗盘底座：八角紫晶金边底盘 */}
        <div className="w-full h-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-violet-800 via-violet-600 to-violet-400 border-[3px] border-amber-400/80 shadow-[0_8px_25px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.3)] flex items-center justify-center p-2 relative ring-2 ring-amber-500/40">
          {/* 四个方位文字 (东 南 西 北) */}
          {directions.map(dir => {
            const isActive = currentTurn === dir.id;
            const isDealer = dealerId === dir.id;

            return (
              <div
                key={dir.id}
                className={`absolute ${dir.posClass} flex items-center justify-center`}
              >
                <span
                  className={`text-xs sm:text-sm font-black transition-all ${
                    isActive
                      ? 'text-amber-200 scale-125 [text-shadow:_0_0_8px_var(--color-gold-200)]'
                      : 'text-amber-400/50'
                  }`}
                >
                  {dir.label}
                  {isDealer && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-0.5 -translate-y-1" />
                  )}
                </span>
              </div>
            );
          })}

          {/* 中心倒计时数字 / 骰子动画 */}
          <div className="flex flex-col items-center justify-center z-10">
            {isRollingDice ? (
              <div className="flex gap-1.5 items-center animate-bounce">
                <div className="w-7 h-7 rounded-lg bg-white text-slate-950 font-black flex items-center justify-center text-sm shadow-md border-2 border-slate-300">
                  {diceValues[0]}
                </div>
                <div className="w-7 h-7 rounded-lg bg-red-600 text-white font-black flex items-center justify-center text-sm shadow-md border-2 border-red-400">
                  {diceValues[1]}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tighter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  {turnTimer}
                </span>
                <span className="text-[10px] text-amber-200/70 font-bold -mt-0.5">
                  秒
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 罗盘下方底纹：房间/模式 + 局数·庄家 + 牌墙进度（P2-2 / D3 改真实信息、D6 增加信息密度） */}
      <div className="mt-2 flex flex-col items-center gap-1 opacity-70">
        <span className="text-[11px] font-black text-amber-400/80 tracking-widest [text-shadow:_0_1px_3px_rgba(0,0,0,0.9)]">
          {roomLabel}
        </span>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200/80 bg-black/50 px-2.5 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
          {roundNumber > 0 && (
            <>
              <span>第</span>
              <span className="font-mono text-amber-300 font-black">{roundNumber}</span>
              <span>局</span>
              <span className="text-amber-400/60">·</span>
            </>
          )}
          {dealerName ? (
            <>
              <span>庄</span>
              <span className="font-black text-amber-300">{dealerName.slice(0, 4)}</span>
              <span className="text-amber-400/60">·</span>
            </>
          ) : null}
          <span>余</span>
          <span className="font-mono text-amber-300 font-black">{wallRemaining}</span>
          <span className="text-amber-400/60">/</span>
          <span className="font-mono text-amber-200/70">{wallTotal}</span>
          <span>张</span>
        </div>
        {/* 牌墙进度条：把「还剩多少」变成一眼可见的比例（数据可视化，不是装饰纹理） */}
        <div
          role="progressbar"
          aria-label="牌墙剩余"
          aria-valuemin={0}
          aria-valuemax={wallTotal}
          aria-valuenow={wallRemaining}
          className="w-24 sm:w-32 h-1 rounded-full bg-black/60 border border-amber-500/20 overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-jade-500 to-amber-400 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, Math.round((wallRemaining / Math.max(1, wallTotal)) * 100)))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

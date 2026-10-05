import React from 'react';
import MahjongTile from './MahjongTile.jsx';

export default function OpponentHand({
  player,
  handCount = 13,
  melds = [],
  isCurrentTurn = false,
  actionBubble = null,
  score = 1000,
  isDealer = false
}) {
  const { position, name } = player;

  const isTop = position === 'top';
  const isLeft = position === 'left';
  const isRight = position === 'right';

  return (
    <div
      className={`absolute flex items-center select-none z-10 ${
        isTop
          ? 'top-2 left-1/2 -translate-x-1/2 flex-col'
          : isLeft
          ? 'left-2 top-1/2 -translate-y-1/2 flex-row'
          : 'right-2 top-1/2 -translate-y-1/2 flex-row-reverse'
      }`}
    >
      {/* 玩家信息牌 (现代微晶玻璃质感芯片) */}
      <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 shadow-xl backdrop-blur-md min-w-[85px] m-1 relative shrink-0">
        {/* 操作/思考气泡 */}
        {actionBubble && (
          <div className="absolute -top-6 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-xl animate-bounce z-30 border border-amber-500">
            {actionBubble}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-white tracking-wide">{name}</span>
          {isDealer && (
            <span className="bg-red-600 text-white text-[9px] px-1 py-0.2 rounded font-black shadow-xs">庄</span>
          )}
        </div>

        <span className="text-xs font-mono text-amber-300 font-black mt-0.5">
          {score} 分
        </span>

        {isCurrentTurn && (
          <span className="text-[10px] text-emerald-400 font-bold mt-0.5 animate-pulse">
            思考中...
          </span>
        )}
      </div>

      {/* 手牌与已亮面子 */}
      <div
        className={`flex items-center gap-2 ${
          isTop
            ? 'flex-row'
            : 'flex-col'
        }`}
      >
        {/* 副露面子 */}
        {melds.length > 0 && (
          <div
            className={`flex gap-1.5 p-1 rounded-lg bg-black/40 border border-emerald-500/20 shrink-0 ${
              isTop ? 'flex-row' : 'flex-col'
            }`}
          >
            {melds.map((meld, mIdx) => (
              <div
                key={mIdx}
                className={`flex gap-0.5 items-center ${isTop ? 'flex-row' : 'flex-col'}`}
              >
                {meld.tiles.map((tile, tIdx) => (
                  <MahjongTile
                    key={tIdx}
                    tile={tile}
                    size={isTop ? 'meld' : 'discard'}
                    isBack={meld.type === 'an_gang' && tIdx > 0 && tIdx < 3}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 牌背立牌 */}
        <div
          className={`flex gap-0.5 shrink-0 ${
            isTop
              ? 'flex-row'
              : 'flex-col'
          }`}
        >
          {[...Array(Math.max(0, handCount))].map((_, idx) => (
            <MahjongTile
              key={idx}
              isBack={true}
              size={isTop ? 'opp-top' : 'opp-side'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

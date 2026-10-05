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
      {/* 玩家信息牌 (字体翻倍，清晰震撼) */}
      <div className="flex flex-col items-center justify-center px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/40 shadow-2xl backdrop-blur-md min-w-[105px] m-1 relative shrink-0">
        {/* 操作/思考气泡 (大号) */}
        {actionBubble && (
          <div className="absolute -top-8 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-sm px-3.5 py-1 rounded-full shadow-2xl animate-bounce z-30 border-2 border-amber-500">
            {actionBubble}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-sm sm:text-base font-black text-white tracking-wide">{name}</span>
          {isDealer && (
            <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-black shadow-md">庄</span>
          )}
        </div>

        <span className="text-sm sm:text-base font-mono text-amber-300 font-black mt-0.5">
          {score} 分
        </span>

        {isCurrentTurn && (
          <span className="text-xs text-emerald-400 font-black mt-0.5 animate-pulse">
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
            className={`flex gap-1.5 p-1.5 rounded-xl bg-black/40 border border-emerald-500/30 shrink-0 ${
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

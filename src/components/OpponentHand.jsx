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
      className={`flex items-center select-none z-10 ${
        isTop ? 'flex-col gap-1' : 'flex-col items-center gap-1.5'
      }`}
    >
      {/* 玩家信息牌 (醒目大气，位于各家手牌顶部) */}
      <div className="flex flex-col items-center justify-center px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-slate-900/95 border border-emerald-500/40 shadow-xl backdrop-blur-md min-w-[95px] relative shrink-0">
        {/* 操作/思考气泡 */}
        {actionBubble && (
          <div className="absolute -top-7 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs sm:text-sm px-3 py-0.5 rounded-full shadow-2xl animate-bounce z-30 border-2 border-amber-500 whitespace-nowrap">
            {actionBubble}
          </div>
        )}

        <div className="flex items-center gap-1">
          <span className="text-xs sm:text-sm font-black text-white tracking-wide">{name}</span>
          {isDealer && (
            <span className="bg-red-600 text-white text-[10px] px-1 py-0.2 rounded font-black shadow-md">庄</span>
          )}
        </div>

        <span className="text-[11px] sm:text-xs font-mono text-amber-300 font-black mt-0.5">
          {score} 分
        </span>

        {isCurrentTurn && (
          <span className="text-[10px] text-emerald-400 font-black mt-0.5 animate-pulse">
            思考中...
          </span>
        )}
      </div>

      {/* 手牌与已亮面子区域 */}
      <div
        className={`flex items-center gap-1.5 ${
          isTop ? 'flex-row' : 'flex-col justify-center'
        }`}
      >
        {/* 副露面子 (暗杠全盖，副露紧凑排布) */}
        {melds.length > 0 && (
          <div
            className={`flex gap-1 p-1 rounded-xl bg-black/50 border border-emerald-500/30 shrink-0 ${
              isTop ? 'flex-row' : 'flex-col items-center'
            }`}
          >
            {melds.map((meld, mIdx) => (
              <div
                key={mIdx}
                className="flex gap-0.5 items-center flex-row"
              >
                {meld.tiles.map((tile, tIdx) => (
                  <MahjongTile
                    key={tIdx}
                    tile={tile}
                    size={isTop ? 'meld' : 'sm'}
                    rotation={isTop ? 180 : isLeft ? 90 : 270}
                    isBack={meld.type === 'an_gang'}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 牌背立牌 */}
        <div
          className={`flex shrink-0 ${
            isTop
              ? 'flex-row gap-0.5'
              : 'flex-col -space-y-1.5 sm:-space-y-2 justify-center'
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

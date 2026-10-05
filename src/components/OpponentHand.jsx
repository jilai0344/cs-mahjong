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
        isTop
          ? 'flex-col gap-1.5'
          : isLeft
          ? 'flex-row gap-2'
          : 'flex-row-reverse gap-2'
      }`}
    >
      {/* 玩家信息牌 (醒目大气) */}
      <div className="flex flex-col items-center justify-center px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/40 shadow-2xl backdrop-blur-md min-w-[105px] relative shrink-0">
        {/* 操作/思考气泡 */}
        {actionBubble && (
          <div className="absolute -top-7 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs sm:text-sm px-3 py-0.5 rounded-full shadow-2xl animate-bounce z-30 border-2 border-amber-500 whitespace-nowrap">
            {actionBubble}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-xs sm:text-sm font-black text-white tracking-wide">{name}</span>
          {isDealer && (
            <span className="bg-red-600 text-white text-[11px] px-1.5 py-0.2 rounded font-black shadow-md">庄</span>
          )}
        </div>

        <span className="text-xs sm:text-sm font-mono text-amber-300 font-black mt-0.5">
          {score} 分
        </span>

        {isCurrentTurn && (
          <span className="text-[11px] text-emerald-400 font-black mt-0.5 animate-pulse">
            思考中...
          </span>
        )}
      </div>

      {/* 手牌与已亮面子区域 */}
      <div
        className={`flex items-center gap-2 ${
          isTop ? 'flex-row' : 'flex-col justify-center'
        }`}
      >
        {/* 副露面子 (修复BUG：暗杠全盖，副露紧凑横向排布，不无限纵向溢出) */}
        {melds.length > 0 && (
          <div
            className={`flex gap-1.5 p-1 rounded-xl bg-black/50 border border-emerald-500/30 shrink-0 ${
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
                    isBack={meld.type === 'an_gang'} // 黄金岛标准：暗杠全牌背盖住，绝无两头翘BUG
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
              : 'flex-col justify-center'
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

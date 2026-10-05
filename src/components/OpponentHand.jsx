import React from 'react';
import MahjongTile from './MahjongTile.jsx';

/**
 * 黄金岛对手玩家手牌与信息牌组件
 * - 黄金岛经典椭圆金边信息胶囊 (头像/VIP/庄家印记/积分)
 * - 站立式琥珀流金牌背
 * - 紧凑副露排布
 */
export default function OpponentHand({
  player,
  handCount = 13,
  melds = [],
  isCurrentTurn = false,
  actionBubble = null,
  score = 1000,
  isDealer = false
}) {
  const { id, position, name } = player;

  const isTop = position === 'top';
  const isLeft = position === 'left';
  const isRight = position === 'right';

  // 虚拟 VIP 等级 (高度还原黄金岛 V1, V5, V32 视觉元素)
  const vipRank = id === 2 ? 'V1' : id === 3 ? 'V5' : 'V32';

  return (
    <div
      className={`flex items-center select-none z-10 ${
        isTop ? 'flex-col gap-1.5' : 'flex-col items-center gap-1.5'
      }`}
    >
      {/* 玩家信息胶囊牌 (高度复刻黄金岛金框黑红椭圆胶囊) */}
      <div className="relative flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-b from-[#4a180e] via-[#2b0c07] to-[#140503] border-[1.5px] border-amber-400/90 shadow-[0_4px_12px_rgba(0,0,0,0.8)] shrink-0">
        {/* 操作/思考气泡 */}
        {actionBubble && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs sm:text-sm px-3 py-0.5 rounded-full shadow-2xl animate-bounce z-40 border-2 border-amber-500 whitespace-nowrap">
            {actionBubble}
          </div>
        )}

        {/* 庄家标志 (红底金字圆章) */}
        {isDealer && (
          <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-red-700 to-red-500 border border-amber-300 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow-md">
            庄
          </span>
        )}

        {/* 玩家昵称 */}
        <span className="text-xs sm:text-sm font-black text-amber-100 tracking-wide drop-shadow-sm">
          {name}
        </span>

        {/* VIP 标识金章 */}
        <span className="text-[10px] sm:text-[11px] font-black italic text-amber-300 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/40">
          {vipRank}
        </span>

        {/* 分数 */}
        <span className="text-xs font-mono font-black text-yellow-300 ml-1">
          {score}分
        </span>

        {/* 思考光圈 */}
        {isCurrentTurn && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" title="思考中" />
        )}
      </div>

      {/* 手牌与已亮面子区域 */}
      <div
        className={`flex items-center gap-2 ${
          isTop ? 'flex-row' : 'flex-col justify-center'
        }`}
      >
        {/* 副露面子 (暗杠全盖，吃牌放中间且对着各家朝向摆放) */}
        {melds.length > 0 && (
          <div
            className={`flex gap-1.5 p-1 rounded-xl bg-black/60 border border-amber-500/30 shrink-0 ${
              isTop ? 'flex-row' : 'flex-row items-center justify-center'
            }`}
          >
            {melds.map((meld, mIdx) => (
              <div
                key={mIdx}
                className={`flex rounded-lg p-1 bg-black/50 border border-amber-500/20 shadow-xs ${
                  isTop ? 'flex-row gap-0.5 items-center' : 'flex-col gap-0.5 items-center'
                }`}
              >
                {meld.tiles.map((tile, tIdx) => {
                  const isEatenTile = meld.type === 'chi' && tIdx === 1;

                  if (isTop) {
                    return (
                      <div
                        key={tIdx}
                        className={`relative flex items-center justify-center shrink-0 ${
                          isEatenTile ? 'ring-1 ring-amber-400 rounded-sm' : ''
                        }`}
                      >
                        <MahjongTile
                          tile={tile}
                          size="meld"
                          rotation={180}
                          isBack={meld.type === 'an_gang'}
                        />
                      </div>
                    );
                  }

                  // 上家 (left, 90°) 与 下家 (right, 270°)：纵向成列，横卧牌面对着他们自己，吃的牌放中间
                  return (
                    <div
                      key={tIdx}
                      className={`w-[36px] h-[26px] sm:w-[42px] sm:h-[30px] flex items-center justify-center relative shrink-0 ${
                        isEatenTile ? 'ring-1 ring-amber-400 rounded-xs' : ''
                      }`}
                    >
                      <MahjongTile
                        tile={tile}
                        size="discard-side"
                        rotation={isLeft ? 90 : 270}
                        isBack={meld.type === 'an_gang'}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* 黄金牌背立牌 */}
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

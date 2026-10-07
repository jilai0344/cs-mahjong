import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import { getTileKey } from '../types/mahjong.js';

/**
 * 黄金岛单家门前出牌池组件 (高度复刻黄金岛布局)
 * - 规则：每行/每列 6 张牌，严密贴合摆放，直接坐落于红丝绒台面
 * - 对家(top)：位于罗盘正上方，横排一行6张，面对对家(180°)
 * - 我家(bottom)：位于罗盘正下方，横排一行6张，面对玩家(0°)
 * - 上家(left)：位于罗盘正左方，竖排一列6张，面对上家(90°)
 * - 下家(right)：位于罗盘正右方，竖排一列6张，面对下家(270°)
 */
export function PlayerDiscardTray({
  playerId = 0,
  discards = [],
  lastDiscard = null,
  hoveredTile = null,
  position = 'bottom' // 'top' | 'bottom' | 'left' | 'right'
}) {
  const hoveredKey = hoveredTile ? getTileKey(hoveredTile) : null;
  const isHorizontal = position === 'top' || position === 'bottom';
  const isLeft = position === 'left';

  // P2-1 节奏动效：每家门前「最新一张」带一次落桌动效。
  // 注意不能用 lastDiscard 当判据 —— 它表示「刚打出、并且你可以吃碰胡的那张」（用于可操作高亮），
  // 自己打出的牌不会写进它，那样自己的出牌就没有节奏反馈了。这里按各自出牌序列的最后一张算。
  const newestId = discards.length ? discards[discards.length - 1].id : null;

  // 1. 上下横排 (一行6张，紧贴成行)
  if (isHorizontal) {
    return (
      <div className="flex flex-col items-center justify-center select-none z-10">
        {discards.length === 0 ? (
          <div className="h-6 w-32 flex items-center justify-center text-[10px] text-amber-200/20 italic">
            门前暂无出牌
          </div>
        ) : (
          <div className="inline-grid grid-cols-6 gap-[1.5px] sm:gap-[2px] items-center justify-center p-0.5">
            {discards.map((tile, idx) => {
              const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
              const isNewest = newestId !== null && tile.id === newestId;
              const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;
              const tileRotation = position === 'top' ? 180 : 0;

              return (
                /* P2-1 节奏动效：「刚打出的那张」带一次落桌动效（180ms ease-out）；只挂本家最新那张 */
                <div key={tile.id || idx} className={`relative flex items-center justify-center shrink-0${isNewest ? ' animate-tile-discard' : ''}`}>
                  <MahjongTile
                    tile={tile}
                    size="discard"
                    rotation={tileRotation}
                    highlight={isMatchHover}
                    className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-20 shadow-lg' : ''}
                  />
                  {isLatest && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-md animate-ping" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 2. 左右竖排 (一列6张，横卧对己)
  return (
    <div className="flex flex-col items-center justify-center select-none z-10">
      {discards.length === 0 ? (
        <div className="w-6 h-32 flex items-center justify-center text-[10px] text-amber-200/20 italic [writing-mode:vertical-rl]">
          暂无出牌
        </div>
      ) : (
        <div className="grid grid-flow-col grid-rows-6 gap-[1.5px] sm:gap-[2px] items-center justify-center p-0.5">
          {discards.map((tile, idx) => {
            const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
            const isNewest = newestId !== null && tile.id === newestId;
            const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;
            const tileRotation = isLeft ? 90 : 270;

            return (
              <div
                key={tile.id || idx}
                className={`w-[36px] h-[26px] sm:w-[42px] sm:h-[30px] flex items-center justify-center relative shrink-0${isNewest ? ' animate-tile-discard' : ''}`}
              >
                <MahjongTile
                  tile={tile}
                  size="discard-side"
                  rotation={tileRotation}
                  highlight={isMatchHover}
                  className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-20 shadow-lg' : ''}
                />
                {isLatest && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shadow-md animate-ping" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 完整四方中央出牌池组件：围绕中央罗盘紧密聚合 (黄金岛核心对局区)
 */
export default function DiscardPool({
  discardsByPlayer = [[], [], [], []], // 0: 我, 1: 下家, 2: 对家, 3: 上家
  lastDiscard = null,
  hoveredTile = null
}) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-1 select-none">
      {/* 顶部 (对家出牌：6张成行) */}
      <PlayerDiscardTray
        playerId={2}
        discards={discardsByPlayer[2]}
        lastDiscard={lastDiscard}
        hoveredTile={hoveredTile}
        position="top"
      />

      {/* 中部左右环绕区 (左上家，右下家) */}
      <div className="flex items-center justify-between w-full gap-2">
        <PlayerDiscardTray
          playerId={3}
          discards={discardsByPlayer[3]}
          lastDiscard={lastDiscard}
          hoveredTile={hoveredTile}
          position="left"
        />

        <PlayerDiscardTray
          playerId={1}
          discards={discardsByPlayer[1]}
          lastDiscard={lastDiscard}
          hoveredTile={hoveredTile}
          position="right"
        />
      </div>

      {/* 底部 (我的出牌：6张成行) */}
      <PlayerDiscardTray
        playerId={0}
        discards={discardsByPlayer[0]}
        lastDiscard={lastDiscard}
        hoveredTile={hoveredTile}
        position="bottom"
      />
    </div>
  );
}

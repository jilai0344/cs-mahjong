import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import { getTileKey } from '../types/mahjong.js';

/**
 * 玩家独立门前出牌池组件
 * 严格放置于各自手牌的正前方，一目了然
 */
export function PlayerDiscardTray({
  playerId,
  label = '',
  wind = '',
  discards = [],
  lastDiscard = null,
  hoveredTile = null,
  position = 'top' // 'top' | 'bottom' | 'left' | 'right'
}) {
  const hoveredKey = hoveredTile ? getTileKey(hoveredTile) : null;
  const isMe = playerId === 0;

  // 根据位置定义卡片边框、背景与栅格配置
  const isTopOrBottom = position === 'top' || position === 'bottom';

  return (
    <div
      className={`flex flex-col select-none transition-all duration-200 rounded-2xl p-2.5 sm:p-3 shadow-xl backdrop-blur-xs ${
        isMe
          ? 'bg-emerald-950/80 border-2 border-emerald-400/60 shadow-emerald-950/60'
          : 'bg-black/50 border border-emerald-500/40'
      } ${
        isTopOrBottom
          ? 'items-center w-full max-w-[760px] md:max-w-[860px] lg:max-w-[980px] xl:max-w-[1080px]'
          : position === 'left'
          ? 'items-start min-w-[220px] max-w-[360px] xl:max-w-[440px]'
          : 'items-end min-w-[220px] max-w-[360px] xl:max-w-[440px]'
      }`}
    >
      {/* 门前出牌标签与张数 (清晰大字) */}
      <div className={`flex items-center gap-2 mb-1.5 px-1 ${
        position === 'right' ? 'flex-row-reverse' : 'flex-row'
      }`}>
        <span
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shadow-sm ${
            isMe
              ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300/80'
              : 'bg-slate-800 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          {wind}
        </span>
        <span className={`text-sm sm:text-base font-black ${
          isMe ? 'text-amber-300' : 'text-slate-200'
        }`}>
          {label}出牌
        </span>
        <span className="text-xs sm:text-sm font-mono font-bold text-emerald-300/80">
          ({discards.length}张)
        </span>
      </div>

      {/* 牌张阵列：正前方一行12张 (超出自动换至下一行12张) */}
      <div
        className={`grid gap-1 sm:gap-1.5 min-h-[50px] items-center justify-items-center ${
          isTopOrBottom
            ? 'grid-cols-12 w-full max-w-[740px] md:max-w-[840px] lg:max-w-[960px] xl:max-w-[1060px]'
            : 'grid-cols-6'
        }`}
      >
        {discards.length === 0 ? (
          <div className={`${isTopOrBottom ? 'col-span-12' : 'col-span-6 xl:col-span-12'} text-center text-xs sm:text-sm text-emerald-200/30 font-semibold italic py-2`}>
            门前暂无出牌
          </div>
        ) : (
          discards.map((tile, idx) => {
            const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
            const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;
            // 其它三家下牌对着他自己，不是对着我
            const tileRotation =
              position === 'top'
                ? 180
                : position === 'left'
                ? 90
                : position === 'right'
                ? 270
                : 0;

            return (
              <div key={tile.id || idx} className="relative flex justify-center items-center">
                <MahjongTile
                  tile={tile}
                  size="discard"
                  rotation={tileRotation}
                  highlight={isMatchHover}
                  className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-10 shadow-md' : ''}
                />
                {/* 最新出牌醒目呼吸指示标 */}
                {isLatest && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-md animate-ping" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * 完整四方弃牌池组件 (兼顾整体调用场景)
 */
export default function DiscardPool({
  discardsByPlayer = [[], [], [], []], // 0: 我, 1: 下家, 2: 对家, 3: 上家
  lastDiscard = null,
  hoveredTile = null
}) {
  return (
    <div className="w-full flex flex-col items-center gap-2 select-none">
      <PlayerDiscardTray
        playerId={2}
        label="对家"
        wind="西"
        discards={discardsByPlayer[2]}
        lastDiscard={lastDiscard}
        hoveredTile={hoveredTile}
        position="top"
      />
      <div className="w-full flex items-center justify-between gap-4">
        <PlayerDiscardTray
          playerId={3}
          label="上家"
          wind="北"
          discards={discardsByPlayer[3]}
          lastDiscard={lastDiscard}
          hoveredTile={hoveredTile}
          position="left"
        />
        <PlayerDiscardTray
          playerId={1}
          label="下家"
          wind="南"
          discards={discardsByPlayer[1]}
          lastDiscard={lastDiscard}
          hoveredTile={hoveredTile}
          position="right"
        />
      </div>
      <PlayerDiscardTray
        playerId={0}
        label="我"
        wind="东"
        discards={discardsByPlayer[0]}
        lastDiscard={lastDiscard}
        hoveredTile={hoveredTile}
        position="bottom"
      />
    </div>
  );
}

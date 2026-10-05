import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import { getTileKey } from '../types/mahjong.js';

/**
 * 玩家独立门前出牌池组件
 * - 对家与我：横向摆放，一行12张
 * - 上家与下家：竖向摆放，一列6张成列，牌面横卧并对着各家自己
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
  const isTopOrBottom = position === 'top' || position === 'bottom';
  const isLeft = position === 'left';
  const isRight = position === 'right';

  // 1. 顶部 (对家) 与 底部 (我) 的横向出牌池 (紧密贴合摆放，一行12张)
  if (isTopOrBottom) {
    return (
      <div
        className={`flex flex-col select-none transition-all duration-200 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 shadow-xl backdrop-blur-xs items-center w-fit max-w-[96vw] ${
          isMe
            ? 'bg-emerald-950/90 border-2 border-emerald-400/60 shadow-emerald-950/60'
            : 'bg-black/60 border border-emerald-500/40'
        }`}
      >
        {/* 标题 */}
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <span
            className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-sm ${
              isMe
                ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-300/80'
                : 'bg-slate-800 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {wind}
          </span>
          <span className={`text-[11px] sm:text-xs font-black ${isMe ? 'text-amber-300' : 'text-slate-200'}`}>
            {label}出牌
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-300/80">
            ({discards.length}张)
          </span>
        </div>

        {/* 牌张紧密阵列：正前方一行12张，牌与牌之间紧密相贴 */}
        <div className="inline-grid grid-cols-12 gap-[1.5px] sm:gap-[2px] md:gap-1 items-center justify-center w-fit">
          {discards.length === 0 ? (
            <div className="col-span-12 text-center text-[11px] sm:text-xs text-emerald-200/30 font-semibold italic py-1 px-6">
              门前暂无出牌
            </div>
          ) : (
            discards.map((tile, idx) => {
              const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
              const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;
              // 对家牌面对着对家 (180°)，我出牌面对着我 (0°)
              const tileRotation = position === 'top' ? 180 : 0;

              return (
                <div key={tile.id || idx} className="relative flex justify-center items-center shrink-0">
                  <MahjongTile
                    tile={tile}
                    size="discard"
                    rotation={tileRotation}
                    highlight={isMatchHover}
                    className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-10 shadow-md' : ''}
                  />
                  {isLatest && (
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center justify-center">
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

  // 2. 左侧 (上家) 与 右侧 (下家) 的竖向出牌池 (一列6张，竖排对着他自己)
  return (
    <div
      className={`flex flex-col select-none transition-all duration-200 rounded-2xl p-2 sm:p-2.5 shadow-xl backdrop-blur-xs bg-black/55 border border-emerald-500/40 items-center shrink-0 min-h-[250px] ${
        isLeft ? 'items-start' : 'items-end'
      }`}
    >
      {/* 门前出牌标题 */}
      <div className={`flex items-center gap-1.5 mb-1.5 px-1 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-xs font-black shadow-sm">
          {wind}
        </span>
        <span className="text-xs font-black text-slate-200">
          {label}出牌
        </span>
        <span className="text-[11px] font-mono font-bold text-emerald-300/80">
          ({discards.length}张)
        </span>
      </div>

      {/* 牌张阵列：纵向每列6张，从上到下成列，横向向中央延展，牌面对着各家自己 */}
      {discards.length === 0 ? (
        <div className="flex items-center justify-center w-full py-8 text-xs text-emerald-200/30 font-semibold italic [writing-mode:vertical-rl] tracking-widest px-2">
          门前暂无出牌
        </div>
      ) : (
        <div className="grid grid-flow-col grid-rows-6 gap-1 sm:gap-1.5 items-center justify-items-center">
          {discards.map((tile, idx) => {
            const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
            const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;
            // 上家 90° (底边朝左对着上家)，下家 270° (底边朝右对着下家)
            const tileRotation = isLeft ? 90 : 270;

            return (
              <div
                key={tile.id || idx}
                className="w-[38px] h-[28px] sm:w-[44px] sm:h-[32px] flex items-center justify-center relative shrink-0"
              >
                <MahjongTile
                  tile={tile}
                  size="discard-side"
                  rotation={tileRotation}
                  highlight={isMatchHover}
                  className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-10 shadow-md' : ''}
                />
                {isLatest && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center justify-center">
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

import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import { getTileKey } from '../types/mahjong.js';

export default function DiscardPool({
  discardsByPlayer = [[], [], [], []], // 0: 我, 1: 下家, 2: 对家, 3: 上家
  lastDiscard = null,
  hoveredTile = null,
  players = []
}) {
  const hoveredKey = hoveredTile ? getTileKey(hoveredTile) : null;

  // 严格按出牌方位排布：对家 (顶), 上家 (左), 下家 (右), 我 (底)
  const playerRows = [
    { id: 2, label: '对家', wind: '西' },
    { id: 3, label: '上家', wind: '北' },
    { id: 1, label: '下家', wind: '南' },
    { id: 0, label: '我', wind: '东' }
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between py-1 px-2 select-none">
      {playerRows.map((pRow) => {
        const discards = discardsByPlayer[pRow.id] || [];
        const isCurrentActive = lastDiscard && lastDiscard.fromPlayer === pRow.id;

        return (
          <div
            key={pRow.id}
            className={`flex items-center gap-2.5 p-1.5 rounded-2xl transition-all ${
              pRow.id === 0 ? 'bg-emerald-950/60 border-2 border-emerald-400/40 shadow-md' : 'bg-black/25'
            }`}
          >
            {/* 玩家出牌行标签 (大号醒目字体翻倍) */}
            <div className="flex items-center gap-1.5 min-w-[70px] shrink-0">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-black shadow-sm ${
                pRow.id === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-emerald-300 border border-emerald-500/30'
              }`}>
                {pRow.wind}
              </span>
              <span className={`text-sm sm:text-base font-black truncate ${
                pRow.id === 0 ? 'text-amber-300' : 'text-slate-200'
              }`}>
                {pRow.label}
              </span>
            </div>

            {/* 一行12张的大号弃牌阵列 (严格12列排布) */}
            <div className="flex-1 grid grid-cols-12 gap-1 max-w-[520px] min-h-[46px] items-center">
              {discards.length === 0 ? (
                <div className="col-span-12 text-xs sm:text-sm text-emerald-200/30 font-semibold italic py-1">
                  暂无弃牌
                </div>
              ) : (
                discards.map((tile, idx) => {
                  const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
                  const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;

                  return (
                    <div key={tile.id || idx} className="relative flex justify-center items-center">
                      <MahjongTile
                        tile={tile}
                        size="discard"
                        highlight={isMatchHover}
                        className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-10' : ''}
                      />
                      {/* 最新出牌指示标 */}
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
      })}
    </div>
  );
}

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
    <div className="w-full h-full flex flex-col justify-between py-2 px-3 select-none">
      {playerRows.map((pRow) => {
        const discards = discardsByPlayer[pRow.id] || [];
        const isCurrentActive = lastDiscard && lastDiscard.fromPlayer === pRow.id;

        return (
          <div
            key={pRow.id}
            className={`flex items-center gap-2 p-1 rounded-xl transition-all ${
              pRow.id === 0 ? 'bg-emerald-950/40 border border-emerald-500/20' : 'bg-black/20'
            }`}
          >
            {/* 玩家出牌行标签 */}
            <div className="flex items-center gap-1 min-w-[58px] shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                pRow.id === 0 ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-emerald-300'
              }`}>
                {pRow.wind}
              </span>
              <span className={`text-[11px] font-bold truncate ${
                pRow.id === 0 ? 'text-amber-300' : 'text-slate-300'
              }`}>
                {pRow.label}
              </span>
            </div>

            {/* 一行12张的弃牌阵列 (严格12列排布，超出自动换行) */}
            <div className="flex-1 grid grid-cols-12 gap-0.5 sm:gap-1 max-w-[420px] min-h-[40px] items-center">
              {discards.length === 0 ? (
                <div className="col-span-12 text-[10px] text-emerald-200/20 italic py-1">
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
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-md animate-ping" />
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

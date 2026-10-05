import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import { getTileKey } from '../types/mahjong.js';

export default function DiscardPool({
  discardsByPlayer = [[], [], [], []], // 0: 我, 1: 下家, 2: 对家, 3: 上家
  lastDiscard = null,
  hoveredTile = null
}) {
  const hoveredKey = hoveredTile ? getTileKey(hoveredTile) : null;

  // 渲染单个方位的弃牌阵列
  const renderDiscardGroup = (playerId, maxCols = 6) => {
    const discards = discardsByPlayer[playerId] || [];
    if (discards.length === 0) return null;

    return (
      <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}>
        {discards.map((tile, idx) => {
          const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
          const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;

          return (
            <div key={tile.id || idx} className="relative transition-transform">
              <MahjongTile
                tile={tile}
                size="discard"
                highlight={isMatchHover}
                className={isLatest ? 'ring-2 ring-amber-400 scale-105 z-10' : ''}
              />
              {/* 最新打出的高亮呼吸光点 */}
              {isLatest && (
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-20">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-md animate-ping" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* 对家弃牌 (上方) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {renderDiscardGroup(2, 6)}
      </div>

      {/* 我的弃牌 (下方) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {renderDiscardGroup(0, 6)}
      </div>

      {/* 上家弃牌 (左侧) */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
        {renderDiscardGroup(3, 3)}
      </div>

      {/* 下家弃牌 (右侧) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
        {renderDiscardGroup(1, 3)}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import MahjongTile from './MahjongTile.jsx';
import { sound } from '../utils/audio.js';

export default function PlayerHand({
  handTiles = [],
  melds = [],
  drawnTile = null,
  isMyTurn = false,
  tingMap = new Map(),
  onDiscard = null,
  onHoverTile = null,
  showJiangBadge = false
}) {
  const [selectedTileId, setSelectedTileId] = useState(null);

  const handleTileClick = (tile) => {
    if (!isMyTurn) return;

    sound.playTileTouch();

    if (selectedTileId === tile.id) {
      if (onDiscard) {
        onDiscard(tile);
        setSelectedTileId(null);
      }
    } else {
      setSelectedTileId(tile.id);
    }
  };

  const handleMouseEnter = (tile) => {
    if (onHoverTile) onHoverTile(tile);
  };

  const handleMouseLeave = () => {
    if (onHoverTile) onHoverTile(null);
  };

  // 分离常规手牌与最新摸牌
  const regularTiles = drawnTile 
    ? handTiles.filter(t => t.id !== drawnTile.id)
    : handTiles;

  return (
    <div className="flex flex-col items-center justify-end w-full px-2 select-none">
      {/* 听牌详情提示气泡 */}
      {selectedTileId && tingMap.has(selectedTileId) && (
        <div className="mb-2 px-5 py-2.5 rounded-2xl bg-slate-900/95 border-2 border-amber-400/60 shadow-2xl backdrop-blur-md flex items-center gap-3 text-sm sm:text-base text-amber-200 animate-fade-in">
          <span className="font-black text-amber-400 text-base sm:text-lg">听牌待胡：</span>
          <div className="flex items-center gap-2 flex-wrap">
            {tingMap.get(selectedTileId).map((w, idx) => (
              <span key={idx} className="bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-400/40 text-emerald-300 font-bold text-sm sm:text-base">
                {w.tile.name} ({w.remaining}张)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end justify-center gap-4 max-w-full overflow-x-auto pb-1">
        {/* 左侧：已亮出的吃碰杠面子 (副露) */}
        {melds.length > 0 && (
          <div className="flex items-end gap-2 pr-3 border-r-2 border-emerald-400/30 shrink-0">
            {melds.map((meld, mIdx) => (
              <div key={mIdx} className="flex items-end bg-black/40 p-1.5 rounded-lg border border-emerald-500/30 gap-1 shadow-md">
                {meld.tiles.map((tile, tIdx) => (
                  <MahjongTile
                    key={tIdx}
                    tile={tile}
                    size="meld"
                    showJiangBadge={showJiangBadge}
                    isBack={meld.type === 'an_gang' && tIdx > 0 && tIdx < 3}
                  />
                ))}
                <span className="text-xs sm:text-sm text-emerald-300 font-black ml-1 self-center bg-emerald-900/60 px-1.5 py-0.5 rounded">
                  {meld.type === 'chi' ? '吃' : meld.type === 'peng' ? '碰' : '杠'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 中间：立手牌 (使用 hand 尺寸，大而清澈) */}
        <div className="flex items-end gap-1 shrink-0">
          {regularTiles.map(tile => {
            const isSelected = selectedTileId === tile.id;
            const tingInfo = tingMap.get(tile.id);
            const isTing = !!tingInfo;
            const tingOuts = isTing ? tingInfo.reduce((sum, item) => sum + item.remaining, 0) : null;

            return (
              <MahjongTile
                key={tile.id}
                tile={tile}
                size="hand"
                selected={isSelected}
                isTing={isTing}
                tingCount={tingOuts}
                showJiangBadge={showJiangBadge}
                onClick={() => handleTileClick(tile)}
                onMouseEnter={() => handleMouseEnter(tile)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </div>

        {/* 右侧：单张摸入的手牌 (与常规手牌拉开微距) */}
        {drawnTile && (
          <div className="flex items-end pl-3 shrink-0">
            <MahjongTile
              tile={drawnTile}
              size="hand"
              selected={selectedTileId === drawnTile.id}
              isTing={tingMap.has(drawnTile.id)}
              tingCount={tingMap.get(drawnTile.id)?.reduce((sum, item) => sum + item.remaining, 0)}
              showJiangBadge={showJiangBadge}
              onClick={() => handleTileClick(drawnTile)}
              onMouseEnter={() => handleMouseEnter(drawnTile)}
              onMouseLeave={handleMouseLeave}
              className="ring-2 ring-amber-400"
            />
          </div>
        )}
      </div>

      {/* 出牌提示条 */}
      {isMyTurn && (
        <div className="text-sm sm:text-base text-emerald-200/90 font-bold mt-1.5 animate-pulse">
          {selectedTileId ? '✦ 再次点击打出选中的牌' : '✦ 点击选择一张牌打出'}
        </div>
      )}
    </div>
  );
}

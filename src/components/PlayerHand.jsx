import React, { useRef, useState } from 'react';
import MahjongTile from './MahjongTile.jsx';
import { sound } from '../utils/audio.js';
import { createDiscardGuard, discardHint } from '../game/discardGuard.js';

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
  const [tooFast, setTooFast] = useState(false);
  const [isDraggingTile, setIsDraggingTile] = useState(false);
  // P2-1 防误触：第一次点击只选中；再点同一张必须间隔 ≥250ms（双击不会误打出）；
  // 也可以用显式「打出」按钮，点哪张打哪张。
  const [guard] = useState(() => createDiscardGuard());
  const tooFastTimerRef = useRef(null);

  const doDiscard = (tile) => {
    if (onDiscard) onDiscard(tile);
    guard.clear();
    setSelectedTileId(null);
    setTooFast(false);
  };

  const handleTileClick = (tile) => {
    if (!isMyTurn) return;

    sound.playTileTouch();

    // 事件处理函数内调用状态机（纯函数逻辑由 test/discardGuard.test.js 覆盖）。
    // eslint-disable-next-line react/purity
    const res = guard.select(tile.id, Date.now());
    if (res.action === 'discard') {
      if (res.allowed) {
        doDiscard(tile);
      } else {
        setTooFast(true);
        if (tooFastTimerRef.current) clearTimeout(tooFastTimerRef.current);
        tooFastTimerRef.current = setTimeout(() => setTooFast(false), 1500);
      }
    } else {
      setSelectedTileId(tile.id);
    }
  };

  const handleExplicitDiscard = () => {
    const id = guard.selected();
    const tile = handTiles.find((t) => t.id === id) || (drawnTile && drawnTile.id === id ? drawnTile : null);
    if (tile && guard.requestExplicit(id).allowed) doDiscard(tile);
  };

  const handleMouseEnter = (tile) => {
    if (onHoverTile) onHoverTile(tile);
  };

  const handleMouseLeave = () => {
    if (onHoverTile) onHoverTile(null);
  };

  const regularTiles = drawnTile
    ? handTiles.filter((t) => t.id !== drawnTile.id)
    : handTiles;

  // 竖屏流式布局：总牌数（副露牌 + 手牌 + 摸牌），用于 CSS calc() 均分宽度
  const totalTiles = melds.reduce((n, m) => n + m.tiles.length, 0) + regularTiles.length + (drawnTile ? 1 : 0);

  return (
    <div className="player-hand flex w-full select-none flex-col items-center justify-end px-2">
      {/* 听牌详情 */}
      {selectedTileId && tingMap.has(selectedTileId) && (
        <div className="animate-fade-in mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/95 px-4 py-2 text-sm text-stone-700 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-stone-500">听牌待胡</span>
          {tingMap.get(selectedTileId).map((w, idx) => (
            <span
              key={idx}
              className="rounded-full border border-[var(--color-jade-200)] bg-[var(--color-jade-200)]/35 px-2 py-0.5 text-xs font-semibold text-[var(--color-jade-600)]"
            >
              {w.tile.name} · 余 {w.remaining}
            </span>
          ))}
        </div>
      )}

      <div
        className={`ph-row flex w-full max-w-full items-end justify-center gap-3 pb-1 ${isDraggingTile ? 'overflow-visible' : 'overflow-x-auto'}`}
        style={{ '--ph-n': Math.max(totalTiles, 1) }}
      >
        {/* 副露：一块很轻的纸片托住，不抢牌面 */}
        {melds.length > 0 && (
          <div className="ph-melds-wrap flex shrink-0 items-end gap-2 border-r border-white/20 pr-3">
            {melds.map((meld, mIdx) => (
              <div
                key={mIdx}
                className="ph-meld-group flex items-end gap-1 rounded-lg border border-white/15 bg-white/10 p-1"
              >
                {meld.tiles.map((tile, tIdx) => (
                  <MahjongTile
                    key={tIdx}
                    tile={tile}
                    size="meld"
                    showJiangBadge={showJiangBadge}
                    lying
                    isBack={meld.type === 'an_gang' && tIdx > 0 && tIdx < 3}
                    className={`ph-tile ${meld.type === 'chi' && tIdx === 1 ? 'ring-1 ring-white/80 rounded-[10px]' : ''}`}
                  />
                ))}
                <span className="ph-meld-badge ml-1 self-center rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/85">
                  {meld.type === 'chi' ? '吃' : meld.type === 'peng' ? '碰' : '杠'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 立牌 */}
        <div className="ph-hand flex shrink-0 items-end gap-1">
          {regularTiles.map((tile, idx) => {
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
                onDragDiscard={isMyTurn ? doDiscard : null}
                onDragStateChange={setIsDraggingTile}
                onMouseEnter={() => handleMouseEnter(tile)}
                onMouseLeave={handleMouseLeave}
                className="ph-tile animate-deal-in"
                style={{ animationDelay: `${Math.min(idx, 10) * 12}ms` }}
              />
            );
          })}
        </div>

        {/* 摸牌：与立牌留一道缝，以插入动效强调这是刚摸的 */}
        {drawnTile && (
          <div key={drawnTile.id} className="ph-drawn animate-tile-draw flex shrink-0 items-end pl-2">
            <MahjongTile
              tile={drawnTile}
              size="hand"
              selected={selectedTileId === drawnTile.id}
              isTing={tingMap.has(drawnTile.id)}
              tingCount={tingMap.get(drawnTile.id)?.reduce((sum, item) => sum + item.remaining, 0)}
              showJiangBadge={showJiangBadge}
              onClick={() => handleTileClick(drawnTile)}
              onDragDiscard={isMyTurn ? doDiscard : null}
              onDragStateChange={setIsDraggingTile}
              onMouseEnter={() => handleMouseEnter(drawnTile)}
              onMouseLeave={handleMouseLeave}
              className="ph-tile"
            />
          </div>
        )}
      </div>

      {/* 出牌提示 + 显式「打出」 */}
      {isMyTurn && (
        <div className="mt-1.5 flex items-center gap-3">
          <div className={`text-xs font-medium ${tooFast ? 'text-rose-300' : 'text-white/75'}`}>
            {discardHint(selectedTileId, tooFast)}
            <span className="ml-1.5 hidden text-[10px] font-normal text-white/45 sm:inline">
              · 向上拖动也可直接打出
            </span>
          </div>
          {selectedTileId && (
            <button
              type="button"
              onClick={handleExplicitDiscard}
              className="rounded-full bg-white px-4 py-1 text-xs font-bold text-stone-900 shadow-md transition-transform active:scale-95"
              title="打出当前选中的这张牌（不会误打别的牌）"
            >
              打出
            </button>
          )}
        </div>
      )}
    </div>
  );
}

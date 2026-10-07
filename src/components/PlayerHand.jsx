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
  // P2-1 防误触：第一次点击只选中；再点同一张必须间隔 ≥250ms（双击不会误打出）；
  // 也可以用显式「打出」按钮，点哪张打哪张。状态机用 useState 惰性创建（稳定实例，且避免
  // 在 render 里直接 new 对象触发 react(purity)）。
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

    // 这里是事件处理函数（不是 render）：状态机只在这里被调用，纯函数逻辑本身在
    // src/game/discardGuard.js 里由 test/discardGuard.test.js 覆盖。
    // oxlint 的 react(purity) 无法识别「工厂返回对象的成员方法」，故显式豁免。
    // eslint-disable-next-line react/purity
    const res = guard.select(tile.id, Date.now());
    if (res.action === 'discard') {
      if (res.allowed) {
        doDiscard(tile);
      } else {
        // 手滑保护：连点/双击不打出，给出明确反馈
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

  // 分离常规手牌与最新摸牌
  const regularTiles = drawnTile 
    ? handTiles.filter(t => t.id !== drawnTile.id)
    : handTiles;

  return (
    <div className="player-hand flex flex-col items-center justify-end w-full px-2 select-none">
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

      <div className="ph-row flex items-end justify-center gap-4 max-w-full overflow-x-auto pb-1">
        {/* 左侧：已亮出的吃碰杠面子 (副露) */}
        {melds.length > 0 && (
          <div className="ph-melds-wrap flex items-end gap-2 pr-3 border-r-2 border-emerald-400/30 shrink-0">
            {melds.map((meld, mIdx) => (
              <div key={mIdx} className="ph-meld-group flex items-end bg-black/40 p-1.5 rounded-lg border border-emerald-500/30 gap-1 shadow-md">
                {meld.tiles.map((tile, tIdx) => (
                  <MahjongTile
                    key={tIdx}
                    tile={tile}
                    size="meld"
                    showJiangBadge={showJiangBadge}
                    isBack={meld.type === 'an_gang' && tIdx > 0 && tIdx < 3}
                    className={`ph-tile ${meld.type === 'chi' && tIdx === 1 ? 'ring-2 ring-amber-400 rounded-md shadow-md' : ''}`}
                  />
                ))}
                <span className="ph-meld-badge text-xs sm:text-sm text-emerald-300 font-black ml-1 self-center bg-emerald-900/60 px-1.5 py-0.5 rounded">
                  {meld.type === 'chi' ? '吃' : meld.type === 'peng' ? '碰' : '杠'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 中间：立手牌 (使用 hand 尺寸，大而清澈) */}
        <div className="ph-hand flex items-end gap-1 shrink-0">
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
                className="ph-tile"
              />
            );
          })}
        </div>

        {/* 右侧：单张摸入的手牌 (与常规手牌拉开微距)
            P2-1 节奏动效：以牌 id 为 key ⇒ 每次摸到新牌都重播一次「右侧滑入 + 淡入」（180ms ease-out）。
            只作用于这个包裹层，避免与 MahjongTile 自身的选中/听牌 transform 打架。 */}
        {drawnTile && (
          <div key={drawnTile.id} className="ph-drawn flex items-end pl-3 shrink-0 animate-tile-draw">
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
              className="ph-tile ring-2 ring-amber-400"
            />
          </div>
        )}
      </div>

      {/* 出牌提示条 + 显式「打出」按钮（P2-1：说清怎么打，并防手滑） */}
      {isMyTurn && (
        <div className="flex items-center gap-3 mt-1.5">
          <div className={`text-sm sm:text-base font-bold ${tooFast ? 'text-amber-300' : 'text-emerald-200/90'}`}>
            {discardHint(selectedTileId, tooFast)}
          </div>
          {selectedTileId && (
            <button
              type="button"
              onClick={handleExplicitDiscard}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-black shadow-md border border-emerald-300/60 active:scale-95 transition-all"
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

import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import { getTileKey } from '../types/mahjong.js';

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * 单家门前出牌池。
 * 每 6 张为一组、整组居中：1 张时落在罗盘正前方，不会偏到一侧；
 * 超过 6 张再起第二组（横排是第二行，竖排是第二列）。
 */
export function PlayerDiscardTray({
  playerId: _playerId = 0,
  discards = [],
  lastDiscard = null,
  hoveredTile = null,
  position = 'bottom'
}) {
  const hoveredKey = hoveredTile ? getTileKey(hoveredTile) : null;
  const isHorizontal = position === 'top' || position === 'bottom';
  const isLeft = position === 'left';

  // P2-1 节奏动效：按「本家门前最新一张」判定，不能用 lastDiscard。
  const newestId = discards.length ? discards[discards.length - 1].id : null;

  const renderTile = (tile, idx, tileRotation, extraClass = '') => {
    const isLatest = lastDiscard && lastDiscard.tile?.id === tile.id;
    const isNewest = newestId !== null && tile.id === newestId;
    const isMatchHover = hoveredKey && getTileKey(tile) === hoveredKey;

    return (
      <div
        key={tile.id || idx}
        className={`relative flex shrink-0 items-center justify-center${isNewest ? ' animate-tile-discard' : ''} ${extraClass}`}
      >
        <MahjongTile
          tile={tile}
          size={isHorizontal ? 'discard' : 'discard-side'}
          rotation={tileRotation}
          highlight={isMatchHover}
          className={isLatest ? 'rounded-[10px] ring-2 ring-white/90 z-20' : ''}
        />
        {isLatest && (
          <span
            className={`pointer-events-none absolute z-30 rounded-full bg-rose-400/90 ${
              isHorizontal
                ? '-top-1 left-1/2 h-0.5 w-4 -translate-x-1/2'
                : 'top-1/2 h-0.5 w-4 -translate-y-1/2 rotate-90 ' + (isLeft ? '-right-1' : '-left-1')
            }`}
          />
        )}
      </div>
    );
  };

  if (isHorizontal) {
    if (discards.length === 0) {
      return (
        <div className="z-10 flex select-none flex-col items-center justify-center">
          <div className="flex h-6 w-28 items-center justify-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 w-1 rounded-full bg-white/20" />
            ))}
          </div>
        </div>
      );
    }

    const rows = chunk(discards, 6);
    const tileRotation = 0;

    return (
      <div className="z-10 flex select-none flex-col items-center justify-center gap-[2px]">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center justify-center gap-[2px]">
            {row.map((tile, idx) => renderTile(tile, rowIdx * 6 + idx, tileRotation))}
          </div>
        ))}
      </div>
    );
  }

  if (discards.length === 0) {
    return (
      <div className="z-10 flex select-none flex-col items-center justify-center">
        <div className="flex h-28 w-6 flex-col items-center justify-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>
    );
  }

  const cols = chunk(discards, 6);
  const tileRotation = 0;

  return (
    <div className="z-10 flex select-none items-center justify-center gap-[2px]">
      {cols.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col items-center justify-center gap-[2px]">
          {col.map((tile, idx) => renderTile(tile, colIdx * 6 + idx, tileRotation, 'h-[26px] w-[36px] sm:h-[30px] sm:w-[42px]'))}
        </div>
      ))}
    </div>
  );
}

/**
 * 四方中央出牌池（保留对外接口，便于单独预览）。
 */
export default function DiscardPool({
  discardsByPlayer = [[], [], [], []],
  lastDiscard = null,
  hoveredTile = null
}) {
  return (
    <div className="relative flex select-none flex-col items-center justify-center gap-1">
      <PlayerDiscardTray
        playerId={2}
        discards={discardsByPlayer[2]}
        lastDiscard={lastDiscard}
        hoveredTile={hoveredTile}
        position="top"
      />

      <div className="flex w-full items-center justify-between gap-2">
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

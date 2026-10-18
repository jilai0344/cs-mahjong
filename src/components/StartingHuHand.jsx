import React from 'react';
import MahjongTile from './MahjongTile.jsx';

const ANGLE = {
  bottom: 0,
  top: 180,
  left: 90,
  right: -90
};

const TILE_W = 28;
const TILE_H = 39;
const GAP = 2;

/**
 * 起手胡公开手牌：一张挨一张排成一列（对玩家来说就是自己面前的一排），
 * 整排按座位旋转，让牌面正对胡家，而不是摊成一块 3×5 的牌阵。
 */
export default function StartingHuHand({ hand = [], facing = 'bottom' }) {
  if (!hand || hand.length === 0) return null;

  const angle = ANGLE[facing] ?? 0;
  const side = facing === 'left' || facing === 'right';
  const lineW = hand.length * TILE_W + (hand.length - 1) * GAP;
  const lineH = TILE_H;
  const outerW = side ? lineH + 8 : lineW + 8;
  const outerH = side ? lineW + 8 : lineH + 8;

  return (
    <div className="starting-hu-hand relative shrink-0" style={{ width: outerW, height: outerH }}>
      <div
        className="absolute left-1/2 top-1/2 flex items-center"
        style={{
          width: lineW,
          height: lineH,
          gap: GAP,
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          transformOrigin: 'center'
        }}
      >
        {hand.map((tile, idx) => (
          <MahjongTile key={`${tile.id || idx}-${idx}`} tile={tile} size="mini" className="shrink-0" />
        ))}
      </div>
    </div>
  );
}

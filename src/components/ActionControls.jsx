import React, { useState } from 'react';
import MahjongTile from './MahjongTile.jsx';
import { sound } from '../utils/audio.js';

export default function ActionControls({
  availableActions = {},
  chiOptions = [],
  kongOptions = [],
  onHu = null,
  onSiXi = null,
  onGang = null,
  onPeng = null,
  onChi = null,
  onPass = null
}) {
  const [showChiPicker, setShowChiPicker] = useState(false);
  const [showKongPicker, setShowKongPicker] = useState(false);

  const hasAnyAction = Object.values(availableActions).some(Boolean);
  if (!hasAnyAction) return null;

  const handleChiClick = () => {
    sound.playTileTouch();
    if (chiOptions.length === 1) {
      if (onChi) onChi(chiOptions[0]);
    } else if (chiOptions.length > 1) {
      setShowChiPicker(true);
    }
  };

  const handleGangClick = () => {
    sound.playTileTouch();
    if (kongOptions.length === 1) {
      if (onGang) onGang(kongOptions[0]);
    } else if (kongOptions.length > 1) {
      setShowKongPicker(true);
    }
  };

  return (
    <div className="action-controls relative z-30 flex flex-col items-center gap-2">
      {/* 吃牌选择 */}
      {showChiPicker && chiOptions.length > 1 && (
        <div className="animate-scale-up flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-xl">
          <span className="text-xs font-semibold text-stone-500">选择一组吃牌</span>
          <div className="flex gap-2">
            {chiOptions.map((group, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onChi) onChi(group);
                  setShowChiPicker(false);
                }}
                className="flex cursor-pointer gap-0.5 rounded-xl border border-stone-200 bg-stone-50 p-1.5 transition-colors hover:border-[var(--color-jade-500)] hover:bg-white"
              >
                {group.map((tile, tIdx) => (
                  <MahjongTile key={tIdx} tile={tile} size="sm" />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 杠牌选择 */}
      {showKongPicker && kongOptions.length > 1 && (
        <div className="animate-scale-up flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-xl">
          <span className="text-xs font-semibold text-stone-500">选择要开的杠</span>
          <div className="flex gap-2">
            {kongOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onGang) onGang(opt);
                  setShowKongPicker(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2 transition-colors hover:border-[var(--color-jade-500)] hover:bg-white"
              >
                <MahjongTile tile={opt.tile} size="sm" />
                <span className="text-xs font-semibold text-stone-600">
                  {opt.type === 'an' ? '暗杠' : opt.type === 'bu' ? '补杠' : '明杠'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="animate-fade-in-up flex items-center gap-2 rounded-full border border-white/60 bg-white/90 p-1.5 pl-2.5 shadow-xl backdrop-blur">
        {availableActions.siXi && (
          <button
            onClick={() => {
              sound.playHu();
              if (onSiXi) onSiXi();
            }}
            className="flex h-10 items-center justify-center rounded-full bg-[var(--color-jade-600)] px-5 text-base font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          >
            四喜
          </button>
        )}

        {availableActions.hu && (
          <button
            onClick={() => {
              sound.playHu();
              if (onHu) onHu();
            }}
            className="flex h-11 items-center justify-center rounded-full bg-rose-600 px-7 text-lg font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-95"
          >
            胡
          </button>
        )}

        {availableActions.gang && (
          <button
            onClick={handleGangClick}
            className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-5 text-base font-semibold text-stone-800 transition-colors hover:border-[var(--color-jade-500)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold-200)]" />
            杠
          </button>
        )}

        {availableActions.peng && (
          <button
            onClick={() => {
              sound.playMeld('peng');
              if (onPeng) onPeng();
            }}
            className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-5 text-base font-semibold text-stone-800 transition-colors hover:border-[var(--color-jade-500)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-jade-600)]" />
            碰
          </button>
        )}

        {availableActions.chi && (
          <button
            onClick={handleChiClick}
            className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-5 text-base font-semibold text-stone-800 transition-colors hover:border-[var(--color-jade-500)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-violet-600)]" />
            吃
          </button>
        )}

        {availableActions.pass && (
          <button
            onClick={() => {
              sound.playTileTouch();
              if (onPass) onPass();
            }}
            className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            过
          </button>
        )}
      </div>
    </div>
  );
}

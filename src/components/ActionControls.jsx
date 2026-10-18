import React, { useState } from 'react';
import MahjongTile from './MahjongTile.jsx';
import { sound } from '../utils/audio.js';

const TONES = {
  hu: 'text-rose-600',
  gang: 'text-amber-600',
  peng: 'text-[var(--color-jade-600)]',
  chi: 'text-[var(--color-violet-600)]',
  xi: 'text-rose-500'
};

function ActionKey({ char, label, tone, onClick, primary = false, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`group relative flex shrink-0 flex-col items-center justify-center rounded-[22px] font-semibold transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
        primary
          ? 'h-[92px] w-[92px] bg-rose-600 text-white shadow-[0_16px_40px_rgba(190,60,50,0.45)] ring-4 ring-rose-200/70 sm:h-[116px] sm:w-[116px]'
          : 'h-[72px] w-[72px] border border-stone-200 bg-white shadow-md sm:h-[92px] sm:w-[92px]'
      }`}
    >
      <span className={`font-brush leading-none ${primary ? 'text-[52px] sm:text-[66px]' : `text-[38px] sm:text-[48px] ${TONES[tone] || ''}`}`}>
        {char}
      </span>
      <span className={`mt-0.5 text-[9px] font-bold tracking-[0.08em] ${primary ? 'text-white/80' : 'text-stone-400'}`}>
        {label}
      </span>
    </button>
  );
}

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

      <div className="animate-action-dock flex flex-col items-center">
        <div className="flex flex-wrap items-end justify-center gap-2.5 rounded-[28px] border border-white/75 bg-white/95 p-2.5 shadow-[0_20px_55px_rgba(20,40,32,0.32)] backdrop-blur">
          {availableActions.siXi && (
            <ActionKey
              char="喜"
              label="四喜"
              tone="xi"
              ariaLabel="中途四喜"
              onClick={() => {
                sound.playHu();
                if (onSiXi) onSiXi();
              }}
            />
          )}

          {availableActions.hu && (
            <ActionKey
              char="胡"
              label="胡牌"
              tone="hu"
              primary
              ariaLabel="胡牌"
              onClick={() => {
                sound.playHu();
                if (onHu) onHu();
              }}
            />
          )}

          {availableActions.gang && (
            <ActionKey
              char="杠"
              label="杠牌"
              tone="gang"
              ariaLabel="杠牌"
              onClick={handleGangClick}
            />
          )}

          {availableActions.peng && (
            <ActionKey
              char="碰"
              label="碰牌"
              tone="peng"
              ariaLabel="碰牌"
              onClick={() => {
                sound.playMeld('peng');
                if (onPeng) onPeng();
              }}
            />
          )}

          {availableActions.chi && (
            <ActionKey
              char="吃"
              label="吃牌"
              tone="chi"
              ariaLabel="吃牌"
              onClick={handleChiClick}
            />
          )}

          {availableActions.pass && (
            <button
              type="button"
              onClick={() => {
                sound.playTileTouch();
                if (onPass) onPass();
              }}
              className="flex h-[54px] items-center justify-center rounded-full px-3 text-sm font-semibold text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              过
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

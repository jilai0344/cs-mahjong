import React, { useState } from 'react';
import MahjongTile from './MahjongTile';
import { sound } from '../utils/audio';

export default function ActionControls({
  availableActions = {}, // { hu: boolean, gang: boolean, peng: boolean, chi: boolean, pass: boolean }
  chiOptions = [], // Array of [tile1, tile2, tile3]
  kongOptions = [], // Array of kong options
  onHu = null,
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
    <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
      {/* 多组吃牌选择弹窗 */}
      {showChiPicker && chiOptions.length > 1 && (
        <div className="bg-slate-900/95 border border-emerald-400/40 p-3 rounded-xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-2 animate-scale-up">
          <span className="text-xs text-emerald-200 font-semibold">请选择一组吃牌：</span>
          <div className="flex gap-3">
            {chiOptions.map((group, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onChi) onChi(group);
                  setShowChiPicker(false);
                }}
                className="flex gap-0.5 p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-800/80 border border-emerald-400/30 cursor-pointer transition-all hover:scale-105 shadow-md"
              >
                {group.map((tile, tIdx) => (
                  <MahjongTile key={tIdx} tile={tile} size="sm" />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 多组杠牌选择弹窗 */}
      {showKongPicker && kongOptions.length > 1 && (
        <div className="bg-slate-900/95 border border-amber-400/40 p-3 rounded-xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-2 animate-scale-up">
          <span className="text-xs text-amber-200 font-semibold">请选择杠哪张牌：</span>
          <div className="flex gap-3">
            {kongOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onGang) onGang(opt);
                  setShowKongPicker(false);
                }}
                className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/60 hover:bg-amber-800/80 border border-amber-400/30 cursor-pointer transition-all hover:scale-105 shadow-md"
              >
                <MahjongTile tile={opt.tile} size="sm" />
                <span className="text-xs font-bold text-amber-300">
                  {opt.type === 'an' ? '暗杠' : opt.type === 'bu' ? '补杠' : '明杠'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 现代胶囊操作按钮栏 */}
      <div className="flex items-center gap-3 bg-slate-950/80 p-2 px-4 rounded-full border border-emerald-400/30 shadow-2xl backdrop-blur-xl animate-fade-in-up">
        {/* 胡牌 */}
        {availableActions.hu && (
          <button
            onClick={() => {
              sound.playHu();
              if (onHu) onHu();
            }}
            className="flex items-center justify-center px-6 py-2.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-lg shadow-lg ring-2 ring-red-400/80 hover:scale-110 active:scale-95 transition-all duration-150 animate-pulse"
          >
            胡
          </button>
        )}

        {/* 杠牌 */}
        {availableActions.gang && (
          <button
            onClick={handleGangClick}
            className="flex items-center justify-center px-5 py-2 rounded-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black text-base shadow-md ring-1 ring-amber-400/60 hover:scale-105 active:scale-95 transition-all"
          >
            杠
          </button>
        )}

        {/* 碰牌 */}
        {availableActions.peng && (
          <button
            onClick={() => {
              sound.playMeld('peng');
              if (onPeng) onPeng();
            }}
            className="flex items-center justify-center px-5 py-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-base shadow-md ring-1 ring-emerald-400/60 hover:scale-105 active:scale-95 transition-all"
          >
            碰
          </button>
        )}

        {/* 吃牌 */}
        {availableActions.chi && (
          <button
            onClick={handleChiClick}
            className="flex items-center justify-center px-5 py-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-base shadow-md ring-1 ring-sky-400/60 hover:scale-105 active:scale-95 transition-all"
          >
            吃
          </button>
        )}

        {/* 过 */}
        {availableActions.pass && (
          <button
            onClick={() => {
              sound.playTileTouch();
              if (onPass) onPass();
            }}
            className="flex items-center justify-center px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-600 hover:scale-105 active:scale-95 transition-all"
          >
            过
          </button>
        )}
      </div>
    </div>
  );
}

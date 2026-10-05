import React, { useState } from 'react';
import MahjongTile from './MahjongTile.jsx';
import { sound } from '../utils/audio.js';

export default function ActionControls({
  availableActions = {},
  chiOptions = [],
  kongOptions = [],
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
    <div className="absolute bottom-36 sm:bottom-42 md:bottom-48 lg:bottom-52 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
      {/* 多组吃牌选择弹窗 */}
      {showChiPicker && chiOptions.length > 1 && (
        <div className="bg-slate-900/95 border-2 border-emerald-400/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-3 animate-scale-up">
          <span className="text-sm font-black text-emerald-200">请选择一组吃牌：</span>
          <div className="flex gap-3">
            {chiOptions.map((group, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onChi) onChi(group);
                  setShowChiPicker(false);
                }}
                className="flex gap-1 p-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-800/80 border-2 border-emerald-400/40 cursor-pointer transition-all hover:scale-105 shadow-lg"
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
        <div className="bg-slate-900/95 border-2 border-amber-400/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-3 animate-scale-up">
          <span className="text-sm font-black text-amber-200">请选择杠哪张牌：</span>
          <div className="flex gap-3">
            {kongOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onGang) onGang(opt);
                  setShowKongPicker(false);
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-950/70 hover:bg-amber-800/80 border-2 border-amber-400/40 cursor-pointer transition-all hover:scale-105 shadow-lg"
              >
                <MahjongTile tile={opt.tile} size="sm" />
                <span className="text-sm font-black text-amber-300">
                  {opt.type === 'an' ? '暗杠' : opt.type === 'bu' ? '补杠' : '明杠'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 现代超大按键胶囊操作栏 (字体尺寸大幅翻倍) */}
      <div className="flex items-center gap-3.5 bg-slate-950/90 p-2.5 px-6 rounded-full border-2 border-emerald-400/40 shadow-2xl backdrop-blur-xl animate-fade-in-up">
        {/* 胡牌 */}
        {availableActions.hu && (
          <button
            onClick={() => {
              sound.playHu();
              if (onHu) onHu();
            }}
            className="flex items-center justify-center px-8 sm:px-10 py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-2xl sm:text-3xl shadow-xl ring-4 ring-red-400/80 hover:scale-110 active:scale-95 transition-all duration-150 animate-pulse"
          >
            胡
          </button>
        )}

        {/* 杠牌 */}
        {availableActions.gang && (
          <button
            onClick={handleGangClick}
            className="flex items-center justify-center px-7 sm:px-8 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black text-xl sm:text-2xl shadow-lg ring-2 ring-amber-400/70 hover:scale-105 active:scale-95 transition-all"
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
            className="flex items-center justify-center px-7 sm:px-8 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xl sm:text-2xl shadow-lg ring-2 ring-emerald-400/70 hover:scale-105 active:scale-95 transition-all"
          >
            碰
          </button>
        )}

        {/* 吃牌 */}
        {availableActions.chi && (
          <button
            onClick={handleChiClick}
            className="flex items-center justify-center px-7 sm:px-8 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-xl sm:text-2xl shadow-lg ring-2 ring-sky-400/70 hover:scale-105 active:scale-95 transition-all"
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
            className="flex items-center justify-center px-6 sm:px-7 py-2.5 sm:py-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-lg sm:text-xl border border-slate-600 hover:scale-105 active:scale-95 transition-all"
          >
            过
          </button>
        )}
      </div>
    </div>
  );
}

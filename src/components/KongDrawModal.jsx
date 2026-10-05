import React from 'react';
import MahjongTile from './MahjongTile';
import { Zap, AlertCircle } from 'lucide-react';

export default function KongDrawModal({
  isOpen,
  kongPlayer,
  drawnKongTiles = [],
  kongCount = 2,
  canSelfHu = false,
  onDeclareKongHu = null,
  onDiscardKongTiles = null
}) {
  if (!isOpen || drawnKongTiles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-900 via-amber-950/80 to-slate-900 border-2 border-amber-400/80 p-5 shadow-2xl flex flex-col items-center text-center animate-scale-up">
        {/* 图标与标题 */}
        <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-2">
          <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
        </div>

        <h3 className="text-lg font-bold text-white">
          【{kongPlayer?.name}】开杠补牌
        </h3>

        <p className="text-xs text-amber-200/80 mt-1 mb-4">
          根据当前规则摸出 <span className="font-bold text-amber-400">{kongCount} 只</span> 牌
        </p>

        {/* 摸出的牌张 */}
        <div className="flex justify-center items-center gap-3 p-3 rounded-xl bg-black/40 border border-amber-400/20 mb-4 w-full">
          {drawnKongTiles.map((tile, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1 animate-bounce" style={{ animationDelay: `${idx * 150}ms` }}>
              <MahjongTile tile={tile} size="md" />
              <span className="text-[10px] text-amber-300 font-mono">第{idx + 1}只</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-300 mb-4">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>摸出的牌若无人成胡，将全部打入弃牌池。</span>
        </div>

        {/* 按钮操作 */}
        <div className="flex gap-2 w-full">
          {canSelfHu && (
            <button
              onClick={onDeclareKongHu}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm shadow-md transition-transform active:scale-95 animate-pulse"
            >
              杠上开花 (胡牌)
            </button>
          )}

          <button
            onClick={onDiscardKongTiles}
            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 transition-colors"
          >
            {canSelfHu ? '放弃自摸打出' : '打出牌张继续'}
          </button>
        </div>
      </div>
    </div>
  );
}

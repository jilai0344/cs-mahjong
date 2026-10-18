import React from 'react';
import MahjongTile from './MahjongTile';
import { Zap, Info } from 'lucide-react';

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
    <div role="dialog" aria-modal="true" tabIndex={-1} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-sm animate-modal-in">
        <div className="flex flex-col items-center px-5 pb-3 pt-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Zap className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-[14px] font-bold text-stone-900">
            【{kongPlayer?.name}】开杠补牌
          </h3>
          <p className="mt-1 text-[11px] text-stone-400">按当前规则摸出 {kongCount} 只牌</p>
        </div>

        <div className="mx-5 flex items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
          {drawnKongTiles.map((tile, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1" style={{ animationDelay: `${idx * 60}ms` }}>
              <MahjongTile tile={tile} size="md" />
              <span className="text-[9px] text-stone-400">第 {idx + 1} 只</span>
            </div>
          ))}
        </div>

        <div className="mx-5 mt-2.5 flex items-start gap-1.5 text-[10px] leading-snug text-stone-400">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>摸出的牌若无人成胡，将全部打入弃牌池。</span>
        </div>

        <div className="modal-foot mt-3">
          {canSelfHu && (
            <button
              onClick={onDeclareKongHu}
              className="h-10 flex-1 rounded-full bg-rose-600 text-[12px] font-bold text-white shadow-sm transition-transform active:scale-95"
            >
              杠上开花
            </button>
          )}
          <button
            onClick={onDiscardKongTiles}
            className="btn-secondary h-10 flex-1 text-[12px]"
          >
            {canSelfHu ? '放弃自摸' : '打出牌张继续'}
          </button>
        </div>
      </div>
    </div>
  );
}

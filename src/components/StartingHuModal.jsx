import React, { useEffect } from 'react';
import MahjongTile from './MahjongTile';
import { Trophy, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';

export default function StartingHuModal({
  startingHuEvents = [],
  onAcknowledge
}) {
  useEffect(() => {
    if (startingHuEvents && startingHuEvents.length > 0) {
      const names = startingHuEvents.flatMap((evt) => (evt.huList || []).map((hu) => hu.name));
      sound.playStartingHu(names);
    }
  }, [startingHuEvents]);

  if (!startingHuEvents || startingHuEvents.length === 0) return null;

  return (
    <div role="dialog" aria-modal="true" tabIndex={-1} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-md animate-modal-in">
        <div className="flex flex-col items-center px-5 pb-2 pt-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-jade-200)]/50 text-[var(--color-jade-600)]">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-stone-400">
            <Sparkles className="h-3 w-3" />
            起手胡
            <Sparkles className="h-3 w-3" />
          </div>
          <h3 className="mt-1 font-serif text-[22px] font-semibold text-stone-900">开局见喜</h3>
          <p className="mt-1 text-[11px] text-stone-400">已按小胡自摸结算，牌局继续</p>
        </div>

        <div className="max-h-[54vh] space-y-2.5 overflow-y-auto px-5 pb-3">
          {startingHuEvents.map((evt, idx) => (
            <div key={idx} className="rounded-2xl border border-stone-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-stone-800">【{evt.player.name}】</span>
                <span className="rounded-full bg-[var(--color-jade-200)]/35 px-2 py-0.5 text-[10px] font-medium text-[var(--color-jade-600)]">
                  共 {evt.huList.length} 把 · +{evt.scoreChanges ? evt.scoreChanges[evt.player.id] : evt.huList.length * 6} 分
                </span>
              </div>

              {evt.huList.map((hu, hIdx) => {
                const sc = (evt.perHuScores || [])[hIdx];
                return (
                  <div key={hIdx} className="mt-2.5 border-t border-stone-100 pt-2.5 first:mt-2 first:border-0 first:pt-0">
                    <div className="text-[12px] font-semibold text-stone-700">{hu.name}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-stone-400">{hu.desc}</div>
                    {sc && (
                      <div className="mt-1 space-y-0.5 text-[10px] leading-snug text-stone-400">
                        <div>
                          骰子 {(sc.birdValues || []).length > 0 ? sc.birdValues.join('、') : '不抓鸟'}
                          {' → n = '}{sc.details.map((d) => d.n).join(' / ')}
                        </div>
                        <div>
                          每家应付 {sc.details.map((d) => `${d.P}`).join(' / ')} · 封顶 {sc.cap}
                        </div>
                      </div>
                    )}
                    {hu.tiles && hu.tiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1">
                        {hu.tiles.slice(0, 8).map((tile, tIdx) => (
                          <MahjongTile key={tIdx} tile={tile} size="sm" />
                        ))}
                        {hu.tiles.length > 8 && (
                          <span className="self-center text-[10px] text-stone-400">+{hu.tiles.length - 8} 张</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="modal-foot">
          <button onClick={onAcknowledge} className="btn-primary h-10 w-full text-[13px]">
            确定并继续行牌
          </button>
        </div>
      </div>
    </div>
  );
}

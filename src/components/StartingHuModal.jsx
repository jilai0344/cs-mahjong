import React, { useEffect } from 'react';
import MahjongTile from './MahjongTile';
import { Sparkles, Trophy } from 'lucide-react';
import { sound } from '../utils/audio';

export default function StartingHuModal({
  startingHuEvents = [], // Array of { player, huList }
  onAcknowledge
}) {
  useEffect(() => {
    if (startingHuEvents && startingHuEvents.length > 0) {
      sound.playStartingHu();
    }
  }, [startingHuEvents]);

  if (!startingHuEvents || startingHuEvents.length === 0) return null;

  return (
    <div role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-amber-950 via-slate-900 to-black border-2 border-amber-400/70 p-6 shadow-2xl flex flex-col items-center text-center animate-scale-up">
        {/* 顶部金光与奖杯 */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-300 flex items-center justify-center shadow-lg mb-3 ring-4 ring-amber-400/30">
          <Trophy className="w-8 h-8 text-slate-950" />
        </div>

        <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm tracking-wider uppercase">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>长沙麻将 · 起手胡牌</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>

        <h3 className="text-2xl font-black text-white mt-1 mb-4 drop-shadow">
          开局天降祥瑞！
        </h3>

        {/* 起手胡列表 */}
        <div className="w-full space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {startingHuEvents.map((evt, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-800/80 border border-amber-400/30 flex flex-col items-center gap-2"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-emerald-300 text-sm">
                  【{evt.player.name}】
                </span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30 font-semibold flex items-center gap-1.5">
                  <span>共胡 <strong className="text-amber-200 text-sm">{evt.huList.length}</strong> 把</span>
                  <span className="text-amber-400/50">|</span>
                  {/* 金额一律取权威端算出的结果（规格 §九.2），不再硬编码 */}
                  <span>+{evt.scoreChanges ? evt.scoreChanges[evt.player.id] : evt.huList.length * 2 * 3}分</span>
                </span>
              </div>

              {evt.huList.map((hu, hIdx) => {
                const sc = (evt.perHuScores || [])[hIdx];
                return (
                  <div key={hIdx} className="w-full text-left">
                    <div className="text-amber-400 font-bold text-sm">
                      {hu.name}
                    </div>
                    <div className="text-slate-300 text-xs mt-0.5">
                      {hu.desc}
                    </div>
                    {sc && (
                      <div className="text-slate-300 text-[11px] mt-1.5 space-y-0.5 leading-tight">
                        <div>
                          抓鸟骰子：{(sc.birdValues || []).length > 0 ? sc.birdValues.join('、') : '不抓鸟'}
                          {' → 逐家 n = '}{sc.details.map(d => d.n).join(' / ')}
                          {'（乘数 '}{sc.details.map(d => d.multiplier).join(' / ')}{'）'}
                        </div>
                        <div>
                          每家应付：
                          {sc.details.map(d => ` ${d.P}（${d.capped}${d.cappedHit ? ' 已封顶' : ''} + 2F ${d.fixed}）`).join('，')}
                          {' · 封顶上限 '}{sc.cap}
                        </div>
                      </div>
                    )}
                    {hu.tiles && hu.tiles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 justify-center">
                        {hu.tiles.slice(0, 8).map((tile, tIdx) => (
                          <MahjongTile key={tIdx} tile={tile} size="sm" />
                        ))}
                        {hu.tiles.length > 8 && (
                          <span className="text-xs text-slate-400 self-center">
                            +{hu.tiles.length - 8}张
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 my-4">
          起手小胡见牌计分完毕，牌局将继续正常进行！
        </p>

        <button
          onClick={onAcknowledge}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg transition-transform active:scale-95"
        >
          确定并继续行牌
        </button>
      </div>
    </div>
  );
}

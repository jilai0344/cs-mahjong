import React, { useEffect } from 'react';
import MahjongTile from './MahjongTile';
import confetti from 'canvas-confetti';
import { Trophy, Feather, RotateCcw, AlertTriangle, Dices, Crown } from 'lucide-react';
import { sound } from '../utils/audio';

const METHOD_LABEL = {
  zimo: '自摸',
  dianpao: '点炮',
  tongpao: '通炮（一炮多响）',
  qishou: '起手胡',
  siji: '中途四喜'
};

export default function RoundResultModal({
  isOpen,
  result, // { isHuangZhuang, winner, loser, huTypes, birdsResult, handTiles, melds, winningTile, isSelfDrawn, scoreChanges, newDealerId, seatNames, scoring:{method,B,F,cap,dealerSeat,details,winners,birdDetail} }
  players = [],
  onNextRound,
  isMultiplayer = false,
  isHost = true
}) {
  useEffect(() => {
    if (isOpen && result && !result.isHuangZhuang) {
      if (result.winner?.id === 0) {
        sound.playHu();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [isOpen, result]);

  if (!isOpen || !result) return null;

  const {
    isHuangZhuang = false,
    winner = null,
    loser = null,
    huTypes = [],
    birdsResult = { birds: [], hitCount: 0 },
    handTiles = [],
    melds = [],
    winningTile = null,
    isSelfDrawn = false,
    scoreChanges = [0, 0, 0, 0],
    newDealerId = null,
    scoring = null
  } = result;

  const seatNames = result.seatNames || players.map(p => p.name);
  const nameOf = (seat) => seatNames?.[seat] || players?.[seat]?.name || `座位 ${seat}`;
  const B = scoring?.B ?? 1;
  const F = scoring?.F ?? 1;
  const cap = scoring?.cap ?? 42 * B;
  const details = scoring?.details || [];
  const winners = scoring?.winners || [];
  const birdDetail = scoring?.birdDetail || [];
  const isDice = scoring?.method === 'qishou' || scoring?.method === 'siji';
  const winnerNames = winners.map(w => nameOf(w.seat)).join('、');

  return (
    <div role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-emerald-950/80 to-slate-900 border-2 border-emerald-500/40 p-6 shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto">
        {/* 顶部标题 */}
        {isHuangZhuang ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-amber-400">黄庄荒牌</h2>
            <p className="text-xs text-slate-400 mt-1">
              牌墙已摸完，本局流局不计分；下一局庄 = 最后一张牌由
              {Number.isInteger(result.lastDrawerId) ? `【${nameOf(result.lastDrawerId)}】` : '（记录缺失，沿用当前庄）'}
              摸走
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mb-2">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">
              【{winners.length > 1 ? winnerNames : winner?.name}】{scoring?.method === 'tongpao' ? '一炮多响！' : isSelfDrawn ? '自摸大捷！' : '点炮胡牌！'}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
              <span className="bg-slate-800/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                {METHOD_LABEL[scoring?.method] || '胡牌'}
              </span>
              {huTypes.map((type, idx) => (
                <span key={idx} className="bg-red-950/70 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full text-xs font-bold">
                  {type}
                </span>
              ))}
              {!isSelfDrawn && loser && (
                <span className="text-xs text-slate-400">
                  (由【{loser.name}】放炮)
                </span>
              )}
            </div>
          </div>
        )}

        {/* 计分参数：B / F / 封顶 / 新庄 */}
        <div className="w-full mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-slate-800/50 border border-emerald-500/20">
            <div className="text-[10px] text-slate-400">基础分 / 固定分</div>
            <div className="text-sm font-black font-mono text-emerald-300">B={B} · F={F}</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/50 border border-emerald-500/20">
            <div className="text-[10px] text-slate-400">单家封顶</div>
            <div className="text-sm font-black font-mono text-amber-300">{cap}（42B）</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-800/50 border border-emerald-500/20">
            <div className="text-[10px] text-slate-400">下一局庄</div>
            <div className="text-sm font-black text-white flex items-center justify-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              {Number.isInteger(newDealerId) ? nameOf(newDealerId) : '—'}
            </div>
          </div>
        </div>

        {/* 逐项明细：每位赢家 → 每位付分者的 n / 乘数 / 封顶前 / 应付 */}
        {details.length > 0 && (
          <div className="w-full mt-3 p-3 rounded-xl bg-black/40 border border-emerald-500/20">
            <div className="text-xs font-bold text-emerald-300 mb-2">计分明细（数字可追溯）</div>
            <div className="space-y-2">
              {winners.map((w) => (
                <div key={`w-${w.seat}`} className="rounded-lg bg-slate-900/60 border border-slate-700/60 p-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-bold text-white">
                      【{nameOf(w.seat)}】{(w.huTypes || []).join(' · ') || '平胡'}
                      <span className="ml-1 text-[10px] text-amber-300 font-mono">
                        {w.k >= 1 ? `k=${w.k} → 底分 ${7 * B * w.k}（7B×k）` : `小胡 k=0 → 底分 ${2 * B}（2B）`}
                      </span>
                    </span>
                    <span className="text-xs font-black font-mono text-amber-400">
                      共得 +{w.receives}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {w.details.map((d) => (
                      <div key={`d-${w.seat}-${d.payerSeat}`} className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                        <span>
                          付分者 {nameOf(d.payerSeat)}
                          <span className="text-slate-400"> · n={d.n} × {d.multiplier}</span>
                          <span className="text-slate-400"> · {d.base}×{d.multiplier}={d.beforeCap}</span>
                        </span>
                        <span>
                          {d.cappedHit && <span className="text-red-300 mr-1">封顶 {d.capped}</span>}
                          {!d.cappedHit && <span className="mr-1">{d.capped}</span>}
                          <span className="text-slate-400">+2F {d.fixed} =</span>
                          <span className="text-red-300 font-bold ml-1">-{d.P}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 抓鸟 / 骰子结果 */}
        {!isHuangZhuang && birdDetail.length > 0 && (
          <div className="w-full mt-3 p-3 rounded-xl bg-slate-800/40 border border-amber-500/30 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-2">
              {isDice ? <Dices className="w-4 h-4 text-amber-400" /> : <Feather className="w-4 h-4 text-amber-400" />}
              <span>
                {isDice ? `摇骰子抓鸟（${birdDetail.length} 颗）` : `翻牌墙取末尾扎鸟（${birdDetail.length} 只 · 中庄位 ${birdsResult.hitCount} 只）`}
              </span>
            </div>
            <div className="flex gap-3 justify-center">
              {birdDetail.map((b, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  {b.tile
                    ? <MahjongTile tile={b.tile} size="sm" className={b.targetSeat === scoring?.dealerSeat ? 'ring-2 ring-amber-400 scale-105' : 'opacity-70'} />
                    : <div className="w-8 h-11 rounded bg-amber-900/50 border border-amber-500/40 flex items-center justify-center text-amber-200 font-black text-sm">{b.value}</div>}
                  <span className={`text-[10px] font-semibold ${b.targetSeat === scoring?.dealerSeat ? 'text-amber-400' : 'text-slate-400'}`}>
                    {b.value} → {nameOf(b.targetSeat)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 获胜者牌面展示 */}
        {!isHuangZhuang && (
          <div className="w-full mt-3 p-3 rounded-xl bg-black/40 border border-emerald-500/20 flex flex-col items-center">
            <span className="text-xs text-emerald-300 font-semibold mb-2">最终成牌展示</span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* 面子 */}
              {melds.map((meld, mIdx) => (
                <div key={mIdx} className="flex gap-0.5 bg-emerald-950/40 p-1 rounded border border-emerald-500/20">
                  {meld.tiles.map((t, idx) => (
                    <MahjongTile key={idx} tile={t} size="sm" />
                  ))}
                </div>
              ))}
              {/* 手牌 */}
              <div className="flex gap-0.5">
                {handTiles.map((t, idx) => (
                  <MahjongTile key={idx} tile={t} size="sm" />
                ))}
              </div>
              {/* 胡牌张 */}
              {winningTile && (
                <div className="flex flex-col items-center ml-1">
                  <MahjongTile tile={winningTile} size="sm" className="ring-2 ring-amber-400" />
                  <span className="text-[9px] text-amber-300 font-bold mt-0.5">胡张</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4名玩家积分变动 */}
        <div className="w-full grid grid-cols-4 gap-2 mt-4 mb-4">
          {players.map((p, idx) => {
            const change = scoreChanges[idx] || 0;
            return (
              <div key={p.id} className="p-2 rounded-xl bg-slate-800/60 border border-emerald-500/20 flex flex-col items-center">
                <span className="text-xs text-slate-300">{p.name.slice(0, 4)}</span>
                <span className={`text-sm font-black font-mono mt-1 ${
                  change > 0 ? 'text-amber-400' : change < 0 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {change > 0 ? `+${change}` : change}
                </span>
              </div>
            );
          })}
        </div>

        {/* 再来一局按钮 */}
        {isMultiplayer && !isHost ? (
          <div className="w-full py-3 rounded-xl bg-slate-800/80 border border-emerald-500/30 text-amber-300 font-bold text-sm shadow-xl flex items-center justify-center gap-2 animate-pulse">
            <RotateCcw className="w-4 h-4 animate-spin text-amber-400" />
            <span>等待房主开启新一局...</span>
          </div>
        ) : (
          <button
            onClick={onNextRound}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>开始新一局</span>
          </button>
        )}
      </div>
    </div>
  );
}

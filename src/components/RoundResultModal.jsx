import React, { useEffect } from 'react';
import MahjongTile from './MahjongTile';
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
  result,
  players = [],
  onNextRound,
  isMultiplayer = false,
  isHost = true
}) {
  useEffect(() => {
    if (isOpen && result && !result.isHuangZhuang && result.winner?.id === 0) {
      sound.playHu({ zimo: !!result.isSelfDrawn, huTypes: result.huTypes || [] });
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
    roundDealerId = null,
    scoring = null
  } = result;

  const seatNames = result.seatNames || players.map((p) => p.name);
  const nameOf = (seat) => seatNames?.[seat] || players?.[seat]?.name || `座位 ${seat}`;
  const B = scoring?.B ?? 1;
  const F = scoring?.F ?? 1;
  const cap = scoring?.cap ?? 42 * B;
  const details = scoring?.details || [];
  const winners = scoring?.winners || [];
  const totalGain = winners.reduce((sum, w) => sum + (Number(scoreChanges?.[w.seat]) || 0), 0);
  const birdDetail = scoring?.birdDetail || [];
  const isDice = scoring?.method === 'qishou' || scoring?.method === 'siji';
  const winnerNames = winners.map((w) => nameOf(w.seat)).join('、');

  return (
    <div role="dialog" aria-modal="true" tabIndex={-1} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-lg animate-modal-in">
        {/* 标题 */}
        <div className="flex flex-col items-center px-5 pb-1 pt-6 text-center">
          {isHuangZhuang ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-[15px] font-bold text-stone-900">黄庄荒牌</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
                牌墙已摸完，本局流局不计分；下一局庄 = 最后一张牌由
                {Number.isInteger(result.lastDrawerId) ? `【${nameOf(result.lastDrawerId)}】` : '（记录缺失，沿用当前庄）'}
                摸走
              </p>
            </>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-jade-200)]/50 text-[var(--color-jade-600)]">
                <Trophy className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-[15px] font-bold text-stone-900">
                【{winners.length > 1 ? winnerNames : winner?.name}】
                {scoring?.method === 'tongpao' ? '一炮多响' : isSelfDrawn ? '自摸' : '点炮胡牌'}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                  {METHOD_LABEL[scoring?.method] || '胡牌'}
                </span>
                {huTypes.map((type, idx) => (
                  <span key={idx} className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                    {type}
                  </span>
                ))}
                {!isSelfDrawn && loser && (
                  <span className="text-[10px] text-stone-400">由【{loser.name}】放炮</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* 主视觉数字 */}
        {isHuangZhuang ? (
          <div className="mt-2 text-center text-[11px] font-medium tracking-[0.15em] text-stone-400">
            本局流局 · 不计分
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-center">
            <span className="text-[10px] font-medium tracking-[0.15em] text-stone-400">本局共得</span>
            <span
              className="font-serif text-[30px] font-semibold leading-none text-[var(--color-jade-600)]"
              title={winners.length > 1 ? '通炮：各胡家得分之和' : '胡牌者本局净得'}
            >
              +{totalGain}
            </span>
          </div>
        )}

        <div className="modal-body space-y-2.5">
          {/* 计分参数 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-stone-200 bg-white p-2">
              <div className="text-[9px] text-stone-400">基础分 / 固定分</div>
              <div className="mt-0.5 font-mono text-[12px] font-semibold text-stone-700">B={B} · F={F}</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-2">
              <div className="text-[9px] text-stone-400">单家封顶</div>
              <div className="mt-0.5 font-mono text-[12px] font-semibold text-stone-700">{cap}</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-2">
              <div className="text-[9px] text-stone-400">下一局庄</div>
              <div className="mt-0.5 flex items-center justify-center gap-1 text-[12px] font-semibold text-stone-700">
                <Crown className="h-3 w-3 text-[var(--color-gold-200)]" />
                <span className="truncate">{Number.isInteger(newDealerId) ? nameOf(newDealerId) : '—'}</span>
                {Number.isInteger(newDealerId) && newDealerId === roundDealerId && (
                  <span className="rounded bg-stone-100 px-1 text-[9px] text-stone-500">连庄</span>
                )}
              </div>
            </div>
          </div>

          {/* 计分明细 */}
          {details.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="mb-2 text-[10px] font-semibold text-stone-500">计分明细（数字可追溯）</div>
              <div className="space-y-2">
                {winners.map((w) => (
                  <div key={`w-${w.seat}`} className="rounded-lg bg-stone-50 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-stone-700">
                        【{nameOf(w.seat)}】{(w.huTypes || []).join(' · ') || '平胡'}
                        <span className="ml-1 font-mono text-[9px] font-normal text-stone-400">
                          {w.k >= 1 ? `k=${w.k} → 7B×k` : '小胡 k=0 → 2B'}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[var(--color-jade-600)]">
                        +{w.receives}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {w.details.map((d) => (
                        <div key={`d-${w.seat}-${d.payerSeat}`} className="flex items-center justify-between gap-2 font-mono text-[9px] text-stone-400">
                          <span className="truncate">
                            {nameOf(d.payerSeat)} · n={d.n}×{d.multiplier} · {d.base}×{d.multiplier}={d.beforeCap}
                          </span>
                          <span className="shrink-0">
                            {d.cappedHit ? `封顶 ${d.capped}` : d.capped} +2F {d.fixed} ={' '}
                            <span className="font-semibold text-rose-600">-{d.P}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 扎鸟 */}
          {!isHuangZhuang && birdDetail.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-medium text-stone-500">
                {isDice ? <Dices className="h-3.5 w-3.5" /> : <Feather className="h-3.5 w-3.5" />}
                <span>
                  {isDice
                    ? `摇骰子抓鸟（${birdDetail.length} 颗）`
                    : `翻牌墙扎鸟（${birdDetail.length} 只 · 中庄位 ${birdsResult.hitCount} 只）`}
                </span>
              </div>
              <div className="flex justify-center gap-2.5">
                {birdDetail.map((b, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    {b.tile ? (
                      <MahjongTile
                        tile={b.tile}
                        size="sm"
                        className={b.targetSeat === scoring?.dealerSeat ? 'ring-2 ring-[var(--color-jade-500)] rounded-[10px]' : 'opacity-70'}
                      />
                    ) : (
                      <div className="flex h-11 w-8 items-center justify-center rounded-md border border-stone-200 bg-stone-50 font-mono text-[12px] font-semibold text-stone-600">
                        {b.value}
                      </div>
                    )}
                    <span className={`text-[9px] ${b.targetSeat === scoring?.dealerSeat ? 'font-semibold text-[var(--color-jade-600)]' : 'text-stone-400'}`}>
                      {b.value} → {nameOf(b.targetSeat)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 成牌 */}
          {!isHuangZhuang && (
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="mb-2 text-center text-[10px] font-medium text-stone-500">最终成牌</div>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {melds.map((meld, mIdx) => (
                  <div key={mIdx} className="flex gap-0.5 rounded-md bg-stone-50 p-0.5">
                    {meld.tiles.map((t, idx) => (
                      <MahjongTile key={idx} tile={t} size="sm" />
                    ))}
                  </div>
                ))}
                <div className="flex gap-0.5">
                  {handTiles.map((t, idx) => (
                    <MahjongTile key={idx} tile={t} size="sm" />
                  ))}
                </div>
                {winningTile && (
                  <div className="ml-1 flex flex-col items-center">
                    <MahjongTile tile={winningTile} size="sm" className="ring-2 ring-[var(--color-jade-500)] rounded-[10px]" />
                    <span className="mt-0.5 text-[9px] text-[var(--color-jade-600)]">胡张</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 四家得失 */}
          <div className="grid grid-cols-4 gap-2">
            {players.map((p, idx) => {
              const change = scoreChanges[idx] || 0;
              return (
                <div key={p.id} className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-1.5 py-2">
                  <span className="w-full truncate text-center text-[10px] text-stone-400">{p.name.slice(0, 5)}</span>
                  <span className={`mt-1 font-mono text-[13px] font-semibold ${
                    change > 0 ? 'text-[var(--color-jade-600)]' : change < 0 ? 'text-rose-600' : 'text-stone-400'
                  }`}>
                    {change > 0 ? `+${change}` : change}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-foot">
          {isMultiplayer && !isHost ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-100 py-2.5 text-[11px] font-medium text-stone-500">
              <RotateCcw className="h-3.5 w-3.5 animate-spin" />
              等待房主开启新一局
            </div>
          ) : (
            <button onClick={onNextRound} className="btn-primary h-10 w-full text-[13px]">
              <RotateCcw className="h-3.5 w-3.5" />
              再来一局
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import MahjongTile from './MahjongTile.jsx';
import { useModalA11y } from '../hooks/useModalA11y.js';
import { compareTiles } from '../types/mahjong.js';

const POSITION_LABEL = {
  bottom: '我',
  right: '下家',
  top: '对家',
  left: '上家'
};

function MeldBadge({ type }) {
  const label = type === 'chi' ? '吃' : type === 'peng' ? '碰' : '杠';
  return (
    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/75">
      {label}
    </span>
  );
}

/**
 * 胡牌后先把赢家的牌完整倒给四家看，再进入结算页。
 * 输赢分可以晚一点看，谁胡了、胡的什么牌必须先看清楚。
 */
export default function WinRevealOverlay({ result, isOpen, onContinue }) {
  const modalA11y = useModalA11y(onContinue);
  const continueRef = useRef(onContinue);
  useEffect(() => { continueRef.current = onContinue; });

  // 只把牌摆出来给四家看一眼，不需要再点一次确认，随后自动进入结算。
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => continueRef.current?.(), 1100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen || !result || result.isHuangZhuang) return null;

  const winner = result.winner;
  const winners = result.scoring?.winners || [];
  const handTiles = [...(result.handTiles || []), ...(result.winningTile ? [result.winningTile] : [])]
    .sort(compareTiles);
  const isTongPao = winners.length > 1;
  const direction = POSITION_LABEL[winner?.position] || '';

  return (
    <div
      {...modalA11y}
      className="fixed inset-0 z-[70] flex select-none items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="animate-modal-in w-full max-w-4xl overflow-hidden rounded-[26px] border border-white/60 bg-[var(--ui-paper)] shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden bg-[var(--color-felt-700)] px-6 pb-5 pt-6 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-32 w-64 rounded-full bg-[var(--color-jade-300)]/20 blur-2xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em]">
                  {isTongPao ? '一炮多响' : result.isSelfDrawn ? '自摸' : '点炮胡牌'}
                </span>
                <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-white/80">
                  {direction || '胡牌'}
                </span>
                <span className="text-[10px] font-medium tracking-[0.2em] text-white/55">倒牌</span>
              </div>
              <h2 className="mt-3 text-[26px] font-bold leading-tight sm:text-[32px]">
                {winner?.name || '胡牌'}
                <span className="ml-3 text-amber-200">胡了</span>
              </h2>
              <p className="mt-1 text-[11px] text-white/65">
                {isTongPao
                  ? `本局 ${winners.length} 家同时胡牌`
                  : result.isSelfDrawn
                    ? '自摸 · 四家共同验牌'
                    : `由【${result.loser?.name || '放炮者'}】放炮`}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(result.huTypes || []).map((type, idx) => (
                <span key={idx} className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-white/85">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 sm:px-7">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-jade-500)]" />
              <span className="text-[11px] font-bold tracking-[0.12em] text-stone-500">赢家亮牌</span>
            </div>
            <span className="text-[10px] text-stone-400">全部手牌 + 副露</span>
          </div>

          {result.melds?.length > 0 && (
            <div className="mb-2 flex flex-wrap items-end gap-2">
              {result.melds.map((meld, mIdx) => (
                <div key={mIdx} className="flex items-center gap-0.5 rounded-lg bg-stone-100/80 p-1">
                  {meld.tiles.map((tile, tIdx) => (
                    <MahjongTile
                      key={tIdx}
                      tile={tile}
                      size="mini"
                      lying
                      isBack={meld.type === 'an_gang' && tIdx > 0 && tIdx < 3}
                    />
                  ))}
                  <MeldBadge type={meld.type} />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end justify-center gap-1 rounded-2xl border border-stone-200/80 bg-white/60 p-3 shadow-inner">
            {handTiles.map((tile, idx) => {
              const isWinningTile = result.winningTile?.id
                ? tile.id === result.winningTile.id
                : idx === handTiles.length - 1;
              return (
                <div key={tile.id || idx} className="animate-meld-snap relative" style={{ animationDelay: `${Math.min(idx, 16) * 18}ms` }}>
                  <MahjongTile
                    tile={tile}
                    size="sm"
                    highlight={isWinningTile}
                    showJiangBadge
                    className={isWinningTile ? 'rounded-[10px] ring-2 ring-rose-400 ring-offset-2 ring-offset-white' : ''}
                  />
                  {isWinningTile && (
                    <span className="absolute -right-1.5 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow">
                      胡
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-400">
            <span>
              胡牌张：
              <strong className="ml-1 text-rose-600">{result.winningTile?.name || '—'}</strong>
            </span>
            <span>请四家确认牌型后进入结算</span>
          </div>
        </div>

        <div className="border-t border-stone-200/70 px-5 py-3 text-center text-[10px] font-medium tracking-[0.12em] text-stone-400 sm:px-7">
          即将进入结算…
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import MahjongTile from './MahjongTile';
import confetti from 'canvas-confetti';
import { Trophy, Feather, RotateCcw, AlertTriangle } from 'lucide-react';
import { sound } from '../utils/audio';

export default function RoundResultModal({
  isOpen,
  result, // { isHuangZhuang, winner, loser, huTypes, score, birdsResult, handTiles, melds, winningTile, isSelfDrawn, scoreChanges }
  players = [],
  onNextRound
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
    score = 1,
    birdsResult = { birds: [], hitCount: 0 },
    handTiles = [],
    melds = [],
    winningTile = null,
    isSelfDrawn = false,
    scoreChanges = [0, 0, 0, 0]
  } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-emerald-950/80 to-slate-900 border-2 border-emerald-500/40 p-6 shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto">
        {/* 顶部标题 */}
        {isHuangZhuang ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-amber-400">黄庄荒牌</h2>
            <p className="text-xs text-slate-400 mt-1">牌墙已摸完，本局流局无胜者</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mb-2">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white">
              【{winner?.name}】{isSelfDrawn ? '自摸大捷！' : '点炮胡牌！'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
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

        {/* 获胜者牌面展示 */}
        {!isHuangZhuang && (
          <div className="w-full my-4 p-3 rounded-xl bg-black/40 border border-emerald-500/20 flex flex-col items-center">
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

        {/* 扎鸟抓鸟结果 */}
        {!isHuangZhuang && birdsResult && birdsResult.birds?.length > 0 && (
          <div className="w-full mb-4 p-3 rounded-xl bg-slate-800/40 border border-amber-500/30 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-2">
              <Feather className="w-4 h-4 text-amber-400" />
              <span>抓鸟结算 (抓 {birdsResult.birds.length} 鸟 · 中 {birdsResult.hitCount} 鸟)</span>
            </div>
            <div className="flex gap-3 justify-center">
              {birdsResult.birds.map((b, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <MahjongTile
                    tile={b.tile}
                    size="sm"
                    className={b.hitsWinner ? 'ring-2 ring-amber-400 scale-105' : 'opacity-60'}
                  />
                  <span className={`text-[10px] font-semibold ${
                    b.hitsWinner ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {b.hitsWinner ? '★ 中鸟' : '未中'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4名玩家积分变动 */}
        <div className="w-full grid grid-cols-4 gap-2 mb-6">
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
        <button
          onClick={onNextRound}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>开始新一局</span>
        </button>
      </div>
    </div>
  );
}

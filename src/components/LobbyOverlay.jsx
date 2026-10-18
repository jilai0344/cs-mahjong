import React from 'react';
import { Play, Users, Settings2, BookOpen, Sparkles } from 'lucide-react';
import MahjongTile from './MahjongTile.jsx';

function Chip({ children }) {
  return (
    <span className="rounded-full border border-stone-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-stone-600">
      {children}
    </span>
  );
}

/**
 * 开局大厅：一张纸片浮在牌桌上。
 * 只暴露「开始 / 联机 / 设置 / 规则」四件事，避免首屏信息过载。
 */
export default function LobbyOverlay({
  config = {},
  record = { netScore: 0, matches: 0 },
  onStart,
  onMultiplayer,
  onSettings,
  onRules
}) {
  const netScore = Number(record?.netScore) || 0;
  const matches = Number(record?.matches) || 0;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-stone-900/15 p-3 backdrop-blur-[1.5px] sm:p-5">
      <div className="animate-modal-in paper-card flex w-full max-w-[460px] flex-col rounded-[28px] px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex items-center gap-3">
          <MahjongTile tile={{ suit: 'wan', value: 1 }} size="md" className="shrink-0 rotate-[-5deg]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-serif text-[28px] font-semibold leading-none tracking-tight text-stone-900">
                长沙麻将
              </div>
              <span className="rounded-full bg-[var(--color-jade-200)]/50 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-jade-600)]">
                青瓷
              </span>
            </div>
            <div className="mt-1.5 text-[10px] font-medium tracking-[0.22em] text-stone-400">
              CHANGSHA MAHJONG
            </div>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-stone-500">
          不联网也能开一局。二五八做将、开杠补牌、扎鸟封顶，按长沙本地打法来。
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>开杠 {config.kongDrawCount ?? 2} 只</Chip>
          <Chip>{config.kongRequiresJiang ? '开杠需将' : '开杠免将'}</Chip>
          <Chip>{(config.birdCount ?? 2) > 0 ? `抓 ${config.birdCount} 鸟` : '不抓鸟'}</Chip>
          <Chip>
            B {config.baseScore ?? 1} · F {config.fixedScore ?? 1}
          </Chip>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="btn-primary mt-5 h-12 w-full text-[15px]"
        >
          <Play className="h-4 w-4 fill-current" />
          开始对局
        </button>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onMultiplayer} className="btn-secondary h-10 text-[13px]">
            <Users className="h-4 w-4" />
            多人联机
          </button>
          <button type="button" onClick={onSettings} className="btn-secondary h-10 text-[13px]">
            <Settings2 className="h-4 w-4" />
            规则设置
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-stone-200/80 bg-white/55 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-gold-200)]" />
            <span>本机战绩</span>
            <span className="font-mono font-semibold text-stone-700">
              {netScore > 0 ? `+${netScore}` : netScore}
            </span>
            <span>·</span>
            <span>{matches} 局</span>
          </div>
          <button
            type="button"
            onClick={onRules}
            className="flex items-center gap-1 text-[11px] font-medium text-stone-500 transition-colors hover:text-stone-800"
          >
            <BookOpen className="h-3.5 w-3.5" />
            玩法说明
          </button>
        </div>

        <div className="mt-3 text-center text-[10px] text-stone-400">
          长沙本地规则 · 单机练习不计入本机战绩
        </div>
      </div>
    </div>
  );
}

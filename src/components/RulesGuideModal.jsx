import React from 'react';
import { useModalA11y } from '../hooks/useModalA11y.js';
import { X, BookOpen, Check } from 'lucide-react';

function RuleBlock({ title, tone = 'jade', children }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className={`mb-2 flex items-center gap-1.5 text-[12px] font-bold ${tone === 'rose' ? 'text-rose-600' : 'text-[var(--color-jade-600)]'}`}>
        <Check className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div className="space-y-1.5 text-[11px] leading-relaxed text-stone-500">{children}</div>
    </section>
  );
}

export default function RulesGuideModal({ isOpen, onClose }) {
  const modalA11y = useModalA11y(onClose);

  if (!isOpen) return null;

  return (
    <div {...modalA11y} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-2xl animate-modal-in">
        <div className="modal-head">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-stone-900">长沙麻将 · 玩法速查</h2>
              <p className="mt-0.5 text-[10px] text-stone-400">二五八做将 · 108 张 · 无字无花</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="关闭玩法说明">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body space-y-2.5">
          <RuleBlock title="牌张构成（108 张）">
            <p>
              仅使用万、条、筒三门数字牌（各 1–9 点，每种 4 张，共 108 张），没有东南西北风牌、中发白箭牌及花牌。
            </p>
          </RuleBlock>

          <RuleBlock title="“二五八做将”核心">
            <p>
              普通平胡必须以 <strong className="font-semibold text-stone-700">二 / 五 / 八</strong> 作为将牌对子方可胡牌；
              大胡（清一色、将将胡、碰碰胡等）不受此限制。
            </p>
          </RuleBlock>

          <RuleBlock title="开杠与补牌（可设置）">
            <ul className="list-disc space-y-1 pl-4">
              <li>开杠补牌数量支持 <strong className="font-semibold text-stone-700">2 只 / 4 只</strong>；摸出后未胡的牌全部打入牌池，其他人可胡「杠上炮」。</li>
              <li>开杠需将：开启后手中必须保留 2、5、8 作为将牌储备，否则无法开杠。</li>
            </ul>
          </RuleBlock>

          <RuleBlock title="起手胡 / 中途四喜（可勾选）">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {[
                ['大四喜', '起手有 4 张完全相同的牌'],
                ['板板胡', '起手没有任何 2、5、8'],
                ['缺一色', '起手缺少一门花色'],
                ['六六顺', '起手有两组刻子'],
                ['一个五', '某一门起手只有一张且为五'],
                ['三个五三个八', '三个五筒 / 三个八筒各胡一把'],
                ['三连对', '同门三副连续对子（如 223344）'],
                ['三同', '三门同点数各一对'],
                ['二筒二条', '一对二筒 + 一对二条'],
                ['中途四喜', '行牌中凑齐 4 张相同牌即刻算胡']
              ].map(([name, desc]) => (
                <div key={name} className="rounded-lg bg-stone-50 px-2.5 py-1.5">
                  <span className="font-semibold text-stone-700">{name}</span>
                  <span className="mx-1 text-stone-300">·</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
            <p className="pt-1 text-[10px] text-stone-400">
              小胡判定后按「小胡自摸」独立计分（底分 2B，逐家算中鸟、封顶 42B、另加 2F），牌局继续。
              规格外的番型默认关闭，可在「规则设置」中打开。
            </p>
          </RuleBlock>

          <RuleBlock title="经典大胡番型" tone="rose">
            <p>
              大胡可乱将，每成立一个番型算一个：<strong className="font-semibold text-stone-700">底分 = 7B × k</strong>（线性相加，不是翻番）。
            </p>
            <p>
              清一色 · 将将胡 · 碰碰胡 · 全求人 · 杠上开花 / 杠上炮 · 海底捞月 / 海底炮 · 豪华七巧对。
            </p>
            <p>
              计分：小胡底分 2B；每家应付 = min(底分 × (n+1), 42B) + 2F。自摸三家各按自己的中鸟数付；点炮只有放炮者付；通炮按每位胡家的番型与 n 单独结算。
            </p>
          </RuleBlock>
        </div>

        <div className="modal-foot">
          <button onClick={onClose} className="btn-primary h-9 px-6 text-xs">
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

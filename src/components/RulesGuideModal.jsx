import React from 'react';
import { X, BookOpen, CheckCircle2 } from 'lucide-react';

export default function RulesGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-emerald-950/90 to-slate-900 border border-emerald-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* 标题 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/20 bg-black/30">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">长沙麻将 · 规则速查宝典</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 规则条目 */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {/* 牌张构成 */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              牌张构成 (108张)
            </h3>
            <p>
              长沙麻将仅使用万、条、筒三门数字牌（各1~9点，每种4张，共108张），没有东南西北风牌、中发白箭牌及花牌。
            </p>
          </div>

          {/* 二五八做将规则 */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              “二五八做将”核心精髓
            </h3>
            <p>
              长沙麻将的普通平胡，必须以 <span className="text-amber-400 font-bold">二万/二条/二筒、五万/五条/五筒、八万/八条/八筒</span> 作为将牌对子方可胡牌！若非2、5、8做将，普通平胡无法成胡（大胡除外）。
            </p>
          </div>

          {/* 开杠规则：2只还是4只 & 需不需要将 */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              开杠与补牌规则 (游戏内可自主设定)
            </h3>
            <ul className="list-disc list-inside space-y-1 mt-1 text-slate-300">
              <li>
                <strong className="text-white">开杠补牌数量：</strong>支持设置摸 <strong>2 只</strong> 或 <strong>4 只</strong> 牌。摸出的牌如果未能成胡（自摸杠上开花），将全部打入牌池，其他人可借此胡牌（杠上炮）。
              </li>
              <li>
                <strong className="text-white">开杠需不需要将：</strong>支持设置开杠时手上是否必须保留 2、5、8 作为将牌。若开启“需要将”，手上无将牌储备时无法进行开杠。
              </li>
            </ul>
          </div>

          {/* 起手胡与即时胡 (小胡) */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              起手胡与中途胡 (小胡) - 支持自主勾选
            </h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">大四喜：</span>起手手牌有4张完全相同的牌。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">板板胡：</span>起手手牌中无任何一张 2、5、8。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">缺一色：</span>起手手牌整门缺失万、条、筒中至少一门。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">六六顺：</span>起手手牌包含两组刻子(各有3张相同牌)。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">一个五：</span>筒条万全手牌有且仅有一张五。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">三五三八：</span>起手拥有3个五筒与3个八筒。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">三连对：</span>同门三副连续的对子(如223344)。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">三同：</span>筒条万同点数各有一对相同的牌。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">二筒二条：</span>手牌拥有一对二筒与一对二条。
              </div>
              <div className="p-2 rounded bg-black/30">
                <span className="text-amber-300 font-bold">中途四喜：</span>打牌摸牌过程中手牌凑齐4张相同牌即刻算胡牌。
              </div>
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-2">
              注：小胡判定亮牌后直接计分（每项每家付2分），随后牌局继续正常摸打。
            </p>
          </div>

          {/* 长沙大胡番型 */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-red-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-red-400" />
              经典大胡番种
            </h3>
            <p>
              大胡可乱将（不必遵循258将限制），计 6 番：
              <br />
              · <strong>清一色</strong>：全手牌为同一花色。
              <br />
              · <strong>将将胡</strong>：手牌与副露全部由 2、5、8 组成。
              <br />
              · <strong>碰碰胡</strong>：由4副刻子加一对将组成。
              <br />
              · <strong>全求人</strong>：吃碰杠亮出4副牌，手里剩1张牌单吊点炮胡牌。
              <br />
              · <strong>杠上开花 / 杠上炮</strong>：开杠摸牌自摸或打出被他人胡牌。
            </p>
          </div>
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-emerald-500/20 bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

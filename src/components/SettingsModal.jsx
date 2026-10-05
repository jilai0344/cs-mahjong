import React from 'react';
import { X, Sliders, Sparkles, Volume2, ShieldCheck, Zap } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  config,
  onUpdateConfig
}) {
  if (!isOpen) return null;

  const handleToggleStartingHu = (key) => {
    onUpdateConfig({
      ...config,
      startingHu: {
        ...config.startingHu,
        [key]: !config.startingHu[key]
      }
    });
  };

  const handleSetKongDraw = (count) => {
    onUpdateConfig({
      ...config,
      kongDrawCount: count
    });
  };

  const handleToggleKongRequiresJiang = (val) => {
    onUpdateConfig({
      ...config,
      kongRequiresJiang: val
    });
  };

  const handleSetBirdCount = (count) => {
    onUpdateConfig({
      ...config,
      birdCount: count
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-emerald-950/90 to-slate-900 border border-emerald-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/20 bg-black/30">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">长沙麻将 · 规则与玩法设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 设置内容列表 */}
        <div className="p-6 space-y-6 overflow-y-auto text-sm">
          {/* 1. 开杠摸牌数规则 (2只 vs 4只) */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">开杠摸牌数量</span>
              </div>
              <span className="text-xs text-emerald-300/70">
                {config.kongDrawCount === 2 ? '标准长沙 2 只' : '刺激加倍 4 只'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              开杠（暗杠/明杠/补杠）后从牌墙末尾补牌摸出的张数，摸出后若未胡则打入牌池供他人抢胡。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSetKongDraw(2)}
                className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all ${
                  config.kongDrawCount === 2
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span>开杠摸 2 只</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded">标准</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetKongDraw(4)}
                className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all ${
                  config.kongDrawCount === 4
                    ? 'bg-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-400/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span>开杠摸 4 只</span>
                <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-amber-200">大杠</span>
              </button>
            </div>
          </div>

          {/* 2. 开杠需不需要将规则 */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">开杠需不需要将</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                config.kongRequiresJiang ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700 text-slate-300'
              }`}>
                {config.kongRequiresJiang ? '需要有258将' : '不需要 (任意杠)'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              传统长沙麻将严谨规则下，开杠时手中必须留有 2、5、8 作为将牌储备；若关闭则允许任意开杠。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggleKongRequiresJiang(true)}
                className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                  config.kongRequiresJiang
                    ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                开杠需要将 (严格)
              </button>
              <button
                type="button"
                onClick={() => handleToggleKongRequiresJiang(false)}
                className={`py-2 px-3 rounded-lg border font-semibold text-center transition-all ${
                  !config.kongRequiresJiang
                    ? 'bg-teal-600 text-white border-teal-400 ring-2 ring-teal-400/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                开杠无需将 (随意)
              </button>
            </div>
          </div>

          {/* 3. 起手胡牌可选项目 (大四喜 / 板板胡 / 缺一色 / 六六顺) */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">起手胡牌 (小胡) 可选类型</span>
              </div>
              <span className="text-xs text-emerald-300/70">发牌后即时判定</span>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              勾选你想开启的起手胡类型，开局抓完牌若手牌满足以下条件即可亮牌计分并继续行牌：
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: 'daSiXi', name: '大四喜', desc: '起手手牌有 4 张相同的牌' },
                { key: 'banBanHu', name: '板板胡', desc: '手牌没有任何一张 2、5、8' },
                { key: 'queYiSe', name: '缺一色', desc: '手牌缺少某一门花色' },
                { key: 'liuLiuShun', name: '六六顺', desc: '手牌拥有两组刻子 (3张同)' },
                { key: 'yiGeWu', name: '一个五', desc: '某一色起手仅有一张牌且为五' },
                { key: 'sanWuSanBa', name: '三个五三个八', desc: '有3个五/八筒各胡1把；4个五/八筒与四喜叠加胡2把' },
                { key: 'sanLianDui', name: '三连对', desc: '同门三副连续的对子 (如223344)' },
                { key: 'sanTong', name: '三同', desc: '筒条万同点数各有一对相同的牌' },
                { key: 'erTongErTiao', name: '二筒二条', desc: '手牌拥有一对二筒与一对二条' },
                { key: 'zhongTuSiXi', name: '中途四喜', desc: '打牌摸牌过程中手牌凑齐4张相同牌' }
              ].map(item => {
                const isChecked = !!config.startingHu[item.key];
                return (
                  <label
                    key={item.key}
                    onClick={() => handleToggleStartingHu(item.key)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-emerald-950/50 border-emerald-400/60 shadow-xs'
                        : 'bg-slate-800/40 border-slate-700 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-white text-xs">{item.name}</div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 4. 抓鸟设置 */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white">胡牌扎鸟数量</span>
              <span className="text-xs text-amber-300 font-mono">
                {config.birdCount === 0 ? '不抓鸟' : `抓 ${config.birdCount} 只鸟`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 2, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSetBirdCount(num)}
                  className={`py-1.5 rounded-md font-semibold text-xs border transition-all ${
                    config.birdCount === num
                      ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {num === 0 ? '不抓鸟' : `${num} 只鸟`}
                </button>
              ))}
            </div>
          </div>

          {/* 5. 辅助与音效设置 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-emerald-500/20 cursor-pointer">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">游戏音效</span>
              </div>
              <input
                type="checkbox"
                checked={config.soundEnabled}
                onChange={e => onUpdateConfig({ ...config, soundEnabled: e.target.checked })}
                className="rounded text-emerald-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-emerald-500/20 cursor-pointer">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white">听牌提示</span>
              </div>
              <input
                type="checkbox"
                checked={config.showHints}
                onChange={e => onUpdateConfig({ ...config, showHints: e.target.checked })}
                className="rounded text-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-emerald-500/20 bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            保存并返回游戏
          </button>
        </div>
      </div>
    </div>
  );
}

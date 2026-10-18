import React from 'react';
import { useModalA11y } from '../hooks/useModalA11y.js';
import { X, SlidersHorizontal, Volume2, Sparkles, ShieldCheck, Zap, Feather, Palette } from 'lucide-react';

const STARTING_HU = [
  { key: 'daSiXi', name: '大四喜', desc: '起手有 4 张完全相同的牌' },
  { key: 'banBanHu', name: '板板胡', desc: '起手没有任何 2、5、8' },
  { key: 'queYiSe', name: '缺一色', desc: '起手缺一门花色' },
  { key: 'liuLiuShun', name: '六六顺', desc: '起手有两组刻子' },
  { key: 'zhongTuSiXi', name: '中途四喜', desc: '行牌中凑齐 4 张相同牌' }
];

const EXTRA_HU = [
  { key: 'yiGeWu', name: '一个五', desc: '某一门只有一张五' },
  { key: 'sanWuSanBa', name: '三个五三个八', desc: '三五/三八筒各胡一把' },
  { key: 'sanLianDui', name: '三连对', desc: '同门三副连续对子' },
  { key: 'sanTong', name: '三同', desc: '三门同点数各一对' },
  { key: 'erTongErTiao', name: '二筒二条', desc: '一对二筒 + 一对二条' }
];

const THEMES = [
  { value: 'mist', label: '雾青', swatch: 'theme-swatch-mist' },
  { value: 'sand', label: '暖砂', swatch: 'theme-swatch-sand' },
  { value: 'ink', label: '夜潭', swatch: 'theme-swatch-ink' }
];

function Section({ icon: Icon, title, desc, children, right }) {
  return (
    <section className="info-block">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-jade-200)]/45 text-[var(--color-jade-600)]">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="section-title">{title}</h3>
            {desc && <p className="section-desc">{desc}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HuOption({ item, checked, onToggle }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
        checked
          ? 'border-[var(--color-jade-300)] bg-[var(--color-jade-200)]/20'
          : 'border-stone-200 bg-stone-50/60 hover:bg-stone-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-jade-600)]"
      />
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-stone-800">{item.name}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-stone-400">{item.desc}</span>
      </span>
    </label>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  rulesLocked = false,
  lockNote = ''
}) {
  const modalA11y = useModalA11y(onClose);

  if (!isOpen) return null;

  const setConfig = (patch) => onUpdateConfig({ ...config, ...patch });

  const handleToggleStartingHu = (key) => {
    setConfig({
      startingHu: { ...config.startingHu, [key]: !config.startingHu[key] }
    });
  };

  const clampIntField = (value, min) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(100, Math.max(min, n));
  };

  return (
    <div {...modalA11y} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-2xl animate-modal-in">
        <div className="modal-head">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-stone-900">规则与设置</h2>
              <p className="mt-0.5 text-[10px] text-stone-400">
                规则遵循长沙本地打法 · 联机时由房主同步并在开局后锁定
              </p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="关闭设置">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="modal-body space-y-3">
          {lockNote && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{lockNote}</span>
            </div>
          )}

          {/* 计分与开杠 */}
          <Section
            icon={Zap}
            title="计分与开杠"
            desc="小胡 2B；大胡 7B × k；单家封顶 42B，2F 不参与翻番与封顶。"
            right={
              <span className="whitespace-nowrap rounded-full bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-500">
                封顶 {42 * (config.baseScore || 1)}
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
                <span className="whitespace-nowrap text-[11px] font-medium text-stone-500">基础分 B</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  disabled={rulesLocked}
                  value={config.baseScore ?? 1}
                  onChange={(e) => setConfig({ baseScore: clampIntField(e.target.value, 1) })}
                  className="field w-16 py-1 text-right font-mono text-xs disabled:opacity-50"
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
                <span className="whitespace-nowrap text-[11px] font-medium text-stone-500">固定分 F</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={rulesLocked}
                  value={config.fixedScore ?? 1}
                  onChange={(e) => setConfig({ fixedScore: clampIntField(e.target.value, 0) })}
                  className="field w-16 py-1 text-right font-mono text-xs disabled:opacity-50"
                />
              </label>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-stone-500">开杠补牌</div>
                <div className="segmented grid-cols-2">
                  {[2, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setConfig({ kongDrawCount: count })}
                      data-active={config.kongDrawCount === count}
                      className="seg-btn"
                    >
                      {count} 只
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-stone-500">开杠是否需要将</div>
                <div className="segmented grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ kongRequiresJiang: true })}
                    data-active={!!config.kongRequiresJiang}
                    className="seg-btn"
                  >
                    需要
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ kongRequiresJiang: false })}
                    data-active={!config.kongRequiresJiang}
                    className="seg-btn"
                  >
                    不需要
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-stone-500">胡牌扎鸟</span>
                <span className="text-[10px] text-stone-400">
                  {config.birdCount === 0 ? '不抓鸟' : `抓 ${config.birdCount} 只`}
                </span>
              </div>
              <div className="segmented grid-cols-3">
                {[0, 2, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setConfig({ birdCount: num })}
                    data-active={config.birdCount === num}
                    className="seg-btn"
                  >
                    {num === 0 ? '不抓' : `${num} 只`}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* 起手胡 */}
          <Section icon={Palette} title="桌面与声音" desc="只影响本机显示与播放，不改变规则。">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => setConfig({ theme: theme.value })}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                    (config.theme || 'mist') === theme.value
                      ? 'border-[var(--color-jade-300)] bg-[var(--color-jade-200)]/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <span className={`${theme.swatch} h-6 w-6 shrink-0 rounded-full border border-black/10 shadow-inner`} />
                  <span className="text-[11px] font-semibold text-stone-700">{theme.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
                <Feather className="h-3.5 w-3.5" />
                报牌语音
                <span className="text-[10px] font-normal text-stone-400">来自黄金岛长沙话录音</span>
              </div>
              <div className="segmented grid-cols-3">
                {[
                  { value: 'f', label: '女声' },
                  { value: 'm', label: '男声' },
                  { value: 'off', label: '关闭' }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setConfig({ voice: item.value })}
                    data-active={(config.voice || 'f') === item.value}
                    className="seg-btn"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
                  <Volume2 className="h-3.5 w-3.5" />
                  游戏音效
                </span>
                <input
                  type="checkbox"
                  checked={config.soundEnabled}
                  onChange={(e) => setConfig({ soundEnabled: e.target.checked })}
                  className="peer sr-only"
                />
                <span className="toggle" aria-hidden="true" />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  听牌提示
                </span>
                <input
                  type="checkbox"
                  checked={config.showHints}
                  onChange={(e) => setConfig({ showHints: e.target.checked })}
                  className="peer sr-only"
                />
                <span className="toggle" aria-hidden="true" />
              </label>
            </div>
          </Section>

          <Section
            icon={Sparkles}
            title="起手胡 / 中途四喜"
            desc="勾选后开局立即判定，按小胡自摸结算，然后继续正常行牌。"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTING_HU.map((item) => (
                <HuOption
                  key={item.key}
                  item={item}
                  checked={!!config.startingHu[item.key]}
                  onToggle={() => handleToggleStartingHu(item.key)}
                />
              ))}
            </div>
            <details className="mt-2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-medium text-stone-500">
                规格外的番型（默认关闭）
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXTRA_HU.map((item) => (
                  <HuOption
                    key={item.key}
                    item={item}
                    checked={!!config.startingHu[item.key]}
                    onToggle={() => handleToggleStartingHu(item.key)}
                  />
                ))}
              </div>
            </details>
          </Section>

          {/* 桌面与声音 */}
          <p className="px-1 text-[10px] leading-relaxed text-stone-400">
            计分公式：小胡 2B；大胡 7B × k（k 为番型个数，线性相加）；每家应付 = min(底分 × (n+1), 42B) + 2F。
            自摸三家分别付；点炮只有放炮者付；通炮按每位胡家的番型与 n 单独结算。
          </p>
        </div>

        <div className="modal-foot">
          <button onClick={onClose} className="btn-primary h-9 px-6 text-xs">
            保存并返回
          </button>
        </div>
      </div>
    </div>
  );
}

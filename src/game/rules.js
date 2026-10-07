// 房间规则（Room rules）：规格 §一 要求「B、F 均由玩家在房间规则设置中自定，
// **联机时同步给所有人，开局后锁定**」。本模块是这条规则的唯一真相源：
// 纯函数、无 React / 无 DOM / 无网络，便于单测（见 test/rules.test.js）。
//
// 分清两类配置：
//   · 影响对局的「房间规则」：B/F、开杠摸牌数、开杠是否需将、起手胡开关、抓鸟数
//     → 房主说了算，联机时广播给所有座位，开局后客人不可改；
//   · 本机偏好：自动理牌、提示、音效、AI 速度 → 各人自己的，不参与同步。
import { normalizeScoreParams } from '../utils/scoring.js';

/** 参与同步的规则字段（顺序即界面展示顺序） */
export const MATCH_RULE_FIELDS = [
  'baseScore',
  'fixedScore',
  'kongDrawCount',
  'kongRequiresJiang',
  'startingHu',
  'birdCount'
];

export const RULE_BOUNDS = {
  baseScore: [1, 100],      // B：整数 1–100
  fixedScore: [0, 100],     // F：整数 0–100（可为 0）
  kongDrawCount: [2, 4],    // 开杠摸牌：2 只 / 4 只
  birdCount: [0, 4]         // 抓鸟：0（不抓）/ 2 / 4
};

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

const bool = (value, fallback = false) =>
  (typeof value === 'boolean' ? value : fallback);

/**
 * 从本机 config 里挑出「房间规则」（并逐项校验/夹取，防止非法值跨端传播）
 * @param {object} config
 * @returns {{baseScore:number, fixedScore:number, kongDrawCount:number, kongRequiresJiang:boolean, startingHu:object, birdCount:number}}
 */
export function pickMatchRules(config = {}) {
  const src = config && typeof config === 'object' ? config : {};
  const { B, F } = normalizeScoreParams(src);
  const rawHu = src.startingHu && typeof src.startingHu === 'object' ? src.startingHu : {};
  const startingHu = {};
  for (const [key, value] of Object.entries(rawHu)) {
    if (typeof value === 'boolean') startingHu[key] = value;
  }
  // 抓鸟只允许 0 / 2 / 4（其他值就近归到 0）
  const birdRaw = clampInt(src.birdCount, 0, 4, 0);
  const birdCount = [0, 2, 4].includes(birdRaw) ? birdRaw : 0;
  return {
    baseScore: clampInt(B, RULE_BOUNDS.baseScore[0], RULE_BOUNDS.baseScore[1], 1),
    fixedScore: clampInt(F, RULE_BOUNDS.fixedScore[0], RULE_BOUNDS.fixedScore[1], 1),
    kongDrawCount: clampInt(src.kongDrawCount, 2, 4, 2) === 4 ? 4 : 2,
    kongRequiresJiang: bool(src.kongRequiresJiang, true),
    startingHu,
    birdCount
  };
}

/**
 * 客人侧：把房主下发的规则套到本机配置上
 * 规则字段一律以房主为准（本机同名字段被覆盖），本机偏好原样保留。
 */
export function applyHostRules(localConfig = {}, hostRules = {}) {
  const host = pickMatchRules(hostRules);
  return { ...localConfig, ...host };
}

/** 两套规则是否等价（只比参与同步的字段） */
export function rulesEqual(a, b) {
  const x = pickMatchRules(a);
  const y = pickMatchRules(b);
  return JSON.stringify(x) === JSON.stringify(y);
}

/** 一行人类可读的规则摘要（大厅/对局中展示用） */
export function describeRules(config = {}) {
  const r = pickMatchRules(config);
  const bird = r.birdCount > 0 ? `抓 ${r.birdCount} 鸟` : '不抓鸟';
  const kong = `开杠摸 ${r.kongDrawCount} 只${r.kongRequiresJiang ? '·需将' : '·不需将'}`;
  const huOn = Object.values(r.startingHu).filter(Boolean).length;
  return `B=${r.baseScore} · F=${r.fixedScore} · ${bird} · ${kong} · 起手胡 ${huOn} 项`; 
}

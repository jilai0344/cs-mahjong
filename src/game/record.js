// 本机对局记录（用户裁定：等级/战绩**只能靠四人对战积累**，刷 AI 电脑不算）
//
// 裁定要点（2026-10）：
//   ① 只保存在本机 localStorage，只显示给自己看 —— 没有服务端，数据可被本机主人修改，
//      所以界面上明确标注「本机记录」，不冒充可信等级，也不在房间内互相展示。
//   ② **只有四人对战计入**：必须 4 个真人满座，且本局全程没有出现「托管」（掉线/看门狗接管）。
//      单机练习、AI 补位、中途有人被托管 → 一律不计。
//   ③ 积累口径 = 四人对战里的**分数净变化**，另外记录场次与胜/负/平，便于后面再算胜率或分档。
//
// 纯函数 + 注入 storage，方便单测（见 test/record.test.js）。
export const RECORD_KEY = 'cs_records_v1';

export const EMPTY_RECORD = Object.freeze({
  version: 1,
  matches: 0,      // 计入的对局场次（仅 4 真人局）
  netScore: 0,     // 累计分数净变化
  wins: 0,
  losses: 0,
  draws: 0,
  lastPlayedAt: 0
});

/**
 * 本局是否算「四人对战」（可计入记录）
 * @param {{seats:Array<{isHuman?:boolean}>, tookOver?:boolean}} input
 *        seats：四个座位（含自己）；tookOver：本局是否出现过托管
 * @returns {boolean}
 */
export function isRankedMatch({ seats, tookOver = false } = {}) {
  if (tookOver) return false;                                   // 出现过托管 → 本局不计
  if (!Array.isArray(seats) || seats.length !== 4) return false;
  return seats.every((s) => s && s.isHuman === true);            // 必须 4 个真人满座
}

/** 把任意来源的数据规整成合法记录（缺字段补 0，非法值丢弃） */
export function normalizeRecord(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const int = (v) => (Number.isFinite(v) ? Math.trunc(v) : 0);
  return {
    version: 1,
    matches: Math.max(0, int(src.matches)),
    netScore: int(src.netScore),
    wins: Math.max(0, int(src.wins)),
    losses: Math.max(0, int(src.losses)),
    draws: Math.max(0, int(src.draws)),
    lastPlayedAt: Math.max(0, int(src.lastPlayedAt))
  };
}

/**
 * 结算一局到记录里（只应在 isRankedMatch 为真时调用）
 * @param {object} record 现有记录
 * @param {number} scoreDelta 本局自己的分数净变化（可为负）
 * @param {number} at 时间戳（可注入，便于测试）
 */
export function applyRoundToRecord(record, scoreDelta, at = 0) {
  const base = normalizeRecord(record);
  const delta = Number.isFinite(scoreDelta) ? Math.trunc(scoreDelta) : 0;
  return {
    ...base,
    matches: base.matches + 1,
    netScore: base.netScore + delta,
    wins: base.wins + (delta > 0 ? 1 : 0),
    losses: base.losses + (delta < 0 ? 1 : 0),
    draws: base.draws + (delta === 0 ? 1 : 0),
    lastPlayedAt: at > 0 ? at : base.lastPlayedAt
  };
}

/** 胜率（%），没有场次时返回 null（避免显示 0% 误导） */
export function winRate(record) {
  const r = normalizeRecord(record);
  if (r.matches === 0) return null;
  return Math.round((r.wins / r.matches) * 100);
}

/** @param {{getItem:Function, setItem:Function}|null} storage */
export function loadRecord(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || typeof storage.getItem !== 'function') return { ...EMPTY_RECORD };
  try {
    const raw = storage.getItem(RECORD_KEY);
    if (!raw) return { ...EMPTY_RECORD };
    return normalizeRecord(JSON.parse(raw));
  } catch {
    return { ...EMPTY_RECORD }; // 解析失败（隐私模式/数据损坏）→ 当作空记录，不抛错
  }
}

export function saveRecord(storage, record) {
  const clean = normalizeRecord(record);
  if (!storage || typeof storage.setItem !== 'function') return clean;
  try {
    storage.setItem(RECORD_KEY, JSON.stringify(clean));
  } catch {
    // 存不进去（配额满/隐私模式）也不影响对局
  }
  return clean;
}

/**
 * 便利函数：读 → 累加一局 → 写，返回新记录
 * @returns {object} 更新后的记录
 */
export function recordRound(storage, { scoreDelta, at = Date.now() } = {}) {
  const updated = applyRoundToRecord(loadRecord(storage), scoreDelta, at);
  saveRecord(storage, updated);
  return updated;
}

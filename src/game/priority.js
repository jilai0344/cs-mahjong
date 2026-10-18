// 长沙麻将 · 一张牌的响应优先级（纯函数，供 App 与单测共用）
//
// 背景（ROADMAP P1-2）：旧实现是「谁先被检查到谁说了算」——
//   ① 本地真人只要有任何选项（哪怕只是「碰」）就 return，**永远轮不到后面评估 AI 的胡** ⇒ 真人碰掉 AI 的胡；
//   ② 真人「过」之后直接轮到下家，其他座位的胡/杠也被吞掉。
// 正确顺序是固定的：胡 > 杠 > 碰 > 吃（胡优先于任何吃碰杠，不管是谁的座位）；
// 同级之间按下家顺位（距打牌者最近者优先，麻将惯例），多家能胡时**同时成立**（一炮多响/通炮）。
//
// 这里只做「谁赢、赢什么」的纯判定，不含任何 UI 与网络。

export const RESPONSE_PRIORITY = { hu: 3, gang: 2, peng: 1, chi: 0 };

/**
 * 某座位在四个选项里最优的那一个
 * @param {{hu?:boolean, gang?:boolean, peng?:boolean, chi?:boolean}} can
 * @returns {'hu'|'gang'|'peng'|'chi'|null}
 */
export function bestResponseOf(can = {}) {
  if (can.hu) return 'hu';
  if (can.gang) return 'gang';
  if (can.peng) return 'peng';
  if (can.chi) return 'chi';
  return null;
}

/**
 * 一张弃牌该由谁响应、响应什么
 * @param {Array<{seat:number, distance:number, isHuman?:boolean, hu?:boolean, gang?:boolean, peng?:boolean, chi?:boolean}>} candidates
 *        distance = 相对打牌者的顺位（1 = 下家），用于同级抢牌时排序
 * @returns {{action:'pass'}
 *          |{action:'hu', winners:number[]}
 *          |{action:'gang'|'peng'|'chi', seat:number, claimants:number[]}}
 */
export function resolveDiscardResponses(candidates = []) {
  const list = (Array.isArray(candidates) ? candidates : [])
    .filter(c => c && typeof c.seat === 'number')
    .map(c => ({ ...c, action: bestResponseOf(c) }))
    .filter(c => c.action)
    .sort((a, b) => a.distance - b.distance);

  if (list.length === 0) return { action: 'pass' };

  const topWeight = Math.max(...list.map(c => RESPONSE_PRIORITY[c.action]));
  const topAction = Object.keys(RESPONSE_PRIORITY).find(k => RESPONSE_PRIORITY[k] === topWeight);

  if (topAction === 'hu') {
    // 一炮多响：**所有**能胡的座位同时成立（不是只留一个），按顺位返回便于逐家结算
    return { action: 'hu', winners: list.filter(c => c.hu).map(c => c.seat) };
  }

  // 杠/碰/吃：同级按顺位，只有最近的一家成立；吃只有下家（distance === 1）
  const pool = topAction === 'chi' ? list.filter(c => c.distance === 1) : list;
  const claimants = pool.filter(c => c.action === topAction).map(c => c.seat);
  if (claimants.length === 0) return { action: 'pass' };
  return { action: topAction, seat: claimants[0], claimants };
}

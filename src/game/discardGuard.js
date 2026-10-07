// 出牌防误触（P2-1 / P2-6④）：纯状态机，注入时钟，便于单测。
//
// 现状问题：原来「点一次选中、再点同一张牌就打出」—— 手快连点两下（或双击）就直接把牌打出去了，
// 麻将里打错一张常常就废了一局。
//
// 规则：
//   ① 第一次点击只「选中」，绝不打出；
//   ② 再点同一张牌，必须与选中时刻相隔 ≥ delay（默认 250ms）才允许打出 ——
//      双击/连点的间隔通常 < 200ms，因此不会被误判成确认；
//   ③ 点另一张牌只切换选中；
//   ④ 显式「打出」按钮（recommend 路径）不受延迟限制，点哪张打哪张。
export const DISCARD_CONFIRM_DELAY_MS = 250;

export function createDiscardGuard({ delay = DISCARD_CONFIRM_DELAY_MS } = {}) {
  const wait = Number.isFinite(delay) && delay >= 0 ? delay : DISCARD_CONFIRM_DELAY_MS;
  let selectedId = null;
  let selectedAt = 0;

  return {
    delay: wait,
    selected() {
      return selectedId;
    },
    /** 点击手牌：返回 { action: 'select' | 'discard', allowed, tileId, waited } */
    select(tileId, now = 0) {
      if (selectedId === tileId) {
        const waited = now - selectedAt;
        return { action: 'discard', allowed: waited >= wait, tileId, waited };
      }
      selectedId = tileId;
      selectedAt = now;
      return { action: 'select', allowed: false, tileId, waited: 0 };
    },
    /** 显式「打出」按钮：只对当前选中的牌生效 */
    requestExplicit(tileId) {
      return { action: 'discard', allowed: selectedId === tileId, tileId, waited: null, via: 'button' };
    },
    clear() {
      selectedId = null;
      selectedAt = 0;
    }
  };
}

/** 手牌下方那行提示（P2-1：把「怎么打出去」说清楚） */
export function discardHint(selectedId, tooFast = false) {
  if (tooFast) return '⚠ 连点不会打出（防误触）：请再点一次，或按右下「打出」';
  return selectedId ? '✦ 已选中：再点一次这张牌，或按右下「打出」' : '✦ 点击选择一张牌打出';
}

// 长沙麻将 · 客户端操作窗口判定（纯函数，供 App 与单测共用）
//
// 背景（ROADMAP P0-5）：本地玩家面对「吃/碰/杠/胡/过」提示若一直不点，旧实现里倒计时只处理
// 「轮到自己出牌」，响应窗口没有任何超时兜底 → 整局永久卡死（单机也会踩）。
// 这里把判定抽成纯函数，便于表驱动单测。

/**
 * 是否处于「等待本地玩家响应」的窗口（吃/碰/杠/胡/中途四喜/过 任一为真）
 * @param {{hu?:boolean,siXi?:boolean,gang?:boolean,peng?:boolean,chi?:boolean,pass?:boolean}} actions
 * @returns {boolean}
 */
export function hasPendingResponse(actions = {}) {
  if (!actions || typeof actions !== 'object') return false;
  return !!(actions.hu || actions.siXi || actions.gang || actions.peng || actions.chi || actions.pass);
}

/**
 * 倒计时归零时该做什么
 * @param {{currentTurn:number, mySeatId:number, pendingResponse:boolean}} input
 * @returns {'discard'|'pass'|'none'}
 *   · 'discard'：轮到自己出牌 → 超时自动打一张
 *   · 'pass'   ：别人出牌后等自己响应（吃碰杠胡）→ 超时自动「过」，让牌局继续
 *   · 'none'   ：没轮到自己、也没有待响应窗口 → 什么都不做
 */
export function resolveTimeoutAction({ currentTurn, mySeatId, pendingResponse }) {
  if (currentTurn === mySeatId) return 'discard';
  if (pendingResponse) return 'pass';
  return 'none';
}

/** 响应窗口超时秒数（与界面倒计时一致） */
export const RESPONSE_TIMEOUT_SECONDS = 15;

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

/** 房主托管看门狗：轮到的真人多久没出牌就降级为 AI（客户端出牌倒计时 15 秒 + 余量） */
export const HOST_TURN_TIMEOUT_MS = 22000;

/**
 * 房主侧「掉线托管」看门狗该不该为这一手起表。
 * 背景（P0-4）：出牌超时兜底只存在于「轮到自己」的那个客户端（P0-5）。
 * 若轮到的是别人（联机真人）而他的客户端挂了/标签页被冻结，房主会一直等 DISCARD_ACTION → 整局永久卡死。
 * 心跳看门狗虽然会把座位降级成 AI，但降级只改大厅状态、不接管这一手，牌局依然停着。
 *
 * @param {{isHost:boolean, gameState:string, currentTurn:number, mySeatId:number, seatIsHuman:boolean, timeoutMs?:number}} input
 * @returns {number|null} 需要起表则返回超时毫秒数；该由别人/别的机制负责时返回 null
 */
export function hostTurnWatchdogDelay({ isHost, gameState, currentTurn, mySeatId, seatIsHuman, timeoutMs = HOST_TURN_TIMEOUT_MS }) {
  if (!isHost) return null;                                  // 只有房主是权威端
  if (gameState !== 'PLAYING') return null;
  if (currentTurn === mySeatId) return null;                 // 自己的回合由本地出牌倒计时兜底
  if (!seatIsHuman) return null;                             // AI 回合由 AI 逻辑推进，无需看门狗
  return timeoutMs;
}

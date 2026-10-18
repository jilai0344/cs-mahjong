// 长沙麻将 · 操作窗口判定测试（ROADMAP P0-5：响应窗口超时兜底）
// 运行：npm test（串在最后）
import { hasPendingResponse, resolveTimeoutAction, RESPONSE_TIMEOUT_SECONDS, hostTurnWatchdogDelay, HOST_TURN_TIMEOUT_MS } from '../src/game/actions.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) passed++;
  else { failed++; failures.push(message); console.error(`  ✗ FAIL: ${message}`); }
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${message}（实际 ${a} ≠ 期望 ${e}）`);
}

console.log('=== 测试 1: 是否处于「等待本地玩家响应」的窗口 ===');
{
  eq(hasPendingResponse({ hu: true }), true, '可胡 → 处于响应窗口');
  eq(hasPendingResponse({ peng: true }), true, '可碰 → 处于响应窗口');
  eq(hasPendingResponse({ chi: true }), true, '可吃 → 处于响应窗口');
  eq(hasPendingResponse({ gang: true }), true, '可杠 → 处于响应窗口');
  eq(hasPendingResponse({ siXi: true }), true, '可中途四喜 → 处于响应窗口');
  eq(hasPendingResponse({ pass: true }), true, '仅「过」也算响应窗口（提示已经弹出）');
  eq(hasPendingResponse({ hu: false, siXi: false, gang: false, peng: false, chi: false, pass: false }), false,
    '六个操作全 false → 无响应窗口');
  eq(hasPendingResponse({}), false, '空对象 → 无响应窗口');
  eq(hasPendingResponse(undefined), false, 'undefined → 无响应窗口（不抛错）');
}

console.log('\n=== 测试 2: 倒计时归零该做什么（表驱动）===');
{
  const cases = [
    // [当前回合, 我的座位, 是否有待响应, 期望]
    [0, 0, false, 'discard'],
    [0, 0, true, 'discard'],   // 轮到自己出牌时优先自动打牌（自摸/碰杠提示也一并超时）
    [1, 0, true, 'pass'],      // 别人打牌后等我吃碰杠胡 → 超时自动「过」，牌局继续（修复前：永久卡死）
    [3, 0, true, 'pass'],
    [1, 0, false, 'none'],     // 没轮到我、也没有待响应 → 什么都不做
    [2, 0, false, 'none'],
    [2, 2, false, 'discard'],  // 我坐 2 号位时轮到我
    [1, 2, true, 'pass'],
    [0, 2, false, 'none']
  ];
  cases.forEach(([currentTurn, mySeatId, pendingResponse, expected]) => {
    eq(resolveTimeoutAction({ currentTurn, mySeatId, pendingResponse }), expected,
      `currentTurn=${currentTurn} mySeat=${mySeatId} 待响应=${pendingResponse} → ${expected}`);
  });
  eq(RESPONSE_TIMEOUT_SECONDS, 15, '响应窗口超时 = 15 秒（与界面倒计时一致）');
}

console.log('\n=== 测试 3: 回归——旧实现只处理「轮到自己」，响应窗口会永久卡死 ===');
{
  // 模拟旧逻辑：只在「轮到自己」时做事
  const legacyTick = ({ currentTurn, mySeatId }) => (currentTurn === mySeatId ? 'discard' : 'none');
  const scenario = { currentTurn: 1, mySeatId: 0, pendingResponse: true };
  eq(legacyTick(scenario), 'none', '旧逻辑在响应窗口下什么都不做（这就是卡死的原因）');
  eq(resolveTimeoutAction(scenario), 'pass', '新逻辑在同样的场景下自动「过」，牌局可以继续');
}

console.log('\n=== 测试 4: 房主托管看门狗该不该为这一手起表（表驱动）===');
{
  const base = { isHost: true, gameState: 'PLAYING', currentTurn: 2, mySeatId: 0, seatIsHuman: true };
  eq(hostTurnWatchdogDelay(base), HOST_TURN_TIMEOUT_MS, '房主 + 行牌中 + 轮到真人访客 → 起表（22 秒）');
  eq(HOST_TURN_TIMEOUT_MS, 22000, '看门狗时长 = 22 秒 > 客户端出牌倒计时 15 秒（留余量，避免误杀慢网络）');

  const cases = [
    [{ ...base, isHost: false }, null, '访客不是权威端 → 不起表（由房主统一托管）'],
    [{ ...base, gameState: 'IDLE' }, null, '未开局 → 不起表'],
    [{ ...base, gameState: 'ROUND_OVER' }, null, '本局已结束 → 不起表'],
    [{ ...base, gameState: 'DEALING' }, null, '发牌中 → 不起表'],
    [{ ...base, currentTurn: 0 }, null, '轮到房主自己 → 不起表（本地出牌倒计时已兜底）'],
    [{ ...base, currentTurn: 2, mySeatId: 2 }, null, '我这个客户端轮到自己（访客视角）→ 不起表'],
    [{ ...base, seatIsHuman: false }, null, '轮到电脑 AI → 不起表（AI 逻辑自己推进）'],
    [{ ...base, currentTurn: 1, seatIsHuman: true }, HOST_TURN_TIMEOUT_MS, '轮到 1 号位真人 → 起表'],
    [{ ...base, currentTurn: 3, seatIsHuman: true }, HOST_TURN_TIMEOUT_MS, '轮到 3 号位真人 → 起表']
  ];
  cases.forEach(([input, expected, label]) => {
    eq(hostTurnWatchdogDelay(input), expected, label);
  });
}

console.log('\n=== 测试 5: 回归——只有心跳看门狗会永久卡死 ===');
{
  // 旧实现：心跳看门狗把座位降级成 AI，但只改大厅状态、不接管当前这一手
  const legacyOnHeartbeatTimeout = () => ({ seatRevertedToAI: true, turnTakenOver: false });
  const now = (input) => ({
    seatRevertedToAI: true,
    turnTakenOver: hostTurnWatchdogDelay(input) !== null
  });
  const input = { isHost: true, gameState: 'PLAYING', currentTurn: 1, mySeatId: 0, seatIsHuman: true };

  eq(legacyOnHeartbeatTimeout(), { seatRevertedToAI: true, turnTakenOver: false },
    '旧实现：座位变成 AI 了，但没人管这一手 → 牌局停在「等一个不在的人出牌」（整局冒烟实测卡死）');
  eq(now(input).turnTakenOver, true, '新实现：看门狗判定该托管 → 交给 AI 接管出牌');
  eq(hostTurnWatchdogDelay({ ...input, seatIsHuman: false }), null,
    '座位已经是 AI 后看门狗自动收手（避免重复托管）');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

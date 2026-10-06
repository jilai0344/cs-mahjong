// 长沙麻将 · 一张牌的响应优先级测试（ROADMAP P1-2）
// 运行：npm test（串在最后）
import { RESPONSE_PRIORITY, bestResponseOf, resolveDiscardResponses } from '../src/game/priority.js';
import { scoreRound, huEntryFromTypes } from '../src/utils/scoring.js';

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

console.log('=== 测试 1: 优先级权重与「最优选项」===');
{
  eq(RESPONSE_PRIORITY, { hu: 3, gang: 2, peng: 1, chi: 0 }, '胡 > 杠 > 碰 > 吃');
  eq(bestResponseOf({ hu: true, gang: true, peng: true, chi: true }), 'hu', '四个都能 → 胡');
  eq(bestResponseOf({ gang: true, peng: true, chi: true }), 'gang', '杠/碰/吃 → 杠');
  eq(bestResponseOf({ peng: true, chi: true }), 'peng', '碰/吃 → 碰');
  eq(bestResponseOf({ chi: true }), 'chi', '只有吃 → 吃');
  eq(bestResponseOf({}), null, '都没有 → null');
  eq(bestResponseOf(undefined), null, 'undefined → null（不抛错）');
}

console.log('\n=== 测试 2: 谁响应这张牌（表驱动）===');
{
  const C = (seat, distance, can, isHuman = false) => ({ seat, distance, isHuman, ...can });

  eq(resolveDiscardResponses([]), { action: 'pass' }, '没人能响应 → 过');
  eq(resolveDiscardResponses([C(1, 1, {})]), { action: 'pass' }, '有座位但不能响应 → 过');

  eq(resolveDiscardResponses([C(2, 2, { hu: true })]), { action: 'hu', winners: [2] }, '一家能胡 → 该家胡');

  // 一炮多响（通炮）：所有能胡的座位同时成立，按顺位返回
  eq(resolveDiscardResponses([C(2, 2, { hu: true }), C(3, 3, { hu: true })]),
    { action: 'hu', winners: [2, 3] }, '两家能胡 → 两家同时胡（一炮多响）');
  eq(resolveDiscardResponses([C(3, 3, { hu: true }), C(1, 1, { hu: true })]),
    { action: 'hu', winners: [1, 3] }, '一炮多响按顺位排序返回');

  // 胡优先于任何吃碰杠（ROADMAP P1-2 ①）
  eq(resolveDiscardResponses([C(0, 3, { peng: true, chi: true }), C(2, 2, { hu: true })]),
    { action: 'hu', winners: [2] }, '本地真人能碰/吃，别家能胡 → 胡赢（真人的碰不得吞掉 AI 的胡）');
  eq(resolveDiscardResponses([C(0, 1, { gang: true }), C(3, 3, { hu: true })]),
    { action: 'hu', winners: [3] }, '真人能杠、别家能胡 → 胡赢');
  eq(resolveDiscardResponses([C(1, 1, { hu: true, peng: true }), C(2, 2, { gang: true })]),
    { action: 'hu', winners: [1] }, '同一家既能胡又能碰 → 按胡算');

  // 杠 > 碰 > 吃
  eq(resolveDiscardResponses([C(1, 1, { peng: true }), C(2, 2, { gang: true })]),
    { action: 'gang', seat: 2, claimants: [2] }, '杠 > 碰');
  eq(resolveDiscardResponses([C(1, 1, { chi: true }), C(2, 2, { peng: true })]),
    { action: 'peng', seat: 2, claimants: [2] }, '碰 > 吃');
  eq(resolveDiscardResponses([C(1, 1, { peng: true })]),
    { action: 'peng', seat: 1, claimants: [1] }, '只有一家能碰 → 该家碰');

  // 同级抢牌：按下家顺位，最近者得
  eq(resolveDiscardResponses([C(3, 3, { peng: true }), C(1, 1, { peng: true })]),
    { action: 'peng', seat: 1, claimants: [1, 3] }, '两家都能碰 → 距出牌者最近的（下家）先碰');
  eq(resolveDiscardResponses([C(3, 3, { gang: true }), C(1, 1, { gang: true })]),
    { action: 'gang', seat: 1, claimants: [1, 3] }, '两家都能杠 → 下家先杠');

  // 吃只有下家能吃（上家打牌只能被下家吃）
  eq(resolveDiscardResponses([C(2, 2, { chi: true }), C(3, 3, { chi: true })]),
    { action: 'pass' }, '不是下家的「吃」候选一律不成立');
  eq(resolveDiscardResponses([C(1, 1, { chi: true }), C(3, 3, { chi: true })]),
    { action: 'chi', seat: 1, claimants: [1] }, '只有下家能吃');

  // 入参健壮性
  eq(resolveDiscardResponses(null), { action: 'pass' }, 'null → 过（不抛错）');
  eq(resolveDiscardResponses([null, { hu: true }, { seat: 'x', hu: true }]), { action: 'pass' },
    '缺 seat/类型不对的候选被忽略');
}

console.log('\n=== 测试 3: 回归——旧实现「先检查本地真人，有选项就 return」===');
{
  // 旧逻辑（复刻）：本地真人有任何选项 → 直接弹窗并结束，永远走不到后面的 AI 胡判定
  const legacyResolve = (localHumanCan, aiCan) => {
    if (localHumanCan.hu || localHumanCan.gang || localHumanCan.peng || localHumanCan.chi) {
      return { action: 'prompt-local-human', swallowed: aiCan.hu ? 'ai-hu' : null };
    }
    return { action: 'ask-others' };
  };

  const r1 = legacyResolve({ peng: true }, { hu: true });
  eq(r1.swallowed, 'ai-hu', '旧实现：真人只能碰，也会吞掉 AI 的胡（这就是要修的 bug）');
  eq(r1.action, 'prompt-local-human', '旧实现：直接给真人弹窗，后面的判定被 return 掉');

  eq(resolveDiscardResponses([C_(0, 3, { peng: true }), C_(2, 2, { hu: true })]),
    { action: 'hu', winners: [2] }, '新实现：同样的局面由 AI 的胡成立，真人不会被弹碰/吃');

  // 反之，只有真人能胡而 AI 不能 → 仍然正常问真人
  eq(resolveDiscardResponses([C_(0, 3, { hu: true }), C_(2, 2, { peng: true })]),
    { action: 'hu', winners: [0] }, '真人能胡时照旧由真人胡（不会被 AI 的碰抢走）');
}

console.log('\n=== 测试 4: 一炮多响的分数守恒（ROADMAP P1-2 ②）===');
{
  // 放炮者 X=3（同时是计分庄位）；A=0 小胡、B=1 大胡 k=1
  // 鸟点 2 → 庄位下家(=座位 0)；3 → 庄位对家(=座位 1)
  const winners = [
    huEntryFromTypes(0, ['平胡']),      // 小胡 → k=0
    huEntryFromTypes(1, ['清一色'])     // 大胡 → k=1
  ];
  const r = scoreRound({
    method: 'tongpao', B: 1, F: 1,
    winners,
    discarderSeat: 3,
    birdValues: [2, 3]
  });

  eq(r.zeroSum, true, '通炮结算零和（所有玩家得失之和 = 0）');
  eq(r.dealerSeat, 3, '通炮的计分庄位 = 放炮者');
  eq(r.details.length, 2, '两位胡家各一条明细（各按自己的 k 与 n）');
  eq(r.details.map(d => d.winnerSeat), [0, 1], '明细逐家可追溯');
  eq(r.details.map(d => d.n), [1, 1], '两家各自的中鸟数 n（有效座位 = 庄位 + 该胡家）');
  eq(r.details.map(d => d.P), [6, 16], 'A 小胡 n=1 → 2×2+2=6；B 大胡 k=1 n=1 → 7×2+2=16');

  const total = r.details.reduce((s, d) => s + d.P, 0);
  eq(total, 22, '两家 P 之和 = 22');
  eq(r.changes[3], -total, '放炮者总付 = 各胡家 P 之和');
  eq([r.changes[0], r.changes[1], r.changes[2]], [6, 16, 0], '两位胡家各得，其余一家不付分');
  eq(r.changes.reduce((a, b) => a + b, 0), 0, '四家得失之和 = 0（守恒）');
  assert(r.details.every(d => d.P <= 42 * 1 + 2 * 1), '每家应付不超过 42B + 2F = 44');
}

// 便捷构造：与测试 2 的 C 同义（提到外层，供测试 3 使用）
function C_(seat, distance, can, isHuman = false) {
  return { seat, distance, isHuman, ...can };
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

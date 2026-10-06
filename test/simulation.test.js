// 长沙麻将 · 随机对局模拟（规格 §九.7）
// 1000 局随机对局，校验：
//   1. 每局得失分总和为 0
//   2. 每笔明细的 n 与 k 统计正确（n 用 countEffectiveBirds 独立复算；k = 番型里非平胡个数）
//   3. 单家应付不超过 42B + 2F，且封顶截断、2F 口径正确
//   4. 中途四喜触发后牌局能正常继续到结算
// 运行：npm test（串在 mahjongLogic + scoring 之后）
import { playSimulatedGame } from '../src/game/simulate.js';
import { countEffectiveBirds, CAP_BASE_MULTIPLIER } from '../src/utils/scoring.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) passed++;
  else { failed++; failures.push(message); console.error(`  ✗ FAIL: ${message}`); }
}

const GAMES = 1000;
const CASES = [
  { B: 1, F: 1, birdCount: 2 },
  { B: 2, F: 0, birdCount: 4 },
  { B: 5, F: 3, birdCount: 0 }
];
const CONFIG = { startingHu: { daSiXi: true, banBanHu: true, queYiSe: true, liuLiuShun: true, zhongTuSiXi: true }, kongRequiresJiang: true };

console.log('\n=== 测试: 1000 局随机对局模拟（规格 §九.7）===');

const summary = {
  games: 0, zeroSumBad: 0, capBad: 0, nBad: 0, kBad: 0, pBad: 0, negWallBad: 0,
  siXiGames: 0, siXiNotContinued: 0, guardHit: 0,
  kongs: 0, kongFlower: 0, kongPao: 0, robbingKong: 0,
  outcomes: {}, methods: {}, kDist: {}, nDist: {}, maxP: 0, settlements: 0
};

for (let i = 0; i < GAMES; i++) {
  const c = CASES[i % CASES.length];
  const config = { ...CONFIG, birdCount: c.birdCount };
  const game = playSimulatedGame({ seed: 100000 + i, B: c.B, F: c.F, config });
  summary.games++;
  summary.outcomes[game.outcome] = (summary.outcomes[game.outcome] || 0) + 1;
  summary.kongs += game.stats.kongs || 0;
  summary.kongFlower += game.stats.kongFlower || 0;
  summary.robbingKong += game.stats.robbingKong || 0;
  if (game.guardHit) summary.guardHit++;
  if (!game.zeroSum) summary.zeroSumBad++;
  if (game.siXiSeen) {
    summary.siXiGames++;
    // 中途四喜结算后必须还能继续行牌（后续摸牌/出牌/结算，或牌墙摸完形成流局），不能卡在四喜上
    const continues = game.eventsAfterSiXi > 0 || game.outcome === 'draw';
    if (!continues) summary.siXiNotContinued++;
  }

  for (const st of game.settlements) {
    summary.settlements++;
    summary.methods[st.method] = (summary.methods[st.method] || 0) + 1;
    if (st.kongDiscard) summary.kongPao++;
    const isQishouOrSiji = st.method === 'qishou' || st.method === 'siji';
    const cap = CAP_BASE_MULTIPLIER * c.B;
    for (const d of st.details) {
      // 3. 单家应付上限与公式
      summary.maxP = Math.max(summary.maxP, d.P);
      if (d.P > cap + 2 * c.F) summary.capBad++;
      if (d.P !== d.capped + d.fixed) summary.pBad++;
      if (d.capped !== Math.min(d.base * d.multiplier, cap)) summary.pBad++;
      if (d.cappedHit !== (d.base * d.multiplier > cap)) summary.pBad++;
      if (d.multiplier !== d.n + 1) summary.pBad++;
      if (d.fixed !== 2 * c.F) summary.pBad++;
      // 起手胡/中途四喜一律小胡（底分 2B），其余按 k
      if (isQishouOrSiji) { if (d.isBigHu || d.k !== 0 || d.base !== 2 * c.B) summary.kBad++; }
      else if (d.isBigHu) { if (d.k < 1 || d.base !== 7 * c.B * d.k) summary.kBad++; }
      else if (d.k !== 0 || d.base !== 2 * c.B) summary.kBad++;
      // 2. n 独立复算：有效座位 = {计分庄位, 该付分者}；通炮时另一位是「当前结算的胡牌者」
      const otherSeat = st.method === 'tongpao' ? d.winnerSeat : d.payerSeat;
      const expectN = countEffectiveBirds(st.birdValues, st.dealerSeat, otherSeat);
      if (d.n !== expectN) summary.nBad++;
      // 鸟点数不能超过规则设置的抓鸟数
      if (st.birdValues.length > c.birdCount) summary.nBad++;
      summary.kDist[d.k] = (summary.kDist[d.k] || 0) + 1;
      summary.nDist[d.n] = (summary.nDist[d.n] || 0) + 1;
    }
  }
}

console.log(`  局数 ${summary.games} · 结算笔数 ${summary.settlements} · 单笔最高应付 ${summary.maxP}`);
console.log('  结果分布:', JSON.stringify(summary.outcomes));
console.log('  结算方式:', JSON.stringify(summary.methods));
console.log('  大胡 k 分布:', JSON.stringify(summary.kDist));
console.log('  中鸟 n 分布:', JSON.stringify(summary.nDist));
console.log(`  中途四喜出现的局数 ${summary.siXiGames} · 其中未继续到结算 ${summary.siXiNotContinued}`);
console.log(`  开杠次数 ${summary.kongs} · 杠上开花 ${summary.kongFlower} 次 · 杠上炮/一炮多响（补牌入池被胡） ${summary.kongPao} 次 · 抢杠胡 ${summary.robbingKong} 次`);

assert(summary.games === GAMES, `模拟局数应为 ${GAMES}（实际 ${summary.games}）`);
assert(summary.zeroSumBad === 0, '每局得失分总和恒为 0');
assert(summary.capBad === 0, '任意一笔单家应付都不超过 42B + 2F');
assert(summary.pBad === 0, '每笔明细的乘数/封顶截断/2F/应付 P 与公式一致');
assert(summary.kBad === 0, 'k 与底分统计正确（起手胡/中途四喜强制小胡 k=0，大胡 base = 7B×k）');
assert(summary.nBad === 0, 'n 统计正确（用 countEffectiveBirds 独立复算；鸟数不超过规则设置）');
assert(summary.siXiNotContinued === 0, '中途四喜触发后牌局都能继续到结算');
assert(summary.guardHit === 0, '没有一局撞到 400 手保护上限（说明牌局都能自然收束）');
assert(summary.methods.dianpao > 0 || summary.methods.tongpao > 0, '模拟中确实出现了点炮或通炮结算');
assert(summary.methods.zimo > 0, '模拟中确实出现了自摸结算');
assert(summary.methods.qishou > 0, '模拟中确实出现了起手胡结算');
assert(summary.outcomes.draw > 0, '模拟中确实出现了流局（牌墙摸完）');
assert(summary.siXiGames > 0, '模拟中确实出现了中途四喜');
assert(summary.kongs > 0, '模拟中确实开了杠（覆盖含杠手牌的判定路径）');
assert(summary.kongFlower + summary.kongPao > 0,
  'Q1 修复后含杠手牌真的能胡：模拟里出现了杠上开花或杠上炮（修复前含杠永远不能胡）');

// 复现性：同一种子必须产出完全相同的牌局记录（含每次结算、骰子点数与明细）
{
  const cfg = { ...CONFIG, birdCount: 2 };
  const g1 = playSimulatedGame({ seed: 20261006, B: 1, F: 1, config: cfg });
  const g2 = playSimulatedGame({ seed: 20261006, B: 1, F: 1, config: cfg });
  assert(JSON.stringify(g1) === JSON.stringify(g2), '同一种子完全复现同一局（洗牌与骰子都走注入的种子随机源）');
  assert(g1.outcome !== undefined && g1.settlements.length >= 0, '复现样本本身是一局有效记录');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

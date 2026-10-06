// 长沙麻将 · 计分规则测试（表驱动）
// 对应规格：docs/SCORING.md（任务《重写长沙麻将计分系统》）
// 运行：npm test（先跑 mahjongLogic.test.js，再跑本文件）
import {
  scoreRound,
  payerAmount,
  countEffectiveBirds,
  birdSeat,
  capAmount,
  nextDealerSeat,
  drawDealerSeat,
  rollBirdDice,
  describeBirdHits,
  CAP_BASE_MULTIPLIER
} from '../src/utils/scoring.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${message}（实际 ${a} ≠ 期望 ${e}）`);
}

function throws(fn, message) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, message);
}

const B1 = 1, F1 = 1; // 规格第八节统一用 B=1、F=1（CAP=42）

// ------------------------------------------------------------------
console.log('=== 测试 1: 基础公式与封顶 ===');
{
  eq(payerAmount({ isBigHu: false, k: 1, B: 1, F: 1, n: 0 }),
    { base: 2, multiplier: 1, beforeCap: 2, cap: 42, capped: 2, cappedHit: false, fixed: 2, P: 4 },
    '小胡 n=0 → Base=2B，P=2B+2F');
  eq(payerAmount({ isBigHu: true, k: 1, B: 1, F: 1, n: 0 }),
    { base: 7, multiplier: 1, beforeCap: 7, cap: 42, capped: 7, cappedHit: false, fixed: 2, P: 9 },
    '大胡 k=1 n=0 → Base=7B，P=7B+2F');
  eq(payerAmount({ isBigHu: true, k: 3, B: 1, F: 1, n: 0 }).base, 21, '大胡线性相加：k=3 → Base=21B（非翻番）');
  eq(payerAmount({ isBigHu: true, k: 2, B: 2, F: 3, n: 2 }),
    { base: 28, multiplier: 3, beforeCap: 84, cap: 84, capped: 84, cappedHit: false, fixed: 6, P: 90 },
    'B/F 参与计算：B=2,F=3,k=2,n=2 → 84(正好=42B)+2F');
  eq(capAmount(2), 84, 'CAP = 42B（B=2 → 84）');
  eq(CAP_BASE_MULTIPLIER, 42, 'CAP 系数 = 42 = 6 × 7B');

  // 封顶边界
  const exact = payerAmount({ isBigHu: true, k: 6, B: 1, F: 1, n: 0 }); // 42B
  eq([exact.beforeCap, exact.capped, exact.cappedHit, exact.P], [42, 42, false, 44], '刚好等于封顶：不标记 cappedHit，P=42B+2F');
  const over = payerAmount({ isBigHu: true, k: 7, B: 1, F: 1, n: 0 }); // 49B
  eq([over.beforeCap, over.capped, over.cappedHit, over.P], [49, 42, true, 44], '刚好超出封顶：截断为 42B 并标记 cappedHit');
  const birdCap = payerAmount({ isBigHu: true, k: 2, B: 1, F: 1, n: 3 }); // 14×4=56
  eq([birdCap.beforeCap, birdCap.capped, birdCap.cappedHit, birdCap.P], [56, 42, true, 44], '鸟翻倍后超限：k=2,n=3 → 56 截断为 42B');
  eq(payerAmount({ isBigHu: true, k: 7, B: 1, F: 3, n: 0 }).P, 48, '固定分不受封顶：42B + 2F(=6)');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 2: 鸟点 → 座位映射（以计分庄位为基准）===');
{
  eq([1, 5, 9].map((v) => birdSeat(0, v)), [0, 0, 0], '1/5/9 → 庄位');
  eq([2, 6].map((v) => birdSeat(0, v)), [1, 1], '2/6 → 庄位下家');
  eq([3, 7].map((v) => birdSeat(0, v)), [2, 2], '3/7 → 庄位对家');
  eq([4, 8].map((v) => birdSeat(0, v)), [3, 3], '4/8 → 庄位上家');
  eq([1, 2, 3, 4].map((v) => birdSeat(1, v)), [1, 2, 3, 0], '庄位=1 时映射随庄位旋转');
  eq([1, 9].map((v) => birdSeat(2, v)), [2, 2], '庄位=2 时 1/9 落庄位');
  eq(countEffectiveBirds([1, 5, 3, 2], 0, 1), 3, 'n 只统计落在 {庄位, 该付分者} 的鸟（同座位可累加）');
  eq(countEffectiveBirds([1, 5, 3, 2], 0, 3), 2, 'n 逐家不同（上家 = 2）');
  eq(countEffectiveBirds([], 0, 1), 0, '不抓鸟（0 只）时 n = 0');
  eq(countEffectiveBirds([{ value: 1, name: '一万' }, { value: 4, name: '四筒' }], 0, 3), 2, '鸟点可直接传牌对象（终局翻牌场景）');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 3: 规格第八节 11 个验算示例（B=1, F=1, CAP=42）===');
{
  // 示例 1：小胡自摸，三家 n 均为 0 → 每家 4，共得 12
  const r1 = scoreRound({ method: 'zimo', B: B1, F: F1, winner: { seat: 0 }, birdValues: [] });
  eq(r1.details.map((d) => d.P), [4, 4, 4], '示例1 小胡自摸 n=0：每家付 4');
  eq(r1.changes, [12, -4, -4, -4], '示例1 胡牌者共得 12');
  assert(r1.zeroSum, '示例1 零和');

  // 示例 2：小胡点炮 n=2 → P=8（鸟点 1→庄位、2→下家=放炮者）
  const r2 = scoreRound({ method: 'dianpao', B: B1, F: F1, winner: { seat: 0 }, discarderSeat: 1, birdValues: [1, 2] });
  eq([r2.details[0].n, r2.details[0].P], [2, 8], '示例2 小胡点炮 n=2 → P=8');
  eq(r2.changes, [8, -8, 0, 0], '示例2 只有放炮者付，其余两家不付');
  assert(r2.zeroSum, '示例2 零和');

  // 示例 3：大胡点炮 k=1 n=0 → P=9
  const r3 = scoreRound({ method: 'dianpao', B: B1, F: F1, winner: { seat: 0, isBigHu: true, k: 1 }, discarderSeat: 2, birdValues: [] });
  eq(r3.details[0].P, 9, '示例3 大胡点炮 k=1 n=0 → P=9');
  assert(r3.zeroSum, '示例3 零和');

  // 示例 4：大胡自摸 k=1，三家 n = 1,1,0 → 16 / 16 / 9，共 41
  // 鸟点 [2,3] 以胡牌者(0)为庄位 → 落 下家(1)、对家(2) ⇒ n=[1,1,0]
  const r4 = scoreRound({ method: 'zimo', B: B1, F: F1, winner: { seat: 0, isBigHu: true, k: 1 }, birdValues: [2, 3] });
  eq(r4.details.map((d) => d.n), [1, 1, 0], '示例4 逐家 n=[1,1,0]');
  eq(r4.details.map((d) => d.P), [16, 16, 9], '示例4 逐家 P=[16,16,9]');
  eq(r4.changes[0], 41, '示例4 胡牌者共得 41');
  assert(r4.zeroSum, '示例4 零和');

  // 示例 5：大胡点炮 k=3 n=1 → 21×2=42（未超封顶）→ P=44
  const r5 = scoreRound({ method: 'dianpao', B: B1, F: F1, winner: { seat: 0, isBigHu: true, k: 3 }, discarderSeat: 1, birdValues: [1] });
  eq([r5.details[0].n, r5.details[0].beforeCap, r5.details[0].cappedHit, r5.details[0].P], [1, 42, false, 44], '示例5 k=3 n=1 → 42 未超顶，P=44');
  assert(r5.zeroSum, '示例5 零和');

  // 示例 6：通炮 A(小胡,n=0)=4 + B(大胡 k=1,n=1)=16 → 放炮者共付 20
  // 以放炮者(3)为庄位；鸟点 [3] → 落座位 (3+2)%4 = 1 ⇒ 只命中胡牌者 B
  const r6 = scoreRound({
    method: 'tongpao', B: B1, F: F1, discarderSeat: 3,
    winners: [{ seat: 0, isBigHu: false }, { seat: 1, isBigHu: true, k: 1 }],
    birdValues: [3]
  });
  const dA = r6.details.find((d) => d.winnerSeat === 0);
  const dB = r6.details.find((d) => d.winnerSeat === 1);
  eq([dA.n, dA.P], [0, 4], '示例6 A 小胡 n=0 → 4');
  eq([dB.n, dB.P], [1, 16], '示例6 B 大胡 k=1 n=1 → 16');
  eq([r6.changes[0], r6.changes[1], r6.changes[3]], [4, 16, -20], '示例6 放炮者共付 20，两位胡牌者各得');
  assert(r6.zeroSum, '示例6 零和');

  // 示例 7：小胡自摸，4 只鸟 1,5,3,2（庄位=胡牌者）→ n=[3,3,2]，P=[10,10,8]，共 28
  const r7 = scoreRound({ method: 'zimo', B: B1, F: F1, winner: { seat: 0 }, birdValues: [1, 5, 3, 2] });
  eq(r7.details.map((d) => d.n), [3, 3, 2], '示例7 逐家 n=[3,3,2]');
  eq(r7.details.map((d) => d.P), [10, 10, 8], '示例7 逐家 P=[10,10,8]');
  eq(r7.changes[0], 28, '示例7 胡牌者共得 28');
  assert(r7.zeroSum, '示例7 零和');

  // 示例 8：清一色+碰碰胡（k=2）自摸 n=0 → 每家 16，共 48
  const r8 = scoreRound({ method: 'zimo', B: B1, F: F1, winner: { seat: 2, isBigHu: true, k: 2, huTypes: ['清一色', '碰碰胡'] }, birdValues: [] });
  eq(r8.details.map((d) => d.P), [16, 16, 16], '示例8 每家 16（14B+2F）');
  eq(r8.changes[2], 48, '示例8 胡牌者共得 48');
  eq(r8.winners[0].huTypes, ['清一色', '碰碰胡'], '示例8 番型与 k 可追溯');
  assert(r8.zeroSum, '示例8 零和');

  // 示例 9：封顶四例
  eq(payerAmount({ isBigHu: true, k: 4, B: B1, F: F1, n: 1 }).P, 44, '示例9 大胡 k=4 n=1：28×2=56 → 42，P=44');
  eq(payerAmount({ isBigHu: true, k: 2, B: B1, F: F1, n: 3 }).P, 44, '示例9 大胡 k=2 n=3：14×4=56 → 42，P=44');
  eq(payerAmount({ isBigHu: true, k: 7, B: B1, F: F1, n: 0 }).P, 44, '示例9 大胡 k=7 n=0：49 → 42，P=44');
  eq(payerAmount({ isBigHu: true, k: 6, B: B1, F: F1, n: 0 }).P, 44, '示例9 大胡 k=6 n=0：42（刚好等于封顶），P=44');

  // 示例 10：起手胡（板板胡）摇 2 颗骰子 = 4 和 1（庄位=触发者）→ n=[1,1,2]，P=[6,6,8]，共 20
  const r10 = scoreRound({ method: 'qishou', B: B1, F: F1, winner: { seat: 0 }, birdValues: [4, 1] });
  eq(r10.details.map((d) => d.n), [1, 1, 2], '示例10 起手胡逐家 n=[1,1,2]');
  eq(r10.details.map((d) => d.P), [6, 6, 8], '示例10 逐家 P=[6,6,8]');
  eq(r10.changes[0], 20, '示例10 触发者共得 20');
  eq([r10.winners[0].isBigHu, r10.winners[0].k], [false, 0], '示例10 起手胡按小胡结算');
  assert(r10.zeroSum, '示例10 零和');

  // 示例 11：中途四喜 摇 2 颗骰子 = 6 和 3 → 6→下家、3→对家（两颗均不落庄位）
  // ⚠️ 已按 S1 裁定修正：规格原文「对家 n=1+1=2、共得 18」与第五节公式矛盾，
  //    以第五节公式为准 → n=[1,1,0]、P=[6,6,4]、触发者共得 16。
  const r11 = scoreRound({ method: 'siji', B: B1, F: F1, winner: { seat: 0 }, birdValues: [6, 3] });
  eq(r11.details.map((d) => d.n), [1, 1, 0], '示例11（按 S1 修正）中途四喜逐家 n=[1,1,0]');
  eq(r11.details.map((d) => d.P), [6, 6, 4], '示例11（按 S1 修正）逐家 P=[6,6,4]');
  eq(r11.changes[0], 16, '示例11（按 S1 修正）触发者共得 16');
  assert(r11.zeroSum, '示例11 零和');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 4: 表驱动穷举（B/F × k=1..7 × n=0..4 × 大小胡 × 自摸/点炮）===');
{
  let cases = 0;
  let zeroSumBad = 0;
  let overCap = 0;
  let formulaBad = 0;
  for (const B of [1, 2, 3]) {
    for (const F of [0, 1, 5]) {
      for (let k = 1; k <= 7; k++) {
        for (let n = 0; n <= 4; n++) {
          for (const isBigHu of [false, true]) {
            cases++;
            const amt = payerAmount({ isBigHu, k, B, F, n });
            const expectBase = (isBigHu ? 7 : 2) * B * (isBigHu ? k : 1);
            if (amt.base !== expectBase) formulaBad++;
            if (amt.multiplier !== n + 1) formulaBad++;
            if (amt.capped !== Math.min(expectBase * (n + 1), 42 * B)) formulaBad++;
            if (amt.cappedHit !== (expectBase * (n + 1) > 42 * B)) formulaBad++;
            if (amt.P !== amt.capped + 2 * F) formulaBad++;
            if (amt.P > 42 * B + 2 * F) overCap++;

            const seat = (k + n) % 4;
            const rs = scoreRound({ method: 'zimo', B, F, winner: { seat, isBigHu, k }, birdValues: [] });
            const rd = scoreRound({ method: 'dianpao', B, F, winner: { seat, isBigHu, k }, discarderSeat: (seat + 1) % 4, birdValues: [] });
            const rq = scoreRound({ method: 'qishou', B, F, winner: { seat }, birdValues: [] });
            if (!rs.zeroSum || !rd.zeroSum || !rq.zeroSum) zeroSumBad++;
            if (rs.changes[seat] !== rs.details.reduce((s, d) => s + d.P, 0)) zeroSumBad++;
          }
        }
      }
    }
  }
  eq(cases, 630, `穷举用例数应为 630（实际 ${cases}）`);
  eq(formulaBad, 0, '任意组合下 Base / 乘数 n+1 / 封顶截断 / P 公式均正确');
  eq(overCap, 0, '任意组合下单家应付不超过 42B + 2F');
  eq(zeroSumBad, 0, '所有组合的自摸/点炮/起手胡结算零和且赢家收分 = 各家应付之和');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 5: 通炮（一炮多响）与零和守恒 ===');
{
  // 三家同时胡，放炮者全付；以放炮者(1)为庄位
  const r = scoreRound({
    method: 'tongpao', B: 2, F: 1, discarderSeat: 1,
    winners: [
      { seat: 0, isBigHu: false, huTypes: ['平胡'] },
      { seat: 2, isBigHu: true, k: 2, huTypes: ['清一色', '碰碰胡'] },
      { seat: 3, isBigHu: true, k: 1, huTypes: ['将将胡'] }
    ],
    birdValues: [1, 2, 3, 4] // 以座位 1 为庄位 → 落 1、2、3、0
  });
  assert(r.zeroSum, '通炮三家同时胡：零和');
  const total = r.details.reduce((s, d) => s + d.P, 0);
  eq(r.changes[1], -total, '通炮：放炮者总付 = 各胡牌者 P 之和');
  eq(r.details.length, 3, '通炮：逐位赢家各一条明细（各按自己的 k 与 n）');
  assert(r.changes[0] > 0 && r.changes[2] > 0 && r.changes[3] > 0, '通炮：每位胡牌者都拿到分');
  eq(r.dealerSeat, 1, '通炮：计分庄位 = 放炮者');
  eq(r.winners.map((w) => w.k), [0, 2, 1], '通炮：逐家 k 可追溯（小胡记 0）');
  assert(r.details.every((d) => d.P <= 42 * 2 + 2), '通炮：单家应付同样受 42B+2F 限制');

  // 逐家 n 与有效座位
  eq(r.details.map((d) => d.n), [
    countEffectiveBirds([1, 2, 3, 4], 1, 0),
    countEffectiveBirds([1, 2, 3, 4], 1, 2),
    countEffectiveBirds([1, 2, 3, 4], 1, 3)
  ], '通炮：n 按 {放炮者, 当前胡牌者} 逐家统计');

  // 起手胡 / 中途四喜：强制小胡、自摸口径
  const q = scoreRound({ method: 'qishou', B: 3, F: 0, winner: { seat: 1, isBigHu: true, k: 5 }, birdValues: [2, 6] });
  eq([q.winners[0].isBigHu, q.winners[0].k], [false, 0], '起手胡强制按小胡（传入的大胡标记被忽略）');
  assert(q.zeroSum, '起手胡零和');
  const s = scoreRound({ method: 'siji', B: 1, F: 2, winner: { seat: 3 }, birdValues: [] });
  eq(s.changes, [-6, -6, -6, 18], '中途四喜按小胡自摸：三家各 2B+2F(=6)，触发者共得 18');
  assert(s.zeroSum, '中途四喜零和');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 6: 庄家轮换（胡者 / 放炮者 / 流局摸牌者）===');
{
  eq(nextDealerSeat({ outcome: 'win', winnerSeat: 2 }), 2, '谁胡牌谁做庄（自摸与点炮相同）');
  eq(nextDealerSeat({ outcome: 'tongpao', discarderSeat: 3 }), 3, '通炮（一炮多响）：放炮者做庄');
  eq(nextDealerSeat({ outcome: 'draw', lastDrawerSeat: 1 }), 1, '流局：摸走最后一张牌的人做庄');
  eq(drawDealerSeat({ lastDrawerSeat: 1, currentDealerSeat: 0 }), 1, '流局庄家 = 最后摸牌的座位（正常摸牌或开杠补牌）');
  eq(drawDealerSeat({ lastDrawerSeat: 0, currentDealerSeat: 3 }), 0, '流局庄家与「当前庄」无关：庄自己摸走最后一张就继续做庄');
  eq(drawDealerSeat({ lastDrawerSeat: null, currentDealerSeat: 2 }), 2, '本局从未有人摸过牌（异常路径）→ 退回当前庄，不顺移');
  eq(drawDealerSeat({}), 0, '两个入参都缺省时不抛错，返回座位 0');
  throws(() => drawDealerSeat({ lastDrawerSeat: 9 }), '流局庄家座位越界抛错');
  throws(() => drawDealerSeat({ currentDealerSeat: -1 }), 'currentDealerSeat 越界抛错');
  throws(() => nextDealerSeat({ outcome: 'unknown' }), '未知 outcome 抛错（避免静默沿用旧庄）');
  throws(() => nextDealerSeat({ outcome: 'qishou' }), '起手胡/中途四喜不通过本函数改庄（结算不影响下一局庄）');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 7: 骰子抓鸟（随机源可注入，联机由服务端提供安全随机源）===');
{
  eq(rollBirdDice(2, (max) => max - 1), [6, 6], '骰子数量 = 抓鸟数；点数由注入的随机源决定');
  eq(rollBirdDice(0).length, 0, '不抓鸟（0 只）返回空数组');
  eq(rollBirdDice(4, () => 0), [1, 1, 1, 1], '抓 4 只鸟返回 4 个点数');
  throws(() => rollBirdDice(1, () => 9), '越界随机数抛错（防止随机源误用）');
  let i = 0;
  const seq = [0, 5];
  eq(rollBirdDice(2, () => seq[i++]), [1, 6], '可注入确定性序列（便于测试与复盘）');

  const r = scoreRound({ method: 'siji', B: 1, F: 1, winner: { seat: 0 }, birdValues: rollBirdDice(2, () => seq[0]) });
  eq(r.birdDetail.map((b) => [b.value, b.targetSeat]), [[1, 0], [1, 0]], '骰子点数 → 座位（1→庄位，两颗都落庄位）');
  eq(describeBirdHits(r.birdDetail), '庄位×2', '中鸟落点可读文案');
  eq(r.details.map((d) => d.n), [2, 2, 2], '两颗都落庄位 ⇒ 三家 n 均为 2');
  assert(r.zeroSum, '骰子抓鸟结算零和');
}

// ------------------------------------------------------------------
console.log('\n=== 测试 8: 回归用例（外部审计发现的 2 处缺陷）===');
{
  // 缺陷 1：通炮缺 k 兜底（与点炮/自摸口径一致）
  const r = scoreRound({ method: 'tongpao', B: 1, F: 1, discarderSeat: 0, winners: [{ seat: 1, isBigHu: true }] });
  eq([r.details[0].k, r.winners[0].k], [1, 1], '通炮缺 k 时兜底为 1（details 与 winners 一致，不再出现 undefined）');
  eq([r.details[0].base, r.details[0].P], [7, 9], '通炮缺 k 时按 k=1 计：7B + 2F = 9');
  assert(r.zeroSum, '通炮缺 k 结算零和');

  const small = scoreRound({ method: 'tongpao', B: 1, F: 1, discarderSeat: 0, winners: [{ seat: 1 }] });
  eq([small.winners[0].isBigHu, small.winners[0].k, small.winners[0].receives], [false, 0, 4], '通炮未标 isBigHu 按小胡（k=0，放炮者付 2B+2F=4）');

  throws(() => scoreRound({ method: 'tongpao', B: 1, F: 1, discarderSeat: 0, winners: [{ seat: 1, isBigHu: true, k: 0 }] }), '大胡 k=0 抛错（k 必须 >= 1）');
  throws(() => scoreRound({ method: 'tongpao', B: 1, F: 1, discarderSeat: 0, winners: [{ seat: 1, isBigHu: true, k: 1.5 }] }), '大胡 k 非整数抛错');

  // 缺陷 2：越界座位抛错，而非静默写坏 changes 数组
  throws(() => scoreRound({ method: 'zimo', B: 1, F: 1, winner: { seat: 7 } }), '自摸 winner.seat=7 抛错');
  throws(() => scoreRound({ method: 'zimo', B: 1, F: 1, winner: { seat: -1 } }), 'winner.seat 负数抛错');
  throws(() => scoreRound({ method: 'zimo', B: 1, F: 1, winner: { seat: 1.5 } }), 'winner.seat 非整数抛错');
  throws(() => scoreRound({ method: 'dianpao', B: 1, F: 1, winner: { seat: 0 }, discarderSeat: 9 }), '点炮 discarderSeat=9 抛错');
  throws(() => scoreRound({ method: 'zimo', B: 1, F: 1, winner: { seat: 0 }, dealerSeat: 5 }), 'dealerSeat=5 抛错');
  throws(() => scoreRound({ method: 'tongpao', B: 1, F: 1, discarderSeat: 0, winners: [{ seat: 7, isBigHu: true }] }), '通炮 winner.seat=7 抛错');
  throws(() => nextDealerSeat({ outcome: 'win', winnerSeat: 8 }), 'nextDealerSeat win winnerSeat=8 抛错');
  throws(() => nextDealerSeat({ outcome: 'draw', lastDrawerSeat: -1 }), 'nextDealerSeat draw lastDrawerSeat=-1 抛错');

  let msg = '';
  try { scoreRound({ method: 'zimo', B: 1, F: 1, winner: { seat: 7 } }); } catch (e) { msg = e.message; }
  assert(msg.includes('winner.seat') && msg.includes('7'), `越界错误信息含字段名与实际值（实际消息：${msg}）`);
}

// ------------------------------------------------------------------
console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

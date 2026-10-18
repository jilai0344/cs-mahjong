// 本机对局记录测试（用户裁定：等级只能靠四人对战积累，刷 AI 不算）
// 运行：npm test（串在最后）
import {
  EMPTY_RECORD, RECORD_KEY, isRankedMatch, normalizeRecord, applyRoundToRecord,
  winRate, loadRecord, saveRecord, recordRound
} from '../src/game/record.js';

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

const human = (id) => ({ id, isHuman: true, name: `玩家${id}` });
const ai = (id) => ({ id, isHuman: false, name: `电脑 AI ${id}` });
const makeStore = (initial) => {
  const map = new Map(initial ? [[RECORD_KEY, initial]] : []);
  return {
    store: { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) },
    map
  };
};

console.log('=== 测试 1: 什么局才算「四人对战」（表驱动）===');
{
  const cases = [
    [{ seats: [human(0), human(1), human(2), human(3)], tookOver: false }, true, '4 真人满座、全程无托管 → 计入'],
    [{ seats: [human(0), human(1), human(2), human(3)], tookOver: true }, false, '中途出现过托管 → 不计（哪怕现在是 4 真人）'],
    [{ seats: [human(0), human(1), human(2), ai(3)], tookOver: false }, false, '有 AI 补位（3 真人 + 1 电脑）→ 不计'],
    [{ seats: [human(0), ai(1), ai(2), ai(3)], tookOver: false }, false, '单机练习（1 真人 + 3 电脑）→ 不计：刷 AI 不能涨记录'],
    [{ seats: [ai(0), ai(1), ai(2), ai(3)], tookOver: false }, false, '纯 AI 局 → 不计'],
    [{ seats: [human(0), human(1), human(2)], tookOver: false }, false, '只有 3 个座位 → 不计'],
    [{ seats: null, tookOver: false }, false, 'seats 缺失 → 不计（不抛错）'],
    [{ seats: [human(0), human(1), human(2), { id: 3, name: '未知' }], tookOver: false }, false, 'isHuman 缺失的座位 → 不计'],
    [{}, false, '空入参 → 不计（不抛错）']
  ];
  cases.forEach(([input, expected, label]) => {
    eq(isRankedMatch(input), expected, label);
  });
}

console.log('\n=== 测试 2: 累加口径（分数净变化 + 场次 + 胜平负）===');
{
  let r = { ...EMPTY_RECORD };
  r = applyRoundToRecord(r, 24, 1000);
  eq([r.matches, r.netScore, r.wins, r.losses, r.draws, r.lastPlayedAt], [1, 24, 1, 0, 0, 1000], '赢一局 +24 → 净胜 24、胜 1');
  r = applyRoundToRecord(r, -8, 2000);
  eq([r.matches, r.netScore, r.wins, r.losses], [2, 16, 1, 1], '输一局 −8 → 净胜 16、负 1');
  r = applyRoundToRecord(r, 0, 3000);
  eq([r.matches, r.netScore, r.wins, r.losses, r.draws], [3, 16, 1, 1, 1], '平局（0）→ 计入场次与平局，不影响净胜');
  r = applyRoundToRecord(r, 'x', 4000);
  eq([r.matches, r.netScore], [4, 16], '非法 scoreDelta 当 0 处理（不写 NaN）');
  eq(winRate(r), 25, '胜率 = 1/4 = 25%');
  eq(winRate({ ...EMPTY_RECORD }), null, '没有场次时胜率为 null（不显示 0% 误导）');
}

console.log('\n=== 测试 3: 读写与健壮性 ===');
{
  eq(normalizeRecord(null), { ...EMPTY_RECORD }, 'null → 空记录');
  eq(normalizeRecord({ matches: -5, netScore: 3.7, wins: 'x' }), { ...EMPTY_RECORD, netScore: 3 },
    '负数场次归零、小数取整、非法值归零');
  eq(normalizeRecord({ version: 99, matches: 2 }).version, 1, '版本号统一为 1');

  const { store, map } = makeStore();
  eq(loadRecord(store), { ...EMPTY_RECORD }, '没有数据时返回空记录');
  const after = recordRound(store, { scoreDelta: 12, at: 5000 });
  eq([after.matches, after.netScore], [1, 12], 'recordRound 累加并返回新记录');
  eq(JSON.parse(map.get(RECORD_KEY)).netScore, 12, '已写入 localStorage');
  eq(loadRecord(store).netScore, 12, '再次读取能看到累计结果');

  const broken = makeStore('{ 这不是 JSON');
  eq(loadRecord(broken.store), { ...EMPTY_RECORD }, '数据损坏 → 当空记录，不抛错');

  eq(loadRecord(null), { ...EMPTY_RECORD }, 'localStorage 不可用 → 空记录');
  eq(saveRecord(null, { matches: 1 }), { ...EMPTY_RECORD, matches: 1 }, '无 storage 时 saveRecord 只规整并返回');
  const throwing = { getItem: () => { throw new Error('privacy mode'); }, setItem: () => { throw new Error('quota'); } };
  eq(loadRecord(throwing), { ...EMPTY_RECORD }, '读取抛错（隐私模式）→ 空记录');
  eq(recordRound(throwing, { scoreDelta: 5 }).netScore, 5, '写入抛错（配额满）也不炸，内存里仍能算出结果');
}

console.log('\n=== 测试 4: 只有四人对战才写记录（回归）===');
{
  const { store } = makeStore();
  // 单机练习：seat 全是 AI → isRankedMatch=false → 调用方不应写记录
  const singlePlayerSeats = [human(0), ai(1), ai(2), ai(3)];
  const ranked = isRankedMatch({ seats: singlePlayerSeats, tookOver: false });
  eq(ranked, false, '单机练习不算可计入对局');
  if (ranked) recordRound(store, { scoreDelta: 999 });
  eq(loadRecord(store).matches, 0, '刷 999 分也没有写进记录（等级不能靠打电脑积累）');

  // 四人对战：应写入
  const mpSeats = [human(0), human(1), human(2), human(3)];
  if (isRankedMatch({ seats: mpSeats, tookOver: false })) recordRound(store, { scoreDelta: 6, at: 1 });
  eq([loadRecord(store).matches, loadRecord(store).netScore], [1, 6], '四人对战计入 1 局 +6');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

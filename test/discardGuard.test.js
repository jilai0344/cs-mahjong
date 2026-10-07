// 出牌防误触测试（P2-1）
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDiscardGuard, discardHint, DISCARD_CONFIRM_DELAY_MS } from '../src/game/discardGuard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
const failures = [];
function assert(c, m) { if (c) passed++; else { failed++; failures.push(m); console.error(`  ✗ FAIL: ${m}`); } }
function eq(a, e, m) { const x = JSON.stringify(a), y = JSON.stringify(e); assert(x === y, `${m}（实际 ${x} ≠ 期望 ${y}）`); }

console.log('=== 测试 1: 第一次点击只选中，绝不打出 ===');
{
  const g = createDiscardGuard();
  const r = g.select('t1', 1000);
  eq(r.action, 'select', '首次点击 = 选中');
  eq(r.allowed, false, '首点不允许打出');
  eq(g.selected(), 't1', '选中态被记住');
}

console.log('\n=== 测试 2: 连点/双击不会打出（核心防误触）===');
{
  const g = createDiscardGuard();
  g.select('t1', 1000);
  eq(g.select('t1', 1010).allowed, false, '双击（10ms）不打出');
  eq(g.select('t1', 1150).allowed, false, '连点（150ms）不打出');
  eq(g.select('t1', 1000 + DISCARD_CONFIRM_DELAY_MS - 1).allowed, false, '差 1ms 也还不算确认');
  eq(g.select('t1', 1000 + DISCARD_CONFIRM_DELAY_MS).allowed, true, '满 250ms 才允许（边界）');
  eq(g.select('t1', 9000).action, 'discard', '确认是「第二次点同一张」这个动作');
}

console.log('\n=== 测试 3: 换牌只切换选中，不会误打 ===');
{
  const g = createDiscardGuard();
  g.select('t1', 1000);
  const r = g.select('t2', 1010);
  eq([r.action, r.allowed], ['select', false], '点另一张 = 只换选中');
  eq(g.selected(), 't2', '选中换成新牌');
  eq(g.select('t2', 1200).allowed, false, '换牌后同样要等够延迟');
  eq(g.select('t2', 1300).allowed, true, '从「选中 t2」起算 300ms → 允许');
}

console.log('\n=== 测试 4: 显式「打出」按钮路径 ===');
{
  const g = createDiscardGuard();
  g.select('t1', 1000);
  eq(g.requestExplicit('t1').allowed, true, '按钮打当前选中的牌：不受延迟限制');
  eq(g.requestExplicit('t2').allowed, false, '按钮打没选中的牌：拒绝（不会误打别的牌）');
  g.clear();
  eq(g.selected(), null, 'clear 之后没有选中');
  eq(g.requestExplicit('t1').allowed, false, 'clear 之后按钮也无牌可打');
}

console.log('\n=== 测试 5: 提示文案 ===');
{
  eq(discardHint(null), '✦ 点击选择一张牌打出', '未选中时的提示');
  assert(discardHint('t1').includes('再点一次') && discardHint('t1').includes('打出'), '选中时说明两种打法');
  assert(discardHint('t1', true).includes('连点不会打出'), '手滑保护触发时给出解释');
}

console.log('\n=== 测试 6: 接线守卫 ===');
{
  const hand = readFileSync(join(ROOT, 'src/components/PlayerHand.jsx'), 'utf8');
  assert(/createDiscardGuard/.test(hand), 'PlayerHand 用防误触状态机');
  assert(/res\.action === 'discard'/.test(hand) && /res\.allowed/.test(hand), '只有确认通过才打出');
  assert(/打出/.test(hand), '提供显式「打出」按钮');
  assert(/discardHint\(/.test(hand), '提示文案走 discardHint');
  assert(/setTooFast\(true\)/.test(hand), '连点被拦时给出反馈');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length) { console.error('\n失败列表:'); failures.forEach(f => console.error('  - ' + f)); }
if (failed > 0) process.exit(1);

// 长沙麻将 · 消息幂等（去重）测试（ROADMAP P0-4）
// 运行：npm test（串在最后）
import { createMessageFilter, nextMessageId } from '../src/utils/dedupe.js';

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

console.log('=== 测试 1: 重复消息只处理一次（QoS 1 至少一次投递）===');
{
  const filter = createMessageFilter();
  const msg = { type: 'TILE_DISCARDED', msgId: 'g_abc#7', tile: { suit: 'wan', value: 5 } };

  let processed = 0;
  for (let i = 0; i < 3; i++) {
    if (filter.accept(msg.msgId)) processed++;
  }
  eq(processed, 1, '同一条消息被投递 3 次 → 只处理 1 次（否则会重复打牌/重复碰杠）');

  eq(filter.accept('g_abc#8'), true, '另一条消息正常放行');
  eq(filter.accept('g_abc#7'), false, '旧 id 仍在窗口内 → 继续拒绝');
}

console.log('\n=== 测试 2: 无 id 的载荷与异常入参 ===');
{
  const filter = createMessageFilter();
  eq(filter.accept(undefined), true, '没有 msgId 的消息一律放行（兼容）');
  eq(filter.accept(null), true, 'null 也放行');
  eq(filter.accept(''), true, '空字符串放行');
  eq(filter.accept(123), true, '非字符串 id 放行（不做误杀）');
}

console.log('\n=== 测试 3: 有界窗口（长时间对局不爆内存）===');
{
  const limit = 50;
  const filter = createMessageFilter({ limit });
  for (let i = 0; i < 500; i++) filter.accept(`h#${i}`);
  eq(filter.size(), limit, `最多只保留 ${limit} 条 id`);
  eq(filter.has('h#499'), true, '最新的 id 在窗口内');
  eq(filter.has('h#0'), false, '最早的 id 已被逐出');
  eq(filter.accept('h#499'), false, '窗口内重复 id 仍被拒绝');

  // 逐出后的极老消息会被再次放行——这是刻意的取舍（对局消息都是实时短事件）
  eq(filter.accept('h#0'), true, '被逐出的老 id 再次出现时放行（取舍：不做无限增长）');
}

console.log('\n=== 测试 4: 消息 id 生成 ===');
{
  const a = nextMessageId('h');
  const b = nextMessageId('h');
  const c = nextMessageId('g_x');
  assert(a !== b && b !== c, 'id 不重复');
  assert(a.startsWith('h#') && c.startsWith('g_x#'), '前缀用于区分来源（房主/访客连接）');

  const filter = createMessageFilter();
  let accepted = 0;
  const ids = [nextMessageId('h'), nextMessageId('h'), nextMessageId('h')];
  ids.forEach(id => { if (filter.accept(id)) accepted++; });
  eq(accepted, 3, '生成的新 id 全部被接受');
}

console.log('\n=== 测试 5: 回归——没有去重时，重传会重复结算 ===');
{
  // 旧行为：直接处理每条消息
  const legacyProcess = (messages) => messages.length;
  const delivered = [{ msgId: 'x#1' }, { msgId: 'x#1' }, { msgId: 'x#1' }];
  eq(legacyProcess(delivered), 3, '旧实现会把同一条消息处理 3 次（这就是要修的问题）');

  const filter = createMessageFilter();
  const processed = delivered.filter(m => filter.accept(m.msgId)).length;
  eq(processed, 1, '新实现只处理 1 次');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

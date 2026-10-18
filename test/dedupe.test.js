// 长沙麻将 · 消息幂等（去重）测试（ROADMAP P0-4）
// 运行：npm test（串在最后）
import { createMessageFilter, createSequenceTracker, nextMessageId, sequenceKey } from '../src/utils/dedupe.js';

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

console.log('\n=== 测试 6: 单调序号追踪（P0-4③：乱序/重放丢弃）===');
{
  const tracker = createSequenceTracker();

  eq(tracker.accept('host:c1', 1), true, '首条消息（seq=1）放行');
  eq(tracker.accept('host:c1', 2), true, '严格递增放行');
  eq(tracker.accept('host:c1', 3), true, '继续递增放行');

  eq(tracker.accept('host:c1', 3), false, '同一序号重复到达 → 丢弃（重放）');
  eq(tracker.accept('host:c1', 2), false, '迟到的旧消息（seq 更小）→ 丢弃（乱序）');
  eq(tracker.accept('host:c1', 1), false, '重连后残留的很旧的包 → 丢弃');
  eq(tracker.accept('host:c1', 4), true, '之后的正常消息不受影响');

  // 不同发送者互不干扰
  eq(tracker.accept('guest:g1', 1), true, '另一个发送者从 1 开始，独立计数');
  eq(tracker.accept('guest:g2', 1), true, '第三个发送者也独立');
  eq(tracker.accept('host:c1', 5), true, '一台设备的序号推进不影响其他发送者');
  eq(tracker.lastSeqOf('host:c1'), 5, '可查询最近序号');
  eq(tracker.size(), 3, '当前追踪 3 个发送者');

  // 会话换了（客户端刷新）：senderId 变了 → 序号可以从 1 重新开始
  eq(tracker.accept('host:c2', 1), true, '同一端刷新后是新会话（新 senderId），从 1 开始照常放行');
}

console.log('\n=== 测试 7: 序号追踪的兼容性与有界性 ===');
{
  const tracker = createSequenceTracker();
  eq(tracker.accept(undefined, 5), true, '没有 senderId（旧载荷）→ 放行');
  eq(tracker.accept('host:c1', undefined), true, '没有 seq（旧载荷）→ 放行');
  eq(tracker.accept('host:c1', 'abc'), true, 'seq 不是整数 → 放行（不误杀）');
  eq(tracker.accept('', 1), true, '空 senderId → 放行');

  const bounded = createSequenceTracker({ maxSenders: 3 });
  ['a', 'b', 'c', 'd'].forEach((s, i) => bounded.accept(s, i + 1));
  eq(bounded.size(), 3, '最多只追踪 maxSenders 个发送者（长对局不膨胀）');
  eq(bounded.lastSeqOf('a'), undefined, '最久未更新的发送者被逐出');
  eq(bounded.accept('d', 5), true, '最新的发送者仍在追踪中（新序号继续放行）');
  eq(bounded.accept('d', 2), false, '最新发送者的旧序号同样被丢弃');

  // 逐出后再出现 → 视为新发送者放行（取舍：不做无限增长）
  eq(bounded.accept('a', 1), true, '被逐出的发送者再次出现时放行');

  const refreshed = createSequenceTracker({ maxSenders: 2 });
  refreshed.accept('x', 10);
  refreshed.accept('y', 20);
  eq(refreshed.accept('x', 11), true, 'x 被访问后回到「最近活跃」位置');
  refreshed.accept('y', 21);
  eq(refreshed.size(), 2, 'x/y 都在，未超上限');
}

console.log('\n=== 测试 8: 回归——没有序号追踪时，乱序消息会被照单全收 ===');
{
  const delivered = [
    { senderId: 'host:c1', seq: 3, msg: '出牌-三' },
    { senderId: 'host:c1', seq: 1, msg: '出牌-一（迟到）' },
    { senderId: 'host:c1', seq: 2, msg: '出牌-二（迟到）' }
  ];

  // 旧实现：来一条处理一条 → 顺序被搞乱（牌局状态可能与房主不一致）
  eq(delivered.map(m => m.seq), [3, 1, 2], '旧实现会按到达顺序处理：[3,1,2] —— 这就是要修的问题');

  const tracker = createSequenceTracker();
  const applied = delivered.filter(m => tracker.accept(m.senderId, m.seq)).map(m => m.seq);
  eq(applied, [3], '新实现只应用 seq=3，迟到的 1、2 被丢弃（不会把牌局带回旧状态）');

  const ordered = [
    { senderId: 'host:c1', seq: 1 },
    { senderId: 'host:c1', seq: 2 },
    { senderId: 'host:c1', seq: 3 }
  ];
  eq(ordered.filter(m => tracker.accept(m.senderId, m.seq)).map(m => m.seq), [],
    '已经在 seq=3 之后，正常的 1/2/3 全部不会再被应用');
}

console.log('\n=== 测试 9: 序号要按「发送者+话题」分开算（跨话题不保证顺序）===');
{
  eq(sequenceKey('host:c1', 'room/b'), 'host:c1|room/b', '键 = 发送者|话题');
  eq(sequenceKey('host:c1', ''), 'host:c1|', '缺话题时也稳定成键');
  eq(sequenceKey('', 'room/b'), null, '没有发送者 → null（交给上层放行）');

  // 真实现场（三真人冒烟实测）：房主先发座位信令 seq=2，再收到广播 seq=1 —— 跨话题乱序
  const tracker = createSequenceTracker();
  const hostBroadcast = sequenceKey('host:c1', 'room/b');
  const hostSeat = sequenceKey('host:c1', 'room/seat/1');

  eq(tracker.accept(hostSeat, 2), true, '座位话题 seq=2 先到 → 放行');
  eq(tracker.accept(hostBroadcast, 1), true,
    '广播话题 seq=1 后到 → **仍要放行**（话题内仍是最新的；旧实现按发送者全局计数会误丢，实测到过）');
  eq(tracker.accept(hostBroadcast, 2), true, '广播话题继续递增 → 放行');
  eq(tracker.accept(hostBroadcast, 2), false, '同一话题内重复序号 → 丢弃');
  eq(tracker.accept(hostBroadcast, 1), false, '同一话题内迟到旧序号 → 丢弃');
  eq(tracker.accept(hostSeat, 3), true, '两个话题各自独立推进，互不影响');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

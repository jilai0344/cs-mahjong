// 长沙麻将 · 联机邀请参数与通道一致性测试
// 运行：npm test（串在最后）
import { buildInviteUrl, parseInviteParams, nextChannelOnRetry, normalizeChannelIndex } from '../src/utils/invite.js';
import { BROKER_URLS } from '../src/utils/multiplayer.js';

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

const LOC = { origin: 'https://jilai0344.github.io', pathname: '/cs-mahjong/' };

console.log('=== 测试 1: 生成邀请链接 ===');
{
  eq(buildInviteUrl(LOC, 'abc123', 0),
    'https://jilai0344.github.io/cs-mahjong/?room=ABC123',
    '主通道（0）不写 b 参数，链接保持简短');
  eq(buildInviteUrl(LOC, 'abc123', 1),
    'https://jilai0344.github.io/cs-mahjong/?room=ABC123&b=1',
    '备用通道（1）必须写进链接，否则访客会连到另一条 broker');
  eq(buildInviteUrl(LOC, 'abc123', 9, 2),
    'https://jilai0344.github.io/cs-mahjong/?room=ABC123',
    '越界的通道号 → 回到主通道（不生成无效参数）');
  eq(buildInviteUrl(LOC, '  abc123  ', -1, 2),
    'https://jilai0344.github.io/cs-mahjong/?room=ABC123',
    '房间号去空格并大写；负数通道 → 主通道');
  eq(buildInviteUrl(null, 'X1', 0),
    '/?room=X1',
    'location 缺失也不抛错（SSR/测试环境）');
}

console.log('\n=== 测试 2: 解析邀请链接 ===');
{
  eq(parseInviteParams('?room=abc123'), { roomCode: 'ABC123', channelIndex: 0 },
    '只有房间号 → 默认主通道');
  eq(parseInviteParams('?room=abc123&b=1'), { roomCode: 'ABC123', channelIndex: 1 },
    '带 b=1 → 备用通道');
  eq(parseInviteParams(''), { roomCode: null, channelIndex: 0 }, '空 search → 无房间号');
  eq(parseInviteParams(undefined), { roomCode: null, channelIndex: 0 }, 'undefined → 不抛错');
  eq(parseInviteParams('?room=ABC123&b=abc'), { roomCode: 'ABC123', channelIndex: 0 },
    '通道号非数字 → 回到主通道');
  eq(parseInviteParams('?room=ABC123&b=7'), { roomCode: 'ABC123', channelIndex: 0 },
    '通道号越界 → 回到主通道');
  eq(parseInviteParams('?b=1'), { roomCode: null, channelIndex: 1 },
    '只有通道号没有房间号 → roomCode 为 null（不会误触发加入）');
}

console.log('\n=== 测试 3: 生成 → 解析 往返一致 ===');
{
  const total = BROKER_URLS.length;
  eq(total, 2, '当前有两条联机通道（主 + 备）');
  for (const ch of [0, 1]) {
    const url = buildInviteUrl(LOC, 'ZZ9K2M', ch, total);
    const parsed = parseInviteParams(url.slice(url.indexOf('?')), total);
    eq(parsed, { roomCode: 'ZZ9K2M', channelIndex: ch }, `通道 ${ch} 往返后不丢信息`);
  }
}

console.log('\n=== 测试 4: 加入失败后换通道重试 ===');
{
  eq(nextChannelOnRetry(0, 2), 1, '主通道无响应 → 换备用通道');
  eq(nextChannelOnRetry(1, 2), 0, '备用通道无响应 → 换回主通道');
  eq(nextChannelOnRetry(0, 1), 0, '只有一条通道时原地重试（不会越界）');
  eq(normalizeChannelIndex('1', 2), 1, '字符串通道号也能规整');
  eq(normalizeChannelIndex(undefined, 2), 0, '缺省 → 0');
}

console.log('\n=== 测试 5: 回归——通道不一致会让双方永远碰不上 ===');
{
  // 场景：房主在主通道（0），访客超时后落到备用通道（1）
  const hostChannel = 0;
  const guestChannelAfterTimeout = 1;
  const sameRoom = 'QK7W2P';

  const topicsMatch = (a, b) => a === b;
  const hostTopic = `csmj-v1-${sameRoom}-host`;
  const guestPublishesTo = `csmj-v1-${sameRoom}-host`;

  // 旧实现：邀请链接不带通道 → 访客从主通道开始试；主通道超时后落到备用通道
  const legacyGuestChannel = guestChannelAfterTimeout;
  eq(hostChannel !== legacyGuestChannel, true,
    '旧实现：房主在通道 0、访客在通道 1 → 两人不在同一个 broker 上（界面永远卡在「正在连接房主...」）');
  assert(topicsMatch(hostTopic, guestPublishesTo), '话题名本身是对的（所以更难发现：不是房间号问题，是通道问题）');

  // 新实现：链接带上房主的通道号，访客直接连同一条通道
  const link = buildInviteUrl(LOC, sameRoom, hostChannel, BROKER_URLS.length);
  const { channelIndex: guestChannelNew } = parseInviteParams(link.slice(link.indexOf('?')), BROKER_URLS.length);
  eq(guestChannelNew, hostChannel, '新实现：访客从链接拿到房主所在通道 → 两端落在同一个 broker');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

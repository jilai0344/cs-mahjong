// 长沙麻将 · 联机传输加密测试（ROADMAP P0-2 / P0-3 的无服务端缓解部分）
// 运行：npm test（串在最后）
import {
  deriveRoomKey,
  encryptJson,
  decryptJson,
  isEncryptedEnvelope,
  normalizeRoomCode
} from '../src/utils/crypto.js';
import { generateRoomCode } from '../src/utils/multiplayer.js';

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
async function throwsAsync(fn, message) {
  let threw = false;
  try { await fn(); } catch { threw = true; }
  assert(threw, message);
}

console.log('=== 测试 1: 房间号（P0-3 ②：4 位 → 6 位）===');
{
  const codes = Array.from({ length: 500 }, () => generateRoomCode());
  assert(codes.every(c => c.length === 6), '生成的房间号一律 6 位');
  assert(codes.every(c => /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(c)), '房间号只含去混淆字符集（无 0/1/I/O）');
  eq(new Set(codes).size, codes.length, '500 次生成无重复（空间 32^6 ≈ 1.07e9）');
  eq(normalizeRoomCode('  ab12cd '), 'AB12CD', '房间号规范化：大写 + 去空白');
  await throwsAsync(() => deriveRoomKey('AB1C'), '4 位旧房间号被拒绝（密钥派生要求 ≥6 位）');
}

console.log('\n=== 测试 2: 密钥派生 ===');
{
  const k1 = await deriveRoomKey('ABC234');
  const k2 = await deriveRoomKey('abc234'); // 规范化后同一个房间
  const k3 = await deriveRoomKey('ABC235');
  const msg = { type: 'TILE_DISCARDED', tile: { suit: 'tong', value: 5 } };
  const wire = await encryptJson(k1, msg);
  eq(await decryptJson(k2, wire), msg, '同一房间号（大小写规整后）派生出可互解的密钥');
  eq(await decryptJson(k3, wire), null, '不同房间号的密钥解不开（房间外的人拿不到内容）');
}

console.log('\n=== 测试 3: 信封与完整性 ===');
{
  const key = await deriveRoomKey('ROOM88');
  const wire = await encryptJson(key, { type: 'MELD_BROADCAST', meldType: 'an_gang', tiles: [{ suit: 'wan', value: 1 }] });
  assert(isEncryptedEnvelope(wire), '发出的是本协议信封 {v, iv, ct}');
  eq(await decryptJson(key, wire), { type: 'MELD_BROADCAST', meldType: 'an_gang', tiles: [{ suit: 'wan', value: 1 }] }, '往返解密一致');
  eq(await decryptJson(key, '{"type":"PLAINTEXT_LEGACY"}'), null, '旧版明文载荷被忽略（不留后门）');
  eq(await decryptJson(key, null), null, '空载荷返回 null（不抛错）');
  const env = JSON.parse(wire);
  const tampered = JSON.stringify({ ...env, ct: env.ct.slice(0, -4) + 'AAAA' });
  eq(await decryptJson(key, tampered), null, '密文被改动 → AES-GCM 校验失败，返回 null');
  const otherIv = JSON.stringify({ ...env, iv: 'AAAAAAAAAAAAAAAA' });
  eq(await decryptJson(key, otherIv), null, 'IV 被改动 → 解密失败');
}

console.log('\n=== 测试 4: 公共 broker 上的旁听者读不到任何对局信息（50 局取样）===');
{
  const roomCode = generateRoomCode();
  const hostKey = await deriveRoomKey(roomCode);
  const attackerKey = await deriveRoomKey(generateRoomCode()); // 旁听者只知道自己的房间号

  const secretMarkers = ['TILE_DISCARDED', 'handTiles', '清一色', '碰碰胡', '牌墙', 'seatId'];
  let leaked = 0;
  let attackerDecrypted = 0;
  let messages = 0;

  for (let game = 0; game < 50; game++) {
    for (let i = 0; i < 20; i++) {
      const message = {
        type: 'TILE_DISCARDED',
        playerId: i % 4,
        handTiles: Array.from({ length: 13 }, (_, k) => ({ suit: ['wan', 'tiao', 'tong'][k % 3], value: (k % 9) + 1 })),
        huTypes: ['清一色', '碰碰胡'],
        wall: Array.from({ length: 55 }, (_, k) => ({ suit: 'wan', value: (k % 9) + 1 }))
      };
      const wire = await encryptJson(hostKey, message);
      messages++;
      if (secretMarkers.some(m => wire.includes(m))) leaked++;
      if (await decryptJson(attackerKey, wire)) attackerDecrypted++;
    }
  }

  eq(messages, 1000, '取样 50 局 × 20 条消息 = 1000 条');
  eq(leaked, 0, '公共 broker 上看到的载荷不含任何明文对局标记（手牌/番型/牌墙等）');
  eq(attackerDecrypted, 0, '房间外的旁听者（密钥不匹配）解不开任何一条消息');

  // 对照组：协议前的「明文 JSON」写法确实会泄露（证明这条断言有意义）
  const legacyWire = JSON.stringify({ type: 'TILE_DISCARDED', handTiles: [{ suit: 'wan', value: 1 }] });
  assert(secretMarkers.some(m => legacyWire.includes(m)), '对照：旧版明文载荷确实含明文标记（修复前的泄露面）');
  eq(isEncryptedEnvelope(legacyWire), false, '对照：旧版明文不是加密信封');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

// 联机延迟 / 连接状态测试（P2-3）
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLatencyTracker, classifyLatency, formatLatency, connectionLabel, connectionTone,
  networkStatusText, statusTone, LATENCY_BOUNDS
} from '../src/utils/latency.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
const failures = [];
function assert(c, m) { if (c) passed++; else { failed++; failures.push(m); console.error(`  ✗ FAIL: ${m}`); } }
function eq(a, e, m) { const x = JSON.stringify(a), y = JSON.stringify(e); assert(x === y, `${m}（实际 ${x} ≠ 期望 ${y}）`); }

console.log('=== 测试 1: 采样与滑动平均（表驱动）===');
{
  const cases = [
    [[], null, '没有样本 → null'],
    [[40], 40, '单个样本就是它自己'],
    [[40, 60], 50, '两个样本取平均'],
    [[40, 41], 41, '四舍五入到整数（40.5 → 41）'],
    [[10, 20, 30, 40, 50, 60], 45, '窗口 5：只保留最近 5 个（20..60 → 40）… 见下']
  ];
  for (const [samples, expected, label] of cases) {
    const tr = createLatencyTracker({ window: 5 });
    for (const s of samples) tr.record(s);
    const v = tr.value();
    if (label.includes('窗口 5')) {
      // 后 5 个样本是 20,30,40,50,60 → 平均 40
      eq(v, 40, '窗口 5：只保留最近 5 个样本（20,30,40,50,60 → 40）');
      eq(tr.all().length, 5, '样本数被窗口裁剪到 5');
    } else {
      eq(v, expected, label);
    }
  }
  const tr = createLatencyTracker({ window: 3 });
  tr.record(10); tr.record(20); tr.record(30); tr.record(300);
  eq(tr.all(), [20, 30, 300], '窗口 3：最旧的被挤出');
  tr.reset();
  eq(tr.value(), null, 'reset 后回到「未知」');
}

console.log('\n=== 测试 2: 非法样本丢弃 ===');
{
  const tr = createLatencyTracker();
  tr.record(50);
  for (const bad of [-1, NaN, Infinity, 'x', null, undefined]) tr.record(bad);
  eq(tr.all(), [50], '负数/NaN/Infinity/非数字一律不记');
  eq(tr.value(), 50, '平均值不被垃圾样本污染');
}

console.log('\n=== 测试 3: 分档边界（表驱动）===');
{
  const b = LATENCY_BOUNDS;
  const cases = [
    [0, 'good'], [b.good, 'good'], [b.good + 1, 'fair'], [b.fair, 'fair'], [b.fair + 1, 'poor'],
    [9999, 'poor'], [-5, 'unknown'], [null, 'unknown'], ['x', 'unknown']
  ];
  for (const [ms, expected] of cases) eq(classifyLatency(ms), expected, `${ms}ms → ${expected}`);
}

console.log('\n=== 测试 4: 展示文案 ===');
{
  eq(formatLatency(48.4), '48ms', '延迟取整显示');
  eq(formatLatency(null), '—', '没有样本显示 —');
  eq(connectionLabel('connected'), '已连接', '连接状态文案');
  eq(connectionLabel('reconnecting'), '重连中', '重连文案');
  eq(connectionLabel('乱写的'), '未知', '未知状态兜底');
  eq(connectionTone('connected'), 'ok', '已连接 → 绿灯');
  eq(connectionTone('reconnecting'), 'warn', '重连中 → 黄灯');
  eq(connectionTone('disconnected'), 'bad', '已断开 → 红灯');
  eq(networkStatusText({ latency: 48, connection: 'connected' }), '48ms 优', '正常时显示延迟 + 分档');
  eq(networkStatusText({ latency: 900, connection: 'connected' }), '900ms 差', '高延迟分档为差');
  eq(networkStatusText({ latency: null, connection: 'connected' }), '已连接', '没测到往返时只说已连接（不假装测速）');
  eq(networkStatusText({ latency: 48, connection: 'reconnecting' }), '重连中', '连接不健康时不谈延迟');
  // 指示器圆点：连接健康时看延迟分档（差必须红灯），不健康时看连接
  eq(statusTone({ latency: 48, connection: 'connected' }), 'ok', '48ms → 绿灯');
  eq(statusTone({ latency: 300, connection: 'connected' }), 'warn', '300ms → 黄灯');
  eq(statusTone({ latency: 900, connection: 'connected' }), 'bad', '900ms → 红灯');
  eq(statusTone({ latency: null, connection: 'connected' }), 'idle', '还没测到 → 灰灯');
  eq(statusTone({ latency: 48, connection: 'reconnecting' }), 'warn', '重连中优先按连接状态');
  eq(statusTone({ latency: 48, connection: 'disconnected' }), 'bad', '已断开 → 红灯');
}

console.log('\n=== 测试 5: 接线守卫（PING/PONG + 顶栏指示器）===');
{
  const net = readFileSync(join(ROOT, 'src/utils/multiplayer.js'), 'utf8');
  const app = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');
  assert(/createLatencyTracker/.test(net), '网络层用 createLatencyTracker 统计延迟');
  assert(/type: 'PING'/.test(net) && /type: 'PONG'/.test(net), '网络层有 PING/PONG 往返测速');
  assert(/_setConnectionState\('connected'\)/.test(net), '连上 broker → 上报「已连接」');
  assert(/_setConnectionState\('reconnecting'\)/.test(net), '断线 → 上报「重连中」');
  assert(/setOnLatency/.test(net) && /setOnConnectionState/.test(net), '对外暴露延迟与连接状态回调');
  assert(/setOnLatency\(/.test(app) && /setOnConnectionState\(/.test(app), 'App 订阅延迟与连接状态');
  assert(/networkStatusText\(/.test(app), '顶栏用 networkStatusText 显示网络状况');
  assert(/networkStatusText\(/.test(readFileSync(join(ROOT, 'src/components/MultiplayerModal.jsx'), 'utf8')),
    '大厅也显示网络状况（延迟 + 连接状态）');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length) { console.error('\n失败列表:'); failures.forEach(f => console.error('  - ' + f)); }
if (failed > 0) process.exit(1);

// 房间规则同步测试（规格 §一：B/F 联机同步、开局锁定）
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MATCH_RULE_FIELDS, pickMatchRules, applyHostRules, rulesEqual, describeRules
} from '../src/game/rules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

const base = {
  baseScore: 1, fixedScore: 1, kongDrawCount: 2, kongRequiresJiang: true,
  startingHu: { daSiXi: true, banBanHu: true, yiGeWu: false }, birdCount: 2,
  autoSort: true, showHints: true, soundEnabled: true, aiSpeed: 700
};

console.log('=== 测试 1: 只挑「房间规则」，本机偏好不参与同步 ===');
{
  const picked = pickMatchRules(base);
  eq(Object.keys(picked).sort(), [...MATCH_RULE_FIELDS].sort(), '挑出的字段正好是房间规则清单');
  assert(!('autoSort' in picked) && !('soundEnabled' in picked) && !('aiSpeed' in picked),
    '本机偏好（理牌/音效/AI 速度）不进同步载荷');
}

console.log('\n=== 测试 2: 非法值一律夹取/归位（防非法配置跨端传播，表驱动）===');
{
  const cases = [
    [{ baseScore: 0 }, 1, 'B 下限 1（0 → 1）'],
    [{ baseScore: 999 }, 100, 'B 上限 100'],
    [{ baseScore: 'x' }, 1, 'B 非数字 → 1'],
    [{ baseScore: 3.7 }, 3, 'B 取整'],
    [{ fixedScore: -5 }, 0, 'F 下限 0'],
    [{ fixedScore: 101 }, 100, 'F 上限 100'],
    [{ fixedScore: 0 }, 0, 'F 允许 0'],
    [{ kongDrawCount: 3 }, 2, '开杠摸牌只允许 2/4（3 → 2）'],
    [{ kongDrawCount: 4 }, 4, '开杠摸牌 4 保留'],
    [{ birdCount: 1 }, 0, '抓鸟只允许 0/2/4（1 → 0）'],
    [{ birdCount: 4 }, 4, '抓鸟 4 保留'],
    [{ birdCount: 0 }, 0, '抓鸟 0 保留'],
    [{ kongRequiresJiang: 'yes' }, true, '非布尔 → 默认 true'],
    [{ kongRequiresJiang: false }, false, 'false 保留']
  ];
  for (const [patch, expected, label] of cases) {
    const r = pickMatchRules({ ...base, ...patch });
    const key = Object.keys(patch)[0];
    eq(r[key], expected, label);
  }
  eq(pickMatchRules({ ...base, startingHu: { daSiXi: true, junk: 'x' } }).startingHu,
    { daSiXi: true }, '起手胡只保留布尔项');
  eq(pickMatchRules(null).birdCount, 0, '空配置也能安全取值');
  eq(pickMatchRules(undefined).baseScore, 1, 'undefined 配置 → 默认 B=1');
}

console.log('\n=== 测试 3: 客人套用房主规则（房主优先、本机偏好保留）===');
{
  const guest = { ...base, baseScore: 9, fixedScore: 9, birdCount: 4, soundEnabled: false };
  const host = { baseScore: 5, fixedScore: 2, birdCount: 2, kongDrawCount: 4, kongRequiresJiang: false, startingHu: { daSiXi: false, banBanHu: true } };
  const merged = applyHostRules(guest, host);
  eq([merged.baseScore, merged.fixedScore, merged.birdCount], [5, 2, 2], 'B/F/抓鸟以房主为准');
  eq(merged.kongDrawCount, 4, '开杠摸牌以房主为准');
  eq(merged.kongRequiresJiang, false, '需将以房主为准');
  eq(merged.startingHu, { daSiXi: false, banBanHu: true }, '起手胡开关以房主为准');
  eq(merged.soundEnabled, false, '本机音效偏好保留（不被房主的默认值覆盖）');
  eq(rulesEqual(merged, host), true, '套用后与房主规则等价');
  eq(rulesEqual(guest, host), false, '套用前与房主规则不等价（说明确实同步了）');
}

console.log('\n=== 测试 4: 规则摘要文案 ===');
{
  const s = describeRules({ baseScore: 2, fixedScore: 0, birdCount: 4, kongDrawCount: 4, kongRequiresJiang: false, startingHu: { daSiXi: true, banBanHu: false } });
  assert(s.includes('B=2') && s.includes('F=0') && s.includes('抓 4 鸟'), '摘要含 B/F/抓鸟');
  assert(s.includes('开杠摸 4 只') && s.includes('不需将'), '摘要含开杠设置');
  assert(s.includes('起手胡 1 项'), '摘要统计开启的起手胡项数');
  assert(describeRules({ birdCount: 0 }).includes('不抓鸟'), '不抓鸟文案');
}

console.log('\n=== 测试 5: 接线守卫（房主广播、客人套用并锁定）===');
{
  const app = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');
  const net = readFileSync(join(ROOT, 'src/utils/multiplayer.js'), 'utf8');

  assert(/pickMatchRules/.test(app), 'App 里用 pickMatchRules 挑房间规则');
  assert(/applyHostRules/.test(app), 'App 里用 applyHostRules 套用房主规则');
  assert(/setRoomRules/.test(app), 'App 把房间规则交给网络层');
  assert(/rules: pickMatchRules\(config\)/.test(app), '客人收到的载荷里带房主规则（DEAL_HAND）');
  assert(/setRulesLocked\(true\)/.test(app), '客人收到房主规则后进入「开局锁定」状态');

  assert(/setRoomRules\(/.test(net) && /this\.roomRules/.test(net), '网络层保存房主规则');
  assert(/rules: this\.roomRules/.test(net), 'LOBBY_STATE 里带上房间规则（大厅全员可见）');
  assert(/onLobbyChangeCallback\(data\.seats, data\.rules \|\| null\)/.test(net),
    '网络层把房主规则作为第二个参数回调给上层');
  assert(/setOnLobbyChange\(\(updatedSeats, roomRules\)/.test(readFileSync(join(ROOT, 'src/components/MultiplayerModal.jsx'), 'utf8')),
    '大厅弹窗收到房主规则后调用 onHostRules');
  assert(/onHostRules=/.test(app) && /rules=\{pickMatchRules\(config\)\}/.test(app), 'App 把规则交给大厅弹窗');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) process.exit(1);

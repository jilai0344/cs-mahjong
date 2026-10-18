#!/usr/bin/env node
// lint 基线门禁（ROADMAP P1-7 ③：CI 增加 lint 步骤）
//
// 做什么：跑 `oxlint --format=json`，把每条告警规范化成一行，与 scripts/lint-baseline.txt 对比：
//   · 出现基线里没有的告警 → 退出码 1（CI 失败，PR 不该合并）
//   · 基线里有但这次没出现的告警 → 只提示（说明被修掉了，可运行 --update 收紧基线）
//
// 为什么要「规范化」：oxlint 的 exhaustive-deps 告警会把缺失依赖**按内部顺序**枚举，
// 同一份代码在不同改动下枚举顺序会变（规则/缺失项/行号完全相同），直接 diff 会把这种
// 顺序变化误报成「新增告警」。这里把消息里的依赖清单排序后再比较，只对**真实的**新增/变化告警报警。
//
// 用法：
//   node scripts/check-lint.mjs            # 校验（CI / 提交前）
//   node scripts/check-lint.mjs --update   # 用当前结果重写基线（需要人复核 diff）
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE = resolve(here, 'lint-baseline.txt');

/**
 * 把告警消息里的依赖清单排序，消除「枚举顺序」造成的假差异。
 * 例：`missing dependencies: 'b', 'a', and 'c'` → `missing dependencies: 'a', 'b', 'c'`
 */
export function normalizeDependencyList(message) {
  return String(message).replace(/'([^']*)'(?:\s*,\s*'([^']*)')*(?:\s*,?\s*and\s*'([^']*)')?/g, (whole) => {
    const names = whole.match(/'[^']*'/g) || [];
    return names.slice().sort().join(', ');
  });
}

/**
 * 把一条 oxlint JSON 诊断规范化成可比的一行：
 * `<文件>:<行>:<列> <级别> <规则>: <消息>`
 */
export function normalizeDiagnostic(d) {
  if (!d || typeof d !== 'object') return null;
  const file = String(d.filename || '').replace(/\\/g, '/').replace(/^.*?(\/(?:src|test|scripts|\.github)\/)/, '$1').replace(/^\//, '');
  const span = (Array.isArray(d.labels) && d.labels[0] && d.labels[0].span) || {};
  const where = `${file}:${span.line ?? 0}:${span.column ?? 0}`;
  const sev = d.severity || 'warning';
  const code = d.code || 'unknown';
  const msg = normalizeDependencyList(d.message || '').replace(/\s+/g, ' ').trim();
  return `${where} ${sev} ${code}: ${msg}`;
}

/** 跑 oxlint 并返回规范化、排序、去重后的告警行 */
export function collectWarnings(cwd = process.cwd()) {
  let out = '';
  try {
    out = execFileSync('npx', ['oxlint', '--format=json'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // oxlint 有告警时也会退出码非 0 —— stdout 仍然是完整 JSON
    out = `${e.stdout || ''}`;
  }
  let parsed;
  try {
    parsed = JSON.parse(out || '{}');
  } catch {
    throw new Error('无法解析 oxlint 的 JSON 输出（oxlint 版本变化？）');
  }
  const rows = (parsed.diagnostics || []).map(normalizeDiagnostic).filter(Boolean);
  return [...new Set(rows)].sort();
}

/**
 * 比较用的「告警指纹」：与展示行相同，但**去掉行列号**。
 * 为什么：往文件上方插入代码会让已有告警整体平移行号（规则、消息完全没变），
 * 按行号比较会把这种平移误报成「新增 + 消失」两条。行号仍保留在展示行里方便定位。
 */
export function warningKey(line) {
  return String(line).replace(/:\d+:\d+ /, ' ');
}

export function compareWarnings(current, baseline) {
  const baseKeys = new Set(baseline.map(warningKey));
  const curKeys = new Set(current.map(warningKey));
  return {
    added: current.filter((l) => !baseKeys.has(warningKey(l))),
    removed: baseline.filter((l) => !curKeys.has(warningKey(l)))
  };
}

function main() {
  const update = process.argv.includes('--update');
  const current = collectWarnings();

  if (update) {
    writeFileSync(BASELINE, `${current.join('\n')}\n`, 'utf8');
    console.log(`✅ 已写入 ${BASELINE}（${current.length} 条）`);
    return;
  }

  if (!existsSync(BASELINE)) {
    console.error('❌ 缺少 scripts/lint-baseline.txt，请先运行 npm run lint:baseline');
    process.exit(2);
  }

  const baseline = readFileSync(BASELINE, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const { added, removed } = compareWarnings(current, baseline);

  console.log(`oxlint 基线：${baseline.length} 条；本次：${current.length} 条`);
  if (removed.length > 0) {
    console.log(`\nℹ️  ${removed.length} 条已在基线里、本次未出现（修好了？可运行 npm run lint:baseline 收紧基线）：`);
    removed.forEach((l) => console.log(`  - ${l}`));
  }
  if (added.length > 0) {
    console.error(`\n❌ 新增 ${added.length} 条 lint 告警（基线里没有）：`);
    added.forEach((l) => console.error(`  + ${l}`));
    console.error('\n要么改代码消除告警；确认无害时才运行 npm run lint:baseline 更新基线，并在 PR 里说明原因。');
    process.exit(1);
  }
  console.log('\n✅ 无新增 lint 告警');
}

if (process.argv[1] && process.argv[1].endsWith('check-lint.mjs')) {
  main();
}

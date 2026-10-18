// 仓库密钥扫描测试（P2-4）
// 注意：本文件里的「示例密钥」一律用拼接构造，避免自己成为扫描器的命中项。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanText, SECRET_PATTERNS, ALLOW_MARKER, repoRoot, trackedFiles } from '../scripts/check-secrets.mjs';

let passed = 0;
let failed = 0;
const failures = [];
function assert(c, m) { if (c) passed++; else { failed++; failures.push(m); console.error(`  ✗ FAIL: ${m}`); } }
function eq(a, e, m) { const x = JSON.stringify(a), y = JSON.stringify(e); assert(x === y, `${m}（实际 ${x} ≠ 期望 ${y}）`); }

const R = (n) => 'x'.repeat(n); // 造足够长的假值

console.log('=== 测试 1: 扫描器能认出常见密钥形态 ===');
{
  const samples = [
    ['AWS 访问密钥', `const k = "${'AKIA'}${'IOSFODNN7EXAMPLE'}";`],
    ['PEM 私钥', `${'-----BEGIN '}RSA PRIVATE KEY-----`],
    ['GitHub Token', `token=${'ghp_'}${R(36)}`],
    ['Google API Key', `key: "${'AIza'}${R(35)}"`],
    ['Slack Token', `${'xoxb-'}1234567890-abcdefghijkl`],
    ['JWT', `${'eyJhbGciOiJIUzI1NiJ9'}.${'eyJzdWIiOiIxIn0'}.${R(12)}`],
    ['Bearer', `Authorization: "${'Bearer '}${R(30)}"`],
    ['硬编码口令', `const ${'password'} = "${R(24)}";`],
    ['api_key 赋值', `${'api_key'}: '${R(24)}'`]
  ];
  for (const [label, text] of samples) {
    assert(scanText(text).length > 0, `能认出 ${label}`);
  }
  eq(scanText('const x = 1; // 普通代码，没有密钥').length, 0, '普通代码不误报');
  eq(scanText('BROKER_URLS = ["wss://broker.emqx.io:8084/mqtt"]').length, 0, '公共 broker 地址不误报（不是密钥）');
  eq(scanText(`const ${'password'} = "短"`).length, 0, '过短的口令字面量不误报');
}

console.log('\n=== 测试 2: 豁免机制 ===');
{
  const line = `const token = "${'ghp_'}${R(36)}";`;
  eq(scanText(`${line} // ${ALLOW_MARKER} 示例值`).length, 0, '带 allow 标记的行被豁免');
  assert(scanText(line).length > 0, '没有标记就照报');
  assert(SECRET_PATTERNS.length >= 6, '规则集覆盖至少 6 类密钥');
}

console.log('\n=== 测试 3: 仓库真实扫描（跟踪文件，0 命中才算过）===');
{
  const files = trackedFiles();
  assert(files.length > 20, `扫到足够多的跟踪文件（实际 ${files.length}）`);
  const hits = [];
  for (const rel of files) {
    if (rel === 'test/secrets.test.js') continue; // 本文件的示例串是拼接出来的，跳过以省时间
    let content = '';
    try { content = readFileSync(join(repoRoot, rel), 'utf8'); } catch { continue; }
    for (const h of scanText(content)) hits.push(`${rel}:${h.line} ${h.name}`);
  }
  eq(hits, [], '仓库内没有疑似密钥');
}

console.log('\n=== 测试 4: .gitignore 拦住 .env 之类的本地机密 ===');
{
  const gi = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
  assert(/^\.env\*/m.test(gi) || /^\.env$/m.test(gi), '.gitignore 忽略 .env / .env*');
  assert(/!\.env\.example/.test(gi), '.env.example 模板仍可提交');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length) { console.error('\n失败列表:'); failures.forEach(f => console.error('  - ' + f)); }
if (failed > 0) process.exit(1);

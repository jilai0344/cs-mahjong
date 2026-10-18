#!/usr/bin/env node
// 仓库密钥扫描（P2-4）：扫「git 跟踪的文件」里像密钥的东西，命中就退出码 1。
// 用于 CI 与 npm test —— 让「仓库内无密钥」成为被守卫的属性，而不是一次性声明。
//
// 用法：node scripts/check-secrets.mjs          （扫全部跟踪文件）
//       node scripts/check-secrets.mjs --list   （只列文件不做判定）
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 只扫文本类文件；图片/字体/压缩产物跳过（它们是二进制，不会承载可读密钥）
const TEXT_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|json|css|md|html|yml|yaml|txt|sh|env|example)$/i;
const SKIP_DIR = /(^|\/)(node_modules|dist|dist-ssr|coverage|\.git)\//;

/** 常见密钥形态。命中 → 视为泄露，需删除或用行内 `secret-scan: allow` 说明豁免理由。 */
export const SECRET_PATTERNS = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: '私钥文件内容', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub Token', re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'Google API Key', re: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: 'Slack Token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: 'Bearer Token', re: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/ },
  {
    name: '疑似硬编码口令/密钥',
    re: /(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i
  }
];

export const ALLOW_MARKER = 'secret-scan: allow';

/** 扫一段文本，返回命中列表 [{name, snippet, line}] */
export function scanText(content) {
  const lines = String(content).split('\n');
  const hits = [];
  lines.forEach((line, idx) => {
    if (line.includes(ALLOW_MARKER)) return; // 显式豁免（必须写明理由）
    for (const { name, re } of SECRET_PATTERNS) {
      const m = line.match(re);
      if (m) {
        hits.push({ name, line: idx + 1, snippet: m[0].slice(0, 24) + (m[0].length > 24 ? '…' : '') });
      }
    }
  });
  return hits;
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => TEXT_EXT.test(f) && !SKIP_DIR.test(f));
}

function main() {
  const listOnly = process.argv.includes('--list');
  const files = trackedFiles();
  if (listOnly) {
    console.log(files.join('\n'));
    return;
  }

  const findings = [];
  for (const rel of files) {
    let content = '';
    try {
      content = readFileSync(join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    const hits = scanText(content);
    for (const h of hits) findings.push({ file: rel, ...h });
  }

  console.log(`已扫描 git 跟踪的文本文件 ${files.length} 个（跳过 node_modules/dist）`);
  if (findings.length === 0) {
    console.log('✅ 未发现疑似密钥');
    return;
  }
  console.error(`❌ 发现 ${findings.length} 处疑似密钥：`);
  for (const f of findings) {
    console.error(`  - ${f.file}:${f.line} ${f.name} → ${f.snippet}`);
  }
  console.error(`\n确需保留的字面量，请在该行加注释「${ALLOW_MARKER}」并写明理由。`);
  process.exit(1);
}

// 仅在被直接执行时跑扫描（被 test 导入时不执行主流程）
const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) main();

export const repoRoot = ROOT;
export { trackedFiles };
export function relToRepo(p) {
  return relative(ROOT, p);
}

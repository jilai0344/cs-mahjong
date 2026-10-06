// 设计 token 守卫（P2-2 / D1）
//
// 作用：把「色值必须集中在 src/index.css 的 @theme」这条规范变成会失败的测试，
// 而不是靠人记得。三条检查：
//   ① @theme 里的 token 齐全且取值与文档一致；
//   ② 除 index.css 与「牌面艺术色白名单」外，源码里不得出现 #rrggbb；
//     白名单文件的 hex 数量只允许减少（记录上限），不允许新增；
//   ③ docs/DESIGN.md §3 必须覆盖每个 token 名与取值（文档与代码不能各说各话）。
//
// 运行：npm test（串在最后）
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const HEX_RE = /#[0-9a-fA-F]{6}\b/g;

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

/** 期望的 token 表（改这里必须同步改 docs/DESIGN.md §3） */
const EXPECTED_TOKENS = {
  page: '#03140e',
  panel: '#1f0604',
  'shell-800': '#3b0e08',
  'shell-700': '#380e08',
  'shell-500': '#240804',
  'shell-300': '#140302',
  'panel-800': '#4a180e',
  'panel-700': '#2b0c07',
  'panel-600': '#140503',
  'felt-300': '#a01c22',
  'felt-400': '#560a0d',
  'felt-500': '#821318',
  'felt-700': '#280406',
  'jade-600': '#15803d',
  'jade-500': '#22c55e',
  'jade-300': '#86efac',
  'jade-200': '#bbf7d0',
  'violet-800': '#4c1d73',
  'violet-600': '#2d0e45',
  'violet-400': '#1a082b',
  'gold-200': '#fde047',
  body: '#f1f5f9'
};

/** 牌面艺术色白名单：允许残留硬编码，但数量只允许减少（D1b 会逐批迁移） */
const ART_HEX_CEILING = {
  'src/components/MahjongTile.jsx': 101,
  'src/components/TileWall.jsx': 30
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
const designDoc = readFileSync(join(ROOT, 'docs/DESIGN.md'), 'utf8');

console.log('=== 测试 1: @theme 里的 token 齐全且取值正确 ===');
{
  assert(!!themeBlock, 'src/index.css 存在 @theme 块');
  const tokens = {};
  for (const m of (themeBlock ? themeBlock[1] : '').matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[m[1]] = m[2].toLowerCase();
  }
  eq(Object.keys(tokens).sort(), Object.keys(EXPECTED_TOKENS).sort(), 'token 名单与期望完全一致');
  for (const [name, value] of Object.entries(EXPECTED_TOKENS)) {
    eq(tokens[name], value, `--color-${name} = ${value}`);
  }
}

console.log('\n=== 测试 2: 源码里不得再写死色值（牌面艺术色白名单除外）===');
{
  const files = [...walk(join(ROOT, 'src'))];
  const offenders = [];
  const artCounts = {};

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (rel === 'src/index.css') continue; // token 定义处，允许
    const content = readFileSync(file, 'utf8');
    const hits = content.match(HEX_RE) || [];
    if (hits.length === 0) continue;
    if (rel in ART_HEX_CEILING) {
      artCounts[rel] = hits.length;
      assert(hits.length <= ART_HEX_CEILING[rel],
        `${rel} 硬编码色值只允许减少：${hits.length} ≤ 上限 ${ART_HEX_CEILING[rel]}（新增请改成 var(--color-*)）`);
      continue;
    }
    offenders.push(`${rel}（${hits.length} 处）`);
  }

  eq(offenders, [], '组件与样式里没有白名单之外的硬编码色值');
  for (const [rel, ceiling] of Object.entries(ART_HEX_CEILING)) {
    assert(artCounts[rel] !== undefined && artCounts[rel] > 0, `${rel} 仍在使用艺术色（当前 ${artCounts[rel]} 处，上限 ${ceiling}）`);
  }
  console.log(`  ℹ️  白名单残留：${Object.entries(artCounts).map(([f, c]) => `${f.split('/').pop()} ${c} 处`).join('、')}（D1b 逐批迁移）`);
}

console.log('\n=== 测试 3: 文档与代码一致（docs/DESIGN.md §3）===');
{
  const missingInDoc = Object.entries(EXPECTED_TOKENS)
    .filter(([name, value]) => !designDoc.includes(value) || !designDoc.includes(name))
    .map(([name]) => name);
  eq(missingInDoc, [], '每个 token 名与取值都出现在 DESIGN.md 的色板表里');
  assert(!/39482|djdodkj/.test(readFileSync(join(ROOT, 'src/App.jsx'), 'utf8')),
    'App.jsx 里没有占位符 39482 / djdodkj 的字样（含注释）');
}

console.log('\n=== 测试 4: 牌张尺寸六场景断点齐全（D2）===');
{
  const tileSrc = readFileSync(join(ROOT, 'src/components/MahjongTile.jsx'), 'utf8');
  const mapBlock = tileSrc.match(/const sizeMap = \{([\s\S]*?)\n  \};/);
  assert(!!mapBlock, 'MahjongTile.jsx 里存在 sizeMap');

  const SCENARIOS = ['hand', 'meld', 'discard', 'discard-side', 'opp-top', 'opp-side'];
  const REQUIRED_VARIANTS = ['sm:', 'md:', 'lg:', 'xl:'];

  for (const key of SCENARIOS) {
    const re = new RegExp(`(?:'${key}'|\\b${key})\\s*:\\s*'([^']*)'`);
    const m = (mapBlock ? mapBlock[1] : '').match(re);
    assert(!!m, `${key} 场景存在尺寸定义`);
    if (!m) continue;
    const cls = m[1];
    const missing = REQUIRED_VARIANTS.filter((v) => !cls.includes(v));
    eq(missing, [], `${key} 场景补齐了 ${REQUIRED_VARIANTS.join(' / ')} 四档（D2：小屏到大屏都要有明确尺寸）`);
    assert(/w-\[\d+px\] h-\[\d+px\]/.test(cls), `${key} 给出了基础宽高`);
    // 强制横屏 + Tailwind 的 landscape: 变体会压过宽度断点（实测桌面 1440 手牌只有 60×82）→ 尺寸表里不许再用它
    assert(!cls.includes('landscape:'), `${key} 不使用 landscape: 变体（它会在横屏下压过 xl 等宽度断点）`);
  }
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

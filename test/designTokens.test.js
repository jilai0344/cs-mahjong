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

/** 牌面艺术色：D1b 已全部 token 化（改动历史：MahjongTile 101 处、TileWall 30 处 → 0）。
 *  上限固定 0：这两个文件里再出现 #xxxxxx 就直接失败，艺术色一律写 var(--art-*)。 */
const ART_HEX_CEILING = {
  'src/components/MahjongTile.jsx': 0,
  'src/components/TileWall.jsx': 0
};

/** D1b 迁移台账：33 个艺术色 token 的取值必须与迁移前的硬编码字面量逐条一致
 *  （值没变 ⇒ 只是换了个引用方式，像素不可能变）。 */
const EXPECTED_ART_TOKENS = {
  face: '#fcfbf7',
  'face-shade': '#f3efe4',
  'face-edge': '#d1ccba',
  ink: '#18181b',
  white: '#ffffff',
  'wan-300': '#f87171',
  'wan-400': '#ef4444',
  'wan-500': '#dc2626',
  'wan-600': '#b91c1c',
  'wan-700': '#991b1b',
  'tiao-300': '#4ade80',
  'tiao-500': '#22c55e',
  'tiao-600': '#15803d',
  'tiao-700': '#047857',
  'tiao-800': '#14532d',
  'tiao-900': '#065f46',
  'tong-300': '#60a5fa',
  'tong-400': '#3b82f6',
  'tong-500': '#2563eb',
  'tong-600': '#1d4ed8',
  'tong-800': '#1e40af',
  'tong-900': '#1e3a8a',
  'gold-100': '#fef9c3',
  'gold-200': '#fef08a',
  'gold-500': '#f59e0b',
  'gold-600': '#d97706',
  'gold-700': '#ca8a04',
  'gold-800': '#92400e',
  'gold-900': '#b45309',
  'brown-900': '#78350f',
  'brown-950': '#451a03',
  'steel-200': '#e5e5e5',
  'steel-300': '#d4d4d4',
  'steel-400': '#a3a3a3'
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
    if (ceiling === 0) {
      assert(!(rel in artCounts), `${rel} 已全部 token 化（D1b 完成：艺术色一律 var(--art-*)）`);
    } else {
      assert(artCounts[rel] !== undefined && artCounts[rel] > 0, `${rel} 仍在使用艺术色（当前 ${artCounts[rel]} 处，上限 ${ceiling}）`);
    }
  }
  console.log(`  ℹ️  白名单残留：${Object.entries(artCounts).map(([f, c]) => `${f.split('/').pop()} ${c} 处`).join('、') || '无'}`);
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

console.log('\n=== 测试 5: 假等级徽标与占位文案已清理（D3）===');
{
  const app = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');
  const opp = readFileSync(join(ROOT, 'src/components/OpponentHand.jsx'), 'utf8');
  const center = readFileSync(join(ROOT, 'src/components/TableCenter.jsx'), 'utf8');

  assert(!/vipRank|>V8</.test(app), 'App.jsx 里没有假等级徽标（vipRank / V8）');
  assert(!/vipRank|'V1'|'V5'|'V32'/.test(opp), 'OpponentHand.jsx 里没有假等级徽标（V1/V5/V32）');
  assert(!/新手区/.test(center), 'TableCenter.jsx 里没有写死的「新手区 20」');
  assert(/roomLabel/.test(center), '牌桌中心显示的是传入的真实标识（房间号 / 单机练习）');
  assert(/myRecord\.netScore/.test(app), '左下角胶囊显示的是本机真实战绩（净胜分）');
}

console.log('\n=== 测试 6: 安全区 / 减少动态 / 结算页字号层级（D4/D5/D7）===');
{
  const cssAll = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
  const appSrc2 = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');

  // D4 安全区
  assert(/safe-area-inset-left/.test(cssAll) && /safe-area-inset-right/.test(cssAll) && /safe-area-inset-bottom/.test(cssAll),
    'D4：index.css 从 env() 取出四边安全区变量');
  assert(/\.safe-pad\s*\{/.test(cssAll) && /padding-left:\s*var\(--safe-left\)/.test(cssAll),
    'D4：提供 .safe-pad 工具类（四边内缩）');
  assert(/safe-pad"/.test(appSrc2), 'D4：游戏根容器套用 safe-pad，顶栏与四角徽标随之避开刘海/圆角');
  assert(/var\(--safe-bottom\)/.test(appSrc2), 'D4：手牌区引用安全区变量');
  assert(!/env\(safe-area/.test(appSrc2), 'D4：组件里不再散落 env()（统一走变量，便于验证）');

  // D5 减少动态效果
  assert(/@media \(prefers-reduced-motion: reduce\)/.test(cssAll), 'D5：存在 prefers-reduced-motion 媒体查询');
  assert(/animation-duration:\s*0\.001ms\s*!important/.test(cssAll), 'D5：动画时长压到不可感知');
  assert(/transition-duration:\s*0\.001ms\s*!important/.test(cssAll), 'D5：过渡时长压到不可感知');
  assert(/animation-iteration-count:\s*1\s*!important/.test(cssAll), 'D5：动画不重复播放（不留位移循环）');

  // D7 结算页字号层级
  const modal = readFileSync(join(ROOT, 'src/components/RoundResultModal.jsx'), 'utf8');
  assert(/本局共得/.test(modal), 'D7：结算页有主视觉标签「本局共得」');
  const serif = modal.match(/font-serif text-\[(\d+)px\]/);
  assert(!!serif, 'D7：主视觉数字用衬线字体');
  if (serif) assert(Number(serif[1]) >= 22, `D7：主视觉字号 ≥22px（实际 ${serif[1]}px）`);
  const big = modal.match(/\btext-(lg|xl|2xl|3xl|4xl)\b/g) || [];
  eq(big, [], 'D7：除主视觉外没有大于 16px 的字号类');
  assert(/--font-serif:\s*"Noto Serif SC"/.test(cssAll),
    'D7：font-serif 指向 index.html 已预加载的 Noto Serif SC（此前只加载没用上）');
}

console.log('\n=== 测试 7: 桌心信息密度（D6）===');
{
  const center = readFileSync(join(ROOT, 'src/components/TableCenter.jsx'), 'utf8');
  const appSrc3 = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');

  assert(/role="progressbar"/.test(center), 'D6：桌心有牌墙进度条（数据可视化，不是装饰纹理）');
  assert(/aria-valuenow=\{wallRemaining\}/.test(center) && /aria-valuemax=\{wallTotal\}/.test(center),
    'D6：进度条带 aria-valuenow / aria-valuemax');
  assert(/roundNumber/.test(center) && /dealerName/.test(center), 'D6：桌心显示「第 N 局」与庄家');
  assert(/wallTotal/.test(center), 'D6：显示「余 N / 总数」，不再只有一个余数');
  assert(/wallTotal=\{wallTotal\}/.test(appSrc3) && /roundNumber=\{roundNumber\}/.test(appSrc3) && /dealerName=\{/.test(appSrc3),
    'D6：App 把牌墙总数 / 局数 / 庄家名传给桌心');
  assert(/setWallTotal\(newDeck\.length\)/.test(appSrc3), 'D6：牌墙总数取自真实牌堆长度（不是写死 108）');
  assert(/gameState === 'ROUND_OVER' \? roundNoRef\.current \+ 1 : 1/.test(appSrc3),
    'D6：局数在结算后递增、从大厅重开归 1');
}

console.log('\n=== 测试 8: 牌面艺术色 token（D1b）===');
{
  const artSection = css.split('牌面艺术色 token')[1] || '';
  const artBlock = artSection.match(/@theme\s*\{([\s\S]*?)\n\}/);
  assert(!!artBlock, 'index.css 里有独立的「牌面艺术色」@theme 块');

  const artTokens = {};
  for (const m of (artBlock ? artBlock[1] : '').matchAll(/--art-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    artTokens[m[1]] = m[2].toLowerCase();
  }
  assert(Object.keys(artTokens).length >= 33, `艺术色 token 数量 ≥33（实际 ${Object.keys(artTokens).length}）`);
  eq(Object.keys(artTokens).sort(), Object.keys(EXPECTED_ART_TOKENS).sort(), '艺术色 token 名单与迁移台账完全一致');
  for (const [name, value] of Object.entries(EXPECTED_ART_TOKENS)) {
    eq(artTokens[name], value, `--art-${name} = ${value}（必须与迁移前的硬编码字面量一致）`);
  }

  const undocumented = Object.entries(artTokens)
    .filter(([name, value]) => !designDoc.includes(`--art-${name}`) || !designDoc.includes(value))
    .map(([name]) => name);
  eq(undocumented, [], '每个艺术色 token 都写进 DESIGN.md 的牌面色板表（含取值）');

  for (const rel of ['src/components/MahjongTile.jsx', 'src/components/TileWall.jsx']) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    eq(src.match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], `${rel} 里不再有任何硬编码色值`);
    assert(/var\(--art-/.test(src), `${rel} 通过 var(--art-*) 取艺术色`);
  }
}

console.log('\n=== 测试 9: 双主题（P0-8 / D8）===');
{
  // 翡翠主题：只换值、不换 token 名；覆盖块必须在 @theme 之外（测试 1 只认第一个 @theme 块）
  const jadeBlock = css.match(/\[data-theme="jade"\]\s*\{([\s\S]*?)\n\}/);
  assert(!!jadeBlock, 'index.css 里有 [data-theme="jade"] 覆盖块');
  const jadeTokens = {};
  for (const m of (jadeBlock ? jadeBlock[1] : '').matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    jadeTokens[m[1]] = m[2].toLowerCase();
  }
  const EXPECTED_JADE = {
    page: '#04120c', panel: '#0d1f14',
    'shell-800': '#123626', 'shell-700': '#0f2e20', 'shell-500': '#0a2115', 'shell-300': '#06130c',
    'panel-800': '#16402e', 'panel-700': '#0f2c1f', 'panel-600': '#071711',
    'felt-300': '#319e64', 'felt-500': '#1e7a49', 'felt-400': '#145c38', 'felt-700': '#0a2c1b',
    'violet-800': '#14503a', 'violet-600': '#0d3a29', 'violet-400': '#07231a'
  };
  eq(jadeTokens, EXPECTED_JADE, '翡翠主题覆盖的 token 名单与取值与规范一致（只换暖色系，翡翠/金色/正文共用）');

  const appSrc = readFileSync(join(ROOT, 'src/App.jsx'), 'utf8');
  assert(/data-theme=\{[^}]*config\.theme/.test(appSrc), 'App.jsx 根容器按 config.theme 设置 data-theme');
  const settingsSrc = readFileSync(join(ROOT, 'src/components/SettingsModal.jsx'), 'utf8');
  assert(/theme: 'red'/.test(settingsSrc) && /theme: 'jade'/.test(settingsSrc), '设置面板有红绒/翡翠两个主题切换按钮');
  const typesSrc = readFileSync(join(ROOT, 'src/types/mahjong.js'), 'utf8');
  assert(/theme: 'red'/.test(typesSrc), "DEFAULT_CONFIG 默认 theme: 'red'（老用户无感）");
  const rulesSrc = readFileSync(join(ROOT, 'src/game/rules.js'), 'utf8');
  assert(!/theme/.test(rulesSrc.match(/export function pickMatchRules[\s\S]*?\n\}/)[0]),
    'pickMatchRules 不含 theme（主题是本机显示偏好，不随联机同步）');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

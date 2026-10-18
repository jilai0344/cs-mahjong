// 出牌/摸牌节奏动效守卫（P2-1 收口）
//
// 作用：把「出牌与摸牌必须有可见的节奏反馈，但必须符合 DESIGN.md §7 的动效规范」变成会失败的测试。
// 四条检查：
//   ① 两个 keyframes（tileDraw / tileDiscard）存在，且只动 transform/opacity（不触发布局抖动）；
//   ② 时长来自动效 token 且落在规范区间 150–200ms（token 取值本身也校验）；
//   ③ 规范禁止「超过 300ms 才能继续操作」的阻塞动画 ⇒ 新增动效里不得出现 >300ms；
//   ④ 两个组件确实挂上了对应 class：摸牌那张牌以「牌 id」为 key（换张即重播），
//      出牌池把 class 挂在「最新一张」上；并且 @media (prefers-reduced-motion: reduce) 仍然存在。
//
// 运行：npm test（串在最后）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function eq(actual, expected, msg) {
  if (actual === expected) { passed++; return; }
  failed++; failures.push(`${msg}\n  期望: ${JSON.stringify(expected)}\n  实际: ${JSON.stringify(actual)}`);
}
function ok(cond, msg) {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const css = read('src/mahjong.css');
const theme = read('src/index.css');
const hand = read('src/components/PlayerHand.jsx');
const pool = read('src/components/DiscardPool.jsx');

// ---- ① keyframes 存在，且只动 transform/opacity ----
for (const name of ['tileDraw', 'tileDiscard']) {
  const m = css.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  ok(!!m, `mahjong.css 必须有 @keyframes ${name}`);
  if (!m) continue;
  const body = m[1];
  ok(/transform:/.test(body), `${name} 必须动 transform（位移/缩放）`);
  ok(/opacity:/.test(body), `${name} 必须动 opacity（淡入）`);
  // 只允许动 transform/opacity：出现 width/height/top/left/margin 会引发布局抖动
  ok(!/\b(width|height|top|left|right|bottom|margin|padding):/.test(body),
    `${name} 不得动布局属性（宽高/定位/外边距），否则会掉帧`);
}

// ---- ② 时长来自 token 且落在 150–200ms ----
const tokenM = (n) => {
  const m = theme.match(new RegExp(`--${n}:\\s*(\\d+)ms`));
  return m ? Number(m[1]) : null;
};
const fast = tokenM('motion-fast');
const base = tokenM('motion-base');
ok(fast !== null && base !== null, 'index.css @theme 必须有 --motion-fast / --motion-base（毫秒）');
for (const [n, v] of [['motion-fast', fast], ['motion-base', base]]) {
  ok(v >= 150 && v <= 200, `--${n} = ${v}ms 必须在规范区间 150–200ms`);
}
ok(/--motion-ease-out:\s*cubic-bezier/.test(theme), '--motion-ease-out 必须是 cubic-bezier 曲线');

const classRe = /\.animate-tile-(draw|discard)\s*\{([^}]*)\}/g;
const classBodies = {};
for (const m of css.matchAll(classRe)) classBodies[m[1]] = m[2];
eq(Object.keys(classBodies).sort().join(','), 'discard,draw', '必须同时提供 .animate-tile-draw 与 .animate-tile-discard');
for (const [kind, body] of Object.entries(classBodies)) {
  ok(/animation:\s*tile(Draw|Discard)\s+var\(--motion-(fast|base)\)/.test(body.replace(/\s+/g, ' ')),
    `.animate-tile-${kind} 的时长必须来自 --motion-* token（不得写裸毫秒）`);
  ok(!/\d+ms/.test(body), `.animate-tile-${kind} 里不得出现裸毫秒时长`);
  ok(/var\(--motion-ease-out\)/.test(body), `.animate-tile-${kind} 必须用 --motion-ease-out`);
}

// ---- ③ 不许有 >300ms 的动效（规范：超过 300ms 才能继续点击即视为阻塞） ----
const allDurations = [...css.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
const tooLong = allDurations.filter((d) => d > 300);
eq(tooLong.length, 0, `mahjong.css 不得有 >300ms 的动效时长（发现：${tooLong.join(',')}）`);

// ---- ④ 组件确实挂上了 class + reduce-motion 仍在 ----
ok(/animate-tile-draw/.test(hand), 'PlayerHand 的摸牌那张必须挂 animate-tile-draw');
ok(/key=\{drawnTile\.id\}/.test(hand), '摸牌那张必须以 drawnTile.id 为 key（换一张牌才重播动效）');
ok(/animate-tile-discard/.test(pool), 'DiscardPool 最新一张出牌必须挂 animate-tile-discard');
// 判据必须是「本家门前最新一张」，不能是 lastDiscard（后者表示「刚打出且你可吃碰胡的那张」，
// 自己打出的牌不会写进它 ⇒ 用它会让自己出牌没有节奏反馈）。
ok(/const newestId = discards\.length \? discards\[discards\.length - 1\]\.id : null/.test(pool),
  '出牌节奏必须按「本家门前最新一张」判定（newestId = discards 的最后一张）');
ok(/isNewest\s*\?[^\n]*animate-tile-discard/.test(pool), 'animate-tile-discard 必须挂在 isNewest 条件下，不能全池都动');
eq(/isLatest\s*\?[^\n]*animate-tile-discard/.test(pool), false,
  '出牌节奏不得挂在 isLatest（lastDiscard）上：自己打出的牌会没有动效');
ok(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(theme), 'index.css 必须保留 prefers-reduced-motion 退化');
ok(/animation-duration:\s*0\.001ms\s*!important/.test(theme), 'reduce-motion 下必须把动画时长压到 0.001ms');

console.log(`\n动效守卫（P2-1）：通过 ${passed} 条，失败 ${failed} 条`);
if (failed) {
  console.log('\n失败明细：');
  for (const f of failures) console.log(' - ' + f);
  process.exit(1);
}

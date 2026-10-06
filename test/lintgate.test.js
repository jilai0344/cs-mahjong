// lint 基线门禁的纯函数测试（ROADMAP P1-7 ③）
// 运行：npm test（串在最后）
import { normalizeDiagnostic, normalizeDependencyList, compareWarnings, warningKey } from '../scripts/check-lint.mjs';

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

// 取自真实 oxlint --format=json 输出的一小片
const DIAG_DEP_A = {
  message: "React Hook useEffect has missing dependencies: 'playerMelds', 'executeDiscard', 'handleGuestActionResponse', and 'handleAcknowledgeStartingHu'",
  code: 'react-hooks(exhaustive-deps)',
  severity: 'warning',
  filename: '/home/runner/work/cs-mahjong/cs-mahjong/src/App.jsx',
  labels: [{ label: 'x', span: { line: 211, column: 1 } }]
};
const DIAG_DEP_B = { ...DIAG_DEP_A, message: "React Hook useEffect has missing dependencies: 'handleAcknowledgeStartingHu', 'playerMelds', 'executeDiscard', and 'handleGuestActionResponse'" };

console.log('=== 测试 1: 诊断行规范化 ===');
{
  eq(normalizeDiagnostic(DIAG_DEP_A), 'src/App.jsx:211:1 warning react-hooks(exhaustive-deps): React Hook useEffect has missing dependencies: \'executeDiscard\', \'handleAcknowledgeStartingHu\', \'handleGuestActionResponse\', \'playerMelds\'',
    '去掉绝对路径前缀，依赖清单排序，输出「文件:行:列 级别 规则: 消息」');
  eq(normalizeDiagnostic(DIAG_DEP_A) === normalizeDiagnostic(DIAG_DEP_B), true,
    '同一条告警、仅缺失依赖枚举顺序不同 → 规范化后完全相同（不再误报「新增告警」）');

  const other = { ...DIAG_DEP_A, message: "React Hook useEffect has missing dependencies: 'playerMelds', 'executeDiscard', 'handleGuestActionResponse', and 'handleStartMultiplayerGame'" };
  assert(normalizeDiagnostic(other) !== normalizeDiagnostic(DIAG_DEP_A), '缺失依赖**集合**不同 → 仍是不同告警（不会被合并掉）');

  const unused = { ...DIAG_DEP_A, message: "Parameter 'playerId' is declared but never used.", code: 'eslint(no-unused-vars)', filename: 'src/components/DiscardPool.jsx', labels: [{ span: { line: 12, column: 20 } }] };
  eq(normalizeDiagnostic(unused), "src/components/DiscardPool.jsx:12:20 warning eslint(no-unused-vars): Parameter 'playerId' is declared but never used.",
    '普通告警照常规范化');

  eq(normalizeDiagnostic(null), null, 'null → null（不抛错）');
  eq(normalizeDiagnostic({ filename: 'src/a.js' }), 'src/a.js:0:0 warning unknown: ', '缺字段也不抛错（行列为 0）');
  eq(normalizeDependencyList("'b', 'a', and 'c'"), "'a', 'b', 'c'", '依赖清单按字典序拼接');
  eq(normalizeDependencyList('没有引号的普通消息'), '没有引号的普通消息', '没有清单时原样返回');
}

console.log('\n=== 测试 2: 基线对比（新增 vs 修复）===');
{
  const baseline = [
    'src/App.jsx:211:1 warning react-hooks(exhaustive-deps): x',
    'src/a.js:3:5 warning eslint(no-unused-vars): y'
  ];
  eq(compareWarnings([...baseline], baseline), { added: [], removed: [] }, '完全一致 → 无新增无修复');
  eq(compareWarnings([...baseline, 'src/b.js:1:1 warning eslint(no-unused-vars): z'], baseline).added,
    ['src/b.js:1:1 warning eslint(no-unused-vars): z'], '多出来的告警 → added（门禁据此失败）');
  eq(compareWarnings([baseline[0]], baseline).removed, [baseline[1]], '少了的告警 → removed（只提示，不失败）');
  eq(compareWarnings([], baseline), { added: [], removed: baseline }, '全部清空 → 全部算 removed');
  eq(compareWarnings(['src/z.js:1:1 warning eslint(no-unused-vars): new'], baseline).added.length, 1,
    '替换成另一条 → 一条 added、一条 removed');
}

console.log('\n=== 测试 3: 行号平移不算新增（真实现场：往文件上方加代码） ===');
{
  const before = 'src/utils/multiplayer.js:158:44 warning eslint(no-unused-vars): Catch parameter \'_\' is caught but never used.';
  const after = 'src/utils/multiplayer.js:176:44 warning eslint(no-unused-vars): Catch parameter \'_\' is caught but never used.';
  assert(before !== after, '两条展示行本身不同（行号变了）');
  eq(warningKey(before) === warningKey(after), true, '但指纹相同（忽略行列号）');
  eq(compareWarnings([after], [before]), { added: [], removed: [] },
    '同一告警只是行号平移 → 不算新增、也不算消失（否则每次在前文插代码都会误报）');

  const realNew = 'src/utils/multiplayer.js:176:44 warning eslint(no-unused-vars): Identifier \'foo\' is imported but never used.';
  eq(compareWarnings([after, realNew], [before]).added, [realNew], '同一文件里的**不同**告警仍然算新增');
  eq(warningKey('src/a.js:1:1 warning x(): y'), 'src/a.js warning x(): y', '指纹格式 = 「文件 级别 规则: 消息」');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

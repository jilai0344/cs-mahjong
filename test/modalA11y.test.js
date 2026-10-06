// 弹窗无障碍辅助函数的测试（P2-6）
// 运行：npm test（串在最后）
import { nextFocusIndex, FOCUSABLE_SELECTOR } from '../src/hooks/useModalA11y.js';
import { getLocalDisplayId } from '../src/utils/localId.js';

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

console.log('=== 测试 1: Tab 焦点循环（表驱动）===');
{
  // [当前下标, 元素个数, 是否 Shift, 期望下一个下标]
  const cases = [
    [0, 3, false, 1],
    [1, 3, false, 2],
    [2, 3, false, 0],   // 末尾 Tab → 回到第一个（不跑到弹窗后面的牌桌）
    [0, 3, true, 2],    // 首项 Shift+Tab → 跳到末尾
    [2, 3, true, 1],
    [-1, 3, false, 0],  // 焦点不在弹窗里 → 从头开始
    [-1, 3, true, 2],
    [0, 1, false, 0],   // 只有一个可聚焦元素 → 原地
    [0, 1, true, 0],
    [0, 0, false, -1],  // 没有可聚焦元素 → -1（调用方跳过 preventDefault）
    [0, -1, false, -1],
    [null, 2, false, 0],
    [0, null, false, -1]
  ];
  cases.forEach(([cur, count, shift, expected]) => {
    eq(nextFocusIndex(cur, count, shift), expected,
      `当前=${cur} 个数=${count} Shift=${shift} → ${expected}`);
  });
}

console.log('\n=== 测试 2: 可聚焦选择器覆盖常见控件 ===');
{
  assert(FOCUSABLE_SELECTOR.includes('button'), '包含 button');
  assert(FOCUSABLE_SELECTOR.includes('input'), '包含 input');
  assert(FOCUSABLE_SELECTOR.includes('[tabindex]:not([tabindex="-1"])'), '包含显式 tabindex（排除 -1）');
  assert(FOCUSABLE_SELECTOR.includes('button:not([disabled])'), '排除被 disabled 的按钮');
}

console.log('\n=== 测试 3: 本机展示标识（P2-6，替掉写死的 39482）===');
{
  const makeStore = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      store: {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v))
      },
      map
    };
  };

  const { store, map } = makeStore();
  const first = getLocalDisplayId(store);
  assert(/^\d{5}$/.test(first), '首次进入生成 5 位数字标识');
  eq(map.get('cs_local_id'), first, '标识写入 localStorage');
  eq(getLocalDisplayId(store), first, '再次读取沿用同一个标识（不会每次刷新都变）');

  const { store: s2 } = makeStore({ cs_local_id: '12345' });
  eq(getLocalDisplayId(s2), '12345', '已有合法标识时直接沿用');

  const { store: s3 } = makeStore({ cs_local_id: 'abc' });
  assert(/^\d{5}$/.test(getLocalDisplayId(s3)), '存量值不合法时重新生成');

  eq(getLocalDisplayId(null), '00000', 'localStorage 不可用 → 占位（不抛错）');
  eq(getLocalDisplayId({}), '00000', 'storage 缺方法 → 占位');
  eq(getLocalDisplayId({ getItem: () => { throw new Error('privacy mode'); }, setItem: () => {} }), '00000',
    '读取抛错（隐私模式）→ 占位，不影响游戏');
}

console.log(`\n测试汇总: 通过 ${passed} 个, 失败 ${failed} 个`);
if (failures.length > 0) {
  console.error('\n失败列表:');
  failures.forEach((f) => console.error('  - ' + f));
}
if (failed > 0) {
  process.exit(1);
}

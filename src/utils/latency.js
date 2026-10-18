// 联机延迟与连接状态（P2-3：给玩家看得见的网络状况）
// 纯函数 + 注入时钟，便于单测（见 test/latency.test.js）。无 React / 无 DOM / 无网络。
//
// 用法：
//   const tr = createLatencyTracker({ window: 5 });
//   tr.record(48); tr.record(52);
//   tr.value()      // 50（最近 N 次的平均，四舍五入）
//   tr.classify()   // 'good' | 'fair' | 'poor' | 'unknown'
//   formatLatency(tr.value()) // '50ms'
export const LATENCY_BOUNDS = { good: 150, fair: 400 };

/** 统一的数值入口：null / undefined / '' / 非数字都算「没有样本」。
 *  （踩过的坑：Number(null) === 0，会被误当成「0ms」这种合法延迟） */
function toLatencyNumber(ms) {
  if (ms === null || ms === undefined || ms === '') return null;
  const v = Number(ms);
  return Number.isFinite(v) ? v : null;
}

/** 采样窗口内平均延迟（毫秒，整数）；没有有效样本时返回 null */
export function createLatencyTracker({ window: windowSize = 5 } = {}) {
  const size = Number.isFinite(windowSize) && windowSize > 0 ? Math.floor(windowSize) : 5;
  let samples = [];

  return {
    /** 记录一次往返耗时；非法值（负数/null/NaN/Infinity）直接丢弃，不污染平均值 */
    record(ms) {
      const v = toLatencyNumber(ms);
      if (v === null || v < 0) return null;
      samples = [...samples, Math.round(v)].slice(-size);
      return this.value();
    },
    /** 最近 N 次的平均（四舍五入） */
    value() {
      if (samples.length === 0) return null;
      const sum = samples.reduce((a, b) => a + b, 0);
      return Math.round(sum / samples.length);
    },
    /** 丢包/长期无响应时调用：清空样本，回到「未知」 */
    reset() {
      samples = [];
    },
    /** 当前窗口内的原始样本（拷贝） */
    all() {
      return [...samples];
    },
    classify() {
      return classifyLatency(this.value());
    }
  };
}

/** 延迟分档：≤150 优 / ≤400 良 / >400 差 / 无样本未知 */
export function classifyLatency(ms) {
  const v = toLatencyNumber(ms);
  if (v === null || v < 0) return 'unknown';
  if (v <= LATENCY_BOUNDS.good) return 'good';
  if (v <= LATENCY_BOUNDS.fair) return 'fair';
  return 'poor';
}

export const LATENCY_LABELS = { good: '优', fair: '良', poor: '差', unknown: '未知' };
export const LATENCY_TONES = { good: 'ok', fair: 'warn', poor: 'bad', unknown: 'idle' };

/** '48ms' / '—' */
export function formatLatency(ms) {
  const v = toLatencyNumber(ms);
  if (v === null || v < 0) return '—';
  return `${Math.round(v)}ms`;
}

export const CONNECTION_LABELS = {
  connecting: '连接中',
  connected: '已连接',
  reconnecting: '重连中',
  disconnected: '已断开'
};

export function connectionLabel(state) {
  return CONNECTION_LABELS[state] || '未知';
}

export function connectionTone(state) {
  if (state === 'connected') return 'ok';
  if (state === 'connecting' || state === 'reconnecting') return 'warn';
  return 'bad';
}

/** 指示器的综合色调：连接不健康时按连接算；健康时按延迟分档算（差延迟必须是红灯） */
export function statusTone({ latency = null, connection = 'disconnected' } = {}) {
  if (connection !== 'connected') return connectionTone(connection);
  const cls = classifyLatency(latency);
  return LATENCY_TONES[cls] || 'idle';
}

/** 顶栏指示器要显示的整句（含延迟与分档），连接不健康时只显示连接状态 */
export function networkStatusText({ latency = null, connection = 'disconnected' } = {}) {
  const conn = connectionLabel(connection);
  if (connection !== 'connected') return conn;
  // 还没测到往返（例如大厅里还没有对手可测）时只说「已连接」，不假装在测速
  if (latency === null) return conn;
  const cls = classifyLatency(latency);
  return `${formatLatency(latency)} ${LATENCY_LABELS[cls]}`;
}

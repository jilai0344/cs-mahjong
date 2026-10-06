// 本机展示标识（P2-6：替掉胶囊牌上写死的 39482）
//
// 只用于界面展示，不入局、不上传、不参与任何判定：首次进入时随机生成一个 5 位数字并存在
// localStorage，之后一直沿用；localStorage 不可用（隐私模式/SSR）时返回占位。
// 抽成模块的原因：一是可单测（传入 storage 桩），二是避免在组件渲染期直接调用 Math.random
// （oxlint 的 react(purity) 会把渲染期调用随机数判为不纯）。
const STORAGE_KEY = 'cs_local_id';

/** @param {{getItem:Function, setItem:Function}|null} storage */
export function getLocalDisplayId(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return '00000';
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing && /^\d{5}$/.test(existing)) return existing;
    const fresh = String(Math.floor(10000 + Math.random() * 90000));
    storage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return '00000'; // 存不进去也不影响游戏
  }
}

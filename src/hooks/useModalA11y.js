// 弹窗无障碍（P2-6）：Esc 关闭 + role/aria + 初始焦点 + Tab 焦点循环
//
// 背景：所有弹窗都只是「一层 fixed inset-0 + 内容」，没有 role/aria，键盘用户 Tab 会跑到弹窗后面的
// 牌桌上、Esc 也关不掉，读屏软件不知道弹出了对话框。这里给一个统一的小钩子，避免每个弹窗各写一遍。
import { useEffect, useRef } from 'react';

/** 可聚焦元素选择器（焦点循环用） */
export const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tab / Shift+Tab 在弹窗内部循环时，下一个应该聚焦第几个（纯函数，便于单测）
 * @param {number} currentIndex 当前焦点在可聚焦元素列表里的下标（-1 表示不在列表里）
 * @param {number} count 可聚焦元素总数
 * @param {boolean} shift 是否按住了 Shift（反向）
 * @returns {number} 下一个下标；count 为 0 时返回 -1
 */
export function nextFocusIndex(currentIndex, count, shift = false) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  if (!Number.isInteger(currentIndex) || currentIndex < 0) return shift ? count - 1 : 0;
  return shift ? (currentIndex - 1 + count) % count : (currentIndex + 1) % count;
}

/**
 * 弹窗无障碍钩子
 * @param {(() => void)|null} onClose Esc 触发（传 null 表示该弹窗不允许被 Esc 关掉，例如结算页）
 * @returns 直接展开到最外层遮罩 div 上的属性：ref / role / aria-modal / tabIndex / onKeyDown
 */
export function useModalA11y(onClose = null) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  // 每次渲染后同步最新的 onClose（放在 effect 里，避免「渲染期访问 ref」的告警）
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;

    // 打开就把焦点移进弹窗，键盘/读屏用户才进得到
    try { node.focus(); } catch { /* 元素可能尚未挂载可聚焦属性 */ }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // 焦点循环：不允许 Tab 跑到弹窗后面的牌桌上
      const items = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement);
      const nextIndex = nextFocusIndex(currentIndex, items.length, e.shiftKey);
      e.preventDefault();
      items[nextIndex]?.focus();
    };

    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
      // 关闭后把焦点还给打开它的元素，避免焦点掉到 body
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch { /* 元素可能已卸载 */ }
      }
    };
  }, []);

  return {
    ref,
    role: 'dialog',
    'aria-modal': 'true',
    tabIndex: -1,
    onKeyDown: undefined // 事件在 effect 里绑到 node 上（避免每次渲染重建内联处理器）
  };
}

import React from 'react';

/**
 * 最后一道兜底：任何渲染期异常都给出可操作的恢复界面，而不是整页白屏。
 * （资源 404 这类连 bundle 都没起来的白屏仍需要刷新/清缓存。）
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ui-paper)] p-5">
        <div className="paper-card w-full max-w-md rounded-3xl p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-2xl">
            !
          </div>
          <h1 className="mt-4 text-lg font-bold text-stone-900">页面加载失败</h1>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            本局状态可能没有保存。先刷新页面；如果刚更新过 APK，请关闭应用后重新打开。
          </p>
          <p className="mt-3 max-h-24 overflow-auto rounded-xl bg-stone-100 px-3 py-2 text-left font-mono text-[10px] leading-relaxed text-stone-500">
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary mt-5 h-11 w-full text-sm"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}

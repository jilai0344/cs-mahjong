import React, { useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y.js';
import { installAppUpdate } from '../utils/appUpdate.js';

/**
 * 启动时的 APK 更新提示。
 * Android 不允许静默覆盖安装：这里负责下载到应用缓存，再拉起系统安装器让用户确认。
 */
export default function UpdatePrompt({ update, onClose }) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const modalA11y = useModalA11y(onClose);

  if (!update) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setError('');
    try {
      await installAppUpdate(update.apkUrl);
      onClose?.();
    } catch (e) {
      setError(e?.message || '下载失败，请稍后重试');
      setInstalling(false);
    }
  };

  return (
    <div {...modalA11y} className="modal-backdrop animate-fade-in select-none">
      <div className="modal-card max-w-sm animate-modal-in">
        <div className="flex items-start gap-3 p-5 pb-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-jade-200)]/55 text-[var(--color-jade-600)]">
            <Download className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-stone-900">发现新版本</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-stone-400">
              {update.versionName} · 当前 build {update.currentBuild} → {update.remoteBuild}
            </p>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="稍后更新">
            <X className="h-4 w-4" />
          </button>
        </div>

        {update.notes && (
          <div className="mx-5 rounded-xl border border-stone-200 bg-stone-50 p-3 text-[10px] leading-relaxed text-stone-500">
            {update.notes.slice(0, 300)}
          </div>
        )}

        {error && (
          <p className="mx-5 mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] leading-relaxed text-rose-600">
            {error}。请在系统设置里允许本应用「安装未知应用」后重试。
          </p>
        )}

        <div className="modal-foot mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={installing}
            className="btn-secondary h-10 flex-1 text-[12px]"
          >
            稍后
          </button>
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="btn-primary h-10 flex-1 text-[12px]"
          >
            {installing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                下载中…
              </>
            ) : (
              '立即更新'
            )}
          </button>
        </div>
        <p className="px-5 pb-4 pt-2 text-center text-[9px] leading-relaxed text-stone-400">
          Android 会要求确认安装；更新后原战绩和设置保留。
        </p>
      </div>
    </div>
  );
}

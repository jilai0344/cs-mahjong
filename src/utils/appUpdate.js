import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

const REPO = 'jilai0344/cs-mahjong';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const APK_URL = `https://github.com/${REPO}/releases/latest/download/cs-mahjong.apk`;
const ApkUpdater = registerPlugin('ApkUpdater');

function normalizeBuild(value) {
  const n = Number.parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 原生 APK 启动时检查 GitHub latest release。
 * 只有远端 versionCode（tag 末尾数字）大于本机 build 才返回更新信息。
 * 网页版永远返回 null。
 */
export async function checkForAppUpdate() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const info = await App.getInfo();
    const currentBuild = normalizeBuild(info.build);
    const res = await fetch(`${RELEASE_API}?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return null;
    const release = await res.json();
    const match = String(release.tag_name || '').match(/android-(\d+)/);
    const remoteBuild = match ? Number(match[1]) : 0;
    if (!remoteBuild || remoteBuild <= currentBuild) return null;

    const asset = (release.assets || []).find((a) => a.name === 'cs-mahjong.apk');
    return {
      currentBuild,
      remoteBuild,
      versionName: release.name || `v${remoteBuild}`,
      notes: release.body || '',
      apkUrl: asset?.browser_download_url || APK_URL
    };
  } catch {
    return null;
  }
}

/** 下载 APK 并交给 Android 安装器；网页端仅作为 fallback 打开下载链接。 */
export async function installAppUpdate(apkUrl = APK_URL) {
  if (Capacitor.isNativePlatform()) {
    await ApkUpdater.downloadAndInstall({ url: apkUrl });
    return;
  }
  window.open(apkUrl, '_blank', 'noopener,noreferrer');
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

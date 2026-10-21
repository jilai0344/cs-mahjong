package com.jilai.csmahjong;

import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // 覆盖安装后 WebView 可能还缓存着旧 index，引用已被替换的 hash 资源会白屏。
        // 只在 versionCode 变化时清缓存并重载，避免每次启动都白一下。
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            long currentVersion = 0;
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                currentVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        ? info.getLongVersionCode()
                        : info.versionCode;
            } catch (Exception ignored) {
                // 包信息读取失败时不清理缓存，不影响正常启动
            }
            android.content.SharedPreferences prefs = getSharedPreferences("app_cache", MODE_PRIVATE);
            long cachedVersion = prefs.getLong("versionCode", 0);
            if (currentVersion > 0 && cachedVersion != currentVersion) {
                webView.clearCache(true);
                webView.clearHistory();
                prefs.edit().putLong("versionCode", currentVersion).apply();
                webView.postDelayed(webView::reload, 250);
            }
        }
    }
}

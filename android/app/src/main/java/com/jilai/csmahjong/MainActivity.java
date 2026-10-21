package com.jilai.csmahjong;

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
            android.content.SharedPreferences prefs = getSharedPreferences("app_cache", MODE_PRIVATE);
            int cachedVersion = prefs.getInt("versionCode", 0);
            if (cachedVersion != BuildConfig.VERSION_CODE) {
                webView.clearCache(true);
                webView.clearHistory();
                prefs.edit().putInt("versionCode", BuildConfig.VERSION_CODE).apply();
                webView.postDelayed(webView::reload, 250);
            }
        }
    }
}

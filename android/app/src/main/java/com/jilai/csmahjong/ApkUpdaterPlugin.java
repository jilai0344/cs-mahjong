package com.jilai.csmahjong;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 自用 APK 更新器：下载 GitHub Release 里的新 APK，再交给 Android 系统安装器。
 * Android 不允许静默覆盖安装，所以最后一步一定要用户在系统界面确认。
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("更新地址必须是 HTTPS");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settings = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName())
                );
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settings);
                call.reject("请允许本应用安装未知应用，然后再次点击更新");
            } catch (Exception e) {
                call.reject("请在系统设置中允许安装未知应用");
            }
            return;
        }

        executor.execute(() -> {
            File apk = null;
            try {
                File dir = new File(
                        getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                        ""
                );
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new Exception("无法创建下载目录");
                }
                apk = new File(dir, "cs-mahjong-update.apk");

                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "cs-mahjong-updater");
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    throw new Exception("下载失败（HTTP " + code + "）");
                }

                long total = 0;
                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        total += read;
                    }
                }
                if (total < 1024 * 1024) {
                    throw new Exception("下载文件不完整");
                }

                PackageInfo archive = getContext().getPackageManager()
                        .getPackageArchiveInfo(apk.getAbsolutePath(), 0);
                if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
                    throw new Exception("下载的安装包不属于本应用");
                }

                final File finalApk = apk;
                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(
                                getContext(),
                                getContext().getPackageName() + ".fileprovider",
                                finalApk
                        );
                        Intent install = new Intent(Intent.ACTION_VIEW);
                        install.setDataAndType(uri, "application/vnd.android.package-archive");
                        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(install);
                        JSObject result = new JSObject();
                        result.put("ok", true);
                        call.resolve(result);
                    } catch (Exception e) {
                        call.reject("无法打开系统安装器：" + e.getMessage());
                    }
                });
            } catch (Exception e) {
                if (apk != null && apk.exists()) apk.delete();
                call.reject(e.getMessage() == null ? "更新失败" : e.getMessage());
            }
        });
    }
}

# Android APK 与 GitHub Pages（自己玩）

> 这是**自用打包**说明，不是商店上架流程。APK 使用固定个人签名，方便覆盖安装；
> 不要用这套 keystore 去发布公开商店版本。

## 地址

- 网页预览（GitHub Pages）：<https://jilai0344.github.io/cs-mahjong/>（已部署成功）
- APK 构建：GitHub 仓库 → **Actions** → **Build Android APK** → 最近一次运行 → **Artifacts** →
  下载 `cs-mahjong-debug-apk.zip`，解压得到 `app-debug.apk`。
  当前一次构建：<https://github.com/jilai0344/cs-mahjong/actions/runs/39112886048>
- 当前 APK：约 11.6 MB；带自定义「一萬」桌面图标与青瓷启动页
- APK SHA-256：`319751827CF57A7AF43208AB1901F3BE75F09B117A73F23A82A630043F70F24C`
- 应用 ID：`com.jilai.csmahjong`
- 最低 Android：7.0（API 24）
- 目标 Android：API 36

## 安装

1. 手机允许「安装未知来源应用」。
2. 把 `app-debug.apk` 传到手机并安装。
3. 以后覆盖安装必须使用**同一个签名**；仓库里的 `android/keystore/personal.p12` 已固定，
   所以新 APK 可以直接覆盖旧版本。
4. 如果遇到签名冲突，先卸载旧版再安装（会清掉本机设置与战绩）。

## 本地构建（可选）

需要：

- JDK 21
- Android SDK（platform 36、build-tools 36.0.0）
- Node.js 22+

```bash
npm ci
npm run android:apk
# 输出：android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:apk` 会先构建 Web 资源、`npx cap sync android`，再执行 Gradle。
用 Android Studio 打开：

```bash
npm run android:open
```

## 签名说明

- `android/keystore/personal.p12`
  - alias：`cs-mahjong`
  - store/key password：见 `android/app/build.gradle`
  - 仅用于个人安装，仓库是公开的，**不要用于公开分发/商店**。
- 修改包名或换签名后，旧 APK 不能覆盖安装。

## GitHub Pages 自动部署

工作流：`.github/workflows/deploy.yml`

- 推送到 `app`、`main` 或 `master` 会自动跑测试、构建 `dist` 并部署。
- 当前代码放在 `app` 分支；GitHub Pages 环境已允许该分支部署。
- 页面是单页应用，Vite `base: './'`，资源使用相对路径，能在
  `https://jilai0344.github.io/cs-mahjong/` 下正常加载。
- 改完代码推 `app` 分支即可更新网页；手机浏览器刷新即可看到新版本。

## APK 自动构建

工作流：`.github/workflows/android-apk.yml`

- 推送到 `app`/`main`/`master`，或手动 `workflow_dispatch`。
- 自动安装 Android SDK 36、构建 Web、`cap sync`、Gradle `assembleDebug`。
- 产物保留 30 天；每次构建的 APK 签名一致。

## 已知限制

- 单机完全离线；联机仍依赖公共 MQTT `broker.emqx.io`，没有自建服务器。
- 字体仍引用 Google Fonts；国内设备可能回退到系统字体，后续可改成本地字体。
- 音频仍是 WAV，APK 体积会偏大；自用可接受。
- Debug APK 带调试标记，适合自用；如果要正式分发再改 release 签名与 targetSdk 策略。

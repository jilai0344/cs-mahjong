# iOS 版（iPhone / iPad）

这个项目是 **React + Capacitor**，同一套代码既出 Android APK，也出原生 iOS App。
下面三条路，按「省事程度」排：

| 路线 | 耗时 | 需要什么 | 手机上长什么样 | 有效期 |
|---|---|---|---|---|
| **A. 添加到主屏（PWA）** | 1 分钟 | 只要 iPhone | 桌面图标 + 全屏，但方向不锁死 | 永久 |
| **B. 侧载原生 App**（推荐） | 10 分钟 | Mac/PC + Apple ID | 真 App，强制横屏 | 7 天，续签免费 |
| **C. Xcode 自己编译** | 40 分钟 | Mac + Xcode（15 GB） | 同上，还能改代码调试 | 7 天，续签免费 |

> 免费 Apple ID 就够，**不需要 $99/年**。想要 1 年有效 + TestFlight 分发，才需要付费账号。

---

## 路线 A：现在就能玩（PWA）

线上已经跑着，**不用编译任何东西**：

1. iPhone 用 **Safari** 打开 <https://jilai0344.github.io/cs-mahjong/>
   （微信内置浏览器不行，必须跳 Safari）；
2. 点底部「分享」→ **「添加到主屏幕」**；
3. 桌面出现「长沙麻将」青瓷图标，点开是全屏独立运行。

**局限**（所以才要路线 B）：

- iOS 网页**不能锁定屏幕方向**，进游戏后自己把手机横过来（App 会弹「请横屏游玩」提示）；
- 锁屏/切后台容易被系统回收，联机可能掉线；
- 首次打开要联网拉一次资源。

---

## 路线 B：侧载原生 App（不用装 Xcode）

原理：GitHub 的 macOS 机器已经帮你把 `ios/` 工程编译好了（工作流
[`ios-build.yml`](../.github/workflows/ios-build.yml)），产出一个**未签名**的 ipa；
你再用自己的 Apple ID 在本地给它签名装进手机。

### 1. 拿到 ipa

打开 <https://github.com/jilai0344/cs-mahjong/actions/workflows/ios-build.yml>，
点最近一次绿色的 **Build iOS IPA** → 页面底部 **Artifacts** →
下载 `cs-mahjong-unsigned-ipa.zip`，解压得到 `cs-mahjong-unsigned.ipa`（约 6 MB）。

> Artifacts 保留 30 天。过期了就在该页面点 **Run workflow** 重新跑一次（约 5 分钟）。
> 没有绿色记录 = 代码编译不过，看日志。

### 2. 装 Sideloadly

<https://sideloadly.io/> 下载 macOS 版（Windows 也能用），拖进「应用程序」。
macOS 版要求 10.12+，**不需要 Xcode**。

### 3. 签名并安装

1. iPhone 用数据线连电脑，手机点 **「信任此电脑」**；
2. 打开 Sideloadly，顶部自动识别到你的 iPhone；
3. 把 `cs-mahjong-unsigned.ipa` 拖进 **IPA** 框；
4. **Apple ID** 填你的 Apple ID（只用于向苹果换签名证书，不上传）；
5. 点 **Start**，输入 Apple ID 密码 + 双重认证验证码；
6. 装完拔线，手机上首次打开会提示「不受信任的开发者」：
   **设置 → 通用 → VPN与设备管理 → 开发者App → 点你的 Apple ID → 信任**；
7. iOS 16 以上还要开 **设置 → 隐私与安全性 → 开发者模式 → 打开 → 重启手机**。

桌面就有「长沙麻将」了。打开是**强制横屏**、状态栏隐藏、刘海安全区适配过的原生 App。

### 4. 7 天到期怎么办

免费账号签的 App 7 天后失效（点开闪退）。两种续法：

- Sideloadly 勾选 **Automatic App Refreshing**，电脑开着 Wi-Fi 就会在到期前自动续签；
- 或者到期后重新走一遍第 3 步（用同一个 Apple ID + 同一个 bundle ID 覆盖安装，**战绩和设置不会丢**）。

另外免费账号有硬限制：最多同时 **3 个**侧载 App、**7 天 10 个** App ID。碰到提示就等几天或换个 Apple ID。

---

## 路线 C：用 Xcode 自己编译（改了代码要调试时用）

### 环境

- iPhone 需要 **iOS 15+**（Capacitor 8 的下限），Xcode **15+**；
- 只有 Command Line Tools 是**不能**编译 iOS App 的，`xcode-select -p` 输出里必须能看到 `Xcode.app`。

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### 准备工程

```bash
git clone https://github.com/jilai0344/cs-mahjong.git
cd cs-mahjong && git checkout app
npm ci
npm run ios:sync      # = npm run build + npx cap sync ios
npm run ios:open
```

> `ios/App/App/public/` 是 `cap sync` 现场生成的，**不跑就是一片白屏**。
> 每次改完 `src/` 都要重新 `npm run ios:sync`。

### 签名并运行

1. Xcode 左侧点蓝色工程图标 **App** → **TARGETS → App** → **Signing & Capabilities**；
2. 勾 **Automatically manage signing**，**Team** 选你的 Apple ID（没有就 `Add an Account…` 登录）；
3. **Bundle Identifier** 默认 `com.jilai.csmahjong`，若提示被占用就改成 `com.你的名字.csmahjong`；
4. 顶部设备选你的 iPhone → 点 **▶ Run**（⌘R）；
5. 首次运行同样要「信任开发者」并开「开发者模式」（见路线 B 第 6、7 步）。

### 命令行编译

```bash
npm run ios:build -- --sim                     # 只编模拟器，验证能否编过（不需要账号）
DEVELOPMENT_TEAM=你的TeamID npm run ios:build -- --ipa   # 出 ipa
```

Team ID 在 Xcode → Settings → Accounts，选中 Team 右侧那 10 位字符。

---

## 这次为了 iOS 改了什么

| 文件 | 改动 |
|---|---|
| `ios/` | 新增 Capacitor iOS 工程（Capacitor 8 用 Swift Package Manager，不需要 CocoaPods） |
| `ios/App/App/Info.plist` | 只保留横屏、中文 App 名、隐藏状态栏、`ITSAppUsesNonExemptEncryption=false` |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` | 换成青瓷底 + 「一萬」牌面的启动屏 |
| `ios/App/App/Assets.xcassets/` | App 图标与启动图，由 `scripts/make-ios-assets.py` 从 `assets/` 生成 |
| `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` | 共享 scheme，CI 的 `xcodebuild -scheme App` 才能用 |
| `capacitor.config.json` | 新增 `ios` 段：全屏、`contentInset: "never"`、背景色 |
| `src/utils/appUpdate.js` | **修 bug**：原来 iOS 上也会弹「发现新版本」并让用户下 APK，现在只在 Android 检查 |
| `scripts/build-ios.sh` | `--sim` / `--device` / `--ipa` 三种编译方式 |
| `.github/workflows/ios-build.yml` | macOS runner 编译并产出未签名 ipa（路线 B 用的就是它） |
| `package.json` | `ios:sync` / `ios:open` / `ios:build` / `ios:ipa` |

---

## 常见报错

| 现象 | 原因 / 解法 |
|---|---|
| Xcode 里白屏、只有启动图 | 没跑 `npm run ios:sync`；`ios/App/App/public/` 里要有 `index.html` |
| `No such module 'Capacitor'` | 没执行 `npm ci`；`Package.swift` 引用了 `node_modules/@capacitor/app` 的相对路径 |
| `Signing requires a development team` | Xcode 里没选 Team |
| `bundle identifier is not available` | 改成唯一 ID，或先卸载手机上的旧版本 |
| 装上点开就闪退 | 签名过期（免费账号 7 天）→ 重新签；或没信任开发者 |
| 模拟器能跑、真机不行 | 真机需要签名 + 开发者模式，模拟器都不需要 |
| Sideloadly 提示 `maximum App ID limit` | 免费账号 7 天只能建 10 个 App ID，等几天或换账号 |
| Sideloadly 读不到设备 | 换个 USB 口/线，确认手机上点了「信任」 |
| 联机连不上 | 联机走公共 MQTT `broker.emqx.io`（wss），不是局域网，公司网络/代理会拦 |

---

## 想上架 App Store？

需要：$99/年开发者账号、App Store 审核、**棋牌类在中国区还要版号/资质**、隐私政策。
另外 HJD 的牌面和音效仅适合自己/朋友私下玩，公开分发必须换成原创或已授权素材。

---

## 版权提醒

HJD 牌面与长沙话语音来自《3D 黄金岛》本地文件，仅用于本机/私人项目。
公开上架或大范围传播前请自行确认授权。

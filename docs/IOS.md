# iOS 版（iPhone / iPad）

这个项目本身是 **React + Capacitor**，同一套代码可以出 Android APK，也可以出原生 iOS App。
下面按「你现在有 Mac」这个前提写，从快到慢三条路：

| 路线 | 要多久 | 需要什么 | 手机上长什么样 |
|---|---|---|---|
| **A. 网页版 / 添加到主屏（PWA）** | 1 分钟 | 只有 iPhone | 桌面图标 + 全屏，但方向不锁死 |
| **B. 原生 App·自己编译**（推荐） | 30–60 分钟 | Mac + Xcode + 免费 Apple ID | 真 App，强制横屏，7 天要重签一次 |
| **C. 原生 App·用别人编好的包** | 10 分钟 | 只要有台电脑（Win/Mac 都行） | 同上，靠 Sideloadly 用自己的 Apple ID 签 |

---

## 路线 A：现在就能在 iPhone 上玩（PWA）

已经在线上跑着，**不需要编译任何东西**：

1. iPhone 用 **Safari** 打开 <https://jilai0344.github.io/cs-mahjong/>
   （微信内置浏览器不行，必须跳 Safari）；
2. 点底部「分享」按钮 → **「添加到主屏幕」**；
3. 桌面出现「长沙麻将」青瓷图标；
4. 从桌面打开，全屏独立运行，有 Service Worker 缓存，弱网也能开。

**它的局限**（这也是为什么还要做原生 App）：

- iOS 的网页 **不允许锁定屏幕方向**，进游戏后要自己把手机横过来（App 会显示「请横屏游玩」提示层）；
- 锁屏 / 切后台容易被系统杀掉，联机可能掉线；
- 首次进入要联网拉一次资源。

---

## 路线 B：编译成真正的 iOS App（推荐）

### 0. 先确认版本要求

- iPhone 需要 **iOS 15 或更高**（Capacitor 8 的下限）；
- Xcode 需要 **15 或更高**；
- 免费 Apple ID 就够用，**不需要 $99/年的开发者账号**（代价见文末「7 天限制」）。

### 1. 安装 Xcode

App Store 里搜 **Xcode** 安装（约 15 GB，装完第一次打开还要装组件，耐心等）。
装完后执行一次，让命令行也指向它：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

> 只有 Command Line Tools 是**不能**编译 iOS App 的，
> `xcode-select -p` 的输出里必须能看到 `Xcode.app`。

### 2. 准备好工程

```bash
git clone https://github.com/jilai0344/cs-mahjong.git
cd cs-mahjong
git checkout app
npm ci
npm run ios:sync        # = npm run build + npx cap sync ios
```

> `ios/App/App/public/` 是 `cap sync` 现场生成的，**没跑这一步 Xcode 里就是一片白屏**。
> 每次改了 `src/` 都要重新 `npm run ios:sync`。

### 3. 在 Xcode 里打开

```bash
npm run ios:open
```

或者直接双击 `ios/App/App.xcodeproj`。

### 4. 设置签名（关键一步）

1. 左侧点最上面的蓝色工程图标 **App**；
2. 中间选 **TARGETS → App**；
3. 打开 **Signing & Capabilities** 标签；
4. 勾上 **Automatically manage signing**；
5. **Team** 选择你的 Apple ID（没有就点 `Add an Account…` 登录，会生成一个 `Personal Team`）；
6. **Bundle Identifier** 默认是 `com.jilai.csmahjong`。如果报红说已被占用，改成
   `com.你的名字.csmahjong` 之类唯一的名字即可。

### 5. 连上 iPhone 跑起来

1. 数据线连上 iPhone，手机上点 **「信任此电脑」**；
2. Xcode 顶部设备栏选中你的 iPhone（不要选模拟器）；
3. 点 **▶ Run**（⌘R）；
4. 第一次装完，iPhone 会提示「不受信任的开发者」：
   **设置 → 通用 → VPN与设备管理 → 开发者App → 信任你的 Apple ID**；
5. iOS 16 以上还需要：**设置 → 隐私与安全性 → 开发者模式 → 打开 → 重启手机**。

装好后桌面就有「长沙麻将」，点开是**强制横屏**的原生 App，状态栏隐藏，
刘海和底部安全区都按 CSS `env(safe-area-inset-*)` 适配过。

### 6. 命令行编译（可选）

不想点 Xcode 的话：

```bash
npm run ios:build -- --sim        # 只编到模拟器，验证能不能编过（不需要账号）
npm run ios:build -- --device     # 编到真机，需要 DEVELOPMENT_TEAM
DEVELOPMENT_TEAM=你的TeamID npm run ios:ipa   # 出 ipa
```

Team ID 在 Xcode → Settings → Accounts 里，选中的 Team 右侧那 10 位字符就是。

### 7. 「7 天限制」是什么

用免费 Apple ID 签的 App，**签名 7 天后失效**，图标点开闪退。解决办法：

- 重新打开 Xcode，手机连上，再 ⌘R 跑一次（战绩和设置不会丢，因为 App 数据还在）；
- 或者买个 $99/年 的 Apple Developer Program，签名有效期 1 年，还能用 TestFlight 发给朋友；
- 或者干脆用路线 A 的 PWA，永不过期。

---

## 路线 C：没有 Mac 也能装（用 GitHub 编好的包）

仓库里加了工作流 `.github/workflows/ios-build.yml`：每次推代码，GitHub 的 macOS 机器会自动编译
`ios/` 工程，产出一个**未签名**的 ipa（Artifacts 里下载 `cs-mahjong-unsigned-ipa`）。

拿到 ipa 后用自己的 Apple ID 侧载：

1. 装 [Sideloadly](https://sideloadly.io/)（Windows / macOS 都有）；
2. iPhone 连电脑，Sideloadly 里选设备、拖入 ipa、填 Apple ID；
3. 点 Start，输入 Apple ID 密码（密码只本地用于换取签名，不会上传）；
4. 第一次安装同样要去 **设置 → 通用 → VPN与设备管理** 信任描述文件。

同样是 **7 天有效期**，到期重签一次即可（Sideloadly 一键重签）。

> 想长期免签、免电脑，只有两条路：App Store 上架（$99/年 + 审核 + 棋牌类资质），
> 或者 European Union 的第三方商店（仅欧盟区）。

---

## 这次为了 iOS 改了什么

| 文件 | 改动 |
|---|---|
| `ios/` | 新增 Capacitor iOS 工程（Capacitor 8 用 Swift Package Manager，不需要 CocoaPods） |
| `ios/App/App/Info.plist` | 只保留横屏、中文 App 名、隐藏状态栏、`ITSAppUsesNonExemptEncryption=false` |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` | 换成青瓷底 + 「一萬」牌面的启动屏 |
| `ios/App/App/Assets.xcassets/` | App 图标与启动图（由 `scripts/make-ios-assets.py` 从 `assets/` 生成） |
| `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` | 共享 scheme，CI 里的 `xcodebuild -scheme App` 才能用 |
| `capacitor.config.json` | 新增 `ios` 段：全屏、`contentInset: "never"`、背景色 |
| `src/utils/appUpdate.js` | **修 bug**：原来在 iOS 上也会弹「发现新版本」并让用户下 APK，现在只在 Android 检查 |
| `scripts/build-ios.sh` | 一条命令编译模拟器 / 真机 / 导出 ipa |
| `.github/workflows/ios-build.yml` | macOS runner 上编译并产出未签名 ipa |
| `package.json` | `ios:sync` / `ios:open` / `ios:build` / `ios:ipa` |

---

## 常见报错

**Xcode 里一片白屏 / 只有启动图**
没跑 `npm run ios:sync`，或者跑完没重新编译。`ios/App/App/public/` 里应该有 `index.html`。

**`No such module 'Capacitor'`**
没执行 `npm ci`。`Package.swift` 里引用的是 `node_modules/@capacitor/app` 的相对路径。

**`Signing for "App" requires a development team`**
第 4 步没选 Team。

**`The app's bundle identifier is not available` / 证书冲突**
改 Bundle Identifier 成唯一值（比如加自己名字），或者卸载手机上旧版本再装。

**装上了但点开闪退**
签名过期（免费账号 7 天）→ 重新 ⌘R；或设备没信任 → 设置里信任开发者。

**模拟器能跑，真机不行**
真机需要签名和「开发者模式」，模拟器两者都不需要。

**联机连不上**
联机走公共 MQTT `broker.emqx.io`（wss），不是局域网，公司网络/代理可能拦截。

---

## 版权提醒

HJD 牌面和音效仅适合自己/朋友私下玩。要公开上架 App Store 或大范围传播，
必须替换成原创或已授权素材。

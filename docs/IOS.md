# iOS 版（PWA，无需 App Store）

> iOS 目前用 **PWA + 添加到主屏幕** 的方式发布。它不经过 App Store，不需要 Apple 开发者账号，朋友用 Safari 打开链接即可安装到桌面。

## 给朋友安装

1. 用 **Safari** 打开 <https://jilai0344.github.io/cs-mahjong/>（微信内置浏览器不能添加到主屏，必须跳 Safari）；
2. 点底部分享按钮；
3. 选「添加到主屏幕」；
4. 桌面会出现「长沙麻将」图标；
5. 从主屏打开，进入独立全屏模式。

## 已适配

- 独立全屏启动，带 `apple-touch-icon`；
- 主屏名义方向为横屏；如果 iPhone 不遵守，应用会显示「请横屏游玩」遮罩；
- 刘海/底部安全区适配；
- 首次打开后 Service Worker 缓存应用外壳，之后冷启动更快，弱网也能打开入口；
- 和 APK、网页版共用同一套房间和 MQTT 联机，可跨平台同桌；
- 网页更新后自动拉新版本，不需要重新安装。

## iOS 上的限制

- Safari/PWA **不能强制锁定屏幕方向**；只能提示用户横屏。想要真正强制横屏必须做原生 iOS 包。
- iOS 不允许网页后台常驻，锁屏/切后台可能断线；回来后可尝试重连。
- 没有 App Store 榜单、推送、内购；朋友之间发链接即可。
- 音效需要先点一次「开始对局」才会播放，这是 iOS 的自动播放限制。

## 如果要真正的 iOS App（IPA / TestFlight / App Store）

这需要：

1. macOS + Xcode；
2. Apple Developer Program（$99/年）；
3. Bundle ID、证书、Provisioning Profile；
4. App Store 审核（棋牌类还涉及资质、版权素材、隐私政策）。

当前项目是 React + Capacitor，可以生成 iOS 工程，但在 Windows 上**不能编译和签名 IPA**。如果以后有 Mac 和开发者账号，可以再把现有 Capacitor 工程扩成原生 iOS 包。

## 版权提醒

HJD 牌面和音效仅适合自己/朋友私下玩。要公开上架 App Store 或大范围传播，必须替换成原创或已授权素材。

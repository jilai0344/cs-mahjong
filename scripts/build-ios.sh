#!/usr/bin/env bash
# 长沙麻将 iOS 构建脚本
#
# 前置：macOS + 完整 Xcode（不是 Command Line Tools）。没装 Xcode 会直接报错。
#
# 用法：
#   bash scripts/build-ios.sh --sim      只编译到模拟器（不需要账号，最快验证能不能编译）
#   bash scripts/build-ios.sh --device   编译到真机（需要 Xcode 里登录过 Apple ID）
#   bash scripts/build-ios.sh --ipa      归档 + 导出可安装的 IPA（需要 DEVELOPMENT_TEAM）
#
# 环境变量：
#   DEVELOPMENT_TEAM  Apple 开发者 Team ID（10 位，Xcode → Settings → Accounts 里能看到）
#   EXPORT_METHOD     导出方式：development（默认）/ ad-hoc / app-store
#
# 例：
#   DEVELOPMENT_TEAM=ABCDE12345 npm run ios:ipa
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT="ios/App/App.xcodeproj"
SCHEME="App"
BUILD_DIR="$ROOT/build/ios"
DERIVED="$BUILD_DIR/DerivedData"

MODE="--sim"
for arg in "$@"; do
  case "$arg" in
    --sim|--device|--ipa) MODE="$arg" ;;
    -h|--help)
      sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "未知参数：$arg（可用：--sim / --device / --ipa）" >&2
      exit 2
      ;;
  esac
done

info() { printf '\033[36m[ios]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[ios] %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- 1. 环境检查 ----------
if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "iOS 只能在 macOS 上编译。"
fi

DEV_DIR="$(xcode-select -p 2>/dev/null || true)"
if [[ "$DEV_DIR" != *"Xcode.app"* ]]; then
  cat >&2 <<'EOF'
[ios] 没有找到完整的 Xcode（当前只有 Command Line Tools）。

请先安装 Xcode：
  1. 打开 App Store，搜索 "Xcode"，安装（约 15 GB）；
  2. 装完后执行一次：
       sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
       sudo xcodebuild -license accept
  3. 重新运行本脚本。

如果暂时不装 Xcode：用 PWA 方式在 iPhone 上玩，见 docs/IOS.md。
EOF
  exit 1
fi

info "Xcode: $(xcodebuild -version | head -1)"

if [[ ! -d node_modules ]]; then
  info "安装依赖 npm ci ..."
  npm ci
fi

# ---------- 2. 同步 Web 资源 ----------
info "构建 Web 资源并同步到 iOS 工程 ..."
npm run build
npx cap sync ios

[[ -f "ios/App/App/public/index.html" ]] || fail "ios/App/App/public 为空，cap sync 失败。"

mkdir -p "$BUILD_DIR"

# ---------- 3. 按模式编译 ----------
case "$MODE" in
  --sim)
    info "编译到 iOS 模拟器（不签名，只验证能编过）..."
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug \
      -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$DERIVED" \
      CODE_SIGNING_ALLOWED=NO \
      build
    APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
    info "完成：$APP_PATH"
    info "用模拟器跑：xcrun simctl install booted \"$APP_PATH\" && xcrun simctl launch booted com.jilai.csmahjong"
    ;;

  --device)
    TEAM="${DEVELOPMENT_TEAM:-}"
    if [[ -z "$TEAM" ]]; then
      cat >&2 <<'EOF'
[ios] 真机编译需要一个 Team ID（免费 Apple ID 也行）。

  1. Xcode → Settings → Accounts → 用 Apple ID 登录；
  2. 选中左侧 Personal Team，右侧 Team ID 就是那 10 位字符；
  3. DEVELOPMENT_TEAM=你的TeamID bash scripts/build-ios.sh --device

或者更简单：直接 `npm run ios:open`，在 Xcode 里点 Run。
EOF
      exit 1
    fi
    info "编译到真机（Team: $TEAM）..."
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Debug \
      -sdk iphoneos -destination 'generic/platform=iOS' \
      -derivedDataPath "$DERIVED" \
      DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic \
      -allowProvisioningUpdates \
      build
    APP_PATH="$DERIVED/Build/Products/Debug-iphoneos/App.app"
    info "完成：$APP_PATH"
    info "装到手机：Xcode → Window → Devices and Simulators，把 App.app 拖到设备上。"
    ;;

  --ipa)
    TEAM="${DEVELOPMENT_TEAM:-}"
    [[ -n "$TEAM" ]] || fail "--ipa 需要 DEVELOPMENT_TEAM=<10位TeamID>。"
    METHOD="${EXPORT_METHOD:-development}"

    ARCHIVE="$BUILD_DIR/cs-mahjong.xcarchive"
    EXPORT_DIR="$BUILD_DIR/export"
    rm -rf "$ARCHIVE" "$EXPORT_DIR"

    info "归档 Release（Team: $TEAM）..."
    xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
      -sdk iphoneos -destination 'generic/platform=iOS' \
      -archivePath "$ARCHIVE" \
      DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic \
      -allowProvisioningUpdates \
      archive

    cat > "$BUILD_DIR/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>$METHOD</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>compileBitcode</key><false/>
  <key>stripSwiftSymbols</key><true/>
  <key>thinning</key><string>&lt;none&gt;</string>
</dict>
</plist>
EOF

    info "导出 IPA（method: $METHOD）..."
    xcodebuild -exportArchive -archivePath "$ARCHIVE" \
      -exportPath "$EXPORT_DIR" \
      -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" \
      -allowProvisioningUpdates

    IPA="$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)"
    [[ -n "$IPA" ]] || fail "导出失败，没有生成 .ipa。"
    info "完成：$IPA"
    info "安装：Xcode → Window → Devices and Simulators → 选中 iPhone → + 选择这个 ipa。"
    ;;
esac

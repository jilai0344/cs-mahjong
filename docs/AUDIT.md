# 长沙麻将 · 项目审计报告（AUDIT.md）

> 第 0 阶段（只读审计）产物。**初次审计基线 commit：`2facaeb`（main）**；§11 已在合并计分 PR 之后把复核基线推进到 `caec53c`（复核结论、命令原始输出与重拍截图见 §11）。
> 仓库 https://github.com/jilai0344/cs-mahjong
> 审计方式：通读源码 + 实际运行（install/test/lint/build/dev）+ 浏览器实测（375px 竖屏 / 812×375 横屏 / 1440px 桌面）+ 规则引擎探针脚本 + 联机信道第三方测试。
> 所有结论都标注了**代码位置**或**实测证据**；未验证的一律写「未能确认」。
> 缩写：`APP:`=`src/App.jsx`，`ML:`=`src/utils/mahjongLogic.js`，`T:`=`src/types/mahjong.js`，`AI:`=`src/utils/aiPlayer.js`，`MP:`=`src/utils/multiplayer.js`，`AUD:`=`src/utils/audio.js`。

---

## 0. 结论摘要（风险清单）

| 编号 | 风险 | 等级 | 证据 |
|---|---|---|---|
| R1 | **没有服务端**：房主浏览器即权威，洗牌/发牌/判胡/算分全在客户端；洗牌用 `Math.random()` | **P0** | `MP:23-490`、`T:84-87`、`APP:451-539/1318-1377` |
| R2 | **信道无鉴权**：任意第三方可订阅/伪造广播、房主信箱、**座位私密频道**（实测已复现） | **P0** | `MP:5-11,56-58,414-438` + §8.9 实证 |
| R3 | **身份可伪造**：`fromSeatId` 由客户端自填，服务端（房主）直接采信 | **P0** | `MP:430-438`、`APP:204-210` |
| R4 | **信息泄露**：座位私密频道 `b`/`host`/`seat/N` 全部可被第三方读取；房主广播的面子/弃牌含真实牌对象 | **P0** | §8.9 实证、`MP:413-427` |
| R5 | **含杠手牌永远无法胡牌**（`checkHu` 硬校验 14 张）→ 杠上开花/杠上炮不可达 | **P0** | `ML:400-402`；探针实测 case1/case1b 均 `canHu:false` |
| R6 | **响应窗口无超时**：本地玩家出现吃/碰/杠/胡提示后不操作，整局永久卡死 | **P0** | `APP:758-786`（提前 return）、`APP:599-678`（计时器只管自己回合出牌） |
| R7 | **跨玩家优先级错误**：不是「胡 > 碰杠 > 吃」，而是「本地座位优先 + 座位号顺序」 | **P0** | `APP:758-821` |
| R8 | **一炮多响未实现**：多家同时胡只赔顺位最近一家（与 README 矛盾） | **P0** | `APP:1193-1201` |
| R9 | **掉线托管后游戏不认**：座位被转为 AI，但 `App` 的 `multiplayerRef` 不更新 → 服务端（房主）永远等一个不会动的真人 | **P0** | `MP:171-182,395-411`；`APP` 全程未订阅 `setOnLobbyChange`（仅 `MultiplayerModal.jsx:36` 内部订阅） |
| R10 | **房主无权威超时**：房主不为访客计时，访客卡住 → 全房卡死；无 `seq` 序号、无幂等、无乱序丢弃 | **P0** | `APP:599-615`、`MP:410-438` |
| R11 | **断线不能恢复对局**：无快照/重连协议，访客刷新后拿不到自己的手牌；房主刷新房间直接解散（LWT） | **P0** | `MP:139-145`、`APP:213-249` |
| R12 | 抢杠胡 / 海底捞月 / 海底炮为**死代码**（参数无调用点） | P1 | `ML:526-533`；全仓库无 `isRobbingKong|isLastTile` 传参 |
| R13 | 联机规则不广播、不锁定、访客看不到本局规则 | P1 | `APP:456-458,481-492`（只发 `GAME_STARTED{seats}` + `DEAL_HAND`） |
| R14 | 扎鸟取牌位置错误（取牌墙头部且不移除）且只结算「中赢家」 | P1 | `ML:641-670`、`APP:1323,1331` |
| R15 | 计分逻辑双份实现（`checkHu.score` 与 `handleRoundWin` 各自算） | P2 | `ML:548-554` vs `APP:1325-1329` |
| R16 | 视觉身份分裂：README 说「翡翠牌桌/象牙骨牌/现代清澈」，实际牌桌是**红色丝绒 + 描金「黄金岛」**，操作栏却是翡翠绿；残留占位符 `39482 / djdodkj / V8` | P2 | `mahjong.css:16-49`、`APP:1560-1644,1783-1800` |
| R17 | 单包 698 KB（gzip 207 KB）触发 Vite 500 KB 告警；`peerjs` 是**未被引用的依赖** | P2 | 构建输出、`grep peerjs src/` 无结果 |
| R18 | 测试仅 32 条、只覆盖规则层；无联机/AI/算分/随机对局测试；无测试框架 | P1 | `test/mahjongLogic.test.js:345-348` |
| R19 | 375px 竖屏直接弹出「请横置手机」遮挡层（可手动跳过），手机竖屏不可玩 | P2 | 浏览器实测（截图 portrait-375x812） |
| R20 | `index.html` 依赖 Google Fonts（Noto Serif SC）→ 非离线可用，国内网络下字体常缺失 | P2 | `index.html:13-15` |
| R21 | **死代码/死文件**：`App.css`(185 行) 是 Vite 模板残留且全仓库无导入；`mahjong.css:52-76` 的 `.mahjong-tile/.tile-face/.mahjong-tile-back` 三个类**零引用** | P2 | `main.jsx:3` 仅引 `index.css`；子代理逐文件核对 + 本人复核 |
| R22 | **无障碍为零**：全部组件 `aria-*/role=/tabIndex/onKeyDown` 命中 **0** 次 → 弹窗不能 Esc 关闭、无焦点陷阱、无键盘操作 | P2 | 子代理全量 grep |
| R23 | `PlayerHand` 的 `selectedTileId` 在回合/手牌变化时不重置 → 跨回合残留选中态（可能在非自己回合误触发） | P2 | `PlayerHand.jsx:15` |
| R24 | `MultiplayerModal` 房间号输入 `maxLength=6` 而文案写「4 位」，两者矛盾；且直读单例 `network.roomCode/seats`（非响应式） | P2 | `MultiplayerModal.jsx:244,79,284,303` |
| R25 | `StartingHuModal` 把「+N×2×3 分 / 每家付 N×2 分」**硬编码**，假定固定 4 人 | P2 | `StartingHuModal.jsx:50-51` |

---

## 1. 模块划分（源码 6 499 行）

| 模块 | 文件 | 行数 | 职责 | 备注 |
|---|---|---|---|---|
| 类型/常量/牌组 | `src/types/mahjong.js` | 105 | 花色常量、`DEFAULT_CONFIG`、`generateDeck()`、`compareTiles`、`getTileKey` | 洗牌（非安全随机）在这里 |
| 规则引擎 | `src/utils/mahjongLogic.js` | 703 | `countTiles` / `checkStartingHu`(10 种) / `getChiOptions` / `canPeng` / `getKongOptions` / `canDecomposeToMelds` / `checkHu`(平胡+8 种大胡) / `analyzeTingCards` / `drawBirds` / `checkMidGameSiXi` | 纯函数、无副作用，可单测——**是重构联机权威层的最佳复用点** |
| AI | `src/utils/aiPlayer.js` | 185 | `chooseAiDiscard`（听牌优先 + 孤立度打分）、`decideAiResponse`、`decideAiTurnAction` | 难度无分级；`decideAiTurnAction` 调 `chooseAiDiscard(..., [])`，**不传已明牌信息**，剩余张数恒按 4 算 |
| 联机 | `src/utils/multiplayer.js` | 490 | `NetworkManager`（MQTT over WSS）、房间码、座位分配、心跳、LWT、托管回退 | 见 §8 |
| 音效 | `src/utils/audio.js` | 187 | Web Audio 合成音（骰子/出牌/碰杠/胡） | 全离线合成，符合 README |
| 状态与流程 | `src/App.jsx` | 1 894 | 全部游戏状态机、吃碰杠胡流程、计分、起手胡、联机事件分发、页面布局 | **上帝组件**，见 §2/§3 |
| 组件 | `src/components/*.jsx` | 13 个文件 1 680 行 | 牌面/手牌/对手/牌墙/弃牌池/操作栏/5 个弹窗 | 全部为纯展示 + 回调 |
| 样式 | `src/index.css`(16) `src/mahjong.css`(133) `src/App.css`(?) | — | Tailwind v4 入口 + 自写牌桌/牌面/3 个 keyframes | 无设计变量（0 个 CSS 自定义属性） |
| 测试 | `test/mahjongLogic.test.js` | 348 | 32 条断言，自研 `assert`（失败 `process.exit(1)`） | 仅规则层 |
| CI | `.github/workflows/deploy.yml` | 52 | push → `npm ci` → `npm test` → `npm run build` → GitHub Pages | 无 lint 步骤、无 node 引擎声明（用 node 20） |

**状态管理方式**：单体 React 状态。`App.jsx` 里 30+ 个 `useState`（牌局展示态）+ 1 个 `stateRef`（人称「单一权威状态引用」，`APP:137-147`）双写：每次逻辑变更既要改 `stateRef.current.*` 再 `setXxx([...])`，两套真相靠人工保持一致。跨组件通信全部靠 props 下沉 + 回调上抛，没有 context/reducer/状态库。

**判定权威所在的层**：单机模式下 `stateRef`（`App.jsx`）即权威；联机模式下**房主浏览器**的 `stateRef` 即权威，访客只发意图、收广播。

---

## 2. 组件结构

```
App.jsx（状态机 + 布局 + 联机事件分发）
├─ header（顶栏：品牌、规则摘要、房间状态、音效/规则/设置按钮）
├─ main.mahjong-table
│  ├─ OpponentHand ×3（top/left/right：对手手牌张数、副露、气泡、分数、庄）
│  ├─ TileWall ×4（纯装饰，count 固定 12/10，不反映真实余牌）
│  ├─ PlayerDiscardTray ×4（四家弃牌，含最新出牌光环 + 悬停高亮）
│  ├─ TableCenter（罗盘、东南西北、倒计时、牌墙余数、骰子）
│  ├─ 左下角玩家信息胶囊（庄/♥/39482/djdodkj/V8 —— 占位符残留）
│  ├─ ActionControls（胡/四喜/杠/碰/吃/过 + 吃与杠的多选弹窗）
│  └─ PlayerHand（副露 + 立牌 + 摸牌位 + 听牌气泡 + 「点两次出牌」提示）
└─ 弹窗：MultiplayerModal / SettingsModal / RulesGuideModal / StartingHuModal / KongDrawModal / RoundResultModal
```

要点（与「体验/画面」直接相关）：
- **手牌出牌是「点两次」交互**（`PlayerHand.jsx:22-29`），选牌后才有听牌气泡；移动端没有长按/滑动等替代手势，误触风险高（无二次确认）。
- `TileWall` 是**纯装饰**，与实际牌墙余数无关（`TileWall.jsx` 固定 count），会误导玩家对剩余牌量的判断。
- 听牌气泡只在**选中牌**时出现（`PlayerHand.jsx:48-59`），且 `tingMap` 计算依赖 `currentTurn === mySeatId`，没有常驻听牌提示。
- 结算弹窗（`RoundResultModal`）展示番型、鸟牌、每家分数变化；起手胡弹窗展示每把 +6 分。
- 顶栏显示规则摘要（开杠摸 N 只 / 需将 / 抓 N 鸟），**联机时不显示房主设置的规则差异**（各端各显本地 config）。

---

## 3. 视觉与样式实现现状（「画面不美观」的取证）

- **样式实现方式**：Tailwind v4 工具类（组件内联，约 90% 的视觉）+ 自写 CSS（`mahjong.css` 133 行：牌桌径向渐变、牌面质感、3 个 keyframes、滚动条）。**没有设计变量层**（无 `--color-*`），颜色/间距/字号全部硬编码散落在 JSX 与 CSS 中。
- **主题分裂（关键）**：`mahjong.css:16-49` 的牌桌是**深红丝绒 + 金色**（`#a01c22 → #560a0d`，`rgba(245,158,11,…)` 金光），顶栏「黄金岛 · 长沙麻将 / 经典正版复刻」也是红金古典；而操作栏、设置弹窗、碰/吃按钮用的是 `emerald/teal/sky` 翡翠色系（`ActionControls.jsx:90-161`）。**README 声明的「纯澈翡翠牌桌 + 象牙骨牌 + 现代清澈」只兑现了一半**，两种身份混在一屏。
- **牌面**：`MahjongTile.jsx`（589 行）用 SVG 绘制（万/条/筒三套字形），牌墙也用 SVG；牌面数据来自 `tile.value/suit`，尺寸通过 `size` 属性（hand/meld/sm/md）切换。字体：`index.html` 引入 Noto Serif SC（Google Fonts），CSS 里再声明系统字体兜底 —— **网络受限时字形与设计稿不一致**。
- **动效**：仅 3 个 keyframes（fadeIn / fadeInUp / scaleUp）+ Tailwind 自带 `animate-pulse/bounce`；出牌、摸牌、碰杠没有位移/缩放动画编排，`mahjong.css:60-62` 的 hover 抬升只有鼠标端有效（触屏无效）。
- **响应式**：断点使用 `sm(64 次)/md(10)/lg(12)/xl(6)/2xl(2)`，牌桌用绝对定位 + `%` 布局；实测三种尺寸均无横向溢出（`scrollWidth === clientWidth`），但 **375px 竖屏被「请横置手机」整屏遮挡**（`APP:1532-1558`，提供「已横屏，开始游戏」跳过按钮）。
- **可辨识性**：实测 375px 宽时手牌尺寸约 52×72 px（`sm` 断点下 13 张 + 摸牌位接近满宽），俯视牌墙装饰与中央罗盘在窄屏上互相挤压；顶栏右侧三个圆形图标按钮实测 25×32 px（**低于 44×44 的触控推荐值**），「多人对战」按钮 79×46。
- **字体三处不统一**：`MahjongTile.jsx:9` 硬编码楷体 `STKaiti`、`index.html:12` 引 Noto Serif SC、`index.css:5` 又声明系统字体栈 —— 三套字体来源，实际字形取决于用户系统与网络。
- **断点清单（实测）**：`sm` 64 次、`md` 10、`lg` 12、`xl` 6、`2xl` 2，另有 Tailwind 的 `landscape:` 变体 4 处；`mahjong.css` **没有任何 `@media`**（响应式全靠工具类）。
- **可维护性**：`.mahjong-table` 是唯一生效的自写样式块；`.mahjong-tile` 系列与 `App.css` 均为死代码（见 R21）；颜色全部硬编码十六进制，无设计变量层。
- **无障碍**：全组件 0 处 `aria-*`/`role`/`tabIndex`/`onKeyDown`；5 个弹窗都无法关闭（Esc/点遮罩），也没有焦点管理（R22）。

---

## 4. 性能与体积

| 指标 | 实测 |
|---|---|
| 构建产物 | `dist/index.html` 1.35 KB、CSS 79.88 KB(gzip 11.79)、JS 698.37 KB(gzip 207.49) |
| 告警 | Vite 提示 chunk > 500 KB，建议代码分割 |
| 依赖 | `mqtt@5` + `peerjs@1.5`（**peerjs 未被任何源码 import，属死依赖**）+ `lucide-react`（全量图标库）+ `canvas-confetti` + `tailwindcss@4` |
| 模块数 | 1 916 modules transformed，构建 528ms |
| 规则引擎耗时 | `analyzeTingCards`（14 张手牌全试打 × 27 种牌 × `checkHu`）实测 **1.2 ms/次**（本机），可接受；但 `tingMap` 是 `useMemo` 且依赖手牌/弃牌/配置，每次出牌都会重算，AI 每回合也会调用 |
| 定时器 | 每秒 1 次 `setTurnTimer`，即使非本人回合也在跑（会触发无关重渲染） |

---

## 5. README 与代码一致性核对（汇总，逐条细节见 RULES.md）

| README 声明 | 实际 | 判定 |
|---|---|---|
| 开杠摸 2/4 只、补牌从牌墙末尾、可杠上开花 | 张数与末尾取牌 ✓；**杠上开花因含杠手牌无法成胡而不可达** | ✗ |
| 未成胡的补牌打入牌池、支持杠上炮、**一炮多响** | 打入牌池 ✓、杠上炮判定在 ✓；**只赔顺位最近一家** | ✗ |
| 开杠需将（无 258 则拦截） | ✓ | ✓ |
| 起手胡 4 种（大四喜/板板胡/缺一色/六六顺） | **实现了 10 种**（+一个五、三个五/三个八、三连对、三同、二筒二条、中途四喜），README 未提 | ✗（文档滞后） |
| 扎鸟 0/2/4 只、1/5/9 赢家 2/6 下家 3/7 对家 4/8 上家 | 顺位算法 ✓；**取鸟位置为牌墙头部且不移除**；只结算「中赢家」 | ⚠ |
| 平胡二五八将 | ✓ | ✓ |
| 大胡：清一色 6 番 / 将将胡 6 番 / 碰碰胡 6 番 / 全求人 6 番 / 杠上开花 / 杠上炮 / **海底捞月 / 海底炮** | 前四项 ✓；杠上开花不可达；**海底系列为死代码** | ✗ |
| 「执行 15 项核心算法测试」 | 实际 **32 条**断言 | ✗ |
| 「全离线 Web Audio 音效，零网络依赖」 | 音效 ✓ 全离线合成；但**页面字体依赖 Google Fonts** | ⚠ |
| 「智能听牌分析气泡 / 悬停关联高亮 / 最新出牌光环 / 超时自动托管」 | 全部存在 ✓；但「超时托管只覆盖自己回合出牌，不覆盖响应窗口」 | ⚠ |
| 「现代清澈 · 翡翠牌桌 · 象牙骨牌」 | 牌桌是红色丝绒描金「黄金岛」，操作栏是翡翠绿 | ✗ |
| 联机能力（题面说「已具备联机能力」） | 有 MQTT 点对点实现，但**无服务端权威、无鉴权、无重连恢复** | ✗（P0） |
| 部署（CI 部署到 GitHub Pages） | 工作流 ✓ 且 base:'./' 兼容子路径 | ✓ |

---

## 6. 运行记录（实际执行，非推断）

### 6.1 环境与命令

```
node v26.7.0 / npm 11.19.0 / git 2.54.0（macOS 26.6.2，Apple Silicon）
```

| 步骤 | 结果 |
|---|---|
| `npm install` | ✅ `added 94 packages, audited 95, found 0 vulnerabilities`（11s）。⚠️ 警告：`fsevents@2.3.3` 安装脚本未在 npm 的 allowScripts 白名单内（npm 11 新策略），不影响构建 |
| `npm test` | ✅ 32 通过 / 0 失败，`process.exit(1)` 保护存在（`test/mahjongLogic.test.js:345-348`）→ CI 能正确失败 |
| `npx oxlint` | ✅ 退出码 0，但 **35 条 warning**（实测规则分布：`eslint(no-unused-vars)` 24、`react(immutability)` 5、`react-hooks(exhaustive-deps)` 3、`react(set-state-in-effect)` 2、`react(refs)` 1）：未使用变量含 `App.jsx` 的 import `isJiangTile/MahjongTile/DiscardPool/Sparkles/RotateCcw/Wifi/Globe`；「Cannot access variable while it is being initialized」5 条（`App.jsx:205/207/209/537/606`，闭包自引用，属真实风险）；`react(refs)` 1 条（`App.jsx:79` 渲染期读 ref）；`exhaustive-deps` 3 条（`App.jsx:207/537/606` 缺依赖） |
| `npm run build` | ✅ 528ms，产物见 §4；1 条 chunk >500 KB 告警 |
| `npm run dev` | ✅ `http://127.0.0.1:5199/` 正常启动，页面 200、无 Vite 错误遮罩、无 `window.onerror` 记录 |
| 截图 | `docs/screenshots/portrait-375x812.png`、`docs/screenshots/landscape-812x375.png`、`docs/screenshots/desktop-1440x900.png`（三种尺寸均无横向/纵向溢出） |

### 6.2 规则引擎探针实测（脚本 `probes/probe1.mjs`）

```
case1  手牌11 + 暗杠(4张)=15张，自摸成胡 → {"canHu":false}      ← 应为 true（P0/R5）
case1b 手牌10 + 暗杠 + 点炮胡      → {"canHu":false}            ← 应为 true
case2  同副牌型 14 张无杠          → {"canHu":true,"平胡"}      ← 对照组，证明只是「杠」触发失败
case3  碰碰胡（含 4 张同牌在手）   → {"canHu":false}            ← 4 张同牌算术问题
case4  七小对                       → {"canHu":false}            ← 未实现（待你裁定 Q10）
case5  将将胡                       → {"canHu":true,"将将胡 · 碰碰胡",score:12}  ← 可叠加
case6  清一色                       → {"canHu":true,"清一色",score:6}
case7  drawBirds(墙前2张,2,0)       → 取的是牌墙头部（见 §8 / R14）
perf   analyzeTingCards ×20         → 24.1 ms（1.2 ms/次）
```

### 6.3 浏览器实测（对局流程）

- 点击「开始对局」→ 掷骰 → 发牌 → 正常进入行牌；牌墙 55 张起步；`window.onerror` 全程无异常。
- 未操作时本地倒计时到点会**自动打出最后一张牌**（托管有效，与 `APP:667-678` 一致）；AI 三家按 700ms 节奏行动，一局可以自己不操作跑下去。
- 实测发现：**页面在后台标签页时定时器被浏览器节流**（时钟 8 → 7 需要 1 分钟以上），因此「看着像卡死」不等于卡死 —— 本报告 R6 的结论来自代码路径（响应窗口不在计时器管辖范围内），**标记为待用 E2E/单测复现确认**，不作「已实测」表述。
- 375px 竖屏：整屏被「请横置手机」遮挡（含「已横屏，开始游戏」跳过按钮）；812×375 横屏与 1440×900 桌面可正常游玩。
- 结局面板、起手胡面板、设置面板（10 项起手胡开关、开杠 2/4 只、需将、扎鸟 0/2/4、音效、听牌提示）均正常渲染。

---

## 7. 测试与 CI 现状

- 测试是**自研断言脚本**（`assert(condition, message)` 计数 + `process.exit(1)`），`npm test` = `node test/mahjongLogic.test.js`。
- 覆盖：起手胡 10 类（23 条）、开杠需将（3 条）、胡牌判定（4 条）、扎鸟（2 条）。**未覆盖**：吃碰杠流程、杠上开花/杠上炮、海底、抢杠、算分与分数守恒、听牌分析、AI 决策、`countTiles`、联机协议、随机对局守恒、组件渲染、非法输入。另：`canPeng`/`getChiOptions` 被 `import` 但**未使用**（`test/mahjongLogic.test.js:7-8`）。
- **为什么 P0 没被现有测试拦住**：没有任何「含杠面子的手牌能否胡」的用例（现状 `checkHu` 的 14 张硬校验把含杠手牌全判死），因此这条 P0 在 CI 里是绿的。
- CI：`npm ci → npm test → npm run build → 部署 Pages`；**没有 lint 步骤**（所以 35 条 warning 可以长期存在）；没有 `engines` 字段；`npm ci` 依赖 `package-lock.json`（已提交 ✓）。
- 仓库卫生：`.gitignore` 覆盖 `node_modules/dist/logs`，但**没有 `.env*` 规则**（P2-4 要补）；源码内未发现密钥（密钥仅存在于本地 Hermes 配置，不在仓库）。

---

## 8. 联机专项审计

### 8.1 架构
- **服务端：无**。通信是 **MQTT over WSS 点对点**（`mqtt@5`），Broker 为公共集群 `wss://broker.emqx.io:8084/mqtt`（备选 `wss://broker.hivemq.com:8884/mqtt`，`MP:8-11`），带 4.5s 超时的自动故障转移（`MP:71-122`）。
- **拓扑**：房主（座位 0）扮演「权威」；访客 = 1/2/3。Topic 约定（`MP:56-58`）：
  - `csmj/v1/<ROOM>/host`：**所有访客向房主发指令**（出牌/响应/心跳/加入请求）
  - `csmj/v1/<ROOM>/b`：房主广播（大厅状态、开局、出牌、面子、轮次、结算、房主 LWT）
  - `csmj/v1/<ROOM>/seat/<N>`：房主向某座位下发私密消息（`DEAL_HAND` 本人手牌、`TURN_UPDATE` 摸到的牌、`PROMPT_ACTION`）
  - `csmj/v1/<ROOM>/guest/<tempId>`：加入握手回复
- **房间与会话**：4 位房间码（32 字符表，`MP:14-21`）；`clientId` 随机、`clean:true`（无持久会话）；访客以 `guestTempId` 申请座位，房主分配 `seatId` 后使其订阅 `seat/<N>`；无密码、无令牌、无房间容量以外的任何限制。

### 8.2 权威方（**P0**）
| 环节 | 位置 | 结论 |
|---|---|---|
| 洗牌 | `T:64-90` 客户端 `Math.random()` + Fisher–Yates | 客户端 ⇒ **房主可预测/可操纵** |
| 发牌 | `APP:463-469` 房主浏览器 | 客户端 |
| 胡牌判定 | `ML:checkHu` 由房主进程调用（`APP:395,767,1187,1296`） | 客户端（房主） |
| 算分 | `APP:1318-1377` 房主计算后广播 `scoreChanges` | 客户端（房主） |
| 出牌合法性 | 房主只信 `data.fromSeatId` 与 `data.tile`（`APP:204-206`），**不校验该座位是否轮次、牌是否在其手牌中** | 客户端可任意出牌/替他人出牌 |

→ 全部落在客户端。房主既可看穿所有人手牌，也可改牌、改分；访客无法验证。

### 8.3 信息隔离（**P0**）
- 做得对的部分：手牌只发给本人（`DEAL_HAND` 走 `seat/N`），牌墙只下发**数量**（`wallRemaining`，`APP:233`），摸到的牌只发给本人。
- 漏洞：
  1. **No ACL**：任何人都能 `subscribe('csmj/v1/+/seat/+')` 拿到**所有房间所有玩家的手牌**（§8.9 已亲测复现）；
  2. 房主广播的 `MELD_BROADCAST.meldGroup.tiles`、`TILE_DISCARDED.tile`、`ROUND_WIN_BROADCAST.result.handTiles` 含完整牌对象（本身可见性没问题，但配合 1 就成了全明牌）；
  3. 访客会收到 `PROMPT_ACTION.kongOptions/chiOptions`（自身信息，合规）；
  4. 前端 `state` 中对手手牌是 `{isBack:true}` 占位（正确，不泄露），但**牌墙真实内容就在房主内存里**。

### 8.4 并发（**P0**）
- 响应窗口与优先级：房主 `processDiscardResponses` 先把窗口**独占给本地座位**（`APP:763-787` 直接 return），再依次询问座位 1→2→3，先响应者立即执行（`APP:789-817`）。**没有并发窗口聚合，也没有按「胡 > 杠 > 碰 > 吃」跨玩家仲裁**；真人可碰的牌会吞掉 AI/其他真人的胡。
- 一炮多响：`discardKongTilesToPool` 收集 `kongWinners` 后只取顺位最近一家（`APP:1193-1201`），其余丢弃。
- 超时：房主侧**没有**针对访客的操作超时（计时器只在本地客户端跑且只处理自己回合出牌，`APP:599-615`），访客挂机 = 全房卡死。
- 消息可靠性：无 `seq`/无 `msgId`/无幂等键；QoS 1（至少一次）但**不检查 `dup` 标志**，重复投递会重复执行（出牌、结算均可能双算）；无乱序/过期消息处理。

### 8.5 异常与容错
| 场景 | 现状 |
|---|---|
| 访客断线 | 房主心跳看门狗每 4s 扫描，14s 无心跳 → `_revertSeatToAI` 变 AI 托管（`MP:171-182`）；**但 App 的 `multiplayerRef`/`seats` 不更新**，对局逻辑仍认为该座位是真人 ⇒ 无人推进（R9） |
| 访客重连 | `mqtt.js` 自动重连（`reconnectPeriod:3000`），但**没有对局快照/重连恢复协议**，房主已把座位改成 AI，访客回来也没有座位与手牌；`joinRoom` 会把旧 `guestTempId` 换新，无法找回原座位 |
| 掉线托管 | 仅「把座位换成 AI 名字」，AI 的决策其实靠房主进程替它算，但触发链路依赖 `mp.seats[s].isHuman` 判断（陈旧状态）⇒ 不可靠 |
| 房主退出/刷新 | LWT 向 `b` 广播 `ROOM_CLOSED`，房间解散，**无房主迁移**；若房主只是切到后台，同样 50% 概率触发 |
| 中途离开 | 访客 `cleanup()` 主动发 `LEAVE` → 房主转 AI（同样受 R9 影响） |
| 服务重启 | 公共 Broker 上房间状态全在房主内存，房主一挂即全丢，无恢复 |
| 加入失败 | 访客 6s 无应答即报「未找到该房间或房主未在线」（`MP:300-308`） |

### 8.6 规则设置（联机）
- 由**房主本地 config** 决定开局行为，且只广播 `GAME_STARTED{seats}` 与 `DEAL_HAND`（`APP:456-458,481-492`）：**访客不知道本局用的是什么规则**（开杠摸几只、需将、起手胡开关、扎鸟数量都按房主浏览器里的值跑，但访客界面顶栏显示的是访客自己的 config）。
- 开局后**没有锁定**机制：访客可以本地改设置，界面显示与实际结算不一致。
- 无「准备」状态：座位加入即 `isReady:true`（`MP:230`）。

### 8.7 AI 补位
- 座位空置即视为 AI（`MP:47-52` 初始即为 AI），人数不足天然由 AI 补位 ✓；`toggleSeatAI` 房主可手动把座位换回 AI（`MP:389-393`，含 `KICKED` 通知）✓。
- 但**对局中途**从真人切 AI 的链路受 R9 影响不可靠（见 8.5）。

### 8.8 客户端信任边界小结
客户端发出的所有消息都带自填的 `fromSeatId`（`MP:430-438`），房主 `_handleHostMessage` 直接采信（`MP:253-262`），因此：伪造他人出牌、替他人吃碰杠胡、伪造心跳让自己永不被托管、向任意 `seat/N` 发假牌 —— 全部可行。

### 8.9 实证：第三方可读可写「私密」频道（本机实跑）

脚本 `probes/net_probe.mjs`（Node + 仓库自带 `mqtt`，连真实 Broker `wss://broker.emqx.io:8084/mqtt`）：
独立第三方客户端订阅 `csmj/v1/+/b`、`csmj/v1/+/seat/+`、`csmj/v1/+/host`（通配符），再由另一客户端向 `csmj/v1/ZZTEST/seat/2` 发布一份 `DEAL_HAND`（正是真实客户端收手牌的消息）、向 `csmj/v1/ZZTEST/host` 发布带 `fromSeatId:1` 的 `DISCARD_ACTION`、向 `csmj/v1/ZZTEST/b` 发布 `GAME_STARTED`。结果：

```
EVESDROPPED_COUNT=3
  RECV topic=csmj/v1/ZZTEST/seat/2  payload={"type":"DEAL_HAND","myHand":[{…一万},{…五筒}],…}
  RECV topic=csmj/v1/ZZTEST/host    payload={"type":"DISCARD_ACTION","fromSeatId":1,"tile":{…}}
  RECV topic=csmj/v1/ZZTEST/b       payload={"type":"GAME_STARTED",…}
RESULT=第三方可完整读写广播频道/房主信箱/座位私密频道（无鉴权、无 ACL）
```

⇒ R2/R3/R4 已实测复现：**任何知道（或枚举）房间码的人都能监听全部手牌、冒充任何座位**。4 位房间码空间约 1.05×10⁶，且无速率限制。

### 8.10 部署
- 前端部署：GitHub Pages（CI 自动），`base:'./'` 兼容子路径 ✓；静态站点本身不含服务端。
- 存储：无数据库、无日志、无会话持久化。
- 环境变量：**README 未提供任何部署文档或环境变量说明**（P2-4）。Broker 地址硬编码在 `MP:8-11`，无法通过环境变量替换。
- 并发上限：公共 EMQX/HiveMQ 免费集群的共享 Topic 数、连接数与限流未知；同房间消息全量广播（每动作 1 条 QoS1 广播）⇒ 单房间带宽 = 玩家数 × 动作频率，未做压测（P0-1 迁移到自建服务端后需重新评估）。

---

## 9. 结论与优先级映射

1. **联机部分不是「已具备联机能力」，而是「能连上、能玩、但完全不可信」**：无服务端权威、无鉴权、无信息隔离、无重连恢复、无并发仲裁。按你的要求，这五条全部落在 **P0**，对应 ROADMAP 的 P0-1 ~ P0-6。
2. **规则引擎有一处会让玩家明显察觉的致命 Bug**（开杠后无法胡牌）与两处文档不实（海底/抢杠死代码），已归入 P1（P1-1~P1-4）。
3. **规则口径本身有 11 处必须由你裁定**（RULES.md §10，Q1~Q11），这些不定，测试与 README 无法同步修改。
4. **画面与 README 的设计语言已经分裂**（红金「黄金岛」 vs 翡翠「现代清澈」），需要先出 `docs/DESIGN.md` 再统一（P2-2），且要清理 `39482/djdodkj/V8` 这类占位符。
5. **测试基建很薄**：32 条断言只覆盖规则层的四个函数，联机/AI/算分全无覆盖，CI 无 lint（P1-7）。

> 说明：本节第 3 条对应你要求的「问题清单交我决定」；其余各项的验收标准见 `docs/ROADMAP.md`。
> 组件层逐文件细读由专项子代理完成（读了 24 个文件），结论已按上表并入本报告；下列为其一手发现的补充清单，主审计已复核到位的条目以「✓已复核」标注。

---

## 10. 组件层细读补充（专项子代理一手证据）

### 10.1 逐文件职责与行数

| 文件 | 行数 | 职责 | 发现 |
|---|---|---|---|
| `MahjongTile.jsx` | 589 | 纯 SVG 牌面/牌背、`sizeMap:434-452`、听牌角标 | 颜色与字体硬编码（`:9, :19, :34`） |
| `PlayerHand.jsx` | 137 | 手牌/副露/摸牌位、两击出牌（`:22-30`） | `selectedTileId` 不随回合重置（R23） |
| `OpponentHand.jsx` | 155 | 三家用胶囊、牌背、朝向 | `vipRank` 硬编码 `V1/V5/V32`（`:28`） |
| `TableCenter.jsx` | 157 | 罗盘、倒计时、余牌 | 「新手区 20」为固定装饰（`:147`）；罗盘 `pointer-events-auto` 但无点击处理（`:63`） |
| `DiscardPool.jsx` | 150 | 四方弃牌池 | 固定 `grid-cols-6/rows-6`（`:33,:70`），超 6 张即折行，与注释「每行 6 张」不符 |
| `ActionControls.jsx` | 165 | 胡/杠/碰/吃/过 + 吃与杠多选弹窗 | `absolute bottom-36`（`:41`）易与手牌重叠；面板内无倒计时 |
| `TileWall.jsx` | 97 | 牌墙装饰 | `count` 默认 12 且被 clamp 到 `[4,14]`（`:81,:92`），**与真实余牌无关** |
| 弹窗 ×6 | 68/94/170/141/266/388 | 开杠补牌/起手胡/结算/规则指南/设置/联机 | 见 R22/R24/R25 |

### 10.2 音效（`src/utils/audio.js`，187 行）
- 单例 `SoundEngine`，Web Audio **现场合成**（无外链音频）：`playTileTouch/playDiscard/playMeld/playStartingHu/playHu/playDice`，懒初始化（`:9-19`）✓ 与 README「全离线音效」一致。
- `enabled` 默认 true（`:6`）；**主审计已确认**开关映射存在（`App.jsx:151` `sound.enabled = newConfig.soundEnabled`，并持久化到 localStorage）✓已复核。
- 缺口：**无音量调节**（只有开关）、无按音效类型分档控制。

### 10.3 测试、CI 与仓库卫生（补充）
- `.oxlintrc.json` 只开了 2 条规则（`react/rules-of-hooks: error`、`react/only-export-components: warn`），其余 35 条 warning 全部来自 oxlint 默认集 → 规则集过窄，且 CI 里**没有 lint 步骤**。
- `test/mahjongLogic.test.js` 的 `canPeng`/`getChiOptions` 导入未使用（`:7-8`）。
- `.gitignore` 缺 `.env*` 规则（与 R 表无冲突，P2-4 处理）。

### 10.4 组件层直接放大的既有风险
- `KongDrawModal` 的 `canSelfHu` 恒为 `false`（源头上游 `checkHu` 含杠必失败，见 R5）→ 面板永远只剩「打出牌张继续」一个按钮，「杠上开花」按钮是**不可达 UI**。
- `MultiplayerModal` 房间号 `maxLength=6` 与「4 位房间号」文案矛盾（R24），且直接读 `network` 单例状态而非订阅回调 → 大厅刷新依赖偶然重渲染。

---

## 11. 基线复核（追加于合并计分 PR 之后，复核基线 `caec53c`）

> 起因：上文写于 `2facaeb`，此后 main 又合并了 3 个 PR（审计文档本身 #1、计分纯函数模块 #2、计分 engine 修正 #3）。
> 本节用**同一套命令在当前 main 上重跑一遍**，逐条确认上文结论是否仍然成立，并补记新发现。

### 11.1 门禁实测（本机原样输出）

| 步骤 | 命令 | 实测结果 | 与 §6.1 对比 |
|---|---|---|---|
| 安装 | `npm ci` | ✅ `added 94 packages in 1s`；⚠️ 仍为 `fsevents@2.3.3` 安装脚本未在 npm allowScripts 白名单（同 §6.1，非故障） | 不变 |
| 测试 | `npm test` | ✅ `mahjongLogic.test.js` 通过 32 / 失败 0，`scoring.test.js` 通过 104 / 失败 0，串跑退出码 0 | **+104 条**（新增计分测试） |
| 校验 | `npx oxlint` | ✅ 退出码 0，**35 条 warning**（`eslint(no-unused-vars)` 24 / `react(immutability)` 5 / `react-hooks(exhaustive-deps)` 3 / `react(set-state-in-effect)` 2 / `react(refs)` 1） | **与文档基线完全一致** |
| 构建 | `npm run build` | ✅ 551ms；`index.html` 1.35 KB、CSS 79.88 KB(gzip 11.79)、JS 698.37 KB(gzip 207.49)；仍有 chunk > 500 KB 告警 | 字节数一致 |
| 启动 | `npm run dev` | ✅ Vite v8.3.2 `ready in 143 ms`，`http://localhost:5173/` 返回 200，`window.onerror` 0 条 | **端口记录修正**：`vite.config.js` 未配置端口 → 默认 5173；§6.1 的 5199 是当时显式加 `--port` 的结果 |

### 11.2 浏览器实测（本轮重拍，截图已更新）

| 视口 | 截图文件 | 溢出检测（`scrollWidth/Height` vs `clientWidth/Height`，实测） |
|---|---|---|
| 375×812 竖屏 | `docs/screenshots/portrait-375x812.png` | 375/375、812/812 → 无溢出；**「请横置手机」遮挡层依旧存在**（R19 未变） |
| 812×375 横屏 | `docs/screenshots/landscape-812x375.png` | 812/812、375/375 → 无溢出 |
| 1440×900 桌面（开局前 / 对局中） | `docs/screenshots/desktop-1440x900.png`、`docs/screenshots/desktop-1440x900-ingame.png` | 1440/1440、900/900 → 无溢出 |

对局实测（桌面）：点「开始对局」→ 三家 AI 各 1000 分、牌墙 55 张起步 → AI 触发**起手胡**结算弹窗（对家 +6 分、其余三家各 −2，与 `APP:512-527` 一致）→ 全程无 JS 异常。
占位符文本实测仍在（`V1/V5/V32`、`39482`、`djdodkj`、`V8`、`新手区 20`），与 R16 / §10.1 / §10.4 一致。

### 11.3 本轮新发现

**N1（P0 相邻）计分重写只落地了「纯函数模块」这一步，尚未接线到游戏。**
`src/utils/scoring.js`（307 行）与 `test/scoring.test.js`（313 行）已合并，但 `src/` 目录下**没有任何文件引用它**（唯一引用方是测试）：
- `grep -rn "scoring.js" src/ test/` → 仅命中 `test/scoring.test.js:14`；
- `grep -n "finalScorePerLoser" src/App.jsx` → 命中 `1318/1331`，即运行时仍走旧口径（`平胡 1 分 / 大胡 k×6`、`baseScore × (1 + hitCount)` 三家共用同一倍数、点炮包三家）。
⇒ **R15（双份计分）在运行时依然成立**；`docs/SCORING.md` §7 的步骤 2–7（`checkHu` 返回值改造、庄家轮换、起手胡/中途四喜按新公式结算、结算页逐项明细、README/规则页同步、1000 局随机模拟）**全部未做**，且步骤 3–7 依赖 S2/S3/S4/S7 等裁定。

**N2 基线漂移的确认（说明上文无需重审）**：`git diff --stat 2facaeb..main` 显示自审计以来**规则层与 UI 层源码零改动** —— 变更仅 `docs/`、`package.json`（test 脚本串联新增测试）、新增 `src/utils/scoring.js` 与 `test/scoring.test.js`。因此 R1–R25 全部仍有效。

**N3 环境（非项目缺陷，记录以免误判）**：本机 `gh` 的 keyring token 失效（`gh auth status` → `The token in keyring is invalid`）⇒ **无法用 `gh` 自动开 PR**；`git push` 的 osxkeychain 凭据仍有效（可推分支）。本机到 github.com 的 TLS 连接偶发 `SSL_ERROR_SYSCALL`（实测 3 次里 1 次成功），推送脚本需带重试。

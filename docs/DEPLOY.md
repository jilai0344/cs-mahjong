# 部署与运维（P2-4）

> 一句话现状：**纯静态前端 + 公共 MQTT broker，没有服务端、没有密钥、没有环境变量。**
> 线上地址 <https://jilai0344.github.io/cs-mahjong/>，由 GitHub Actions 在 main 推送后自动发布。

---

## 1. 环境变量清单

**本仓库当前不使用任何环境变量。** 代码里没有 `import.meta.env` / `process.env` 的读取
（可复现验证）：

```bash
grep -rn "import\.meta\.env\|process\.env" src/ | wc -l   # → 0
```

之所以不需要：联机走公共 broker + 房间号派生密钥（见 §4），计分/庄家全在客户端确定性计算，
没有服务端要配置的东西。`.env.example` 里的变量属于**未来方案 B（自建服务端，当前未立项）**的预备清单，
现在留着它只是为了立项时不用现想。

---

## 2. 单机（纯前端）部署

```bash
npm ci
npm run dev        # 本地开发，默认 http://localhost:5173
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建产物
```

`vite.config.js` 里 `base: './'` —— 产物用相对路径，因此**可以放在任意子路径**下
（GitHub Pages 子目录、OSS/CDN 子目录、本地 `file://` 打开均可）。

### GitHub Pages 自动部署

`.github/workflows/deploy.yml`：push 到 `main`/`master`（或手动 `workflow_dispatch`）后依次执行

1. `npm ci`
2. `npm run lint:check`（与 `scripts/lint-baseline.txt` 逐条比对，**新增告警直接失败**）
3. `npm test`（15 个测试文件、692 条断言）
4. `npm run build`
5. 上传 `dist/` 并 `deploy-pages`

**三关门禁有任意一关不过，就不会发布** —— 线上永远是一个「lint 无新增 + 测试全绿 + 能构建」的版本。

### 回滚

- 首选：`git revert <坏的提交>` 再 push（Pages 会按新提交重新发布）
- 或者：在 Actions 页面 Redeploy 上一次成功的部署（`workflow_dispatch` 重跑）

---

## 3. 联机部署（方案 A：无服务端）

联机不依赖任何自建服务器：

- 客户端直连公共 MQTT broker（`src/utils/multiplayer.js` 的 `BROKER_URLS`，当前两条：
  杭州 EMQX / HiveMQ，`wss://…:8084/mqtt`，带故障转移）。
- 房间号 6 位 → `PBKDF2-SHA256(6 万次)` → `AES-GCM-256`：公共 broker 上只有密文。
- 邀请链接带 `&b=` 房主所在通道，避免两端落在不同 broker 互相收不到；加入失败会自动换通道重试一次。

### 换成自建 broker（可选）

把 `BROKER_URLS` 换成本地 EMQX / HiveMQ 的 **WebSocket** 地址即可（浏览器只能走 `ws/wss`）：

```js
export const BROKER_URLS = [
  'wss://your-emqx.example.com:8084/mqtt',
  'ws://192.168.1.10:8083/mqtt',
];
```

自建 broker 需要：允许匿名或配置账号、开启 WebSocket 监听、`wss` 需要证书。
（当前代码不带任何 broker 账号密码 —— 若要用账号，**不要写进仓库**，见 §6。）

### 这套方案的边界（务必知情）

- 没有权威服务端 ⇒ 房间内玩家能看到房主下发的载荷，也拦不住改本机存档；
  因此「等级/战绩」是**本机记录**，不是可信等级（详见 README「战绩」小节）。
- 公共 broker 的连接数/带宽不可控；两端都连不上时表现为「无法连接到联机服务器，请检查网络设置」。

---

## 4. 容量与压测结论

**方案 A 没有服务端，「并发房间上限」这一项无从压测** —— 诚实说明，不编造数字。
实际约束与已实测规模：

| 项目 | 结论 |
|---|---|
| 已实测规模 | 2 真人 + 2 AI **整局跑通**（含掉线托管接管、换通道重试、结算零和）；3 真人 + 1 AI **整局跑通**到点炮结算 |
| 未实测 | 4 真人满座整局（需要 4 个真人同时在线打完） |
| 同浏览器多标签 | ❌ 会因 MQTT clientId 冲突连不上同一个房间 —— 双端测试必须用两个独立浏览器 |
| 服务端方案立项后需补的压测 | 单机并发房间数、每房间消息吞吐（QoS1 下重传量）、断线重连风暴、按座位裁剪载荷后的带宽 |

---

## 5. 仓库内无密钥（有守卫，不是一次性声明）

```bash
npm run secrets:check     # 扫描 git 跟踪的文本文件，命中即退出码 1
npm test                  # test/secrets.test.js 里也跑同一套规则
```

- 规则集：AWS key / PEM 私钥 / GitHub token / Google API key / Slack token / JWT / Bearer / 疑似硬编码口令。
- 豁免：确需保留的字面量，在该行加 `secret-scan: allow` 并写明理由（扫描器只认这一种豁免）。
- `.gitignore` 忽略 `.env*`（`.env.example` 模板除外），避免本地密钥被误提交。
- CI：`.github/workflows/deploy.yml` 在建构建之前跑 `npm run secrets:check`。

---

## 6. 排障速查

| 症状 | 先看这里 |
|---|---|
| 部署没成功 | Actions 日志里是哪一关挂的（lint:check / test / build）；本地复跑同一条命令 |
| 「无法连接到联机服务器，请检查网络设置」 | broker 是否可达（公司网络可能封 8084）；换通道重试；两个独立浏览器 |
| 顶栏显示「重连中 / 已断开」 | 就是字面意思：MQTT 连接断了，客户端会自动重连并补订阅 |
| 顶栏延迟长期 >400ms（红） | 公共 broker 抖动；换通道或换网络试试 |
| 某个座位标着「托管」 | 那位真人掉线被电脑接管了，回到房间可继续；本局不计入四人对战战绩 |

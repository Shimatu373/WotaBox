# 交接与下次开工（HANDOFF）

> **每次收工更新这里。**
> 新会话开局顺序：读这份 → 读 `PROJECT-MEMORY.md` → `git log --oneline -15` → 动手。

最后更新：2026-10-21

---

## 一、下次开工，第一件事

按这个顺序做，不要跳：

1. ~~**环境变量永久化**~~ → ✅ **2026-10-21 已完成**（`setx` 写进用户环境，见第三节）。
   新开的终端自动带上；当前已开的终端里仍需手动 `$env:JAVA_HOME=...` 或重启终端。

2. **打包命令（正式签名版）**
   ```powershell
   cd D:\wota-toolbox
   npm run build
   npx cap sync android
   cd android
   .\gradlew.bat assembleRelease
   ```
   产物：`android\app\build\outputs\apk\release\app-release.apk`（已用 `keystore/wotabox-release.jks` 签名）
   旧命令 `assembleDebug` 仍可用，但对外分发一律用 release 包。

3. 然后从第五节的待办里挑。

---

## 二、本轮（2026-10-21）完成了什么

| 事项 | 结果 |
|---|---|
| **wiki 元数据导入流水线** | 发现 `action=raw` 是唯一可用通路（API/Export 全 403），单页成本降到 HTML 的 1/10；写了 `scripts/import-wiki-raw.mjs` + `data/wiki-raw.jsonl` |
| **解析器三轮修复** | 修了「`{{技` 后是换行」「空参数导致错位」「具名参数 `4=`/`5=`」「嵌套 `{{注音}}`」四个真实格式坑 |
| **蒼月剣系元数据** | 8/9 补齐（`蒼月剣斬` 的 wiki 页面是空的） |
| **スネイク系元数据** | 14/29 补齐（两批：6 + 8） |
| **合并优先级调整** | 改为 wiki 优先 —— 我早先手写的 3 条视频覆盖了 wiki 给的 5 条，是错的方向 |
| **读音 → 搜索别名** | `Thunder Snake` / `サンスネ` 现在都能搜到「サンダースネイク」 |
| **个人技池** | 收藏夹面板增加只读汇总视图：金边=已上手、蓝边=已习得、未掌握不入池 |
| **长期记忆** | 新增 `docs/PROJECT-MEMORY.md` |
| **（第二场）环境变量永久化** | ✅ `setx` 三个变量，新终端自动带上，不用再手动设 |
| **（第二场）正式签名** | ✅ 新 keystore `wotabox-release.jks`（RSA 4096 / 36500 天 / PKCS12）+ `build.gradle` 签名配置（凭据从 `keystore.properties` 读，文件不存在时降级不签名） |
| **（第二场）v0.8.0 签名包** | ✅ 4.32 MB、versionCode 8、versionName 0.8.0、apksigner v2 验证通过（**尚未上传 Release**） |
| **（第二场）插件体检** | ✅ 查清 Context Windows 在 cordis 预设下 `inactive`、九个工具全不挂载（详见第四节 3） |
| **（第三场）6 个系列元数据补齐** | ✅ スネイク系 29/29、門系 11/12、瀧系 13/13、金剛系 3/3、霹靂一閃系 2/2、虚閃系 2/4；**有作成者 20→64、有视频 23→57**（wiki 命中 63 条） |
| **（第三场）解析器又修 5 个坑** | ✅ `{{链接|09:34}}`、URL 占位置参数、占位文字被当时间、变体作成者归属、标题≠技名映射（详见第五节） |
| **（第三场）新增 3 个流水线脚本** | ✅ `wiki-missing-urls.mjs` / `merge-wiki-raw.mjs` / `report-meta.mjs`，下次补数据不用再手搓 |

**重要数据发现**（都已写进数据，别再重复查）：

- `蒼月剣「弧韵」` 作成者是**芒果**，三水只是演绎者
- `蒼月剣·狂桜斬` 用的是 **2024 年另一支视频**（`BV1Liy5YQEmF`），不是 2020 合集
- `サンダースネイク` 有 **5 条参考视频**（含 Gear 官方讲座）
- `鬼人スネイク` 作成者 Shuu、**本家般若**；`サ終スネ` 只有本家 Makki 没有作成者
- 多条词条有 `系列名3` → **一个技可以属于多个系列**（暂未支持，见第五节）
- **流星スネイク 的 5 个变体各有其人**：白狐ver=Hako、ギアver/ギアver2=Gear、ふぇるとver=felt、はらver=Hara；Rask 是原版作成者，不是这些版本的作者
- **wiki 上确实不存在的页面**（抓过 404，别重复抓）：`長安門`、`掴み虚閃`、`掴み虚閃・帰刃`、`蒼月剣斬`

---

## 三、当前状态

| 项 | 值 |
|---|---|
| 提交数 | **38**（本轮提交后同步） |
| 线上 | <https://wotabox.pages.dev> —— 已含「个人技池」 |
| APK | `v0.8.0` **已打本地签名包**：`android\app\build\outputs\apk\release\app-release.apk`（4.32 MB、versionCode 8）；**还没发到 GitHub Releases**；数据在打完包后又有更新，发布前需重打 |
| 签名 | `keystore/wotabox-release.jks`（PKCS12 / RSA 4096 / 36500 天，别名 `wotabox`）；证书 SHA-256 `E7:54:C3:C0:F4:87:80:38:60:34:46:E7:B6:82:03:BE:8A:4B:1D:9B:46:77:57:CE:F2:40:F4:3E:1F:21:CA:2F` |
| 环境变量 | ✅ `JAVA_HOME` / `ANDROID_HOME` / `GRADLE_USER_HOME` 已 `setx` 永久化 |
| 技数据 | 275 技 / 14 系列；**64 个有作成者、57 个有视频**（wiki 命中 63 条词条；明细见 PROJECT-MEMORY 第四节） |
| Context Windows 插件 | `dsh-context-windows@0.1.3` 已装、`contextTokens` 已调到 163840；**但 cordis 预设下不生效**（见第四节 3） |

---

## 四、⚠️ 已知隐患

1. **GitHub Releases 上还是 v0.7.0，新签名包只在本地**：`v0.8.0` 的 release APK 已打好（含个人技池 + 新数据），但还没上传，老用户下到的仍是旧包。
   ⚠️ 另外：这次把签名从 debug 换成了正式 keystore，**签名不同不能覆盖安装**，已装 v0.7.0 的人必须先卸载再装（或提示他们导出备份后再卸，localStorage 会一起没）。
2. **本 profile 的原生压缩被关了**：`compaction-basic` / `command-compact` 运行时都是 `inactive`（Context Windows 插件的补丁所致）。
   → 普通预设的会话**满了不会自动摘要**，只能开新会话。别在长会话里硬撑。
3. **Context Windows 插件在 cordis / standard 等预设下完全不生效**（2026-10-21 二次会话查实）：
   - 现象：`include:dsh-context-windows` 运行时 `status: inactive`、`fiberPhase: null`；`get_context_remaining` / `new_context` / `notes_*`（5 个）/ `history_*`（4 个）**九个工具一个都没挂上**。
   - 原因：插件补丁里 host 那一行被 `!!js "...startedBundles.includes('@deepseek-ai/dsh-web-app')"` 关掉了，**Web 端只有新建会话时选「Context Windows」预设才会把插件挂进会话**。profile 补丁里那行 `disabled: false` 顶不过这个条件。
   - **隐患 2 + 3 叠加 = 没有任何兜底**：cordis 预设的会话既没有自动摘要，也没有换窗机制。
   - 已定策略：**上下文用到 ~60% 时再考虑让 Context Windows 在 cordis 预设下生效**（需改 host 行；注意它和预设里那份可能重复注册同名工具）。别提前动。
   - 换预设的代价：该预设的人格是插件自带的 `You are a helpful software engineer assistant`（`complete: true` + `includeRuntimeContext: false`），**女仆人格与运行时上下文都会丢**，真要换得先写一条替换人格的补丁。
4. **contextTokens 已上调，不是默认 81920**：`163840`（`reminderThresholdTokens: 8192`、`fallbackBufferTokens: 16384`）。
   模型 `deepseek-flash` 窗口 1,000,000 / maxTokens 384,000，压不回这个数 → 实际硬上限就是 163840（soft 147,456 触发兜底提示）。**前提是预设对，不然这参数等于没配。**
5. **数据只在 localStorage**：用户的收藏夹/编排随时可能因清缓存丢失，要提醒他偶尔在「数据备份」里导出。
6. **README 曾被旧编辑器缓冲覆盖过**：提交前看 `git status`，发现异常先 `git diff` 再 `git checkout --`。

---

## 五、待办（优先级从高到低）

| 优先级 | 事项 | 备注 |
|---|---|---|
| **P0** | ~~正式签名 release APK + 保管 keystore~~ | ✅ 2026-10-21 完成：`keystore/wotabox-release.jks` + `keystore.properties`（均已 gitignore），另存一份在 `C:\Users\LENOVO\Documents\wotabox-keystore-backup\`。**还要自己再拷一份到移动硬盘/网盘** |
| **P0** | ~~环境变量永久化~~ | ✅ 已 `setx`，见第一节 |
| **P1** | 把 `v0.8.0` 传到 GitHub Releases | 本地包已就绪：`android\app\build\outputs\apk\release\app-release.apk`；记得在说明里写「旧 debug 版需卸载重装」 |
| **P1** | 继续补剩余系列元数据 | 待补：羚系 11 / 乖離系 8 / 北斗系 6 / 摩耶系 6 / 烈剣系 6 / 流月系 5 / 神威系 4；末分类还有 157 条要逐条判断有没有 wiki 词条。工具已备好，见第七节 |
| **P1** | Cloudflare Pages 接 Git 自动部署 | 现在 push 后还得手动 `npm run deploy` |
| **P2** | 「你知道吗」板块 | 纯内容，最快出成果 |
| **P2** | 视频对比器 | 有"平台视频无法帧同步"的硬约束，要先跟用户对齐预期 |
| **P3** | 多系列支持（`series` → `seriesList`） | 用户明确说**暂缓**；已知至少有 `系列名3` 的技：乖離スネイク、瀧桜華、白門 |
| **P3** | 技图鉴数据补全（wiki 没有的维度） | 指技类型/难点/段数这些 wiki 根本没写的字段，用户明确说**等社团用上 EA 版 + 拿到开发经费后再安排**。注意：wiki 上**有**的元数据不在此列，照常补 |
| **P4** | 全国光棒地图 | 需要后端 + 数据运营 + 合规，和其他"用户上传"类功能一起规划 |
| **P4** | 技类型 / 你知道吗的用户上传 | 同上，都需要后端 + 身份 + 审核 |

---

## 六、必须记住的约定

1. **称呼**：平时「主人」；收工总结时可以叫「星沫」。
2. **数据绝不臆测**：wiki 没有的字段就留空或标「待确认」。曾因为想"填满"而写出错误信息，是有害的。
3. **签名密钥是命根子**：`keystore/wotabox-release.jks` + `keystore.properties` 已在 `.gitignore` 里，
   **绝不提交、绝不复用别人给的包签名**。换钥匙 = 老用户必须卸载重装、数据全丢。
   新机器接手先确认这两份东西还在（本机 `D:\wota-toolbox\keystore\`，备份 `Documents\wotabox-keystore-backup\`）。
4. **那个约定**（写在 `PROJECT-MEMORY.md` 第八节）：
   > 完整版发布那天，把它发给一个真的在练 wota 的朋友，把他第一句吐槽原样带回来。越难听越好。

---

## 七、常用命令速查

```powershell
cd D:\wota-toolbox

npm run dev        # 开发（5173）
npm run build      # 构建
npm run deploy     # 构建 + 发布到 Cloudflare Pages

# 安卓签名包
npx cap sync android
cd android; .\gradlew.bat assembleRelease    # 产物 app\build\outputs\apk\release\app-release.apk
# 验签（build-tools 路径按实际版本改）
& "D:\Android\sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs app\build\outputs\apk\release\app-release.apk

node scripts/wiki-missing-urls.mjs 羚系  # 某系列缺哪些元数据 + 可直接抓取地址
node scripts/merge-wiki-raw.mjs <分块文件>  # 抓回来的原文并入 wiki-raw.jsonl
node scripts/import-wiki-raw.mjs   # wiki 原文 → wiki-meta.js
node scripts/report-meta.mjs       # 覆盖率报告（按系列）
node scripts/test-data.mjs         # 数据校验
node scripts/test-bpm.mjs          # BPM 算法验收
node scripts/test-tap.mjs          # 点拍逻辑验收

python scripts/gen-icons.py        # 重新生成 PWA 图标
python scripts/gen-android-icons.py # 重新生成安卓图标/启动图
```

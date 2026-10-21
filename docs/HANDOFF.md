# 交接与下次开工（HANDOFF）

> **每次收工更新这里。**
> 新会话开局顺序：读这份 → 读 `PROJECT-MEMORY.md` → `git log --oneline -15` → 动手。

最后更新：2026-10-21

---

## 一、下次开工，第一件事

按这个顺序做，不要跳：

1. **环境变量永久化**（当前每次打包都得手动设）
   ```powershell
   setx JAVA_HOME "C:\Program Files\Java\jdk-21"
   setx ANDROID_HOME "D:\Android\sdk"
   setx GRADLE_USER_HOME "D:\gradle-cache"
   ```
   设完要**新开终端**才生效。

2. **重新打 APK 并发新 Release**（现在的线上包缺两个功能，见第四节）
   ```powershell
   cd D:\wota-toolbox
   npm run build
   npx cap sync android
   cd android
   .\gradlew.bat assembleDebug
   ```
   产物：`android\app\build\outputs\apk\debug\app-debug.apk`

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

**重要数据发现**（都已写进数据，别再重复查）：

- `蒼月剣「弧韵」` 作成者是**芒果**，三水只是演绎者
- `蒼月剣·狂桜斬` 用的是 **2024 年另一支视频**（`BV1Liy5YQEmF`），不是 2020 合集
- `サンダースネイク` 有 **5 条参考视频**（含 Gear 官方讲座）
- `鬼人スネイク` 作成者 Shuu、**本家般若**；`サ終スネ` 只有本家 Makki 没有作成者
- 多条词条有 `系列名3` → **一个技可以属于多个系列**（暂未支持，见第五节）

---

## 三、当前状态

| 项 | 值 |
|---|---|
| 提交数 | **36**（远程已同步） |
| 线上 | <https://wotabox.pages.dev> —— 已含「个人技池」 |
| APK | GitHub Releases **v0.7.0** —— **已过时**（见下） |
| 技数据 | 275 技 / 14 系列；20 个有作成者、23 个有视频 |
| Context Windows 插件 | `dsh-context-windows@0.1.3` 已装；**Web 下须用「Context Windows」预设开新会话**才生效 |

---

## 四、⚠️ 已知隐患

1. **APK 过时**：`v0.7.0` 里没有「个人技池」，也没有这轮的技数据更新。发给朋友前必须重打。
2. **本 profile 的原生压缩被关了**：`compaction-basic` / `command-compact` 都是 `enabled: false`（Context Windows 插件的补丁所致）。
   → 普通预设的会话**满了不会自动摘要**，只能开新会话。别在长会话里硬撑。
3. **数据只在 localStorage**：用户的收藏夹/编排随时可能因清缓存丢失，要提醒他偶尔在「数据备份」里导出。
4. **README 曾被旧编辑器缓冲覆盖过**：提交前看 `git status`，发现异常先 `git diff` 再 `git checkout --`。

---

## 五、待办（优先级从高到低）

| 优先级 | 事项 | 备注 |
|---|---|---|
| **P0** | 正式签名 release APK + **保管 keystore** | 现在只有 debug 签名；keystore 丢了就没法给老用户推更新 |
| **P0** | 环境变量永久化 | 见第一节 |
| **P1** | 重打 APK 发 `v0.8.0` | 含个人技池 + 新数据 |
| **P1** | Cloudflare Pages 接 Git 自动部署 | 现在 push 后还得手动 `npm run deploy` |
| **P2** | 「你知道吗」板块 | 纯内容，最快出成果 |
| **P2** | 视频对比器 | 有"平台视频无法帧同步"的硬约束，要先跟用户对齐预期 |
| **P3** | 多系列支持（`series` → `seriesList`） | 用户明确说**暂缓** |
| **P3** | 技图鉴数据补全 | 用户明确说**等社团用上 EA 版 + 拿到开发经费后再安排** |
| **P4** | 全国光棒地图 | 需要后端 + 数据运营 + 合规，和其他"用户上传"类功能一起规划 |
| **P4** | 技类型 / 你知道吗的用户上传 | 同上，都需要后端 + 身份 + 审核 |

---

## 六、必须记住的约定

1. **称呼**：平时「主人」；收工总结时可以叫「星沫」。
2. **数据绝不臆测**：wiki 没有的字段就留空或标「待确认」。曾因为想"填满"而写出错误信息，是有害的。
3. **那个约定**（写在 `PROJECT-MEMORY.md` 第八节）：
   > 完整版发布那天，把它发给一个真的在练 wota 的朋友，把他第一句吐槽原样带回来。越难听越好。

---

## 七、常用命令速查

```powershell
cd D:\wota-toolbox

npm run dev        # 开发（5173）
npm run build      # 构建
npm run deploy     # 构建 + 发布到 Cloudflare Pages

node scripts/import-wiki-raw.mjs   # wiki 原文 → wiki-meta.js
node scripts/test-data.mjs         # 数据校验
node scripts/test-bpm.mjs          # BPM 算法验收
node scripts/test-tap.mjs          # 点拍逻辑验收

python scripts/gen-icons.py        # 重新生成 PWA 图标
python scripts/gen-android-icons.py # 重新生成安卓图标/启动图
```

# WotaBox 项目记忆

> 这份文件是**跨会话的长期记忆**。上下文重置、开新窗口、换设备、甚至换人接手之后 ——
> 先读这里，再动手。
>
> 当前进度与下次开工清单见 [HANDOFF.md](HANDOFF.md)。

最后更新：2026-10-21

---

## 一、这是什么

**WotaBox** —— 给 wota 艺（ヲタ芸）打师的学习与练习工具箱。纯前端、离线可用、**无后端**。

| 项 | 地址 |
|---|---|
| 线上 | <https://wotabox.pages.dev>（Cloudflare Pages） |
| 源码 | <https://github.com/Shimatu373/WotaBox> |
| APK | 本地已打 **`v0.8.0` 正式签名包**（4.32 MB，versionCode 8）；GitHub Releases 上仍是旧的 `v0.7.0`（debug 签名） |
| 技术栈 | Vue 3 + Vite 8；安卓用 Capacitor 打包 |

> ⚠️ 本项目**不使用 GitHub Pages**。仓库里只有源码，`*.github.io` 地址跑不起来。

---

## 二、功能清单（当前状态）

| 功能 | 状态 | 位置 |
|---|---|---|
| 节拍器 | ✅ 四八拍分组、三层重音、预备拍、屏幕常亮 | `components/MetronomePanel.vue` |
| 音乐播放器 | ✅ 无缝 A-B 循环、0.5–1.5× 变速、导入自动识别 BPM | `components/PlayerPanel.vue` |
| 编排 | ✅ 歌曲片段 × 有序副歌技，可复制文本 | `components/ChoreoPanel.vue` |
| BPM 测试 | ✅ 自动分析（自相关）+ 手动点拍 | `components/BpmPanel.vue` |
| 技图鉴 | ✅ **619 技 / 52 系列**，搜索、筛选（系列+难度）、分组、跳 wiki、**难度色条** | `components/WazaPanel.vue` |
| 难度分级 | ✅ 四档（基础绿/进阶黄/专家红/大师紫）+ 待评定灰条，显示在每条技名后 | `data/difficulty.js` + `components/DifficultyBar.vue` |
| 收藏夹 | ✅ 自定义分组 + 三档掌握状态 | `components/FavoritesPanel.vue` |
| 个人技池 | ✅ 只读汇总视图（金=已上手，蓝=已习得） | 同上，模式切换 |
| 数据备份 | ✅ 导出 / 导入 / 撤销 | `components/BackupPanel.vue` |
| PWA | ✅ manifest + SW + 离线 | `public/` |
| 安卓 APK | ✅ Capacitor 打包，图标已替换 | `android/` |

---

## 三、关键决策与理由（别推翻，除非有更好的理由）

| 决策 | 理由 |
|---|---|
| 音频用 **Web Audio**，不用 `<audio>` | `AudioBufferSourceNode.loopStart/loopEnd` 是采样级精确，无缝；`<audio>` 用 `currentTime` 判循环会有几十毫秒断缝 |
| 节拍器用**前瞻调度**，不用 `setInterval` 发声 | 定时器有累积漂移，会让节拍"散掉" |
| 节拍器与播放器**共用一个 AudioContext** | 两者可同时出声（放原曲 + 打拍）；共用上下文**不能**在某个面板卸载时 close |
| Service Worker **网络优先** | 开发期永远拿最新，避免"改了代码手机还是旧的" |
| 托管选 **Cloudflare Pages**，不用 GitHub Pages | 项目用绝对路径（`/assets/`、`/sw.js`），挂子路径会全废；GitHub Pages 也不能直接跑源码 |
| 安卓走 **Capacitor APK** | 国内 WebAPK 要访问 Google 服务器，装不上；APK 完全绕开 |
| 数据全存 **localStorage** | 隐私 + 无后端；代价是必须靠备份 |
| 技类型全留 **待确认** | wiki 没有这个维度，不臆测；计划日后由用户上传。目前只有金剛系三条由星沫查证标成「关西」 |
| 难度分 **四档**（基础/进阶/专家/大师），用**色条**标在技名后 | 一眼扫出「这个技新手能不能上」；没用星星/数字是因为在长列表里不如一条颜色快。未评定的显示「比背景略亮」的灰条 —— **留白 ≠ 最低档** |
| 安卓用**独立 keystore 签 release 包**（`keystore/wotabox-release.jks`，RSA 4096 / 36500 天） | debug 签名只能自用：签名不同无法覆盖安装，用户数据会丢，也没法长期推更新。密码放 `keystore.properties`，两者都 gitignore + 异地备份 |
| 系列按**命名归族** | 除「蒼月剣系」「スネイク系」等有 wiki 官方分类外，其余是按命名整理，非权威 |

---

## 四、wiki 元数据流水线（重要）

**坑**：wiki 整站对本地机器 403（Node/PowerShell 都不行），`api.php`/`rest.php`/`Special:Export` 全被 WAF 挡。
**唯一通路**：`web_fetch` + `index.php?title=<标题>&action=raw`（返回模板原文，约 300 字符，比 HTML 省 10 倍）。

```
web_fetch action=raw  →  data/wiki-raw.jsonl（累积，可重复解析）
                              ↓
        scripts/import-wiki-raw.mjs
                              ↓
              src/data/wiki-meta.js（自动生成，勿手改）
                              ↓
      src/data/waza.js 合并（wiki 优先，手写补充）
```

**常用命令**

```powershell
# ① 浏览器导出（绕开 Cloudflare 403，见下）
#    在 wiki 页面 F12 → Console 粘贴 docs/bulk-fetch-wiki.js → 下载 wiki-pages.json → 放到 data/
node scripts/absorb-wiki-json.mjs              # 导出的 JSON → 并入 wiki-raw.jsonl
node scripts/clean-wiki-raw.mjs                # 去测试页、去「同一技多个标题」重复
node scripts/qa-wiki-raw.mjs                   # 入库前校验：标题↔正文错配、重复、空 raw

# ② 单页补抓（少量缺漏时）
node scripts/wiki-missing-urls.mjs スネイク系   # 某系列缺哪些 + 生成 action=raw 地址
node scripts/merge-wiki-raw.mjs data/xxx.txt   # @@PAGE@@ 分块文本 → wiki-raw.jsonl

# ③ 生成与归类
node scripts/gen-wiki-rows.mjs                 # 新词条 → src/data/waza-wiki-extra.js（自动 ROWS）
node scripts/import-wiki-raw.mjs               # 解析 jsonl → wiki-meta.js
node scripts/propose-series.mjs                # 用 wiki「系列名」半自动归类 → series-auto.js + 提案 md
node scripts/diff-cat-list.mjs                 # 分类清单 vs 图鉴，还缺哪些
node scripts/report-meta.mjs                   # 覆盖率报告
node scripts/test-data.mjs                     # 数据校验（含难度档名校验）

npm run build && npm run deploy                # 构建并发布
```

**⚠️ Cloudflare 403（2026-10-21 查实，别再浪费时间试本地抓）**

- wiki 站对**任何本地脚本**一律 403，页面是「请稍候…」挑战页；带全套浏览器指纹头没用
- `cf_clearance` 是 **HttpOnly**，浏览器控制台 `document.cookie` 读不到它；
  DevTools 的「Copy as cURL」也常常不带 `Cookie:` 头
- **唯一稳的路**：在 wiki 页面里跑 `docs/bulk-fetch-wiki.js`（同源 fetch 自带会话），
  导出 JSON 后由本地脚本离线入库 —— 正文不经过模型，token 成本≈0
- 直接走 web_fetch 抓单页也能通（每次约 350–450 token），少量补漏时才用

**分块文件的写法**（`merge-wiki-raw.mjs` 的输入）：

```
蒼月剣舞〈苍月剑舞〉          ← 第一行是 wiki 标题
{{技                          ← 之后是 action=raw 原始文本
|原=蒼月剣舞
...
}}
@@PAGE@@                      ← 分隔下一页
```

标题与内部技名不一致时，标题行写「标题<TAB>技名」，例：`半蔵門〈半藏门〉	半藏門`。

**解析器已处理过的真实格式**（都是踩出来的）

- `{{技` 后面是**换行**而不是 `|`
- 空位置参数必须**保留位置**，否则标题会顶到时间位
- 具名参数 `4=`=时间、`5=`=标题
- `{{时间|45.2|2}}`、`{{时间链接|103.3|2|url}}`、`{{链接|09:34|url}}` 三种
- 时间缺失时可以用链接里的 `?t=170` 兜底（原文自带信息，不算臆测）；除此之外不许瞎填
- 嵌套 `{{注音|显示|原音|罗马字}}`、`<ref>`、`{{换行}}`、`<br>`、`<nowiki>`
- `本家=同上` 要解析成作成者；`|国人技=是` 要转成标签
- 视频字段有 4 种写法：`视频` / `以外视频` / `其他视频` / `使用视频`
- 链接有时不写在 `6=`，而是直接占位置参数
- 变体词条：`|人物=原版作成者 |作成者=原版作者 |身份=版本创编者 |本家=该版本作者`
  → **creator 取本家**，否则「流星スネイク ギアver」会被错标成 Rask
- 具名参数 `同=`/`伴=`/`换=` 会挤占位置，但仍保留空位
- **颜色模板包裹整条词条**：`{{八舞橙|「神威灵装·八番」}}`、`{{十香紫|{{AKHOT}}}}`
  → 判断规则：参数都是显示开关（`1`/`3`/`显`/`x`/`b`）才取模板名，否则取参数正文。
  早先一律取模板名，会把作成者解析成「八舞橙」
- 链接位直接写 **BV 号**（`6=BV1ox421Q72Z`）：要补成完整 bilibili 地址
- 中文名字段有 `中=` 也有 `中文名=`；`拼音`/`拼` 不是读音，别混
- `|身份=版本创编者` 等字段可能和 `时间` 并存，解析时按字段名取，不看顺序

**当前进度（2026-10-21 全量导入后）**：**619 技 / 52 系列**，wiki 词条命中 **616 条**；
**556 有作成者（90%）、542 有视频（88%）**；未分类 330 条。

> 这一轮把「分类:技」的 618 个页面全拉下来了（= 我们之前只有 278 个）。
> 未分类从 123 涨到 330 是正常的：新进来的技大多还没归类，
> 而自动归类只认「组内 ≥2 条」，大量技是独苗。

**旧数字（第一轮扫完时）**：275 技中 248 有作成者、231 有视频。
14 个系列 + 未分类全部扫过一遍，剩下的 27 条是 wiki 本身没数据，别再重复抓：

| 原因 | 条目 |
|---|---|
| 页面 404，wiki 根本没有 | 満月雕弓、ライザー、長安門、北斗·天枢/天璇/天玑/天权/玉衡、掴み虚閃、掴み虚閃・帰刃 |
| 页面存在但只有名字 | AXISnake、ガブリエル、蒼月剣斬（空页） |
| 页面写了别的东西、没写作成者 | ムラサメ（只有读音和趣闻） |
| 只写了本家、没写作成者 | 流月赋/歌/诗/アンタレス（本家=狱祠）、サ終スネ（Makki）、永夜スネーク、凸スネ・鳳凰 |

**大批量抓取的做法**（156 条一次扫完的经验）

1. 生成清单按块切分（每块 20 条左右），**每个子代理负责一块**，各自写 `_pages-*.txt`，
   正文不进主会话上下文 —— 否则光粘贴就会吃掉几千 token 且极易抄错
2. 子代理只做「抓 + 逐字写盘」，不做任何改写；提示里必须写死「不要改写/翻译/补全」
3. 合并后**先跑 `qa-wiki-raw.mjs` 再入库**：它比对每块 `原=` 与标题，能抓住
   「A 页正文写到 B 标题下」这种肉眼看不出的错配
4. 事后随机抽样 10 条重新抓取逐字比对（实测 11/11 一致，行尾空白原样保留 = 直写证据）

---

## 五、踩过的坑（复用知识）

| 坑 | 教训 |
|---|---|
| PowerShell 里用相对路径写文件 | 会落到 `D:\dsh`（.NET 进程 CWD ≠ PS 当前目录）。**一律用绝对路径** |
| `"反引号"` 在双引号字符串里 | 是转义符。JS 模板字符串内容要用单引号或 here-string |
| `write` 工具报 `ReplaceFileW EIO` | 文件被占用。改用 pwsh `FileStream` + **必须 `SetLength(0)`**，否则旧内容尾部残留 → 曾导致构建失败 |
| `import ... from './x.json'` | 纯 Node 需要 import attribute。**改成生成 `.js` 模块** |
| 批量抓取靠「复制粘贴」 | 100+ 条会掏空上下文且必然抄错。拆给子代理写盘 + `qa-wiki-raw.mjs` 校验标题↔正文 + 抽样重抓比对，三者缺一不可 |
| 生成脚本「自噬」 | `gen-wiki-rows` / `propose-series` 的产物会被 `waza.js` 消费，第二次运行会把「自己上一轮写的」当成「已经有的」→ 把文件清空。**凡是产物回流进数据的脚本，都必须把自己上一轮的产物视为未处理**（两个脚本都踩过） |
| 简繁两套系列名 | `鹤望兰系` / `鶴望蘭系` 会被当成两个系列。分组前先做一次简繁折叠（只用于比较，显示用出现多的那种写法） |
| 彩色文字模板污染字段 | 有个「系列名」在 wiki 上是用 `<span style>` 堆出来的，不剥 HTML 就会在系列列表里出现一长串标签 |
| Vite 隧道域名 403 | `server.allowedHosts` / `preview.allowedHosts` 要放行 `.trycloudflare.com` |
| README 被旧编辑器缓冲覆盖 | 提交前看 `git status`，被覆盖就从 git 恢复 |
| 重复声明（`WAZA` / `wazaMap`） | 改组件前先 `grep` 确认已有什么 |

---

## 六、协作约定

- **称呼**：平时叫「主人」；收工总结时可以叫「星沫」（用户许可）
- **数据诚实**：来源没有的字段就留空 / 标「待确认」，**绝不臆测**。写成看起来权威但错误的数据，比空着有害
- **改完必验**：`npm run build` + 相关测试脚本，通过才提交
- **提交习惯**：中文 commit message，说明"为什么"而不只是"改了什么"

---

## 七、未完成 / 下一步

| 优先级 | 事项 | 备注 |
|---|---|---|
| 高 | ~~正式签名的 release APK + 保管 keystore~~ ✅ 2026-10-21 | keystore 已生成、`build.gradle` 已配；备份在 `Documents\wotabox-keystore-backup\`，**还需再拷一份到移动硬盘/网盘** |
| 高 | ~~环境变量永久化~~ ✅ 2026-10-21 | `JAVA_HOME` / `ANDROID_HOME` / `GRADLE_USER_HOME` 已 `setx` |
| 高 | 把 `v0.8.0` 传到 GitHub Releases | 本地包 `android\app\build\outputs\apk\release\app-release.apk` 已就绪 |
| 中 | Cloudflare Pages 接 Git 自动部署 | 现在 push 后要手动 `npm run deploy` |
| 中 | `你知道吗` 板块 | 纯内容，最快出成果 |
| 中 | 视频对比器 | 有"平台视频无法帧同步"的硬约束 |
| 低 | 多系列支持（`series` → `seriesList`） | 暂缓，用户决定等经费 |
| 低 | 技图鉴数据补全 | 等社团用上 EA 版、拿到开发经费后再安排 |
| 低 | 全国光棒地图 | 需要后端 + 数据运营 + 合规 |

---

## 八、那个约定

> 完整版发布那天，把它发给一个**真的在练 wota 的朋友**，然后把他第一句吐槽原样带回来。
> 越难听越好。

这是唯一能证明它不是玩具的东西。别忘。

---

## 九、给未来接手的人（包括我自己）

1. 先读 `README.md` 了解对外说明，再读这份文件了解内情
2. `git log --oneline` 看最近的决策轨迹
3. 任何"看起来能跑但没验证"的改动，先跑 `npm run build`
4. 用户是 wota 打师，**领域知识以他为准**；技术判断可以给建议，但不要替他做产品决定

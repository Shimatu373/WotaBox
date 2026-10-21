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
| 技图鉴 | ✅ 275 技 / 14 系列，搜索、筛选、分组、跳 wiki | `components/WazaPanel.vue` |
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
| 技类型全留 **待确认** | wiki 没有这个维度，不臆测；计划日后由用户上传 |
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
node scripts/wiki-missing-urls.mjs スネイク系   # 列出该系列还缺元数据的技 + 生成 action=raw 地址
node scripts/merge-wiki-raw.mjs data/xxx.txt   # @@PAGE@@ 分块文本 → data/wiki-raw.jsonl（可重复跑）
node scripts/import-wiki-raw.mjs               # 解析 jsonl → wiki-meta.js
node scripts/report-meta.mjs                   # 覆盖率报告：按系列统计作成者/视频缺口
node scripts/test-data.mjs                     # 校验重复 id / 非法类型
npm run build && npm run deploy                # 构建并发布
```

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

**当前进度**：275 技中 **64 有作成者、57 有视频**（wiki 命中 63 条词条）。

| 系列 | 作成者/总数 | 说明 |
|---|---|---|
| スネイク系 | 25/29 | 4 条 wiki 未给作成者（AXISnake、永夜、サ終スネ、凸スネ・鳳凰） |
| 門系 | 11/12 | `長安門` 页面不存在 |
| 瀧系 | 13/13 | 大多只有作成者、无视频 |
| 蒼月剣系 | 8/9 | `蒼月剣斬` 页面为空 |
| 金剛系 / 霹靂一閃系 | 3/3 · 2/2 | 全齐 |
| 虚閃系 | 2/4 | `掴み虚閃` 两条页面不存在 |
| 羚系 / 乖離系 / 北斗系 / 摩耶系 / 烈剣系 / 流月系 / 神威系 | 0 | **下一批待补** |
| 未分类 | 0/157 | 大头，需逐条判断是否有 wiki 词条 |

---

## 五、踩过的坑（复用知识）

| 坑 | 教训 |
|---|---|
| PowerShell 里用相对路径写文件 | 会落到 `D:\dsh`（.NET 进程 CWD ≠ PS 当前目录）。**一律用绝对路径** |
| `"反引号"` 在双引号字符串里 | 是转义符。JS 模板字符串内容要用单引号或 here-string |
| `write` 工具报 `ReplaceFileW EIO` | 文件被占用。改用 pwsh `FileStream` + **必须 `SetLength(0)`**，否则旧内容尾部残留 → 曾导致构建失败 |
| `import ... from './x.json'` | 纯 Node 需要 import attribute。**改成生成 `.js` 模块** |
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

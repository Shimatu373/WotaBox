# WotaBox

> 🌐 **在线使用**：<https://wotabox.pages.dev>
> 📦 **安卓安装包**：<https://github.com/Shimatu373/WotaBox/releases>
>
> ⚠️ 本项目**不使用 GitHub Pages**。`*.github.io` 地址无法运行 —— 仓库里只有源码，
> 能跑的产物需要 `npm run build` 生成，不在版本库里。

给 wota 艺打师的学习与练习工具箱。纯前端、离线可用，所有数据都存在你自己的设备上。

> 开发笔记、关键决策与踩坑记录见 [docs/PROJECT-MEMORY.md](docs/PROJECT-MEMORY.md)。

## 功能

| 模块 | 说明 |
|---|---|
| **节拍器** | 四八拍分组、三层重音（组头 / 八拍头 / 普通拍）、预备拍、屏幕常亮 |
| **音乐播放器** | 本地音频无缝 A-B 循环、0.5–1.5× 变速、导入即自动识别 BPM |
| **编排** | 把「歌曲片段 × 按顺序的副歌技」存成记录，一键复制成文本发给同伴 |
| **BPM 测试** | 自动分析（Web Audio 能量包络 + 自相关）与手动点拍两种方式 |
| **技图鉴** | **619 个技 / 52 个系列**，支持搜索、系列与难度筛选、跳转 wiki 原文 |
| **难度分级** | 每技名后一条色条（机制已就位）；**目前全部「待评定」，分类暂停**，见下文说明 |
| **收藏夹** | 自定义分组 + 三档掌握状态（未掌握 / 已习得 / 已上手），另有只读的「个人技池」 |
| **数据备份** | 一键导出 / 导入全部本地数据，导入可撤销 |
| **视频对比器** | 两个本地视频**共用一条时间轴**（同步播放 / 拖拽 / 逐帧），0.1–2× 变速、左右镜像与上下翻转、B 相对 A 按帧微调对齐 |

节拍器与音乐播放器共用同一个 `AudioContext`，所以可以**同时播放原曲和节拍**。

## 关于技的分类（当前：暂停中）

技图鉴里为每个技预留了**技类型**（关西 / 火把 / 综合）和**难度**（基础 / 进阶 / 专家 / 大师）两个维度，
界面上表现为**技名后面的一条小色条**。

**这两个维度目前全部是「待确认」/「待评定」，尚未开始正式分类。**

原因：社团内部对判定口径存在分歧 —— 同一个技，不同打师给出的类型和难度并不一致，
而这两项又直接影响「新手该从哪个技入门」这种实用的判断。在没有可靠的分类信源之前，
与其给出一个看起来权威、实际各说各话的档位，不如先空着。

**恢复条件**：等到可靠的分类信源之后重新进行 —— 例如官方分级、社团统一的评审记录，
或教学机构成体系的标准。届时会在 `src/data/difficulty.js` 里逐条录入，
并在这个 README 里公布对应的判定口径。

> 现在所有技都显示比背景略亮的灰条：**留白 ≠ 最低档**，它表示「还没评」。


## 技术栈

Vue 3 + Vite。无后端、无账号、无网络请求（除点击跳转 wiki 外）。

- 音频：Web Audio API（`AudioBufferSourceNode` 做采样级精确循环，避免 `<audio>` 的接缝）
- 计时：前瞻调度（lookahead scheduling），不用 `setInterval` 直接发声，避免累积漂移
- 存储：`localStorage`
- 安装：PWA（manifest + Service Worker，离线可用）

## 快速开始

```bash
npm install
npm run dev      # 开发服务器，5173
npm run build    # 打包到 dist/
npm run preview  # 预览生产版本，4173
```

## 在手机上打开

开发时用 `npm run dev` 打印的 `Network` 地址即可（手机与电脑需在同一局域网）。

⚠️ 注意：**局域网 HTTP 不是安全上下文**，Service Worker 无法注册，因此安卓 Chrome 不会给出安装入口。想真正「装到桌面」需要 HTTPS 或 localhost，例如：

- 用 `cloudflared tunnel --url http://localhost:4173` 临时开一条 HTTPS 隧道
- 或部署到任意支持 HTTPS 的静态托管
- iOS 不受此限制，Safari「分享 → 添加到主屏幕」即可

## 目录结构

```
src/
├─ components/      各功能面板（每个都是可折叠卡片）
├─ composables/     音频、播放、收藏夹、编排、备份等逻辑
└─ data/            技数据（手写 curated + wiki 批量导入）
```

加一个新功能 = 新增 `components/XxxPanel.vue`，用 `<CollapsibleCard>` 包一层，挂到 `App.vue`。

## 开发脚本

```bash
node scripts/test-bpm.mjs    # BPM 自动分析准确度（合成鼓点轨）
node scripts/test-tap.mjs    # 手动点拍逻辑
node scripts/test-data.mjs   # 技数据完整性（重复 id / 非法类型 / 非法难度档位）
node scripts/report-meta.mjs # 元数据覆盖率（按系列看作成者/视频缺口）
node scripts/export-unclassified.mjs  # 导出未分类技清单（给社团分工填系列）
```

## 数据与隐私

收藏夹、编排、设置全部存在浏览器 `localStorage` 里，不上传任何服务器。清理浏览器数据会导致丢失，建议定期用「数据备份」导出。

- **技名与译名**：来自 [中文WOTA艺wiki](https://wotagei.huijiwiki.com/) 的「分类:技」
- **作成者 / 参考视频 / 要点**：从 wiki 词条原文（`action=raw`）解析而来
- **系列**：wiki 标注的系列 + 按命名归族整理，非官方分类
- **技类型 / 难度**：wiki 没有这两个维度；**当前未分类**，等可靠分类信源后重新进行

## 部署

已部署在 Cloudflare Pages：<https://wotabox.pages.dev>

```bash
npm run deploy   # 构建并发布到 Cloudflare Pages
```

首次使用需要 `npx wrangler login` 授权一次。

## 待开发

- 全国光棒地图
- 「你知道吗」小知识

## 项目状态

开发中，接口与数据结构仍在变动。
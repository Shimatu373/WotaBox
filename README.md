# WotaBox

给 wota 艺打师的学习与练习工具箱。纯前端、离线可用，所有数据都存在你自己的设备上。

## 功能

| 模块 | 说明 |
|---|---|
| **节拍器** | 四八拍分组、三层重音（组头 / 八拍头 / 普通拍）、预备拍、屏幕常亮 |
| **音乐播放器** | 本地音频无缝 A-B 循环、0.5–1.5× 变速、导入即自动识别 BPM |
| **编排** | 把「歌曲片段 × 按顺序的副歌技」存成记录，一键复制成文本发给同伴 |
| **BPM 测试** | 自动分析（Web Audio 能量包络 + 自相关）与手动点拍两种方式 |
| **技图鉴** | 275 个技 / 14 个系列，支持搜索、系列筛选、跳转 wiki 原文 |
| **收藏夹** | 自定义分组 + 三档掌握状态（未掌握 / 已习得 / 已上手） |
| **数据备份** | 一键导出 / 导入全部本地数据，导入可撤销 |

节拍器与音乐播放器共用同一个 `AudioContext`，所以可以**同时播放原曲和节拍**。

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
node scripts/test-data.mjs   # 技数据完整性（重复 id / 非法类型）
```

## 数据与隐私

收藏夹、编排、设置全部存在浏览器 `localStorage` 里，不上传任何服务器。清理浏览器数据会导致丢失，建议定期用「数据备份」导出。

技数据中的名称与译名来自 [中文WOTA艺wiki](https://wotagei.huijiwiki.com/)，其余元数据由使用者补充。

## 待开发

- 全国光棒地图
- 视频对比器
- 「你知道吗」小知识

## 项目状态

开发中，接口与数据结构仍在变动。
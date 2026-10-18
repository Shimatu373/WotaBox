# WOTA 工具箱

给 wota 艺打师的学习与练习助手。技术栈：Vue 3 + Vite（PWA）。

## 已实现

### 节拍器 v0.2.0

- BPM **40–220** 可调，滑块 + `±5` 微调
- **四个八拍（32 拍）为一组**循环，契合副歌技的常见结构
- **预备拍**：开始前先数 4 拍或 8 拍（低音"嗒"，660 Hz），数完立刻进入正式循环。8 拍正好一个八拍，更贴近实际练习习惯
- **三层重音**，帮助新手抓住节奏骨架：

  | 层级 | 位置 | 音高 | 说明 |
  |---|---|---|---|
  | 组头 | 每组第 1 拍（0/32） | 1760 Hz | 最响，标记一组四个八拍的循环起点 |
  | 八拍头 | 每 8 拍起始（8/16/24 拍） | 1318 Hz | 新手最容易丢的位置，可单独开关 |
  | 普通拍 | 其余 24 拍 | 880 Hz | 撑住节奏骨架 |

- **4×8 网格可视化**：4 行 = 4 个八拍，每行 8 个点，实时高亮当前拍；预备拍阶段网格变暗并显示大号倒数
- 运行时**自动保持屏幕常亮**（Screen Wake Lock API），练到一半不会黑屏
- 音频采用 **Web Audio 前瞻调度**（lookahead scheduling），不用 `setInterval` 直接发声 —— 后者有累积漂移，会让节拍"散掉"

### 界面

- 每个功能面板都是**可折叠卡片**：点标题栏展开 / 收起，展开状态记在 `localStorage` 里，下次打开保持原样
- 折叠时标题栏右侧仍显示关键状态（如 `120 BPM · 运行中`）

### PWA v0.3.0

- **可安装**：安卓 Chrome「安装应用」/ iOS Safari「添加到主屏幕」，装完是独立窗口，没有浏览器地址栏
- **离线可用**：Service Worker 采用 **网络优先 + 缓存兜底**，在线永远拿最新内容，断网时用上次缓存的版本
- **图标**：`public/icons/` 下四套（192 / 512 / maskable / apple-touch），由 `scripts/gen-icons.py` 用 Pillow 生成
- **安全区适配**：`env(safe-area-inset-*)` 避开刘海和手势条
- 主题色 `#0b1020`，启动画面与 App 背景同色，不会闪白

## 常用命令

```powershell
npm run dev      # 开发服务器（端口 5173，热更新）
npm run build    # 打包到 dist/
npm run preview  # 预览生产版本（端口 4173）—— 测 PWA 必须用这个
```

> ⚠️ **Service Worker 只在生产构建里注册**，所以 `npm run dev`（5173）上不会出现「安装应用」提示，这是故意的 —— 避免开发时缓存干扰热更新。要测安装和离线，请用 `npm run build` + `npm run preview`（4173）。

两个服务器都会打印 `Network:` 地址，手机用那行。

> PATH 问题已通过 `fix-path-admin.ps1` 修复（机器级 PATH 里损坏的 `C:\Program Files\dotnet"` 条目会截断后续搜索），修好后新开的终端直接可用 node / npm。

## 手机上测试

1. 手机和电脑在同一网络（校园网有 AP 隔离时，用电脑开移动热点让手机连接）
2. 电脑防火墙弹窗时勾选「专用网络」并允许
3. 手机浏览器打开 `Network` 那行的地址

### 安装到主屏幕

- **安卓 Chrome**：地址栏右侧出现「安装」图标，或菜单 →「安装应用 / 添加到主屏幕」
- **iOS Safari**：底部「分享」→「添加到主屏幕」
- **iOS 必须用 Safari**，Chrome for iOS 不支持安装

### 验证离线

装好之后：打开飞行模式 → 点击桌面图标 → 应该仍能正常打开并出声。

## 重新生成图标

```powershell
python scripts/gen-icons.py
```

改配色就编辑脚本顶部的 `BG` / `BLUE` / `CYAN`。

## 目录结构

```
wota-toolbox/
├─ index.html                 PWA meta 标签在这里
├─ vite.config.js             dev 5173 / preview 4173，均开 host
├─ fix-path-admin.ps1         机器级 PATH 修复脚本（管理员运行，已执行过）
├─ dev.cmd                    免权限备用启动器
├─ scripts/
│  └─ gen-icons.py            图标生成脚本（Pillow）
├─ public/                    原样拷贝到 dist 根目录
│  ├─ manifest.json           PWA 清单
│  ├─ sw.js                   Service Worker（网络优先 + 缓存）
│  ├─ favicon.svg
│  └─ icons/                  192 / 512 / maskable / apple-touch
└─ src/
   ├─ main.js                 应用入口 + SW 注册
   ├─ App.vue                 页面骨架
   ├─ style.css               全局变量 + 通用卡片 + 安全区
   ├─ components/
   │  ├─ CollapsibleCard.vue  可折叠卡片容器
   │  └─ MetronomePanel.vue   节拍器界面
   └─ composables/
      └─ useMetronome.js      节拍器核心（Web Audio 调度）
```

## 设计约定

- **加新功能 = 新增一个 `components/XxxPanel.vue`**，内部用 `<CollapsibleCard>` 包一层，再在 `App.vue` 里挂上即可
- 涉及音频 / 计时的复杂逻辑放 `composables/`，界面只管显示
- 颜色用 `style.css` 里的 CSS 变量，别写死
- 折叠状态持久化键名：`wota:panel:<id>`
- 改了 `public/` 下的东西要重新 `npm run build` 才会进 dist

## 待办

- [x] 阶段 0：环境跑通、手机能打开页面
- [x] 阶段 1：节拍器（四八拍分组 + 三层重音）
- [x] 阶段 2：预备拍 + 面板折叠
- [x] 阶段 3：PWA 化（图标 / 清单 / 离线 / 安装）
- [x] 阶段 4：技图鉴（搜索 + 系列筛选 + 展开详情）
- [x] 阶段 5：收藏夹（自定义分组 + 三档掌握状态）
- [ ] 阶段 6：全国光棒地图
- [ ] 阶段 7：视频对比器
- [ ] 阶段 8：BPM 测试
- [ ] 阶段 9：「你知道吗」小知识
- [ ] 阶段 10：数据导出 / 导入备份
- [ ] 阶段 11：打包成 APK 发给社团

## 星沫的留言

连上以太网后运行：Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq '以太网' } | Select-Object IPAddress
获取dev服务器的IP
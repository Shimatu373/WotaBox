# WOTA 工具箱

给 wota 艺打师的学习与练习助手。技术栈：Vue 3 + Vite（网页 / PWA 优先，后续可用 Capacitor 打包成安卓 APK）。

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

## 常用命令

```powershell
npm run dev      # 启动开发服务器（已配置 host，局域网可访问）
npm run build    # 打包到 dist/
npm run preview  # 预览打包结果
```

启动后终端会打印两行地址：

- `Local:   http://localhost:5173/`
- `Network: http://192.168.x.x:5173/` ← **手机用这个**

> PATH 问题已通过 `fix-path-admin.ps1` 修复（机器级 PATH 里损坏的 `C:\Program Files\dotnet"` 条目会截断后续搜索），修好后新开的终端直接可用 node / npm。

## 手机上测试

1. 手机和电脑在同一网络（校园网有 AP 隔离时，用电脑开移动热点让手机连接）
2. 电脑防火墙弹窗时勾选「专用网络」并允许
3. 手机浏览器打开 `Network` 那行的地址

## 目录结构

```
wota-toolbox/
├─ index.html                 页面入口（title / viewport 在这里）
├─ vite.config.js             Vite 配置（已开 host，手机可访问）
├─ fix-path-admin.ps1         机器级 PATH 修复脚本（管理员运行，已执行过）
├─ dev.cmd                    免权限备用启动器
└─ src/
   ├─ main.js                 应用入口
   ├─ App.vue                 页面骨架
   ├─ style.css               全局样式变量 + 通用卡片样式
   ├─ components/
   │  ├─ CollapsibleCard.vue  可折叠卡片容器（标题 / 摘要 / 状态记忆）
   │  └─ MetronomePanel.vue   节拍器界面
   └─ composables/
      └─ useMetronome.js      节拍器核心（Web Audio 调度逻辑）
```

## 设计约定

- **加新功能 = 新增一个 `components/XxxPanel.vue`**，内部用 `<CollapsibleCard>` 包一层，再在 `App.vue` 里挂上即可
- 涉及音频 / 计时的复杂逻辑放 `composables/`，界面只管显示
- 颜色用 `style.css` 里的 CSS 变量，别写死
- 折叠状态持久化键名：`wota:panel:<id>`

## 待办

- [x] 阶段 0：环境跑通、手机能打开页面
- [x] 阶段 1：节拍器（四八拍分组 + 三层重音）
- [x] 阶段 2：预备拍 + 面板折叠
- [ ] 阶段 3：节奏跟拍 / 节拍偏差提示？
- [ ] 阶段 4：打包成 APK 发给社团
- [ ] PWA 化：manifest + 图标 + 添加到主屏幕

## 星沫的留言

连上以太网后运行：Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -eq '以太网' } | Select-Object IPAddress
获取dev服务器的IP
# WOTA 工具箱

给 wota 艺打师的学习与练习助手。技术栈：Vue 3 + Vite（网页 / PWA 优先，后续可用 Capacitor 打包成安卓 APK）。

## 常用命令

```powershell
# 先确保 node 能被 cmd 找到（每个新终端窗口都要执行一次，见下方说明）
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

npm run dev      # 启动开发服务器（已配置 host，局域网可访问）
npm run build    # 打包到 dist/
npm run preview  # 预览打包结果
```

启动后终端会打印两行地址：
- `Local:   http://localhost:5173/`
- `Network: http://192.168.x.x:5173/`  ← **手机用这个**

## 手机上测试

1. 手机和电脑连同一个 Wi-Fi
2. 电脑防火墙弹窗时勾选「专用网络」并允许
3. 手机浏览器打开 `Network` 那行的地址

## 目录结构

```
wota-toolbox/
├─ index.html          页面入口（title / viewport 在这里）
├─ vite.config.js      Vite 配置（已开 host，手机可访问）
├─ src/
│  ├─ main.js          应用入口
│  ├─ App.vue          主界面（当前是阶段 0 的占位页）
│  └─ style.css        全局样式变量
└─ package.json
```

## 待办

- [ ] 阶段 0：环境跑通、手机能打开页面
- [ ] 阶段 1：核心功能 1 —— ？
- [ ] 阶段 2：打包成 APK 发给社团
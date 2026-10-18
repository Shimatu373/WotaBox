import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // host: true 让开发服务器监听局域网，手机才能访问
    host: true,
    port: 5173,
    // 允许通过 cloudflared / ngrok 之类的隧道域名访问（防止 Host 校验 403）
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
  },
  preview: {
    // npm run preview 也要能手机访问（PWA 需要在生产构建下测试）
    host: true,
    port: 4173,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
  },
})
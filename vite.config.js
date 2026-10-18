import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // host: true 让开发服务器监听局域网，手机才能访问
    host: true,
    port: 5173,
  },
  preview: {
    // npm run preview 也要能手机访问（PWA 需要在生产构建下测试）
    host: true,
    port: 4173,
  },
})
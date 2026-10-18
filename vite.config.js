import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// host: true 让开发服务器监听局域网，手机才能访问
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
  },
})
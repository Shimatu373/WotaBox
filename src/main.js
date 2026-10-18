import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')

// 只在打包后的生产版本启用 Service Worker。
// 开发时（npm run dev）不注册，避免缓存干扰热更新。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[pwa] Service Worker 注册失败：', err)
    })
  })
}

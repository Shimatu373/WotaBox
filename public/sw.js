/**
 * WOTA 工具箱 Service Worker
 *
 * 策略：网络优先（network-first），失败时回退到缓存。
 *   - 在线时永远拿最新内容，不会出现"改了代码但手机上还是旧的"
 *   - 断网 / 弱网时用上次缓存的版本，保证离线也能打开
 *   - 首次访问必须联网（要先把资源缓存下来）
 *
 * 升级缓存版本时改 CACHE 名字即可，旧缓存会在 activate 时清掉。
 */

const CACHE = 'wota-v1'
const ENTRY = '/'

self.addEventListener('install', (event) => {
  // 新版本立刻进入等待结束状态
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(ENTRY))
      .catch(() => {
        /* 首次预缓存失败不影响后续运行时缓存 */
      })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // 只处理同源 GET
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 只缓存成功的完整响应
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // 导航请求兜底到应用入口，避免离线时白屏
        if (request.mode === 'navigate') {
          const entry = await caches.match(ENTRY)
          if (entry) return entry
        }
        return new Response('离线状态，且没有缓存副本。', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
  )
})

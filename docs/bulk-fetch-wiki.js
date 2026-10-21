/**
 * 在浏览器控制台里跑：把中文WOTA艺wiki「分类:技」的全部正文抓成一个 JSON 下载下来。
 *
 * 为什么要在浏览器里跑：wiki 对本地脚本一律 403（Cloudflare 挑战，cf_clearance 是
 * HttpOnly，控制台里 document.cookie 也读不到）。但**页面内的 fetch 是同源的**，
 * 自带会话和风控指纹，所以能通。
 *
 * 用法：
 *   1. 打开 https://wotagei.huijiwiki.com/wiki/分类:技 （或任意 wiki 页面）
 *   2. F12 → Console → 粘贴本文件全部内容 → 回车
 *   3. 等它打印「已导出」，会下载 wiki-pages.json（约 300–500 KB）
 *   4. 把文件放到 D:\wota-toolbox\data\wiki-pages.json
 *   5. 回来告诉 Deepseek，由本地脚本离线入库
 */
;(async () => {
  const api = '/api.php'
  const log = (...a) => console.log('[wotabox]', ...a)

  // 1) 取「分类:技」全部成员（618 条左右，2 页）
  const titles = []
  let cont = ''
  do {
    const u =
      `${api}?action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:技')}` +
      `&cmlimit=500&format=json&formatversion=2` +
      (cont ? `&cmcontinue=${encodeURIComponent(cont)}` : '')
    const j = await (await fetch(u, { headers: { Accept: 'application/json' } })).json()
    for (const m of j.query.categorymembers) if (m.ns === 0) titles.push(m.title)
    cont = (j.continue && j.continue.cmcontinue) || ''
    log('成员累计', titles.length)
  } while (cont)

  // 2) 分批取正文（每批 50 条，带节流，避免触发风控）
  const pages = {}
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const u =
      `${api}?action=query&prop=revisions&rvprop=content&rvslots=main` +
      `&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`
    let ok = false
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const r = await fetch(u, { headers: { Accept: 'application/json' } })
        if (!r.ok) {
          log('批次 HTTP', r.status, `第 ${attempt} 次，等一下重试`)
          await new Promise((s) => setTimeout(s, 2000 * attempt))
          continue
        }
        const j = await r.json()
        for (const p of j.query.pages) {
          const c = p.missing ? null : p.revisions && p.revisions[0] && p.revisions[0].slots.main.content
          if (c) pages[p.title] = c
        }
        ok = true
      } catch (e) {
        log('批次异常', e.message, `第 ${attempt} 次`)
        await new Promise((s) => setTimeout(s, 2000 * attempt))
      }
    }
    log('正文累计', Object.keys(pages).length, '/', titles.length)
    await new Promise((s) => setTimeout(s, 400))
  }

  // 3) 导出
  const blob = new Blob([JSON.stringify(pages)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'wiki-pages.json'
  a.click()
  log('已导出 wiki-pages.json，共', Object.keys(pages).length, '页')
  console.log('[wotabox] 把文件放到 D:\\wota-toolbox\\data\\wiki-pages.json，然后回来告诉 Deepseek')
})()

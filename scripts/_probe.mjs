const api = 'https://wotagei.huijiwiki.com/api.php?action=query&list=categorymembers&cmtitle=' +
  encodeURIComponent('Category:技') + '&cmlimit=10&format=json'

for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'WotaToolbox/0.6']) {
  try {
    const res = await fetch(api, { headers: { 'User-Agent': ua, Accept: 'application/json' } })
    const text = await res.text()
    console.log(`UA="${ua.slice(0, 20)}..." -> HTTP ${res.status}, 长度 ${text.length}`)
    if (res.ok) {
      try {
        const j = JSON.parse(text)
        const list = j.query?.categorymembers || []
        console.log('  解析成功，返回条目:', list.length)
        console.log('  样例:', list.slice(0, 5).map((x) => x.title).join(' | '))
      } catch { console.log('  非 JSON:', text.slice(0, 120)) }
    }
  } catch (e) {
    console.log('FAILED:', e.message)
  }
}

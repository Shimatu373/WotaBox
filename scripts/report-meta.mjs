import { WAZA } from '../src/data/waza.js'
import WIKI_META from '../src/data/wiki-meta.js'

const withCreator = WAZA.filter((w) => w.creator).length
const withVideos = WAZA.filter((w) => w.videos?.length).length
console.log(`总技数 ${WAZA.length} | 有作成者 ${withCreator} | 有视频 ${withVideos} | wiki 命中 ${Object.keys(WIKI_META).length}`)

const bySeries = new Map()
for (const w of WAZA) {
  const k = w.series || '未分类'
  if (!bySeries.has(k)) bySeries.set(k, [])
  bySeries.get(k).push(w)
}

console.log('\n=== 按系列 ===')
for (const [s, list] of [...bySeries.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const c = list.filter((w) => w.creator).length
  const v = list.filter((w) => w.videos?.length).length
  console.log(`${s.padEnd(10)} 共${String(list.length).padStart(3)} | 作成者${String(c).padStart(3)} | 视频${String(v).padStart(3)}`)
}

console.log('\n=== 缺元数据的技（按系列）===')
for (const [s, list] of [...bySeries.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const missing = list.filter((w) => !w.creator && !w.videos?.length)
  if (!missing.length) continue
  console.log(`\n[${s}] 缺 ${missing.length} 条`)
  for (const w of missing) console.log(`  ${w.nameJa}  ⟶ wiki 标题: ${w.wiki}`)
}

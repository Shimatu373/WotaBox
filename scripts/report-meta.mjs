/**
 * 元数据覆盖率报告：按系列统计作成者/视频缺口。
 * 元数据在分块里，所以这里异步全量加载（见 lib-wiki-meta.mjs）。
 *
 * 用法：node scripts/report-meta.mjs
 */
import { WAZA } from '../src/data/waza.js'
import { loadAllMeta } from './lib-wiki-meta.mjs'

const META = await loadAllMeta()
const detailOf = (w) => META[w.nameJa] || {}

const withCreator = WAZA.filter((w) => w.creator || detailOf(w).creator).length
const withVideos = WAZA.filter((w) => w.videos?.length || detailOf(w).videos?.length).length
console.log(`总技数 ${WAZA.length} | 有作成者 ${withCreator} | 有视频 ${withVideos} | wiki 命中 ${Object.keys(META).length}`)

const bySeries = new Map()
for (const w of WAZA) {
  const k = w.series || '未分类'
  if (!bySeries.has(k)) bySeries.set(k, [])
  bySeries.get(k).push(w)
}

console.log('\n=== 按系列 ===')
for (const [s, list] of [...bySeries.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const c = list.filter((w) => w.creator || detailOf(w).creator).length
  const v = list.filter((w) => w.videos?.length || detailOf(w).videos?.length).length
  console.log(`${s.padEnd(10)} 共${String(list.length).padStart(3)} | 作成者${String(c).padStart(3)} | 视频${String(v).padStart(3)}`)
}

const missing = WAZA.filter(
  (w) => !w.creator && !detailOf(w).creator && !w.videos?.length && !detailOf(w).videos?.length,
)
console.log(`\n=== 既没作成者也没视频：${missing.length} 条 ===`)
for (const w of missing.slice(0, 40)) console.log('  ' + w.nameJa)
if (missing.length > 40) console.log(`  … 另有 ${missing.length - 40} 条`)

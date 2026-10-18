import { WAZA, TYPE_DEF, allSeries, wikiUrl } from '../src/data/waza.js'

let bad = 0
const ids = new Set()
for (const w of WAZA) {
  if (ids.has(w.id)) { console.log('重复 id:', w.id, w.nameJa); bad++ }
  ids.add(w.id)
  if (w.type && !TYPE_DEF[w.type]) { console.log('非法 type:', w.nameJa, w.type); bad++ }
  if (!w.nameJa) { console.log('缺日文名'); bad++ }
}

const series = allSeries()
console.log(`技总数: ${WAZA.length}`)
console.log(`系列数: ${series.length - (series.includes('未分类') ? 1 : 0)} + 未分类`)
console.log('')
for (const s of series) {
  const n = WAZA.filter((w) => (w.series || '未分类') === s).length
  console.log(`  ${s.padEnd(8)} ${String(n).padStart(3)} 个`)
}
console.log('')
console.log('类型分布:', ['kansai', 'huoba', 'mixed'].map((k) => `${TYPE_DEF[k].label} ${WAZA.filter((w) => w.type === k).length}`).join(' / '), `/ 待确认 ${WAZA.filter((w) => !w.type).length}`)
console.log('示例 wiki 链接:', wikiUrl(WAZA[2].wiki))
console.log('')
console.log(bad === 0 ? 'OK 数据校验通过' : `FAIL ${bad} 处问题`)
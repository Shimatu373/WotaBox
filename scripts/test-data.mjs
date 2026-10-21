import { WAZA, TYPE_DEF, allSeries, wikiUrl } from '../src/data/waza.js'
import { DIFFICULTY_DEF, DIFFICULTY_ORDER } from '../src/data/difficulty.js'

let bad = 0
const ids = new Set()
for (const w of WAZA) {
  if (ids.has(w.id)) { console.log('重复 id:', w.id, w.nameJa); bad++ }
  ids.add(w.id)
  if (w.type && !TYPE_DEF[w.type]) { console.log('非法 type:', w.nameJa, w.type); bad++ }
  // 难度写错（比如写成 'hard'）会静默退化成「待评定」，这里拦住
  if (w.difficulty && !DIFFICULTY_DEF[w.difficulty]) { console.log('非法 difficulty:', w.nameJa, w.difficulty); bad++ }
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
console.log(
  '难度分布:',
  DIFFICULTY_ORDER.map((k) => `${DIFFICULTY_DEF[k].label} ${WAZA.filter((w) => w.difficulty === k).length}`).join(' / '),
  `/ 待评定 ${WAZA.filter((w) => !w.difficulty).length}`,
)
console.log('示例 wiki 链接:', wikiUrl(WAZA[2].wiki))
console.log('')
console.log(bad === 0 ? 'OK 数据校验通过' : `FAIL ${bad} 处问题`)
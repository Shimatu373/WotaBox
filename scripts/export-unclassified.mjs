/**
 * 导出「未分类技」清单给社团分工整理。
 *
 * 输出：docs/未分类技-待归类.csv
 *   - UTF-8 **带 BOM**（Excel 直接双击打开不会乱码）
 *   - 列：日文名 / 中文译名 / wiki 系列名 / 作成者 / 建议系列（留给人工填）/ wiki 链接
 *
 * 用法：node scripts/export-unclassified.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WAZA, wikiUrl } from '../src/data/waza.js'
import { loadAllMeta } from './lib-wiki-meta.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'docs', '未分类技-待归类.csv')

const META = await loadAllMeta()

const rows = WAZA.filter((w) => !w.series).sort(
  (a, b) => (META[a.nameJa]?.seriesJa || '\uffff').localeCompare(META[b.nameJa]?.seriesJa || '\uffff', 'ja') || a.nameJa.localeCompare(b.nameJa, 'ja'),
)

const esc = (s) => {
  const v = String(s ?? '')
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

const lines = []
lines.push('日文名,中文译名,wiki系列名,作成者,建议系列（请填写）,wiki链接')
for (const w of rows) {
  const meta = META[w.nameJa] || {}
  lines.push(
    [w.nameJa, w.nameZh || '', meta.seriesJa || '', meta.creator || '', '', wikiUrl(w.wiki)].map(esc).join(','),
  )
}

mkdirSync(dirname(OUT), { recursive: true })
// BOM：让 Excel 认出 UTF-8
writeFileSync(OUT, '\ufeff' + lines.join('\r\n') + '\r\n', 'utf8')

const withSeriesHint = rows.filter((w) => META[w.nameJa]?.seriesJa).length
console.log(`未分类 ${rows.length} 条 → ${OUT}`)
console.log(`  其中 ${withSeriesHint} 条 wiki 上有「系列名」字段（多半是独苗，可参考）`)
console.log(`  ${rows.length - withSeriesHint} 条 wiki 也没写系列名，需要靠领域知识判断`)

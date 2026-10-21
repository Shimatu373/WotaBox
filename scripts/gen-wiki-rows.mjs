/**
 * 把 wiki-raw.jsonl 里「我们还没有的技」自动生成成 ROWS，写进 src/data/waza-wiki-extra.js。
 *
 * 只生成能确定的部分：日文名（标题里 〈〉 之前）+ 中文译名（〈〉 里）+ 系列 null。
 * 系列一律留 null（未分类）——wiki 的「系列名」字段和我们的系列口径不完全一致，
 * 硬塞会造出假分类，宁可留着让人工归类。
 *
 * 用法：node scripts/gen-wiki-rows.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WAZA } from '../src/data/waza.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const RAW = join(ROOT, 'data', 'wiki-raw.jsonl')
const OUT = join(ROOT, 'src', 'data', 'waza-wiki-extra.js')

const recs = readFileSync(RAW, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))

const known = new Set(WAZA.map((w) => w.nameJa))
const jsStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

const rows = []
for (const r of recs) {
  const title = String(r.title || '').trim()
  if (!title) continue
  const nameJa = String(r.name || title.replace(/〈[^〉]*〉/g, '')).trim()
  if (!nameJa || known.has(nameJa)) continue
  const m = title.match(/〈([^〉]*)〉/)
  // 标题里可能有嵌套〈〉（如「ドクターペッパー〈胡椒博士〈Dr.Pepper〉〉」），取最外层的第一个
  const nameZh = m ? m[1].split('〈')[0].trim() : ''
  rows.push({ nameJa, nameZh, wiki: title })
  known.add(nameJa)
}

const body =
  '/**\n' +
  ' * 自动生成：node scripts/gen-wiki-rows.mjs —— 请勿手改\n' +
  ' * 来源：data/wiki-raw.jsonl 里「还不存在于 waza.js / waza-imported.js」的词条\n' +
  ' * 只写能确定的事实：日文名、标题里的中文译名、wiki 标题；系列/类型/难度一律留空。\n' +
  ' */\n\n' +
  'export const WIKI_ADDED = [\n' +
  rows.map((r) => `  [${jsStr(r.nameJa)}, ${r.nameZh ? jsStr(r.nameZh) : 'null'}, null, null],`).join('\n') +
  (rows.length ? '\n' : '') +
  ']\n\n' +
  'export const WIKI_ADDED_TITLES = {\n' +
  rows.map((r) => `  ${jsStr(r.nameJa)}: ${jsStr(r.wiki)},`).join('\n') +
  (rows.length ? '\n' : '') +
  '}\n\n' +
  'export default WIKI_ADDED\n'

writeFileSync(OUT, body, 'utf8')
console.log(`新技 ${rows.length} 条 → ${OUT}`)
if (rows.length) console.log('前 5 条：' + rows.slice(0, 5).map((r) => `${r.nameJa}(${r.nameZh || '—'})`).join(' / '))

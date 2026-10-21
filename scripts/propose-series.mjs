/**
 * 系列半自动归类：用 wiki 的「系列名」字段给未分类的技找归属。
 *
 * 规则（保守优先）：
 *  - 只处理 series 为空的技
 *  - 按 wiki 词条的 |系列名= 分组；**组内 ≥ 2 条**才认定为系列（单条不成为系列）
 *  - 系列名规范化：已带「系」的原样用；不带「系」的补一个「系」（摩耶 → 摩耶系）
 *    这样能和 waza.js 里已有的系列名对齐，而不是另造一套
 *  - 组内作成者全部相同 → 顺手作为系列 origin；不一致 → 留空（不猜）
 *
 * 输出：
 *   src/data/series-auto.js   机器可用（waza.js 读取）
 *   docs/series-proposal.md   人看的提案表，供星沫确认/否决
 *
 * 用法：node scripts/propose-series.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WAZA } from '../src/data/waza.js'
import { SERIES_AUTO } from '../src/data/series-auto.js'
import { loadAllMeta } from './lib-wiki-meta.mjs'

const WIKI_META = await loadAllMeta()

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_JS = join(ROOT, 'src', 'data', 'series-auto.js')
const OUT_MD = join(ROOT, 'docs', 'series-proposal.md')

/** 简繁/异体字的归一：只用于**比较**，显示时仍用出现最多的那种写法 */
const SERIES_FOLD = {
  鹤: '鶴',
  龙: '龍',
  鸟: '鳥',
  兰: '蘭',
  纹: '紋',
  剑: '剣',
  华: '華',
  梦: '夢',
  阳: '陽',
  云: '雲',
  发: '發',
  炼: '煉',
  狱: '獄',
  万: '萬',
  无: '無',
  双: '雙',
}
function foldSeries(s) {
  return [...String(s)].map((c) => SERIES_FOLD[c] || c).join('')
}

/** wiki 系列名 → 我们的系列名 */
function normalizeSeries(sj) {
  const s = String(sj || '')
    .trim()
    // 有些页面把系列名包在装饰符号里：『黎明白刃』→ 黎明白刃
    .replace(/^[『「【]+|[』」】]+$/g, '')
    .trim()
  if (!s) return null
  // 彩色文字/符号堆出来的垃圾系列名：宁可不归类，也别造一个看不懂的系列
  if (/[⚖★☆♪♯]/.test(s) || s.length > 14) return null
  if (/系$/.test(s)) return s
  return s + '系'
}

// 先按「简繁归一后的名字」分组，组内再统计哪种写法出现得多 —— 显示时用多的那种
const rawGroups = new Map()
const noSeriesName = []
/** 已被「人」归类过（手写 ROWS / waza-imported / SERIES_OVERRIDE）的技 */
const handAssigned = (w) => Boolean(w.series) && !SERIES_AUTO[w.nameJa]

for (const w of WAZA) {
  // 注意：本脚本的产物会被 waza.js 消费，所以必须把自己上一轮写的系列当成「未归类」，
  // 否则第二次运行会认为都归好了 → 清空文件（自噬）。
  if (handAssigned(w)) continue
  const meta = WIKI_META[w.nameJa] || {}
  const sj = normalizeSeries(meta.seriesJa)
  if (!sj) {
    noSeriesName.push(w.nameJa)
    continue
  }
  const fold = foldSeries(sj)
  if (!rawGroups.has(fold)) rawGroups.set(fold, new Map())
  const variants = rawGroups.get(fold)
  if (!variants.has(sj)) variants.set(sj, [])
  variants.get(sj).push(w)
}

// fold → { series(显示名), list(合并后的成员) }
const groups = new Map()
for (const [fold, variants] of rawGroups) {
  let best = null
  for (const [name, list] of variants) {
    if (!best || list.length > best.list.length) best = { series: name, list }
  }
  // 把其它写法的成员并进来（简繁混用的情况：鹤望兰系 / 鶴望蘭系）
  const merged = []
  for (const [, list] of variants) merged.push(...list)
  groups.set(fold, { series: best.series, list: merged })
}

// 现有系列只看人手写的，避免把自动生成的也当「已有」
const existing = new Set(WAZA.filter(handAssigned).map((w) => w.series))
const existingFold = new Set([...existing].map(foldSeries))

const accepted = []
const singles = []
for (const [, g] of [...groups.entries()].sort((a, b) => b[1].list.length - a[1].list.length)) {
  if (g.list.length < 2) {
    singles.push([g.series, g.list])
    continue
  }
  const creators = new Set(g.list.map((w) => w.creator).filter(Boolean))
  const origin = creators.size === 1 ? [...creators][0] : null
  accepted.push({ series: g.series, list: g.list, origin, isNew: !existingFold.has(foldSeries(g.series)) })
}

// ---- 生成机器可用的映射 ----
const jsStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
const lines = []
lines.push('/**')
lines.push(' * 自动生成：node scripts/propose-series.mjs —— 请勿手改')
lines.push(' * 来源：未分类的技 + wiki 词条的「系列名」字段；组内 ≥2 条才成立一个系列。')
lines.push(' * 人工否决某个系列：把 SERIES_AUTO 里对应的一行删掉再重跑 build 即可。')
lines.push(' */')
lines.push('')
lines.push('/** 技名 → 系列名（只包含自动归类成功的） */')
lines.push('export const SERIES_AUTO = {')
for (const g of accepted) {
  for (const w of g.list) lines.push(`  ${jsStr(w.nameJa)}: ${jsStr(g.series)},`)
}
lines.push('}')
lines.push('')
lines.push('/** 自动成立的系列元信息（origin 仅在组内作成者一致时才填） */')
lines.push('export const SERIES_AUTO_INFO = {')
for (const g of accepted) {
  // 已有系列（瀧系、虚閃系…）的说明是手写的，别被自动生成的覆盖掉
  if (!g.isNew) continue
  const note = `wiki 的「系列名」字段归为「${g.series}」，本工具自动成组（${g.list.length} 条）`
  lines.push(`  ${jsStr(g.series)}: { origin: ${g.origin ? jsStr(g.origin) : 'null'}, note: ${jsStr(note)} },`)
}
lines.push('}')
lines.push('')
lines.push('export default SERIES_AUTO')
writeFileSync(OUT_JS, lines.join('\n') + '\n', 'utf8')

// ---- 生成给人看的提案 ----
const md = []
md.push('# 系列归类提案（自动生成）')
md.push('')
md.push('> 由 `node scripts/propose-series.mjs` 生成。依据是 wiki 词条的「系列名」字段，')
md.push('> 组内 ≥2 条才认定为一个系列，单条不构成系列。确认后就保留，否掉就把')
md.push('> `src/data/series-auto.js` 里对应行删掉再重跑构建。')
md.push('')
md.push(`- 未分类技总数：**${WAZA.filter((w) => !w.series).length}**`)
md.push(`- 自动成组：**${accepted.length}** 个系列，覆盖 **${accepted.reduce((n, g) => n + g.list.length, 0)}** 条技`)
md.push(`- 仍无法归类：**${noSeriesName.length + singles.reduce((n, s) => n + s[1].length, 0)}** 条（wiki 没写系列名，或该系列只有 1 条）`)
md.push('')
md.push('## 一、建议成立的系列')
md.push('')
md.push('| 系列 | 条数 | 组内作成者 | 是否新系列 | 成员 |')
md.push('|---|---|---|---|---|')
for (const g of accepted) {
  const who = g.origin ? g.origin : `不一致（${[...new Set(g.list.map((w) => w.creator).filter(Boolean))].join(' / ') || '未填'}）`
  md.push(`| ${g.series} | ${g.list.length} | ${who} | ${g.isNew ? '**是**' : '否（并入现有）'} | ${g.list.map((w) => w.nameJa).join('、')} |`)
}
md.push('')
md.push('## 二、只有 1 条、暂不成立的')
md.push('')
if (singles.length) {
  md.push('| wiki 系列名 | 那条技 |')
  md.push('|---|---|')
  for (const [sj, list] of singles) md.push(`| ${sj} | ${list.map((w) => w.nameJa).join('、')} |`)
} else {
  md.push('（无）')
}
md.push('')
md.push(`## 三、wiki 完全没写系列名的（${noSeriesName.length} 条）`)
md.push('')
md.push(noSeriesName.length ? noSeriesName.join('、') : '（无）')
md.push('')
writeFileSync(OUT_MD, md.join('\n'), 'utf8')

console.log(`自动成组 ${accepted.length} 个系列，覆盖 ${accepted.reduce((n, g) => n + g.list.length, 0)} 条技`)
for (const g of accepted) {
  console.log(`  ${g.series.padEnd(12)} ${String(g.list.length).padStart(3)} 条  ${g.isNew ? '[新]' : '[并入现有]'}  ${g.origin || '作成者不一致'}`)
}
console.log(`\n仍无法归类 ${noSeriesName.length + singles.reduce((n, s) => n + s[1].length, 0)} 条`)
console.log(`已写入 ${OUT_JS}\n已写入 ${OUT_MD}`)

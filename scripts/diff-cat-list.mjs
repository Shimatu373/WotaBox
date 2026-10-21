/**
 * 对比「wiki 分类:技 全量清单」和「我们已有的技」，输出还缺哪些。
 *
 * 输入：data/_wiki-cat-list.txt（一行一个 wiki 词条标题）
 * 输出：data/_missing-list.txt（只含缺失的，保持 wiki 顺序）
 *
 * 用法：node scripts/diff-cat-list.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WAZA } from '../src/data/waza.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const LIST = join(ROOT, 'data', '_wiki-cat-list.txt')
const OUT = join(ROOT, 'data', '_missing-list.txt')

if (!existsSync(LIST)) {
  console.error(`缺少清单：${LIST}`)
  process.exit(1)
}

/** 归一化：去掉 〈译名〉、装饰符号、异体字差异，用于比对 */
function key(s) {
  return String(s)
    .replace(/〈[^〉]*〉/g, '')
    .replace(/[\s·・.、,，]/g, '')
    .replace(/[「」【】〈〉]/g, '')
    .replace(/蔵/g, '藏')
    .replace(/ー/g, '')
    .toLowerCase()
    .trim()
}

/** 明显不是技的页面（模板示例、测试页） */
function isJunk(title) {
  return /^AAA/.test(title) || /示例|サンプル|テスト|test/i.test(title)
}

const titles = readFileSync(LIST, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)

const have = new Map()
for (const w of WAZA) {
  have.set(key(w.nameJa), w.nameJa)
  if (w.wiki) have.set(key(w.wiki), w.nameJa)
  if (w.nameZh) have.set(key(w.nameZh), w.nameJa)
}

const missing = []
const junk = []
const dupe = []
for (const title of titles) {
  if (isJunk(title)) {
    junk.push(title)
    continue
  }
  if (have.has(key(title))) {
    dupe.push(title)
    continue
  }
  missing.push(title)
}

writeFileSync(OUT, missing.join('\n') + '\n', 'utf8')
console.log(`wiki 清单 ${titles.length} 条`)
console.log(`  已有（含译名/别名匹配）${dupe.length} 条`)
console.log(`  明显非技页面（跳过）${junk.length} 条${junk.length ? '：' + junk.join(' / ') : ''}`)
console.log(`  **缺失 ${missing.length} 条** → 已写入 ${OUT}`)
if (missing.length) console.log('前 10 条：' + missing.slice(0, 10).join(' / '))

/**
 * 清理 data/wiki-raw.jsonl：去测试页 + 去「同一条技挂在多个标题下」。
 *
 * 触发场景：wiki 上有重名/改名的页面（半蔵門 ↔ 半藏門、JKスネイク 加了副名、
 * テラスネイク 标题改过），直接抓会得到两条同技记录，最后在 WIKI_META 里互相覆盖。
 *
 * 保留规则（按顺序）：
 *   1. 标题在「分类:技」当前清单里（data/_wiki-cat-list.txt）的优先 —— 那是权威标题
 *   2. 都在清单里时，保留正文更长的那条（改名前的旧页往往更短/更旧）
 *   3. 都不在清单里时保留后出现的
 *
 * 用法：node scripts/clean-wiki-raw.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const RAW = join(ROOT, 'data', 'wiki-raw.jsonl')
const CAT = join(ROOT, 'data', '_wiki-cat-list.txt')
const DRY = process.argv.includes('--dry')

const canonical = new Set()
if (existsSync(CAT)) {
  for (const line of readFileSync(CAT, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (t) canonical.add(t)
  }
}

const records = readFileSync(RAW, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))

const keyOf = (r) => String(r.name || String(r.title).replace(/〈[^〉]*〉/g, '')).trim()

// 1) 丢掉模板测试页
const junk = records.filter((r) => /^AAA/.test(String(r.title)) || /^AAA/.test(keyOf(r)))
const kept = records.filter((r) => !junk.includes(r))

// 2) 同名只留一条
const byKey = new Map()
for (const r of kept) {
  const k = keyOf(r)
  if (!byKey.has(k)) byKey.set(k, [])
  byKey.get(k).push(r)
}

const dropped = []
const droppedKeys = []
for (const [k, list] of byKey) {
  if (list.length <= 1) continue
  const inCat = list.filter((r) => canonical.has(String(r.title)))
  let winner
  if (inCat.length === 1) winner = inCat[0]
  else if (inCat.length > 1) winner = [...inCat].sort((a, b) => b.raw.length - a.raw.length)[0]
  else winner = list[list.length - 1]
  for (const r of list) {
    if (r === winner) continue
    dropped.push(r)
    droppedKeys.push(`${k}：丢掉「${r.title}」，保留「${winner.title}」`)
  }
}

const final = kept.filter((r) => !dropped.includes(r))

console.log(`原始 ${records.length} 条`)
console.log(`  测试页丢弃 ${junk.length} 条${junk.length ? '：' + junk.map((r) => r.title).join(' / ') : ''}`)
console.log(`  重复技名丢弃 ${dropped.length} 条：`)
for (const line of droppedKeys) console.log('    ' + line)
console.log(`  最终 ${final.length} 条`)

if (DRY) {
  console.log('\n--dry：未写回文件')
} else {
  writeFileSync(RAW, final.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8')
  console.log(`\n已写回 ${RAW}`)
}

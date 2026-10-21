/**
 * 把 _pages-*.txt（@@PAGE@@ 分块的「标题 + action=raw 原文」）并入 data/wiki-raw.jsonl
 * 用法：node scripts/_merge-raw.mjs data/_pages-snake.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const RAW_FILE = join(ROOT, 'data', 'wiki-raw.jsonl')
const src = process.argv[2]
if (!src) {
  console.error('用法：node scripts/_merge-raw.mjs <分块文件>')
  process.exit(1)
}

const blocks = readFileSync(src, 'utf8')
  .split(/^@@PAGE@@[ \t]*$/m)
  .map((s) => s.replace(/\r/g, '').trim())
  .filter(Boolean)

const lines = readFileSync(RAW_FILE, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
const store = new Map()
for (const l of lines) {
  const o = JSON.parse(l)
  store.set(o.title, o)
}

let added = 0
let updated = 0
for (const b of blocks) {
  const nl = b.indexOf('\n')
  // 块首行：TITLE 或 「TITLE<TAB>技名」（wiki 标题与内部技名不一致时用后者）
  const [title, key] = b
    .slice(0, nl)
    .trim()
    .split('\t')
    .map((s) => s.trim())
  const raw = b.slice(nl + 1).trim()
  if (!title || !raw) {
    console.warn(`跳过空块：${title || '(无标题)'}`)
    continue
  }
  if (!/\{\{技/.test(raw)) console.warn(`注意：${title} 的原文里没有 {{技 模板`)
  const rec = key ? { title, name: key, raw } : { title, raw }
  if (store.has(title)) {
    store.set(title, rec)
    updated++
  } else {
    store.set(title, rec)
    added++
  }
}

writeFileSync(RAW_FILE, [...store.values()].map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8')
console.log(`新增 ${added} 条，覆盖 ${updated} 条，jsonl 现有 ${store.size} 条`)

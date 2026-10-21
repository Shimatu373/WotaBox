/**
 * 吸收浏览器导出的 wiki 页面内容（data/wiki-pages.json，形如 { "标题": "action=raw 原文" }）。
 *
 * 为什么这么绕：wiki 站对本地脚本一律 403（Cloudflare 挑战，cf_clearance 是 HttpOnly），
 * 但**浏览器页面里 fetch 同源 api.php 是通的**（自带会话）。所以让浏览器把内容抓下来存成
 * JSON，再由本脚本离线入库 —— 正文完全不经过模型，几乎不花 token。
 *
 * 用法：
 *   1) 在 wiki 任意页面按 F12 → Console，粘贴 bulk-fetch 片段，会下载 wiki-pages.json
 *   2) 把文件放到 data/wiki-pages.json
 *   3) node scripts/absorb-wiki-json.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const IN = join(ROOT, 'data', 'wiki-pages.json')
const RAW = join(ROOT, 'data', 'wiki-raw.jsonl')

if (!existsSync(IN)) {
  console.error(`缺少 ${IN}`)
  console.error('先按提示在浏览器里跑 bulk-fetch 片段，把下载到的 wiki-pages.json 放到 data/ 下')
  process.exit(1)
}

const pages = JSON.parse(readFileSync(IN, 'utf8'))
const lines = readFileSync(RAW, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const store = new Map()
for (const l of lines) {
  const o = JSON.parse(l)
  store.set(o.title, o)
}
const before = store.size

let added = 0
let replaced = 0
let skippedNoTech = 0
let skippedEmpty = 0
const skipped = []

for (const [title, raw] of Object.entries(pages)) {
  const content = String(raw || '').trim()
  if (!content) {
    skippedEmpty++
    continue
  }
  if (!/\{\{技/.test(content)) {
    skippedNoTech++
    skipped.push(title)
    continue
  }
  if (store.has(title)) {
    if (store.get(title).raw !== content) {
      store.set(title, { ...store.get(title), raw: content })
      replaced++
    }
    continue
  }
  store.set(title, { title, raw: content })
  added++
}

writeFileSync(RAW, [...store.values()].map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8')

console.log(`浏览器导出 ${Object.keys(pages).length} 页`)
console.log(`  新增 ${added} 条 | 更新 ${replaced} 条 | 无 {{技 跳过 ${skippedNoTech} 条 | 空内容 ${skippedEmpty} 条`)
console.log(`  wiki-raw.jsonl：${before} → ${store.size} 条`)
if (skipped.length) console.log('  无 {{技 的（前 10）：' + skipped.slice(0, 10).join(' / '))
console.log('\n下一步：node scripts/gen-wiki-rows.mjs && node scripts/import-wiki-raw.mjs && node scripts/propose-series.mjs')

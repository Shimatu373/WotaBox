/**
 * wiki-raw.jsonl 一致性校验
 *
 * 主要防「标题/正文错配」：每块的 原= 应该等于标题〈〉前的部分（或 name 字段）。
 * 子代理批量抓取时最可能犯的错就是把 A 页的正文写到 B 的标题下，肉眼看不出，
 * 但一旦入库就是错的数据。
 *
 * 用法：node scripts/qa-wiki-raw.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const RAW_FILE = join(ROOT, 'data', 'wiki-raw.jsonl')

const lines = readFileSync(RAW_FILE, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())

/** 取 |原= 的值：要能扛住值里包含嵌套模板 {{...}} */
function pickOriginal(raw) {
  const idx = raw.search(/\|\s*原\s*=/)
  if (idx === -1) return ''
  let i = raw.indexOf('=', idx) + 1
  let depth = 0
  let out = ''
  for (; i < raw.length; i++) {
    const two = raw.slice(i, i + 2)
    if (two === '{{' || two === '[[') {
      depth++
      out += two
      i++
      continue
    }
    if (two === '}}' || two === ']]') {
      depth--
      out += two
      i++
      continue
    }
    if (raw[i] === '\n' && depth === 0) break
    out += raw[i]
  }
  return out
}

/** 归一化：剥模板、去装饰符号、统一异体字与大小写，只留可比较的名字 */
function normName(s) {
  let t = String(s).replace(/<[^>]*>/g, '')
  // 模板由内向外剥：注音 取显示值，拼音 直接丢掉，其余取第一个参数（没有参数就取模板名）
  for (let i = 0; i < 8; i++) {
    const next = t.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const parts = inner.split('|').map((x) => x.trim())
      const name = parts[0]
      if (name === '注音') return parts[1] || ''
      if (name === '拼音') return ''
      return parts[1] || name
    })
    if (next === t) break
    t = next
  }
  return t
    .replace(/[\s·・.、,，]/g, '')
    .replace(/[「」【】〈〉]/g, '')
    .replace(/蔵/g, '藏') // wiki 有些页面写「蔵」，我们收「藏」
    .replace(/ー/g, '') // wiki 自己也丢过长音符（シューティングスタ / スター）
    .toLowerCase()
    .trim()
}

/**
 * 判断两个名字算不算「同一个技」。
 * 变体页面的 原= 常常只写基础名（流星スネイク はらver 的 原=流星スネイク），
 * wiki 自己也写过错字（シューティングスタ / スター），所以允许包含关系。
 */
function sameWaza(a, b) {
  if (!a || !b) return true // 没有 原= 就不评判
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

let bad = 0
const seenTitle = new Set()
const seenKey = new Map()

for (const [i, line] of lines.entries()) {
  let rec
  try {
    rec = JSON.parse(line)
  } catch {
    console.log(`第 ${i + 1} 行 JSON 解析失败`)
    bad++
    continue
  }
  const title = String(rec.title || '').trim()
  const raw = String(rec.raw || '')
  const key = String(rec.name || title.split('〈')[0]).trim()

  if (!title) {
    console.log(`第 ${i + 1} 行缺 title`)
    bad++
    continue
  }
  if (seenTitle.has(title)) {
    console.log(`title 重复：${title}`)
    bad++
  }
  seenTitle.add(title)

  if (!/\{\{技/.test(raw)) {
    console.log(`正文里没有 {{技：${title}`)
    bad++
    continue
  }
  // 从正文里挖 原=，和标题推出的技名比对（归一化后）
  const gen = normName(pickOriginal(raw))
  const expected = normName(key)
  if (!sameWaza(gen, expected)) {
    console.log(`标题与正文不匹配？${title}\n    标题推出：${expected}\n    正文 原=：${gen}`)
    bad++
  }
  if (seenKey.has(key) && seenKey.get(key) !== title) {
    console.log(`技名 ${key} 挂在多个标题下：${seenKey.get(key)} / ${title}`)
    bad++
  }
  seenKey.set(key, title)
}

console.log(`\n共 ${lines.length} 条，问题 ${bad} 处`)
console.log(bad === 0 ? 'OK jsonl 一致性通过' : 'FAIL 请修掉上面这些再入库')
process.exit(bad === 0 ? 0 : 1)

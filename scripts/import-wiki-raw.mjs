/**
 * 把 wiki 词条的原始模板文本解析成结构化元数据
 *
 * 输入：data/wiki-raw.jsonl，每行 {"title":"页面标题","raw":"{{技|原=...|中=...|...}}"}
 * 输出：src/data/wiki-meta.json，形如
 *   { "蒼月剣舞": { creator, origin, year, videos: [...], pitfalls, tags, seriesJa } }
 *
 * 词条模板长这样（action=raw 拿到的原文）：
 *   {{技
 *   |原=蒼月剣舞
 *   |中=苍月剑舞
 *   |作成者=三水
 *   |本家=三水
 *   |视频=
 *   {{参考|系列技连|三水|官方发布 bilibili|{{时间|45.2|2}}|【三水】蒼月剣系全般【自创技集合】|6=https://...|时间=2020年|7={{三水}} say【...】的后两八拍作了修改。}}
 *   |系列名=蒼月剣
 *   |系列={{苍月剑系类}}
 *   }}[[分类:国人技]][[分类:三水]][[Category:蒼月剣系]]
 *
 * 用法：node scripts/import-wiki-raw.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const RAW_FILE = join(ROOT, 'data', 'wiki-raw.jsonl')
const OUT_FILE = join(ROOT, 'src', 'data', 'wiki-meta.js')

/** 按顶层分隔符切分，跳过 {{...}} 和 [[...]] 内部 */
function splitTopLevel(text, sep = '|') {
  const out = []
  let depthCurly = 0
  let depthSquare = 0
  let buf = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{' && text[i + 1] === '{') {
      depthCurly++
      buf += '{{'
      i++
      continue
    }
    if (ch === '}' && text[i + 1] === '}') {
      depthCurly--
      buf += '}}'
      i++
      continue
    }
    if (ch === '[' && text[i + 1] === '[') {
      depthSquare++
      buf += '[['
      i++
      continue
    }
    if (ch === ']' && text[i + 1] === ']') {
      depthSquare--
      buf += ']]'
      i++
      continue
    }
    if (ch === sep && depthCurly === 0 && depthSquare === 0) {
      out.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  out.push(buf)
  return out
}

/**
 * 取出以 name 开头的模板内文（去掉 {{名称 前缀）
 * 注意 wiki 实际写法是「{{技」换行再「|原=」，所以不能要求名称后紧跟竖线
 */
function getTemplates(raw, name) {
  const marker = '{{' + name
  const out = []
  let from = 0
  while (true) {
    const start = raw.indexOf(marker, from)
    if (start === -1) break
    const after = raw[start + marker.length]
    // 名称后面必须是空白、竖线或结束，避免误匹配 {{技の名
    if (after && !/[\s|}]/.test(after)) {
      from = start + marker.length
      continue
    }
    let depth = 0
    let i = start
    for (; i < raw.length; i++) {
      if (raw[i] === '{' && raw[i + 1] === '{') {
        depth++
        i++
      } else if (raw[i] === '}' && raw[i + 1] === '}') {
        depth--
        i++
        if (depth === 0) break
      }
    }
    out.push(raw.slice(start + 2 + name.length, i - 1))
    from = i
  }
  return out
}

/** 去掉常见 wiki 标记，留下人类可读文本 */
function plain(text) {
  if (!text) return ''
  let s = String(text)
  // 反复剥离模板：{{三水}} -> 三水；{{三水|1|显}} -> 三水
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\{\{([^|{}]+)(?:\|[^{}]*)?\}\}/g, '$1')
    if (next === s) break
    s = next
  }
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** {{时间|45.2|2}} 里的秒数 -> "00:45" */
function timeFromTemplate(text) {
  if (!text) return null
  // 两种模板都要认：{{时间|45.2|2}} 和 {{时间链接|103.3|2|url}}
  const m = String(text).match(/\{\{时间(?:链接)?\|([\d.]+)/)
  if (m) {
    const sec = Number(m[1])
    if (Number.isFinite(sec)) return fmtClock(sec)
  }
  const t = plain(text)
  const mmss = t.match(/\d{1,2}:\d{2}/)
  if (mmss) return mmss[0]
  return t || null
}

function fmtClock(t) {
  const total = Math.round(t)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 解析一条 {{参考|...}} */
function parseRef(inner) {
  const parts = splitTopLevel(inner)
  const positional = []
  const named = {}
  for (const p of parts) {
    if (!p.trim()) continue
    const eq = p.indexOf('=')
    // 形如 "6=xxx" 或 "时间=2020年" 才算具名参数
    if (eq > 0 && /^\s*(\d+|[^\s=]+)\s*$/.test(p.slice(0, eq))) {
      named[p.slice(0, eq).trim()] = p.slice(eq + 1)
    } else {
      positional.push(p)
    }
  }

  const kind = plain(positional[0] || '')
  const performer = plain(positional[1] || '')
  const platform = plain(positional[2] || '')
  const time = timeFromTemplate(positional[3] || '')
  const title = plain(positional[4] || '')
  const url = (named['6'] || '').trim()
  const year = (named['时间'] || '').trim()
  const note = plain(named['7'] || '')

  if (!title && !url) return null
  return {
    kind: kind || '参考',
    performer,
    platform,
    time,
    title,
    url,
    year: year || null,
    note: note || '',
  }
}

/** 解析整条词条的 raw 文本 */
function parsePage(raw) {
  // 主模板 {{技 ... }} 的内文
  const bodies = getTemplates(raw, '技')
  const body = bodies.find((b) => b.includes('作成者=') || b.includes('原=')) || bodies[0] || raw

  const fields = {}
  for (const seg of splitTopLevel(body)) {
    const eq = seg.indexOf('=')
    if (eq === -1) continue
    const key = seg.slice(0, eq).trim()
    const val = seg.slice(eq + 1)
    if (key) fields[key] = val
  }

  const videos = []
  for (const block of getTemplates(fields['视频'] || '', '参考')) {
    const v = parseRef(block)
    if (v) videos.push(v)
  }
  // 有些词条把参考直接写在 视频 字段外层
  if (!videos.length && fields['视频']) {
    for (const block of getTemplates(fields['视频'], '参考')) {
      const v = parseRef(block)
      if (v) videos.push(v)
    }
  }

  const tags = [...raw.matchAll(/\[\[(?:分类|Category):([^\]|]+)\]\]/g)].map((m) => m[1].trim())

  const yearFromVideo = videos.map((v) => v.year).find(Boolean)
  const yearNum = yearFromVideo ? Number(String(yearFromVideo).replace(/[^\d]/g, '')) : null

  return {
    creator: plain(fields['作成者'] || '') || null,
    origin: plain(fields['本家'] || '') || null,
    year: Number.isFinite(yearNum) && yearNum > 1900 ? yearNum : null,
    videos: videos.map((v) => ({
      kind: v.kind,
      performer: v.performer,
      time: v.time,
      title: v.title,
      url: v.url,
    })),
    pitfalls: [
      ...videos.map((v) => v.note).filter(Boolean),
      fields['参考对象'] ? `参考对象：${plain(fields['参考对象'])}` : '',
      plain(fields['其他'] || ''),
      plain(fields['趣闻'] || ''),
      plain(fields['备注'] || ''),
    ]
      .filter(Boolean)
      .join('；'),
    seriesJa: plain(fields['系列名'] || '') || null,
    tags: tags.filter((t) => !/^(技|时间未明|需要帮助|无本家视频)$/.test(t)),
  }
}

function main() {
  if (!existsSync(RAW_FILE)) {
    console.error(`缺少输入文件：${RAW_FILE}`)
    console.error('先往里面写若干行 {"title":"...","raw":"..."} 再运行本脚本')
    process.exit(1)
  }

  const lines = readFileSync(RAW_FILE, 'utf8').split(/\r?\n/).filter((l) => l.trim())
  const meta = {}
  let ok = 0
  let skip = 0

  for (const line of lines) {
    let item
    try {
      item = JSON.parse(line)
    } catch {
      console.warn('  跳过无法解析的行')
      skip++
      continue
    }
    const title = String(item.title || '').trim()
    const raw = String(item.raw || '')
    if (!title || !raw || raw.length < 20) {
      skip++
      continue
    }
    // 空页面（wiki 上存在但无内容）
    if (/本页面目前没有内容/.test(raw)) {
      skip++
      continue
    }
    const nameJa = title.split('〈')[0].trim()
    meta[nameJa] = parsePage(raw)
    ok++
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  const body =
    '/**\n' +
    ' * 自动生成：node scripts/import-wiki-raw.mjs —— 请勿手改\n' +
    ' * 数据来源：中文WOTA艺wiki 词条原文（action=raw）\n' +
    ' */\n' +
    `export const WIKI_META = ${JSON.stringify(meta, null, 2)}\n\n` +
    'export default WIKI_META\n'
  writeFileSync(OUT_FILE, body, 'utf8')

  console.log(`解析成功 ${ok} 条，跳过 ${skip} 条`)
  console.log(`已写入 ${OUT_FILE}`)

  for (const [k, v] of Object.entries(meta)) {
    const vids = v.videos.map((x) => `${x.time || '?'}`).join(',')
    console.log(`  ${k.padEnd(18)} 作成者:${(v.creator || '—').padEnd(14)} 年份:${String(v.year || '—').padEnd(5)} 视频:${vids || '—'}`)
  }
}

main()

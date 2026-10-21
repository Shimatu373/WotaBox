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
/** 处理 {{注音|显示|原音}}：只保留「显示」；支持内部嵌套模板 */
function stripRuby(s) {
  let out = s
  for (let guard = 0; guard < 30; guard++) {
    const start = out.indexOf('{{注音|')
    if (start === -1) break
    let depth = 0
    let i = start
    for (; i < out.length; i++) {
      if (out[i] === '{' && out[i + 1] === '{') {
        depth++
        i++
      } else if (out[i] === '}' && out[i + 1] === '}') {
        depth--
        i++
        if (depth === 0) break
      }
    }
    const inner = out.slice(start + '{{注音|'.length, i - 1)
    const first = splitTopLevel(inner)[0] || ''
    out = out.slice(0, start) + first + out.slice(i + 1)
  }
  return out
}

/** 参数是否只是「显示开关」之类（1 / 3 / 显 / x / b），而不是正文 */
function isFlagArg(s) {
  return s === '' || /^\d+$/.test(s) || /^[显xbBw]{1,2}$/.test(s)
}

/**
 * 剥掉一层模板、留下可读内容。三种情况要分清：
 *   {{三水}} / {{三水|1|显}}        → 三水        （模板名就是人，参数是显示开关）
 *   {{八舞橙|「神威灵装·八番」}}     → 「神威灵装·八番」（颜色模板，参数才是正文）
 *   {{发布|1=5|2=3}}               → 空          （纯具名参数＝纯装饰）
 * 早先一律取模板名，会把「神威灵装·八番」的作成者解析成「八舞橙」。
 */
function stripTemplateOnce(inner) {
  const parts = splitTopLevel(inner)
  const name = (parts[0] || '').trim()
  const args = parts.slice(1).map((s) => s.trim())
  if (!args.length) return name
  const namedOnly = args.every((a) => a === '' || /^[^\s=]+=/.test(a))
  if (namedOnly && args.some((a) => a !== '')) return ''
  if (args.every(isFlagArg)) return name
  return args[0]
}

function plain(text) {
  if (!text) return ''
  let s = String(text)
  // 去掉脚注
  s = s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  // {{换行}} -> 空格
  s = s.replace(/\{\{换行\}\}/g, ' ')
  // {{注音|显示|原音}} -> 显示
  s = stripRuby(s)
  // 其余模板逐层剥壳（由内向外，最多 8 层）
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => stripTemplateOnce(inner))
    if (next === s) break
    s = next
  }
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // 单方括号外链：[https://… 显示文字] → 显示文字；[https://…] 直接删掉
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/\[https?:\/\/[^\]]+\]/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** {{时间|45.2|2}} 里的秒数 -> "00:45" */
function timeFromTemplate(text) {
  if (!text) return null
  const raw = String(text)
  // 两种模板都要认：{{时间|45.2|2}} 和 {{时间链接|103.3|2|url}}
  const m = raw.match(/\{\{时间(?:链接)?\|([\d.]+)/)
  if (m) {
    const sec = Number(m[1])
    if (Number.isFinite(sec)) return fmtClock(sec)
  }
  // {{链接|09:34|url}} —— 有的词条直接写时刻，不写秒数
  const m2 = raw.match(/\{\{链接\|(\d{1,2}:\d{2}(?::\d{2})?)/)
  if (m2) return clockLiteral(m2[1])
  const t = plain(raw)
  const mmss = t.match(/\d{1,2}:\d{2}/)
  if (mmss) return mmss[0]
  // 纯秒数 / "1分30秒" 也认；除此之外（「本家」「入门」这类占位说明）一律当没有时间，不许瞎填
  const secOnly = t.match(/^(\d{1,3})$/)
  if (secOnly) return fmtClock(Number(secOnly[1]))
  const jp = t.match(/^(\d+)\s*分\s*(\d+)?\s*秒?$/)
  if (jp) return fmtClock(Number(jp[1]) * 60 + Number(jp[2] || 0))
  return null
}

/** "9:34" -> "09:34"；"1:02:03" -> "62:03" 这类统一成 mm:ss */
function clockLiteral(str) {
  const parts = str.split(':').map((x) => Number(x))
  if (parts.some((n) => !Number.isFinite(n))) return str
  if (parts.length === 2) return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`
  if (parts.length === 3) return fmtClock(parts[0] * 3600 + parts[1] * 60 + parts[2])
  return str
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
  // 第一段是模板名，去掉它；其余空参数必须保留位置，否则 [4]标题 会顶到 [3]时间
  if (parts.length && !parts[0].trim()) parts.shift()
  const positional = []
  const named = {}
  for (const p of parts) {
    // 空参数保留位置（上面的 shift 已经去掉了模板名）
    const eq = p.indexOf('=')
    // 形如 "6=xxx" 或 "时间=2020年" 才算具名参数
    if (eq > 0 && /^\s*(\d+|[^\s=]+)\s*$/.test(p.slice(0, eq))) {
      named[p.slice(0, eq).trim()] = p.slice(eq + 1)
    } else {
      positional.push(p.trim())
    }
  }

  const kind = plain(positional[0] || '')
  const performer = plain(positional[1] || '')
  const platform = plain(positional[2] || '')
  // 链接一般在具名参数 6=，但也有的词条直接当位置参数写（第 5、6 位）
  let url = (named['6'] || '').trim()
  if (!url) {
    const inline = positional.slice(3).find((p) => /^https?:\/\//i.test((p || '').trim()))
    if (inline) url = inline.trim()
  }
  // 有的词条直接把 BV 号写在链接位（例：金剛、北斗），补齐成完整地址
  if (/^BV[0-9A-Za-z]{10}$/.test(url)) url = 'https://www.bilibili.com/video/' + url
  let time = timeFromTemplate(positional[3] || named['4'] || '')
  // 模板没写时间、但链接里带了 ?t=170（B站/YouTube 都表示起始秒数）——这是原文自带的信息
  if (!time && url) {
    const mt = url.match(/[?&]t=([\d.]+)/)
    if (mt) {
      const sec = Number(mt[1])
      if (Number.isFinite(sec)) time = fmtClock(sec)
    }
  }
  const title = plain(positional[4] || named['5'] || '')
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
  // 主模板 {{技 ... }} 的内文（注意 "{{技" 后面跟的是换行，不是 |）
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

  // 本家视频 + 「以外视频」+「其他视频」/「使用视频」都要收（几种字段名 wiki 都在用）
  const videos = []
  for (const src of [fields['视频'], fields['以外视频'], fields['其他视频'], fields['使用视频']]) {
    if (!src) continue
    for (const block of getTemplates(src, '参考')) {
      const v = parseRef(block)
      if (v) videos.push(v)
    }
  }

  const tags = [...raw.matchAll(/\[\[(?:分类|Category):([^\]|]+)\]\]/g)].map((m) => m[1].trim())
  if (String(fields['国人技'] || '').includes('是')) tags.push('国人技')

  let creator = plain(fields['作成者'] || '') || null
  let origin = plain(fields['本家'] || '') || null
  if (origin === '同上') origin = creator

  // 变体词条的写法：|人物=原版作成者 |作成者=原版作者 |身份=版本创编者 |本家=该版本作者
  // 例：流星スネイク ギアver 的作成者是 Rask（原版），真正做这个版本的是 Gear。
  // 不处理的话「ギアver」会被标成 Rask 的作品 —— 那是错的。
  if (origin && /版本创编/.test(plain(fields['身份'] || ''))) {
    const originalAuthor = creator
    creator = origin
    origin = originalAuthor
  }

  // 年份：词条顶层的 |时间= 最准，其次用视频里的发布时间
  const yearFromField = (plain(fields['时间'] || '').match(/\d{4}/) || [])[0]
  const yearFromVideo = videos
    .map((v) => (v.year ? (String(v.year).match(/\d{4}/) || [])[0] : null))
    .find(Boolean)
  const year = Number(yearFromField || yearFromVideo) || null

  // 读音类字段：读音 / 音 / 注音（注音有时写罗马字，正好当搜索别名）
  const readings = [plain(fields['读音'] || ''), plain(fields['音'] || ''), plain(fields['注音'] || '')].filter(
    Boolean,
  )

  return {
    creator,
    origin,
    year,
    readings,
    videos: videos.map((v) => ({
      kind: v.kind,
      performer: v.performer,
      time: v.time,
      title: v.title,
      url: v.url,
    })),
    pitfalls: [
      ...videos.map((v) => v.note).filter(Boolean),
      plain(fields['参考对象'] || '') ? `参考对象：${plain(fields['参考对象'])}` : '',
      plain(fields['趣闻'] || ''),
      plain(fields['其他'] || ''),
      plain(fields['其他内容'] || '') ? `其他：${plain(fields['其他内容'])}` : '',
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
    // nameJa 默认取标题〈〉前的部分；个别词条标题与技名不一致（如 wiki 写「半蔵門」、我们收「半藏門」），
    // 用记录里的 name 字段显式指定，否则元数据会静默匹配不上。
    const nameJa = String(item.name || title.split('〈')[0]).trim()
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

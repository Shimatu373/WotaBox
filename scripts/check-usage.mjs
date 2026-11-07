/**
 * 静态检查：防「用了某个函数但没 import」这类构建查不出的错
 *
 * 背景：Vite 打包不会管未声明的标识符（会当成全局变量），
 * 所以 `canDragDancer(...)` 少写一行 import 也能构建通过，只在浏览器里点下去时才
 * 抛 ReferenceError —— 表现就是「按钮/拖拽完全没反应」（2026-11-07 真踩过）。
 *
 * 做法：
 *   1. 收集 src/composables/*.js 导出的所有名字
 *   2. 对每个 .vue / .js：解析 import 的名字、本地声明的名字
 *   3. 文件里**调用**了某个 composable 导出名，却既没 import 也没本地定义 → 报错
 *   4. 顺带校验 import 的名字在那个模块里确实存在（拼错、改名都能发现）
 *
 * 用法：node scripts/check-usage.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(vue|js|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** 去掉字符串字面量：避免 './playerClock.js' 这种路径被当成「使用了 playerClock」 */
function stripStrings(src) {
  return src
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

function exportNames(src) {
  const names = new Set()
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()
      if (n) names.add(n.trim())
    }
  }
  return names
}

const files = walk(ROOT)
const exportsByFile = new Map()
const allExports = new Set()

for (const f of files) {
  const norm = f.replace(/\\/g, '/')
  if (!norm.includes('/composables/')) continue
  const names = exportNames(readFileSync(f, 'utf8'))
  exportsByFile.set(norm, names)
  for (const n of names) allExports.add(n)
}

function moduleExportsFor(spec) {
  if (!spec.startsWith('.')) return null
  const suffix = spec.replace(/^\.\.?\//, '').replace(/\\/g, '/')
  for (const [path, names] of exportsByFile) {
    if (path.endsWith('/' + suffix) || path.endsWith(suffix)) return names
  }
  return null
}

const problems = []

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const src = stripComments(raw)
  const usageSrc = stripStrings(src)
  const rel = relative(ROOT, file).replace(/\\/g, '/')

  const imported = new Set()

  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clause = m[1]
    const spec = m[2]
    const targetExports = moduleExportsFor(spec)

    for (const brace of clause.matchAll(/\{([^}]*)\}/g)) {
      for (const part of brace[1].split(',')) {
        const piece = part.trim()
        if (!piece) continue
        const [origin, alias] = piece.split(/\s+as\s+/)
        imported.add((alias || origin).trim())
        if (targetExports && !targetExports.has(origin.trim())) {
          problems.push(`${rel}: 从「${spec}」import 了不存在的「${origin.trim()}」`)
        }
      }
    }

    const def = clause.match(/^\s*([A-Za-z_$][\w$]*)/)
    if (def && !clause.trim().startsWith('{')) imported.add(def[1])
  }

  const declared = new Set()
  for (const m of src.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1])
  for (const m of src.matchAll(/(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1])
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(':').pop().trim()
      if (n) declared.add(n)
    }
  }

  for (const name of allExports) {
    if (imported.has(name) || declared.has(name)) continue
    const usedAsCall = new RegExp(`(^|[^.\\w$])${name}\\s*\\(`, 'm').test(usageSrc)
    const usedAsMember = new RegExp(`(^|[^.\\w$])${name}\\.[A-Za-z_$]`, 'm').test(usageSrc)
    if (usedAsCall || usedAsMember) {
      problems.push(`${rel}: 用到「${name}」但既没 import 也没本地定义（运行时才会炸）`)
    }
  }
}

if (problems.length) {
  console.log('发现 ' + problems.length + ' 个问题：')
  for (const p of problems) console.log('  ✗ ' + p)
  process.exit(1)
}

console.log(`OK 静态检查通过（${files.length} 个文件，${allExports.size} 个 composable 导出名）`)

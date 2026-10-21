/**
 * 命令行脚本用的「全量元数据」加载器。
 *
 * 前端已经改成按需加载（src/data/wiki-meta/chunk-*.js），但脚本要统计/归类就得全量，
 * 这里把 32 个分块全读进来拼成一个大对象。只在 Node 里用，不进浏览器包。
 */
import { WIKI_CHUNKS } from '../src/data/wiki-meta/index.js'
import { LOADERS } from '../src/data/wiki-meta/loaders.js'

let cache = null

export async function loadAllMeta() {
  if (cache) return cache
  const out = {}
  const ids = [...new Set(Object.values(WIKI_CHUNKS))]
  for (const id of ids) {
    const mod = await LOADERS[id]()
    Object.assign(out, mod.default || {})
  }
  cache = out
  return out
}

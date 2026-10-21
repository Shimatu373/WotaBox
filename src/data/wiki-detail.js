/**
 * 按需加载技详情。
 *
 * 详情字段（作成者、参考视频、要点）体积占了元数据的 8 成，但列表页完全用不到，
 * 所以拆成 32 个分块，点开某个技时才动态 import 那一块。
 */
import { WIKI_CHUNKS } from './wiki-meta/index.js'
import { LOADERS } from './wiki-meta/loaders.js'

/** 已加载的详情缓存：技名 → detail */
const cache = new Map()

export function getCachedDetail(nameJa) {
  return cache.get(nameJa) || null
}

/** 这个技有没有详情分块（没有就是纯名字的技） */
export function hasDetail(nameJa) {
  return WIKI_CHUNKS[nameJa] !== undefined
}

/**
 * 加载某个技的详情。返回 null 表示 wiki 上没这个技的数据。
 * 同一分块里的其它技会一起进缓存 —— 反正已经下载了。
 */
export async function loadWazaDetail(nameJa) {
  if (cache.has(nameJa)) return cache.get(nameJa)
  const id = WIKI_CHUNKS[nameJa]
  if (id === undefined) return null
  const mod = await LOADERS[id]()
  for (const [k, v] of Object.entries(mod.default || {})) {
    if (!cache.has(k)) cache.set(k, v)
  }
  return cache.get(nameJa) || null
}

import { reactive, watch } from 'vue'

/**
 * 收藏夹（学习进度）数据层
 *
 * 结构：
 *   collections: [
 *     { id, name, color, builtin, items: [{ wazaId, status }] }
 *   ]
 *
 * status 三档，构成学习进度的阶梯：
 *   unlearned  未掌握  — 收藏了但还没练
 *   learned    已习得  — 能跟着打下来
 *   proficient 已上手  — 能稳定打、可以上台
 *
 * 数据全部存在本机 localStorage，不联网、不上传。
 */

const STORAGE_KEY = 'wota:collections:v1'

export const STATUS_DEF = [
  { key: 'unlearned', label: '未掌握', color: '#44556f', text: '#93a7c4' },
  { key: 'learned', label: '已习得', color: '#4a8fe0', text: '#a8d0ff' },
  { key: 'proficient', label: '已上手', color: '#f5a524', text: '#ffd98a' },
]

/** 新建收藏夹时轮流分配的颜色（第一个是默认「喜爱技」的淡粉） */
const PALETTE = ['#ff9ec4', '#4a8fe0', '#59c9a5', '#b48cf2', '#f5a524', '#63b3ed']

const BUILTIN_ID = 'fav'

function newId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function defaultState() {
  return {
    collections: [
      { id: BUILTIN_ID, name: '喜爱技', color: '#ff9ec4', builtin: true, items: [] },
    ],
  }
}

/** 读盘时做一次清洗，防止旧数据 / 手改坏了导致界面崩掉 */
function sanitize(raw) {
  if (!raw || !Array.isArray(raw.collections)) return defaultState()

  const collections = raw.collections
    .filter((c) => c && typeof c.id === 'string')
    .map((c) => ({
      id: c.id,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : '未命名',
      color: typeof c.color === 'string' && c.color ? c.color : '#4a8fe0',
      builtin: c.id === BUILTIN_ID,
      items: Array.isArray(c.items)
        ? c.items
            .filter((i) => i && typeof i.wazaId === 'string')
            .map((i) => ({
              wazaId: i.wazaId,
              status: STATUS_DEF.some((s) => s.key === i.status) ? i.status : 'unlearned',
            }))
        : [],
    }))

  if (!collections.some((c) => c.id === BUILTIN_ID)) {
    collections.unshift({ id: BUILTIN_ID, name: '喜爱技', color: '#ff9ec4', builtin: true, items: [] })
  }

  return { collections }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return sanitize(JSON.parse(raw))
  } catch {
    return defaultState()
  }
}

export const store = reactive(load())

watch(
  store,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      /* 存储满了或被禁用，静默失败 */
    }
  },
  { deep: true }
)

export const collections = store.collections

export function statusMeta(key) {
  return STATUS_DEF.find((s) => s.key === key) || STATUS_DEF[0]
}

export function nextStatus(key) {
  const i = STATUS_DEF.findIndex((s) => s.key === key)
  return STATUS_DEF[(i + 1) % STATUS_DEF.length].key
}

function findCollection(id) {
  return store.collections.find((c) => c.id === id)
}

export function createCollection(name) {
  const color = PALETTE[store.collections.length % PALETTE.length]
  const c = {
    id: newId(),
    name: (name || '').trim() || '新收藏夹',
    color,
    builtin: false,
    items: [],
  }
  store.collections.push(c)
  return c
}

export function renameCollection(id, name) {
  const c = findCollection(id)
  const v = (name || '').trim()
  if (c && v) c.name = v
}

export function removeCollection(id) {
  const i = store.collections.findIndex((c) => c.id === id)
  if (i === -1) return false
  if (store.collections[i].builtin) return false // 默认收藏夹不允许删除
  store.collections.splice(i, 1)
  return true
}

export function isInCollection(collId, wazaId) {
  const c = findCollection(collId)
  return !!c && c.items.some((i) => i.wazaId === wazaId)
}

export function addWaza(collId, wazaId) {
  const c = findCollection(collId)
  if (!c || c.items.some((i) => i.wazaId === wazaId)) return
  c.items.push({ wazaId, status: 'unlearned' })
}

export function removeWaza(collId, wazaId) {
  const c = findCollection(collId)
  if (!c) return
  const i = c.items.findIndex((x) => x.wazaId === wazaId)
  if (i !== -1) c.items.splice(i, 1)
}

/** 图鉴里点一下就「加入 / 移出」 */
export function toggleWazaInCollection(collId, wazaId) {
  if (isInCollection(collId, wazaId)) removeWaza(collId, wazaId)
  else addWaza(collId, wazaId)
}

export function setStatus(collId, wazaId, status) {
  const c = findCollection(collId)
  if (!c) return
  const item = c.items.find((i) => i.wazaId === wazaId)
  if (item) item.status = STATUS_DEF.some((s) => s.key === status) ? status : 'unlearned'
}

/** 未掌握 → 已习得 → 已上手 → 未掌握 */
export function cycleStatus(collId, wazaId) {
  const c = findCollection(collId)
  if (!c) return
  const item = c.items.find((i) => i.wazaId === wazaId)
  if (item) item.status = nextStatus(item.status)
}

/** 跨所有收藏夹取最高的掌握状态（图鉴列表里的小圆点用） */
export function bestStatusOf(wazaId) {
  let best = null
  let bestRank = -1
  for (const c of store.collections) {
    const item = c.items.find((i) => i.wazaId === wazaId)
    if (!item) continue
    const rank = STATUS_DEF.findIndex((s) => s.key === item.status)
    if (rank > bestRank) {
      bestRank = rank
      best = item.status
    }
  }
  return best
}

export function collectionsOfWaza(wazaId) {
  return store.collections.filter((c) => c.items.some((i) => i.wazaId === wazaId))
}

/**
 * 个人技池：汇总所有收藏夹，只取「已习得 / 已上手」
 * 同一技在多个收藏夹里有不同状态时取最高的那个
 */
export function poolOf() {
  const map = new Map()
  for (const c of store.collections) {
    for (const item of c.items) {
      const rank = STATUS_DEF.findIndex((s) => s.key === item.status)
      const prev = map.get(item.wazaId)
      if (!prev || rank > prev.rank) {
        map.set(item.wazaId, { wazaId: item.wazaId, status: item.status, rank })
      }
    }
  }
  // rank > 0 即排除「未掌握」
  return [...map.values()].filter((x) => x.rank > 0)
}

export function statsOf(collId) {
  const counts = { unlearned: 0, learned: 0, proficient: 0 }
  const c = findCollection(collId)
  if (c) for (const i of c.items) counts[i.status] = (counts[i.status] || 0) + 1
  return counts
}

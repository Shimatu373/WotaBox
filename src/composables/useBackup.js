/**
 * 数据备份：导出 / 导入 / 撤销
 *
 * 导出的是 localStorage 里所有 `wota:` 前缀的原始字符串，
 * 不做结构化转换 —— 这样应用以后改数据结构也不会让旧备份失效。
 *
 * 导入采用「整体覆盖」，但会先把当前数据存一份快照，可一键撤销。
 */

const PREFIX = 'wota:'
const SNAPSHOT_KEY = 'wota:__snapshot'

export const COLLECTIONS_KEY = 'wota:collections:v1'
export const CHOREO_KEY = 'wota:choreo:v1'

/** 收集所有备份范围内的键（排除快照自身） */
function collectKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX) && k !== SNAPSHOT_KEY) keys.push(k)
  }
  return keys
}

export function buildBackup() {
  const data = {}
  for (const k of collectKeys()) data[k] = localStorage.getItem(k) ?? ''
  const totalWaza = Object.values(data).reduce((s, v) => s + v.length, 0)
  return {
    app: 'WotaBox',
    version: 1,
    exportedAt: new Date().toISOString(),
    bytes: totalWaza,
    data,
  }
}

/** 生成并触发下载，返回导出的键数量 */
export function downloadBackup() {
  const payload = buildBackup()
  const text = JSON.stringify(payload, null, 2)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`

  const a = document.createElement('a')
  a.href = url
  a.download = `wotabox-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)

  return Object.keys(payload.data).length
}

/** 导入：先快照当前数据，再整体覆盖。返回导入的键数量 */
export async function importBackup(file) {
  const text = await file.text()

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON')
  }

  if (!payload || payload.app !== 'WotaBox' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('这不是 WotaBox 的备份文件')
  }

  // 导入前先给当前数据拍个快照，导错了还能撤
  const snapshot = buildBackup()
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))

  for (const k of collectKeys()) localStorage.removeItem(k)

  let count = 0
  for (const [k, v] of Object.entries(payload.data)) {
    if (typeof k === 'string' && k.startsWith(PREFIX) && typeof v === 'string') {
      localStorage.setItem(k, v)
      count++
    }
  }

  return { count, exportedAt: payload.exportedAt || '' }
}

export function hasSnapshot() {
  return !!localStorage.getItem(SNAPSHOT_KEY)
}

/** 撤销上一次导入，恢复到导入前的状态 */
export function restoreSnapshot() {
  const raw = localStorage.getItem(SNAPSHOT_KEY)
  if (!raw) throw new Error('没有可撤销的导入记录')

  const payload = JSON.parse(raw)
  if (!payload?.data) throw new Error('快照已损坏')

  for (const k of collectKeys()) localStorage.removeItem(k)
  for (const [k, v] of Object.entries(payload.data)) {
    if (typeof v === 'string' && k.startsWith(PREFIX)) localStorage.setItem(k, v)
  }
  return true
}

/** 本地数据概览，用来在界面上告诉用户"会导出些什么" */
export function localOverview() {
  const out = { collections: 0, wazaRecords: 0, clips: 0, keys: collectKeys().length }
  try {
    const c = JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '{}')
    const list = Array.isArray(c.collections) ? c.collections : []
    out.collections = list.length
    out.wazaRecords = list.reduce((s, x) => s + (Array.isArray(x.items) ? x.items.length : 0), 0)
  } catch {
    /* 忽略 */
  }
  try {
    const k = JSON.parse(localStorage.getItem(CHOREO_KEY) || '{}')
    out.clips = Array.isArray(k.clips) ? k.clips.length : 0
  } catch {
    /* 忽略 */
  }
  return out
}

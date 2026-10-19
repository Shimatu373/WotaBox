import { reactive, watch } from 'vue'

/**
 * 编排片段（歌曲片段 + 可用副歌技序列）
 *
 * 一条记录 = 某首歌的某一段 × 按顺序使用的副歌技。
 * 这是打师之间交流节目编排的最小单元，也是"这段怎么打"的记录。
 *
 * 结构：
 *   { id, songKey, fileName, duration, name, a, b, wazaIds[], note, createdAt }
 */

const KEY = 'wota:choreo:v1'

function isValid(c) {
  return (
    c &&
    typeof c.id === 'string' &&
    typeof c.fileName === 'string' &&
    typeof c.a === 'number' &&
    typeof c.b === 'number' &&
    Array.isArray(c.wazaIds)
  )
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const arr = Array.isArray(parsed?.clips) ? parsed.clips : []
    return arr.filter(isValid)
  } catch {
    return []
  }
}

export const choreoStore = reactive({ clips: load() })

watch(
  choreoStore,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(choreoStore))
    } catch {
      /* 忽略 */
    }
  },
  { deep: true }
)

/** 歌曲身份：文件名 + 时长，够区分同一首歌的重复载入 */
export function songKey(song) {
  return `${song.fileName}::${Math.round(song.duration || 0)}`
}

export function clipsOfSong(song) {
  if (!song || !song.fileName) return []
  const k = songKey(song)
  return choreoStore.clips.filter((c) => c.songKey === k).sort((a, b) => a.a - b.a)
}

export function addClip({ song, name, a, b, wazaIds = [], note = '' }) {
  const clip = {
    id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    songKey: songKey(song),
    fileName: song.fileName,
    duration: Math.round(song.duration || 0),
    name: (name || '片段').trim() || '片段',
    a,
    b,
    wazaIds: [...wazaIds],
    note,
    createdAt: Date.now(),
  }
  choreoStore.clips.push(clip)
  return clip
}

export function removeClip(id) {
  const i = choreoStore.clips.findIndex((c) => c.id === id)
  if (i !== -1) choreoStore.clips.splice(i, 1)
}

export function updateClip(id, patch) {
  const c = choreoStore.clips.find((x) => x.id === id)
  if (c) Object.assign(c, patch)
}

/** 按歌曲归组，组内按起始时间排序 */
export function clipsBySong() {
  const map = new Map()
  for (const c of choreoStore.clips) {
    if (!map.has(c.songKey)) {
      map.set(c.songKey, { songKey: c.songKey, fileName: c.fileName, duration: c.duration, clips: [] })
    }
    map.get(c.songKey).clips.push(c)
  }
  const groups = [...map.values()]
  for (const g of groups) g.clips.sort((x, y) => x.a - y.a)
  return groups
}

export function fmtClock(t) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * 生成一份便于发群里的纯文本编排
 * nameOf: (wazaId) => 显示名
 */
export function toText(group, nameOf) {
  const lines = [`【${group.fileName}】${fmtClock(group.duration)}`]
  group.clips.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.name}　${fmtClock(c.a)} – ${fmtClock(c.b)}`)
    if (c.wazaIds.length) {
      lines.push('   ' + c.wazaIds.map((id, k) => `${k + 1}.${nameOf(id)}`).join(' → '))
    } else {
      lines.push('   （未关联副歌技）')
    }
    if (c.note) lines.push(`   备注：${c.note}`)
  })
  return lines.join('\n')
}

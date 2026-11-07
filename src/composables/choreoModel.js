/**
 * 编排的数据模型（纯函数，不依赖 Vue / localStorage）
 *
 * 单独抽出来有两个好处：
 *   1. 可以在 Node 里直接跑测试（scripts/test-choreo.mjs），不用开浏览器
 *   2. 「旧数据迁移」这种一次性逻辑只写一遍，别散在组件里
 *
 * 结构（v2）：
 *   {
 *     clips: [{ id, songKey, fileName, duration, name, a, b, note, steps[], createdAt }],
 *     songs: {
 *       [songKey]: {
 *         dancers: [{ key, name, color }],            // 打师（整首歌一份）
 *         keys:    [{ t, pos: { [dancerKey]: {x,y} }, hard? }],  // 走位关键帧，坐标 0–1
 *         lines:   { [dancerKey]: [{ at, steps[] }] },  // 某打师在某时刻开始的一串动作
 *       }
 *     }
 *   }
 *
 * steps 里每一项：
 *   { kind: 'waza', id: 'wxxxx' }   引用图鉴里的技
 *   { kind: 'text', text: '…' }     自定义文本（原创 / 缝合动作）
 */

export const DANCER_COLORS = ['#e0574f', '#4a8fe0', '#43c463', '#e8b53c', '#a970e6', '#22b8cf', '#f06ba8']

/* ---------------- steps ---------------- */

export function wazaStep(id) {
  return { kind: 'waza', id: String(id) }
}

export function textStep(text) {
  return { kind: 'text', text: String(text ?? '').trim() }
}

/** 旧数据（wazaIds: string[]）→ steps */
export function stepsFromWazaIds(wazaIds) {
  return Array.isArray(wazaIds) ? wazaIds.filter((x) => typeof x === 'string' && x).map(wazaStep) : []
}

/** 把任意来源的步骤数组规整成合法的 steps */
export function normalizeSteps(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item) out.push(wazaStep(item))
      continue
    }
    if (!item || typeof item !== 'object') continue
    if (item.kind === 'text') {
      const t = String(item.text ?? '').trim()
      if (t) out.push(textStep(t))
    } else if (item.kind === 'waza' || item.id) {
      if (item.id) out.push(wazaStep(item.id))
    }
  }
  return out
}

/** 取显示文字：nameOf 用来把 waza id 换成技名 */
export function stepLabel(step, nameOf) {
  if (!step) return ''
  if (step.kind === 'text') return step.text || ''
  return nameOf ? nameOf(step.id) : step.id
}

export function stepCount(clip) {
  return Array.isArray(clip?.steps) ? clip.steps.length : 0
}

/* ---------------- 状态 ---------------- */

export function emptyState() {
  return { clips: [], songs: {} }
}

/** 一首歌的站位/走位数据（没有就建一个空壳） */
export function songOf(state, songKey) {
  if (!state.songs) state.songs = {}
  if (!state.songs[songKey]) {
    state.songs[songKey] = { dancers: [], keys: [], lines: {} }
  }
  const s = state.songs[songKey]
  if (!Array.isArray(s.dancers)) s.dancers = []
  if (!Array.isArray(s.keys)) s.keys = []
  if (!s.lines || typeof s.lines !== 'object') s.lines = {}
  return s
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

/** 单条片段的规整（兼容 v1 的 wazaIds） */
export function normalizeClip(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || typeof raw.fileName !== 'string') return null
  return {
    id: raw.id,
    songKey: typeof raw.songKey === 'string' ? raw.songKey : `${raw.fileName}::${Math.round(num(raw.duration))}`,
    fileName: raw.fileName,
    duration: Math.round(num(raw.duration)),
    name: String(raw.name || '片段').trim() || '片段',
    a: num(raw.a),
    b: num(raw.b),
    note: String(raw.note || ''),
    steps: normalizeSteps(Array.isArray(raw.steps) ? raw.steps : stepsFromWazaIds(raw.wazaIds)),
    createdAt: num(raw.createdAt, Date.now()),
  }
}

/** 整个状态的规整（读到脏数据也不会崩） */
export function normalizeState(raw) {
  const state = emptyState()
  const clips = Array.isArray(raw?.clips) ? raw.clips : []
  state.clips = clips.map(normalizeClip).filter(Boolean)
  const songs = raw?.songs && typeof raw.songs === 'object' ? raw.songs : {}
  for (const [key, value] of Object.entries(songs)) {
    const s = songOf(state, key)
    s.dancers = Array.isArray(value?.dancers)
      ? value.dancers
          .filter((d) => d && typeof d.key === 'string')
          .map((d, i) => ({
            key: d.key,
            name: String(d.name || `打师${i + 1}`),
            color: String(d.color || DANCER_COLORS[i % DANCER_COLORS.length]),
          }))
      : []
    s.keys = Array.isArray(value?.keys)
      ? value.keys
          .map((k) => {
            const pos = {}
            for (const [dk, p] of Object.entries(k?.pos || {})) {
              if (!p) continue
              pos[dk] = { x: Math.min(1, Math.max(0, num(p.x))), y: Math.min(1, Math.max(0, num(p.y))) }
            }
            return { t: Math.max(0, num(k?.t)), pos, hard: Boolean(k?.hard) }
          })
          .sort((a, b) => a.t - b.t)
      : []
    s.lines = {}
    for (const [dk, list] of Object.entries(value?.lines || {})) {
      if (!Array.isArray(list)) continue
      s.lines[dk] = list
        .map((seg) => ({ at: Math.max(0, num(seg?.at)), steps: normalizeSteps(seg?.steps) }))
        .sort((a, b) => a.at - b.at)
    }
  }
  return state
}

/* ---------------- v1 → v2 迁移 ---------------- */

export function migrateV1(parsedV1) {
  const state = emptyState()
  const clips = Array.isArray(parsedV1?.clips) ? parsedV1.clips : []
  state.clips = clips.map(normalizeClip).filter(Boolean)
  return state
}

/** 是否需要迁移：v2 没有但 v1 有 */
export function needsMigration(v2raw, v1raw) {
  return !v2raw && Boolean(v1raw)
}

/* ---------------- 增删改查 ---------------- */

function newId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

export function songKeyOf(song) {
  if (!song || !song.fileName) return ''
  return `${song.fileName}::${Math.round(num(song.duration))}`
}

export function addClipToState(state, { song, name, a, b, steps = [], note = '' }) {
  const clip = {
    id: newId(),
    songKey: songKeyOf(song),
    fileName: song.fileName,
    duration: Math.round(num(song.duration)),
    name: String(name || '片段').trim() || '片段',
    a: num(a),
    b: num(b),
    note: String(note || ''),
    steps: normalizeSteps(steps),
    createdAt: Date.now(),
  }
  state.clips.push(clip)
  return clip
}

export function updateClipInState(state, id, patch) {
  const clip = state.clips.find((c) => c.id === id)
  if (!clip) return null
  const next = { ...clip, ...patch }
  if (patch.steps) next.steps = normalizeSteps(patch.steps)
  if (patch.a !== undefined) next.a = num(patch.a)
  if (patch.b !== undefined) next.b = num(patch.b)
  if (patch.name !== undefined) next.name = String(patch.name || '片段').trim() || '片段'
  if (patch.note !== undefined) next.note = String(patch.note || '')
  Object.assign(clip, next)
  return clip
}

export function removeClipFromState(state, id) {
  const i = state.clips.findIndex((c) => c.id === id)
  if (i !== -1) state.clips.splice(i, 1)
  return i !== -1
}

export function clipsOfSongIn(state, song) {
  const k = songKeyOf(song)
  if (!k) return []
  return state.clips.filter((c) => c.songKey === k).sort((x, y) => x.a - y.a)
}

export function clipsBySongIn(state) {
  const map = new Map()
  for (const c of state.clips) {
    if (!map.has(c.songKey)) {
      map.set(c.songKey, { songKey: c.songKey, fileName: c.fileName, duration: c.duration, clips: [] })
    }
    map.get(c.songKey).clips.push(c)
  }
  const groups = [...map.values()]
  for (const g of groups) g.clips.sort((x, y) => x.a - y.a)
  return groups
}

/* ---------------- 导出文本 ---------------- */

function fmtClock(t) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function toTextOfGroup(group, nameOf) {
  const lines = [`【${group.fileName}】${fmtClock(group.duration)}`]
  group.clips.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.name}　${fmtClock(c.a)} – ${fmtClock(c.b)}`)
    if (c.steps.length) {
      lines.push('   ' + c.steps.map((s, k) => `${k + 1}.${stepLabel(s, nameOf)}`).join(' → '))
    } else {
      lines.push('   （还没有动作）')
    }
    if (c.note) lines.push(`   备注：${c.note}`)
  })
  return lines.join('\n')
}

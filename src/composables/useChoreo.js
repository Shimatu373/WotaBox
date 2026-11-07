import { reactive, watch } from 'vue'
import {
  addClipToState,
  clipsBySongIn,
  clipsOfSongIn,
  emptyState,
  migrateV1,
  needsMigration,
  normalizeState,
  removeClipFromState,
  songKeyOf,
  songOf,
  textStep,
  toTextOfGroup,
  updateClipInState,
  wazaStep,
} from './choreoModel.js'

/**
 * 编排片段：歌曲片段（时间轴标注）+ 按顺序的动作序列
 *
 * v2 起：
 *   - 动作从 wazaIds 升级为 steps，支持「引用图鉴技」和「自定义文本（原创/缝合）」
 *   - 每首歌另有 songs[songKey] 保存打师名单、走位关键帧、各打师的动作线
 *
 * 迁移：v1 的 wota:choreo:v1 若存在且 v2 为空，第一次加载时自动转换；v1 原样保留不删。
 */

const KEY = 'wota:choreo:v2'
const LEGACY_KEY = 'wota:choreo:v1'

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadInitial() {
  const v2 = readJson(KEY)
  if (v2) return normalizeState(v2)

  const v1 = readJson(LEGACY_KEY)
  if (needsMigration(v2, v1)) {
    const migrated = migrateV1(v1)
    // 立刻落盘成 v2，v1 留着（只读备份，避免迁移出问题时数据没了）
    try {
      localStorage.setItem(KEY, JSON.stringify(migrated))
    } catch {
      /* 忽略 */
    }
    return migrated
  }
  return emptyState()
}

export const choreoStore = reactive(loadInitial())

/** 立刻写盘：不要只依赖 watch —— 用户点完保存马上关标签页时，watch 的异步 flush 会丢数据 */
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(choreoStore))
  } catch {
    /* 忽略 */
  }
}

// 走位关键帧之类可能被直接改（不经下面这些函数），用深度 watch 兜底
watch(choreoStore, persist, { deep: true })

/* ---------------- 片段 ---------------- */

export function songKey(song) {
  return songKeyOf(song)
}

export function clipsOfSong(song) {
  return clipsOfSongIn(choreoStore, song)
}

export function clipsBySong() {
  return clipsBySongIn(choreoStore)
}

export function addClip({ song, name, a, b, steps, note = '' }) {
  const clip = addClipToState(choreoStore, { song, name, a, b, steps, note })
  persist()
  return clip
}

export function updateClip(id, patch) {
  const clip = updateClipInState(choreoStore, id, patch)
  persist()
  return clip
}

export function removeClip(id) {
  const done = removeClipFromState(choreoStore, id)
  if (done) persist()
  return done
}

export function toText(group, nameOf) {
  return toTextOfGroup(group, nameOf)
}

/* ---------------- 站位 / 走位 ---------------- */

/** 取某首歌的打师名单与走位（不存在会自动建） */
export function stageOf(songKeyValue) {
  return songOf(choreoStore, songKeyValue)
}

/* ---------------- 小工具 ---------------- */

export function fmtClock(t) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export { textStep, wazaStep }

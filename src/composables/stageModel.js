/**
 * 站位 / 走位模型（纯函数，可脱离浏览器测）
 *
 * 一首歌的站位数据（存在 choreoStore.songs[songKey]）：
 *   dancers: [{ key, name, color }]
 *   keys:    [{ t, pos: { dancerKey: {x, y} }, hard? }]   // 归一化坐标 0–1，按 t 升序
 *   lines:   { dancerKey: [{ at, steps[] }] }             // 该打师在整首歌里的动作线
 *
 * 「上下场 / 接力」不用额外字段：**某帧里有这个打师的坐标＝在场，没有＝不在场**，
 * 采样时按前后帧推断出淡入淡出（alpha）与位置。
 */

import { normalizeSteps, DANCER_COLORS } from './choreoModel.js'

export const KEY_EPS = 0.06 // 同一时间点判定阈值（秒）

/* ---------------- 打师 ---------------- */

function nextColor(stage) {
  const used = new Set(stage.dancers.map((d) => d.color))
  return DANCER_COLORS.find((c) => !used.has(c)) || DANCER_COLORS[stage.dancers.length % DANCER_COLORS.length]
}

function freshKey(stage) {
  let i = 1
  const taken = new Set(stage.dancers.map((d) => d.key))
  while (taken.has(`d${i}`)) i++
  return `d${i}`
}

export function addDancer(stage, name) {
  const dancer = {
    key: freshKey(stage),
    name: String(name || `打师${stage.dancers.length + 1}`).trim(),
    color: nextColor(stage),
  }
  stage.dancers.push(dancer)
  // 给个默认站位：沿水平方向均匀铺开，竖直居中偏下
  const i = stage.dancers.length - 1
  const x = (i + 1) / (stage.dancers.length + 1)
  setPos(stage, dancer.key, 0, x, 0.7)
  return dancer
}

export function renameDancer(stage, key, name) {
  const d = stage.dancers.find((x) => x.key === key)
  if (d) d.name = String(name || '').trim() || d.name
  return d
}

export function removeDancer(stage, key) {
  const i = stage.dancers.findIndex((d) => d.key === key)
  if (i === -1) return false
  stage.dancers.splice(i, 1)
  for (const k of stage.keys) delete k.pos[key]
  stage.keys = stage.keys.filter((k) => Object.keys(k.pos).length > 0)
  delete stage.lines[key]
  return true
}

/* ---------------- 走位关键帧 ---------------- */

export const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))

/**
 * 在时间 t 写一个关键帧：只更新该打师的坐标，其它打师保留。
 * 已存在接近 t 的帧就直接改，避免拖动时刷出一堆重复帧。
 */
export function setPos(stage, dancerKey, t, x, y, { hard } = {}) {
  const time = Math.max(0, Number(t) || 0)
  let key = stage.keys.find((k) => Math.abs(k.t - time) <= KEY_EPS)
  if (!key) {
    key = { t: Math.round(time * 100) / 100, pos: {} }
    stage.keys.push(key)
    stage.keys.sort((a, b) => a.t - b.t)
  }
  key.pos[dancerKey] = { x: clamp01(x), y: clamp01(y) }
  if (hard !== undefined) key.hard = Boolean(hard)
  return key
}

/** 把某个打师从时间 t 的关键帧里移除（= 在这一帧离场） */
export function clearPos(stage, dancerKey, t, { createIfMissing = true } = {}) {
  const time = Math.max(0, Number(t) || 0)
  let key = stage.keys.find((k) => Math.abs(k.t - time) <= KEY_EPS)
  if (!key) {
    if (!createIfMissing) return null
    key = { t: Math.round(time * 100) / 100, pos: {} }
    stage.keys.push(key)
    stage.keys.sort((a, b) => a.t - b.t)
  }
  delete key.pos[dancerKey]
  return key
}

/**
 * 在时间 t 补一个「完整队形」的关键帧。
 *
 * 修一个真实的坑：拖某个圆点时如果直接在 t 新建帧，这一帧里就只有他一个人，
 * 采样时其他人会被判定成「不在场」→ 整队自动淡出。
 * 所以新建帧前先把当前画面上所有**在场**的打师位置灌进去（已在帧里的不覆盖）。
 */
export function seedKey(stage, t, sampled) {
  const time = Math.max(0, Number(t) || 0)
  let key = stage.keys.find((k) => Math.abs(k.t - time) <= KEY_EPS)
  if (!key) {
    key = { t: Math.round(time * 100) / 100, pos: {} }
    stage.keys.push(key)
    stage.keys.sort((a, b) => a.t - b.t)
  }
  for (const [dk, p] of Object.entries(sampled || {})) {
    if (!p || (p.alpha ?? 1) < 0.05) continue // 已经淡出的不补
    if (!key.pos[dk]) key.pos[dk] = { x: clamp01(p.x), y: clamp01(p.y) }
  }
  return key
}

export function removeKeyAt(stage, t) {
  const i = stage.keys.findIndex((k) => Math.abs(k.t - t) <= KEY_EPS)
  if (i === -1) return false
  stage.keys.splice(i, 1)
  return true
}

/**
 * 把某个关键帧改到新时间（高精度编辑 / 逐帧微调用）。
 * 撞到别的帧就不动 —— 两帧合并会丢数据，宁可让调用方提示一下。
 */
export function retimeKey(stage, fromT, toT) {
  const key = stage.keys.find((k) => Math.abs(k.t - fromT) <= KEY_EPS)
  if (!key) return null
  const target = Math.max(0, Math.round((Number(toT) || 0) * 1000) / 1000)
  const clash = stage.keys.some((k) => k !== key && Math.abs(k.t - target) <= KEY_EPS)
  if (clash) return { key, moved: false, t: key.t }
  key.t = target
  stage.keys.sort((a, b) => a.t - b.t)
  return { key, moved: true, t: target }
}

/** 相对移动 delta 秒（逐帧用 1/30） */
export function moveKey(stage, t, delta) {
  const key = stage.keys.find((k) => Math.abs(k.t - t) <= KEY_EPS)
  if (!key) return null
  return retimeKey(stage, t, key.t + delta)
}

/**
 * 找这个打师上一次出现的位置（优先取 beforeT 之前最近的一次，否则任意一次）。
 * 「让他上场」时用它把圆点放回原位，而不是凭空跳到舞台中央。
 */
export function lastPosOf(stage, dancerKey, beforeT = Infinity) {
  const withPos = stage.keys.filter((k) => k.pos[dancerKey])
  if (!withPos.length) return null
  const before = [...withPos].filter((k) => k.t <= beforeT + 1e-6).sort((a, b) => b.t - a.t)[0]
  const pick = before || [...withPos].sort((a, b) => a.t - b.t)[0]
  return { ...pick.pos[dancerKey] }
}

export function toggleHard(stage, t) {
  const key = stage.keys.find((k) => Math.abs(k.t - t) <= KEY_EPS)
  if (!key) return null
  key.hard = !key.hard
  return key
}

/* ---------------- 上场方向 ---------------- */

export const ENTER_DIRS = ['left', 'right', 'top', 'bottom']
const OFF_STAGE = 0.12 // 起点在舞台外多远（按宽高的比例）

/** 没指定方向时按目标位置自动选最近的边 */
export function autoEdge(pos) {
  const dist = [pos.x, 1 - pos.x, pos.y, 1 - pos.y]
  return ENTER_DIRS[dist.indexOf(Math.min(...dist))]
}

/** 某个方向对应的舞台外起点 */
export function enterStart(pos, dir) {
  switch (dir) {
    case 'left':
      return { x: -OFF_STAGE, y: pos.y }
    case 'right':
      return { x: 1 + OFF_STAGE, y: pos.y }
    case 'top':
      return { x: pos.x, y: -OFF_STAGE }
    default:
      return { x: pos.x, y: 1 + OFF_STAGE }
  }
}

/** 给「这一帧开始出现」的打师指定入场方向（null / 'auto' 表示清掉，走自动判断） */
export function setEnterDir(stage, dancerKey, t, dir) {
  const time = Math.max(0, Number(t) || 0)
  let key = stage.keys.find((k) => Math.abs(k.t - time) <= KEY_EPS)
  if (!key) {
    key = { t: Math.round(time * 100) / 100, pos: {} }
    stage.keys.push(key)
    stage.keys.sort((a, b) => a.t - b.t)
  }
  if (!key.enter) key.enter = {}
  if (!dir || dir === 'auto') delete key.enter[dancerKey]
  else if (ENTER_DIRS.includes(dir)) key.enter[dancerKey] = dir
  if (!Object.keys(key.enter).length) delete key.enter
  return key
}

/** 设置这一帧的上下场过渡时长（秒）。传 null/0 表示回到「占满整段间隔」 */
export function setKeyDuration(stage, t, dur) {
  const time = Math.max(0, Number(t) || 0)
  let key = stage.keys.find((k) => Math.abs(k.t - time) <= KEY_EPS)
  if (!key) {
    key = { t: Math.round(time * 100) / 100, pos: {} }
    stage.keys.push(key)
    stage.keys.sort((a, b) => a.t - b.t)
  }
  const v = Number(dur)
  if (dur === null || dur === undefined || !Number.isFinite(v) || v <= 0) delete key.dur
  else key.dur = Math.min(30, Math.max(0.05, Math.round(v * 100) / 100))
  return key
}

/* ---------------- 采样（位置 + 淡入淡出） ---------------- */

const lerp = (a, b, p) => a + (b - a) * p

/**
 * 求 time 时刻每个打师的显示状态：{ [dancerKey]: { x, y, alpha } }
 *
 * 规则（相邻两帧 prev → next）：
 *   两帧都有  → 位置线性插值，alpha 1
 *   prev 有、next 没有 → 从 prev 位置淡出（alpha 1 → 0）
 *   prev 没有、next 有 → 在 next 位置淡入（alpha 0 → 1）
 *   两帧都没有 → 不显示
 *   next.hard = true → 到 next 之前保持 prev 状态，到点瞬间切换（不插值）
 */
export function sampleAt(stage, time) {
  const out = {}
  const keys = stage.keys
  if (!keys.length) return out

  const t = Math.max(0, Number(time) || 0)
  let prev = null
  let next = null
  for (const k of keys) {
    if (k.t <= t + 1e-6) prev = k
    else {
      next = k
      break
    }
  }

  const all = new Set()
  if (prev) for (const d of Object.keys(prev.pos)) all.add(d)
  if (next && !(next.hard && next.t > t)) for (const d of Object.keys(next.pos)) all.add(d)

  const span = prev && next ? Math.max(1e-6, next.t - prev.t) : 1
  // 走位（两帧都在场）按整段插值；上下场用「这一帧指定的时长」，默认才退回整段
  const moveP = prev && next && !next.hard ? Math.min(1, Math.max(0, (t - prev.t) / span)) : 0
  const transDur = next ? Math.min(span, Math.max(0.05, Number(next.dur) || span)) : span
  const transP = next ? Math.min(1, Math.max(0, (t - (next.t - transDur)) / transDur)) : 0

  for (const d of all) {
    const a = prev?.pos?.[d]
    const b = next?.pos?.[d]

    if (a && b) {
      if (next.hard && t >= next.t - 1e-6) out[d] = { x: b.x, y: b.y, alpha: 1 }
      else out[d] = { x: lerp(a.x, b.x, moveP), y: lerp(a.y, b.y, moveP), alpha: 1 }
      continue
    }
    if (a && !b) {
      // 只在 prev 有 → 往后淡出；已经过了 next 就彻底离场
      if (!next) out[d] = { x: a.x, y: a.y, alpha: 1 }
      else if (next.hard) out[d] = { x: a.x, y: a.y, alpha: 1 }
      else out[d] = { x: a.x, y: a.y, alpha: Math.max(0, 1 - transP) }
      continue
    }
    if (!a && b) {
      // 上一帧没有、这一帧有 → 从舞台边缘滑入 + 淡入
      //   方向优先用关键帧里指定的（key.enter[d]），没有就按目标位置选最近的边
      //   硬切 / 没有前一帧（第一帧）时不做动画，直接出现
      if (next.hard || !prev) {
        out[d] = { x: b.x, y: b.y, alpha: t >= (next?.t ?? 0) - 1e-6 ? 1 : 0 }
      } else {
        const dir = (next.enter && next.enter[d]) || autoEdge(b)
        const from = enterStart(b, dir)
        out[d] = {
          x: lerp(from.x, b.x, transP),
          y: lerp(from.y, b.y, transP),
          alpha: Math.min(1, transP),
        }
      }
    }
  }
  return out
}

/* ---------------- 打师动作线 ---------------- */

export function segmentsOf(stage, dancerKey) {
  const list = stage.lines?.[dancerKey]
  return Array.isArray(list) ? [...list].sort((x, y) => x.at - y.at) : []
}

/** 落在片段 [a, b) 里的动作段 */
export function segmentsInRange(stage, dancerKey, a, b) {
  return segmentsOf(stage, dancerKey).filter((s) => s.at >= a - 1e-6 && s.at < b - 1e-6)
}

/**
 * 把某个片段的动作复制给这个打师。
 *
 * 归属用 **clipId** 而不是时间：片段的时间区间可以相邻甚至重叠，
 * 按区间/时间近似判断会让「导入第 4 段」把第 3 段的动作覆盖或串过去。
 * 老数据没有 clipId 的，用「同一片段起点 ±0.5 秒」兜底兼容一次。
 */
export function importClipSteps(stage, dancerKey, clip) {
  if (!Array.isArray(stage.lines[dancerKey])) stage.lines[dancerKey] = []
  const list = stage.lines[dancerKey]
  const steps = normalizeSteps(clip.steps).map((s) => ({ ...s }))
  let seg = list.find((s) => s.clipId === clip.id)
  if (!seg) seg = list.find((s) => !s.clipId && Math.abs(s.at - clip.a) <= 0.5)
  if (seg) {
    seg.steps = steps
    seg.at = clip.a
    seg.clipId = clip.id
  } else {
    list.push({ at: clip.a, clipId: clip.id, steps })
  }
  list.sort((x, y) => x.at - y.at)
  return list
}

/** 这个打师在某个片段上的动作段（按 clipId 归属，老数据退回区间判断） */
export function segmentsOfClip(stage, dancerKey, clip) {
  return segmentsOf(stage, dancerKey).filter((s) =>
    s.clipId ? s.clipId === clip.id : s.at >= clip.a - 1e-6 && s.at < clip.b - 1e-6,
  )
}

/** 清空某打师在某片段上的动作（只删归属这个片段的段） */
export function removeClipSegments(stage, dancerKey, clip) {
  const list = stage.lines?.[dancerKey]
  if (!Array.isArray(list)) return 0
  let removed = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]
    const own = s.clipId ? s.clipId === clip.id : s.at >= clip.a - 1e-6 && s.at < clip.b - 1e-6
    if (own) {
      list.splice(i, 1)
      removed++
    }
  }
  return removed
}



export function removeSegment(stage, dancerKey, index) {
  const list = stage.lines?.[dancerKey]
  if (!Array.isArray(list) || index < 0 || index >= list.length) return false
  list.splice(index, 1)
  return true
}

/** 复制某个打师的整条动作线（深拷贝，供粘贴 / 内部剪贴板用） */
export function cloneSegments(stage, dancerKey) {
  return segmentsOf(stage, dancerKey).map((s) => ({ at: s.at, steps: s.steps.map((x) => ({ ...x })) }))
}

/** 把动作线写进另一个打师（覆盖） */
export function pasteSegments(stage, dancerKey, segments) {
  stage.lines[dancerKey] = segments.map((s) => ({ at: s.at, steps: s.steps.map((x) => ({ ...x })) }))
  return stage.lines[dancerKey]
}

/**
 * 现在能不能拖动某个圆点。
 *
 * 三条限制，都是为了「别手一滑就把别人挪了」：
 *   1. 必须处于走位编辑模式
 *   2. 只能是当前选中的打师
 *   3. 必须真的在场（alpha > 0.05）—— 没上场的打师根本不该被碰到
 */
export function canDragDancer({ selectedKey, dancerKey, recordMode, alpha }) {
  if (!recordMode) return false
  if (!dancerKey || selectedKey !== dancerKey) return false
  return (Number(alpha) || 0) > 0.05
}

/** 某个打师还没被分配动作的片段（用于「从片段导入」提示） */
export function clipsForDancer(stage, dancerKey, clips) {
  return clips.map((c) => {
    const segs = segmentsInRange(stage, dancerKey, c.a, c.b)
    return { clip: c, segments: segs }
  })
}

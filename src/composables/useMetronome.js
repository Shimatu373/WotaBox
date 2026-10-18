import { ref, shallowRef, onUnmounted } from 'vue'
import { bpm as sharedBpm } from './sharedState.js'

/**
 * 节拍器核心（Web Audio 前瞻调度）
 *
 * 为什么不用 setInterval 直接发声？
 *   JS 定时器有累积漂移，且和声卡时钟不同步，跑久了节拍会"散"。
 * 所以这里分两个角色：
 *   1. 定时器（25ms 心跳）：只负责"提前把未来的拍子排进音频时钟"
 *   2. 音频时钟（AudioContext.currentTime）：真正决定发声时刻，精确到采样
 * 视觉高亮则从同一个排程队列里取，保证"听到的和看到的"是同一拍。
 */

const LOOKAHEAD_MS = 25 // 调度器心跳（毫秒）
const SCHEDULE_AHEAD = 0.12 // 提前排程的时间窗（秒）
const START_OFFSET = 0.08 // 按下开始后，第一拍留给用户的余量（秒）

// 四层音色：组头 > 八拍头 > 普通拍 > 预备拍
const CLICK = {
  groupStart: { freq: 1760, gain: 0.5, dur: 0.07 },
  barStart: { freq: 1318, gain: 0.32, dur: 0.055 },
  beat: { freq: 880, gain: 0.16, dur: 0.04 },
  countIn: { freq: 660, gain: 0.26, dur: 0.05 },
}

export function useMetronome({ bpm: initialBpm = 120, countIn: initialCountIn = 4 } = {}) {
  const bpm = sharedBpm // 与 BPM 测试面板共享，测完能一键送进来
  const countIn = ref(initialCountIn) // 预备拍数量：0 = 关闭
  const isRunning = ref(false)
  const beatIndex = ref(0) // 累计拍数；预备拍阶段为负数（-4..-1）
  const accentEnabled = ref(true) // 是否开启八拍头重音

  const ctxRef = shallowRef(null)
  const queue = [] // [{ time, beat }] 已排程但还没响的拍子
  const nodes = [] // 正在发声的振荡器，停止时要立刻掐掉
  let timerId = null
  let nextNoteTime = 0
  let nextBeat = 0
  let wakeLock = null

  function safeBpm() {
    const v = Number(bpm.value)
    if (!Number.isFinite(v) || v <= 0) return 120
    return Math.min(240, Math.max(30, v))
  }

  function safeCountIn() {
    const v = Number(countIn.value)
    if (!Number.isFinite(v) || v <= 0) return 0
    return Math.min(16, Math.round(v))
  }

  function ensureContext() {
    if (!ctxRef.value) {
      const AC = window.AudioContext || window.webkitAudioContext
      ctxRef.value = new AC()
    }
    return ctxRef.value
  }

  /** 在音频时钟的 time 时刻，安排一次"咔" */
  function playClick(ctx, time, kind) {
    const cfg = CLICK[kind] || CLICK.beat
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(cfg.freq, time)

    // 极短的起音 + 指数衰减，听起来像木鱼/鼓点而不是"哔——"
    gainNode.gain.setValueAtTime(0.0001, time)
    gainNode.gain.exponentialRampToValueAtTime(cfg.gain, time + 0.002)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + cfg.dur)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(time)
    osc.stop(time + cfg.dur + 0.02)

    osc.addEventListener('ended', () => {
      const i = nodes.indexOf(osc)
      if (i !== -1) nodes.splice(i, 1)
      try {
        osc.disconnect()
        gainNode.disconnect()
      } catch {
        /* 忽略 */
      }
    })
    nodes.push(osc)
  }

  /** 判定这一拍属于哪一层 */
  function kindOf(beat) {
    if (beat < 0) return 'countIn' // 预备拍：低音，不带重音
    const posInBar = beat % 8
    if (posInBar !== 0) return 'beat' // 普通拍
    if (beat % 32 === 0) return 'groupStart' // 四个八拍的第一拍
    return accentEnabled.value ? 'barStart' : 'beat'
  }

  /** 把时间窗内该响的拍子，全部排进音频时钟 */
  function schedule() {
    const ctx = ctxRef.value
    if (!ctx) return
    const horizon = ctx.currentTime + SCHEDULE_AHEAD
    let guard = 0
    while (nextNoteTime < horizon && guard < 64) {
      playClick(ctx, nextNoteTime, kindOf(nextBeat))
      queue.push({ time: nextNoteTime, beat: nextBeat })
      nextBeat += 1
      nextNoteTime += 60 / safeBpm()
      guard += 1
    }
  }

  /** 心跳：推进视觉 + 继续排程 */
  function tick() {
    const ctx = ctxRef.value
    if (!ctx) return
    const now = ctx.currentTime
    while (queue.length && queue[0].time <= now) {
      beatIndex.value = queue.shift().beat
    }
    schedule()
  }

  // ---- 屏幕常亮：练习时不能黑屏 ----
  async function requestWakeLock() {
    try {
      if (wakeLock || !('wakeLock' in navigator)) return
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => {
        wakeLock = null
      })
    } catch {
      wakeLock = null
    }
  }

  function releaseWakeLock() {
    try {
      if (wakeLock) wakeLock.release()
    } catch {
      /* 忽略 */
    }
    wakeLock = null
  }

  async function start() {
    if (isRunning.value) return
    const ctx = ensureContext()
    // 移动端必须在用户手势里恢复音频上下文，否则静音
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        /* 忽略 */
      }
    }

    const lead = safeCountIn()

    queue.length = 0
    nextBeat = -lead // 预备拍用负数表示：-4, -3, -2, -1
    beatIndex.value = -lead
    nextNoteTime = ctx.currentTime + START_OFFSET

    schedule()
    timerId = window.setInterval(tick, LOOKAHEAD_MS)
    isRunning.value = true
    requestWakeLock()
  }

  function stop() {
    isRunning.value = false
    if (timerId !== null) {
      window.clearInterval(timerId)
      timerId = null
    }
    queue.length = 0
    // 掐掉已经排进音频时钟、但还没响的拍子（最多 120ms）
    for (const osc of nodes.slice()) {
      try {
        osc.stop(0)
      } catch {
        /* 忽略 */
      }
    }
    nodes.length = 0
    releaseWakeLock()
  }

  function toggle() {
    return isRunning.value ? stop() : start()
  }

  function handleVisibility() {
    // 切回前台时重新申请屏幕常亮
    if (document.visibilityState === 'visible' && isRunning.value) {
      requestWakeLock()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility)
  }

  onUnmounted(() => {
    stop()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    const ctx = ctxRef.value
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {})
    }
  })

  return { bpm, countIn, isRunning, beatIndex, accentEnabled, start, stop, toggle }
}

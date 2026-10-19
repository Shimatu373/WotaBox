import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { getAudioContext, resumeAudio } from './sharedAudio.js'
import { analyzeAudioBuffer } from './bpmAnalysis.js'
import { bpm as sharedBpm } from './sharedState.js'

/**
 * 音乐播放器（Web Audio 版）
 *
 * 为什么不用 <audio> 标签？
 *   靠 currentTime 跳回去做循环，每次接头会有几十毫秒的空隙，练舞时节奏会断。
 *   AudioBufferSourceNode 的 loopStart / loopEnd 是采样级精确的，完全无缝。
 *
 * 代价：整首歌要解码进内存。4 分钟的立体声约 80MB（Float32），
 *       老手机上属于"能用但别同时开太多 App"的量级。
 */

const STORE_PREFIX = 'wota:player:'

export function fmtTime(t) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function useAudioPlayer() {
  const buffer = shallowRef(null)
  const fileName = ref('')
  const duration = ref(0)
  const isPlaying = ref(false)
  const position = ref(0)
  const loopA = ref(0)
  const loopB = ref(0)
  const loopEnabled = ref(true)
  const rate = ref(1)
  const loading = ref(false)
  const error = ref('')
  const bpmInfo = ref(null)
  const bpmAnalyzing = ref(false)

  let source = null
  let startedAt = 0 // 开始播放时的 ctx.currentTime
  let offsetAtStart = 0 // 开始播放时在 buffer 里的位置
  let timer = null
  let wakeLock = null

  const hasAudio = computed(() => !!buffer.value)
  const loopLen = computed(() => Math.max(0, loopB.value - loopA.value))
  const canLoop = computed(() => loopEnabled.value && loopLen.value > 0.2)

  // ---------- 载入 ----------
  async function load(file) {
    loading.value = true
    error.value = ''
    try {
      const raw = await file.arrayBuffer()
      const ctx = getAudioContext()
      const decoded = await ctx.decodeAudioData(raw)

      buffer.value = decoded
      fileName.value = file.name
      duration.value = decoded.duration
      position.value = 0
      loopA.value = 0
      loopB.value = Math.min(decoded.duration, 30)
      rate.value = 1
      bpmInfo.value = null
      bpmAnalyzing.value = true
      // 让"分析中"先渲染出来，再做同步计算
      await new Promise((r) => setTimeout(r, 20))
      try {
        const res = analyzeAudioBuffer(decoded)
        bpmInfo.value = res
        sharedBpm.value = Math.round(res.bpm)
      } catch {
        bpmInfo.value = null
      } finally {
        bpmAnalyzing.value = false
      }
    } catch (e) {
      error.value = e?.message || '解码失败，换个文件试试'
    } finally {
      loading.value = false
    }
  }

  function reset() {
    stopSource()
    buffer.value = null
    fileName.value = ''
    duration.value = 0
    position.value = 0
    isPlaying.value = false
    bpmInfo.value = null
    error.value = ''
  }

  // ---------- 播放控制 ----------
  function computePosition() {
    if (!isPlaying.value || !source) return position.value
    const ctx = getAudioContext()
    const elapsed = (ctx.currentTime - startedAt) * rate.value
    let t = offsetAtStart + elapsed
    if (canLoop.value) {
      const len = loopLen.value
      if (t > loopB.value) t = loopA.value + ((t - loopB.value) % len)
    }
    return clamp(t, 0, duration.value)
  }

  function stopSource() {
    if (source) {
      try {
        source.onended = null
        source.stop(0)
        source.disconnect()
      } catch {
        /* 已经停了 */
      }
      source = null
    }
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function startTimer() {
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      position.value = computePosition()
    }, 100)
  }

  async function play() {
    if (!buffer.value || isPlaying.value) return
    const ctx = await resumeAudio()
    stopSource()

    const src = ctx.createBufferSource()
    src.buffer = buffer.value
    src.playbackRate.value = rate.value
    if (canLoop.value) {
      src.loop = true
      src.loopStart = loopA.value
      src.loopEnd = loopB.value
    }

    // 起点：在循环区间内就接着放，在区间外就跳到 A
    let startOffset = position.value
    if (canLoop.value && (startOffset < loopA.value || startOffset >= loopB.value - 0.05)) {
      startOffset = loopA.value
    }
    startOffset = clamp(startOffset, 0, Math.max(0, buffer.value.duration - 0.05))

    src.connect(ctx.destination)
    src.start(0, startOffset)

    source = src
    startedAt = ctx.currentTime
    offsetAtStart = startOffset
    position.value = startOffset
    isPlaying.value = true

    src.onended = () => {
      if (source === src) {
        isPlaying.value = false
        source = null
      }
    }

    startTimer()
    requestWakeLock()
  }

  function pause() {
    if (!isPlaying.value) return
    position.value = computePosition()
    stopSource()
    isPlaying.value = false
    releaseWakeLock()
  }

  function toggle() {
    return isPlaying.value ? pause() : play()
  }

  function seek(t) {
    const target = clamp(Number(t) || 0, 0, duration.value)
    position.value = target
    if (isPlaying.value) {
      const wasPlaying = true
      stopSource()
      isPlaying.value = false
      if (wasPlaying) play()
    }
  }

  function setRate(r) {
    const v = Math.min(1.5, Math.max(0.5, Number(r) || 1))
    if (Math.abs(v - rate.value) < 1e-6) return
    if (isPlaying.value && source) {
      // 不重启音源：重设基准点后直接改速率，播放位置保持连续，拖滑条不会卡顿
      const pos = computePosition()
      rate.value = v
      startedAt = getAudioContext().currentTime
      offsetAtStart = pos
      source.playbackRate.value = v
    } else {
      rate.value = v
    }
  }

  /** 把某个 BPM 写进节拍器（候选值修正用） */
  function applyBpm(b) {
    if (b == null) return
    sharedBpm.value = Math.min(220, Math.max(40, Math.round(Number(b))))
  }

  // ---------- A-B 点 ----------
  function applyLoopToSource() {
    if (source) {
      source.loop = canLoop.value
      source.loopStart = loopA.value
      source.loopEnd = loopB.value
    }
  }

  function setA() {
    loopA.value = clamp(position.value, 0, Math.max(0, loopB.value - 0.2))
    applyLoopToSource()
  }

  function setB() {
    loopB.value = clamp(position.value, Math.min(duration.value, loopA.value + 0.2), duration.value)
    applyLoopToSource()
  }

  function nudgeA(d) {
    loopA.value = clamp(loopA.value + d, 0, Math.max(0, loopB.value - 0.2))
    applyLoopToSource()
  }

  function nudgeB(d) {
    loopB.value = clamp(loopB.value + d, Math.min(duration.value, loopA.value + 0.2), duration.value)
    applyLoopToSource()
  }

  function toggleLoop() {
    loopEnabled.value = !loopEnabled.value
    applyLoopToSource()
  }

  // ---------- 屏幕常亮 ----------
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

  onUnmounted(() => {
    stopSource()
    releaseWakeLock()
    // 共用的 AudioContext 不在这里关闭
  })

  return {
    // 状态
    fileName,
    duration,
    isPlaying,
    position,
    loopA,
    loopB,
    loopEnabled,
    rate,
    loading,
    error,
    hasAudio,
    loopLen,
    canLoop,
    bpmInfo,
    bpmAnalyzing,
    // 操作
    load,
    reset,
    play,
    pause,
    toggle,
    seek,
    setRate,
    setA,
    setB,
    nudgeA,
    nudgeB,
    toggleLoop,
    applyBpm,
    fmtTime,
  }
}

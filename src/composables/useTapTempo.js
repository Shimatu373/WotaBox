import { computed, ref } from 'vue'

/**
 * 手动点拍测 BPM（Tap Tempo）
 *
 * 原理：记录相邻两次点击的间隔，取最近 N 个间隔的**中位数**换算成 BPM。
 * 用中位数而不是平均数，是因为偶尔手抖点错一下不会把结果带跑。
 *
 * 几个必要的保护：
 *   - 超过 2.5 秒没点：认为重新开始计数（不然中间停顿会被算成一个超长间隔）
 *   - 间隔 < 150ms（>400 BPM）或 > 2000ms（<30 BPM）：丢弃，多半是误触或走神
 *   - 只保留最近 8 个间隔：早期不熟的点击会自然被淘汰，结果越来越准
 */

const MAX_INTERVALS = 8
const RESET_MS = 2500
const MIN_INTERVAL = 150
const MAX_INTERVAL = 2000

export function useTapTempo() {
  const intervals = ref([]) // 最近若干个间隔（毫秒）
  const tapCount = ref(0)
  const bpm = ref(null)
  const lastTapAt = ref(0)

  function tap(now = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    const prev = lastTapAt.value
    lastTapAt.value = now

    if (!prev) {
      tapCount.value = 1
      return
    }

    const dt = now - prev

    // 停太久 → 重新开始
    if (dt > RESET_MS) {
      intervals.value = []
      tapCount.value = 1
      bpm.value = null
      return
    }

    // 明显误触 / 走神，丢弃但不清空
    if (dt < MIN_INTERVAL || dt > MAX_INTERVAL) return

    tapCount.value += 1
    const next = [...intervals.value, dt].slice(-MAX_INTERVALS)
    intervals.value = next

    const sorted = [...next].sort((a, b) => a - b)
    const mid = sorted.length >> 1
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

    bpm.value = Math.round((60000 / median) * 10) / 10
  }

  function reset() {
    intervals.value = []
    tapCount.value = 0
    bpm.value = null
    lastTapAt.value = 0
  }

  /** 点击间隔的离散程度：越小越稳 */
  const steadiness = computed(() => {
    const list = intervals.value
    if (list.length < 3) return null
    const mean = list.reduce((a, b) => a + b, 0) / list.length
    const variance = list.reduce((a, b) => a + (b - mean) ** 2, 0) / list.length
    const cv = Math.sqrt(variance) / mean // 变异系数

    if (cv < 0.03) return { label: '节奏很稳', cls: 'good', cv }
    if (cv < 0.08) return { label: '还算稳', cls: 'mid', cv }
    return { label: '有点抖，再点点看', cls: 'low', cv }
  })

  /** 最少点两下才有意义，四下有初步结果 */
  const canUse = computed(() => bpm.value != null && intervals.value.length >= 2)

  return { bpm, tapCount, intervals, tap, reset, steadiness, canUse }
}

import { ref, watch } from 'vue'

/**
 * 跨面板共享的状态。
 * BPM 同时被节拍器和 BPM 测试使用 —— 测出速度后可以一键送进节拍器。
 */

const KEY = 'wota:metronome:v1'

function loadBpm() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return 120
    const n = Number(JSON.parse(raw).bpm)
    if (Number.isFinite(n) && n >= 40 && n <= 220) return n
  } catch {
    /* 忽略 */
  }
  return 120
}

export const bpm = ref(loadBpm())

watch(bpm, (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ bpm: v }))
  } catch {
    /* 忽略 */
  }
})

/** 请求某个面板展开并滚动到它（配合 CollapsibleCard 里的监听） */
export function requestOpenPanel(id) {
  window.dispatchEvent(new CustomEvent('wota:open-panel', { detail: id }))
}

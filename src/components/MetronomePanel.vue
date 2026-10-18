<script setup>
import { computed, watch } from 'vue'
import { useMetronome } from '../composables/useMetronome.js'

const { bpm, isRunning, beatIndex, accentEnabled, toggle } = useMetronome({
  bpm: 120,
})

const MIN_BPM = 40
const MAX_BPM = 220

function nudge(delta) {
  const next = Number(bpm.value) + delta
  bpm.value = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(next)))
}

// 挡住手动输入 / 拖动越界的情况
watch(bpm, (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) {
    bpm.value = 120
    return
  }
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)))
  if (clamped !== n) bpm.value = clamped
})

// 当前处于 32 拍循环里的第几拍；未运行时为 -1（不高亮）
const groupPos = computed(() => (isRunning.value ? beatIndex.value % 32 : -1))

const cells = computed(() =>
  Array.from({ length: 32 }, (_, i) => ({
    i,
    groupStart: i === 0,
    barStart: i % 8 === 0,
    active: groupPos.value === i,
  }))
)

const statusText = computed(() => {
  if (!isRunning.value) return '准备就绪'
  const bar = Math.floor((beatIndex.value % 32) / 8) + 1
  const pos = (beatIndex.value % 8) + 1
  return `第 ${bar} 个八拍 · 第 ${pos} 拍`
})

const bpmNote = computed(() => {
  const n = Number(bpm.value)
  if (n < 90) return '慢速 · 适合拆解动作'
  if (n < 130) return '中速 · 常见副歌区间'
  if (n < 170) return '快速 · 需要一定熟练度'
  return '极快 · 注意保护手腕'
})
</script>

<template>
  <section class="card metro">
    <header class="head">
      <h2>节拍器</h2>
      <span class="mode">四个八拍一组</span>
    </header>

    <div class="readout">
      <span class="bpm-value">{{ bpm }}</span>
      <span class="bpm-unit">BPM</span>
    </div>

    <div class="bpm-control">
      <button class="step" type="button" aria-label="减速" @click="nudge(-5)">−5</button>
      <input
        v-model.number="bpm"
        class="slider"
        type="range"
        :min="MIN_BPM"
        :max="MAX_BPM"
        step="1"
      />
      <button class="step" type="button" aria-label="加速" @click="nudge(5)">+5</button>
    </div>
    <p class="bpm-note">{{ bpmNote }}</p>

    <div class="grid" :class="{ running: isRunning }">
      <div
        v-for="c in cells"
        :key="c.i"
        class="cell"
        :class="{
          'group-start': c.groupStart,
          'bar-start': c.barStart,
          active: c.active,
        }"
      >
        <span class="dot" />
      </div>
    </div>

    <div class="status">
      <span class="status-text">{{ statusText }}</span>
      <span class="legend">
        <i class="lg lg-group" />组头
        <i class="lg lg-bar" />八拍头
      </span>
    </div>

    <button class="primary" :class="{ stopping: isRunning }" type="button" @click="toggle">
      {{ isRunning ? '停止' : '开始' }}
    </button>

    <label class="switch">
      <input v-model="accentEnabled" type="checkbox" />
      <span class="track"><span class="thumb" /></span>
      <span class="switch-label">八拍头重音</span>
    </label>

    <p class="hint">运行时自动保持屏幕常亮。四个八拍为一组循环，组头最响。</p>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.head h2 {
  margin: 0;
}

.mode {
  font-size: 11px;
  color: #7f9ac0;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.readout {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin: 6px 0 10px;
}

.bpm-value {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}

.bpm-unit {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 1px;
}

.bpm-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step {
  flex: none;
  width: 46px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #17203a;
  color: #cfe3ff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease;
}

.step:active {
  background: #22304d;
}

.slider {
  flex: 1;
  appearance: none;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #2f6fd0, #4a8fe0);
  outline: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #2f6fd0;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
}

.slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #2f6fd0;
  cursor: pointer;
}

.bpm-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #7f9ac0;
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  margin: 16px 0 12px;
}

.cell {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #0f1729;
  transition: background 120ms ease;
}

.dot {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2b3c58;
  transition: transform 110ms ease, background 110ms ease, box-shadow 110ms ease;
}

.bar-start .dot {
  width: 10px;
  height: 10px;
  background: #35629b;
}

.group-start .dot {
  width: 13px;
  height: 13px;
  background: #4a8fe0;
  box-shadow: 0 0 8px rgba(74, 143, 224, 0.6);
}

.cell.active {
  background: #16233c;
}

.cell.active .dot {
  background: #ffffff;
  transform: scale(1.6);
  box-shadow: 0 0 14px rgba(120, 200, 255, 0.95);
}

.status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 12px;
}

.status-text {
  color: #9db6d6;
  font-variant-numeric: tabular-nums;
}

.legend {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7f9c;
  font-size: 11px;
}

.lg {
  display: inline-block;
  border-radius: 50%;
  margin-left: 6px;
}

.lg-group {
  width: 9px;
  height: 9px;
  background: #4a8fe0;
}

.lg-bar {
  width: 7px;
  height: 7px;
  background: #35629b;
}

.primary {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 4px;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(180deg, #3d86e8, #2a63c2);
  box-shadow: 0 6px 18px rgba(47, 111, 208, 0.35);
  transition: transform 100ms ease, box-shadow 100ms ease;
}

.primary:active {
  transform: translateY(1px);
  box-shadow: 0 3px 10px rgba(47, 111, 208, 0.3);
}

.primary.stopping {
  background: linear-gradient(180deg, #d9534f, #b23a36);
  box-shadow: 0 6px 18px rgba(217, 83, 79, 0.3);
}

.switch {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  position: relative;
  flex: none;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #22304d;
  transition: background 160ms ease;
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #7d90ab;
  transition: transform 160ms ease, background 160ms ease;
}

.switch input:checked + .track {
  background: #2f6fd0;
}

.switch input:checked + .track .thumb {
  transform: translateX(16px);
  background: #fff;
}

.switch-label {
  line-height: 1;
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>

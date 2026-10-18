<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import { bpm as sharedBpm, requestOpenPanel } from '../composables/sharedState.js'
import { analyzeBpm } from '../composables/bpmAnalysis.js'
import { useTapTempo } from '../composables/useTapTempo.js'

const mode = ref('auto') // auto | manual

// ---------- 自动测试 ----------
const fileName = ref('')
const status = ref('idle') // idle | decoding | analyzing | done | error
const errorMsg = ref('')
const result = ref(null)
const selected = ref(null)

const busy = computed(() => status.value === 'decoding' || status.value === 'analyzing')

const statusText = computed(() => {
  if (status.value === 'decoding') return '解码中…'
  if (status.value === 'analyzing') return '分析中…'
  return '选择音频文件'
})

async function handleFile(event) {
  const file = event.target.files?.[0]
  if (!file) return

  fileName.value = file.name
  errorMsg.value = ''
  result.value = null
  selected.value = null

  try {
    const r = await analyzeBpm(file, {
      onStatus: (s) => {
        status.value = s
      },
    })
    result.value = r
    selected.value = r.bpm
    status.value = 'done'
  } catch (e) {
    errorMsg.value = e?.message || '分析失败，换个文件试试'
    status.value = 'error'
  } finally {
    if (event.target) event.target.value = ''
  }
}

// ---------- 手动测试 ----------
const {
  bpm: tapBpm,
  tapCount,
  tap,
  reset: resetTap,
  steadiness,
  canUse,
} = useTapTempo()
const pulseKey = ref(0)

function onTap() {
  tap()
  pulseKey.value += 1
}

// 电脑上可以用空格 / 回车点拍，方便调试
function onKey(e) {
  if (mode.value !== 'manual') return
  if (e.code !== 'Space' && e.code !== 'Enter') return
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  e.preventDefault()
  onTap()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

// ---------- 共用 ----------
const activeBpm = computed(() => (mode.value === 'manual' ? tapBpm.value : selected.value))

function describe(b) {
  if (b < 90) return '慢速 · 适合拆解动作'
  if (b < 130) return '中速 · 常见副歌区间'
  if (b < 170) return '快速 · 需要一定熟练度'
  return '极快 · 注意保护手腕'
}

const practice = computed(() => {
  const b = Number(activeBpm.value)
  if (!b) return null
  const beat = 60 / b
  return {
    beatMs: Math.round(beat * 1000),
    bar: (beat * 8).toFixed(2),
    group: (beat * 32).toFixed(1),
    slow: Math.max(40, Math.round((b * 0.8) / 5) * 5),
    desc: describe(b),
  }
})

const confidenceLabel = computed(() => {
  const c = result.value?.confidence ?? 0
  if (c >= 0.45) return { text: '可信度高', cls: 'good' }
  if (c >= 0.25) return { text: '可信度一般', cls: 'mid' }
  return { text: '可信度低，建议核对', cls: 'low' }
})

const summary = computed(() => (activeBpm.value ? `${activeBpm.value} BPM` : '未测试'))

function sendToMetronome() {
  const b = Number(activeBpm.value)
  if (!b) return
  sharedBpm.value = Math.min(220, Math.max(40, Math.round(b)))
  requestOpenPanel('metronome')
}
</script>

<template>
  <CollapsibleCard id="bpm" title="BPM 测试" :summary="summary" :default-open="false">
    <div class="tabs">
      <button
        class="tab"
        :class="{ on: mode === 'auto' }"
        type="button"
        @click="mode = 'auto'"
      >
        自动测试
      </button>
      <button
        class="tab"
        :class="{ on: mode === 'manual' }"
        type="button"
        @click="mode = 'manual'"
      >
        手动测试
      </button>
    </div>

    <!-- ============ 自动测试 ============ -->
    <template v-if="mode === 'auto'">
      <label class="picker" :class="{ busy }">
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac"
          :disabled="busy"
          @change="handleFile"
        />
        <span class="picker-icon">{{ busy ? '⏳' : '🎵' }}</span>
        <span class="picker-title">{{ statusText }}</span>
        <span class="picker-sub">mp3 / wav / m4a · 在本机分析，不上传</span>
      </label>

      <p v-if="fileName" class="file">{{ fileName }}</p>
      <p v-if="status === 'error'" class="error">{{ errorMsg }}</p>
    </template>

    <!-- ============ 手动测试 ============ -->
    <template v-else>
      <div class="tap-wrap">
        <button class="tap-btn" type="button" @pointerdown.prevent="onTap">
          <span class="tap-icon">👆</span>
          <span class="tap-label">点 击</span>
          <span v-if="pulseKey" :key="pulseKey" class="pulse" />
        </button>
      </div>

      <p class="tap-meta">
        已点击 <b>{{ tapCount }}</b> 次
        <span v-if="steadiness" class="stead" :class="steadiness.cls">· {{ steadiness.label }}</span>
      </p>

      <div class="tap-actions">
        <button class="mini ghost" type="button" @click="resetTap">重新开始</button>
        <span class="tap-hint">跟着歌的拍子点，至少点 4 下</span>
      </div>
    </template>

    <!-- ============ 结果（两种模式共用） ============ -->
    <template v-if="activeBpm && practice">
      <div class="bpm-row">
        <span class="num">{{ activeBpm }}</span>
        <span class="unit">BPM</span>
      </div>
      <p class="desc">{{ practice.desc }}</p>

      <p v-if="mode === 'auto' && result" class="conf" :class="confidenceLabel.cls">
        {{ confidenceLabel.text }} · 相关系数 {{ (result.confidence * 100).toFixed(0) }}%
      </p>
      <p v-else-if="mode === 'manual' && steadiness" class="conf" :class="steadiness.cls">
        {{ steadiness.label }} · 离散度 {{ (steadiness.cv * 100).toFixed(1) }}%
      </p>

      <div v-if="mode === 'auto' && result" class="alt">
        <span class="alt-label">觉得不对？试试</span>
        <button
          v-for="c in result.candidates"
          :key="c"
          class="alt-btn"
          :class="{ on: c === selected }"
          type="button"
          @click="selected = c"
        >
          {{ c }}
        </button>
      </div>

      <dl class="facts">
        <div>
          <dt>一拍</dt>
          <dd>{{ practice.beatMs }} ms</dd>
        </div>
        <div>
          <dt>一个八拍</dt>
          <dd>{{ practice.bar }} 秒</dd>
        </div>
        <div>
          <dt>一组四八拍</dt>
          <dd>{{ practice.group }} 秒</dd>
        </div>
      </dl>

      <p class="tip">
        建议先用 <b>{{ practice.slow }} BPM</b>（约原速 80%）把动作走顺，再逐步追到原速。
      </p>

      <button class="primary" type="button" @click="sendToMetronome">
        用 {{ activeBpm }} BPM 去练 →
      </button>
    </template>

    <p v-if="mode === 'manual' && !canUse && tapCount > 0" class="hint warn">
      还差几下 —— 至少要有 2 个间隔（点 3 下）才能算出 BPM。
    </p>

    <p class="hint">
      <template v-if="mode === 'auto'">
        算法看的是「能量上升沿」的周期性，鼓点清晰的曲子准，自由节奏或速度变化的曲子会偏。常见误差是倍速 / 半速 / 1.5 倍，用上面的候选按钮修正。
      </template>
      <template v-else>
        取最近 8 次点击间隔的<b>中位数</b>，手抖点错一两下不会带偏结果。停手超过 2.5 秒会重新开始计数。电脑上也可以按空格点拍。
      </template>
    </p>
  </CollapsibleCard>
</template>

<style scoped>
/* ---------- 子版块切换 ---------- */
.tabs {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  background: #0f1729;
  border: 1px solid var(--line);
  margin-bottom: 12px;
}

.tab {
  flex: 1;
  border: 0;
  background: transparent;
  color: #7f9ac0;
  font-size: 13px;
  padding: 9px 0;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 150ms ease, color 150ms ease;
}

.tab.on {
  background: #2f6fd0;
  color: #fff;
  font-weight: 600;
}

/* ---------- 自动测试 ---------- */
.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 12px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: #0f1729;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease;
  -webkit-tap-highlight-color: transparent;
}

.picker.busy {
  border-style: solid;
  border-color: #2f6fd0;
}

.picker input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.picker-icon {
  font-size: 24px;
  line-height: 1;
}

.picker-title {
  font-size: 14px;
  font-weight: 600;
  color: #cfe3ff;
}

.picker-sub {
  font-size: 11px;
  color: #5f728c;
}

.file {
  margin: 8px 0 0;
  font-size: 11px;
  color: #7f9ac0;
  word-break: break-all;
}

.error {
  margin: 10px 0 0;
  font-size: 12px;
  color: #e08b8b;
  background: rgba(224, 139, 139, 0.08);
  border-left: 2px solid #7a3b3b;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

/* ---------- 手动测试 ---------- */
.tap-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.tap-btn {
  position: relative;
  width: 148px;
  height: 148px;
  border-radius: 50%;
  border: 2px solid #2f6fd0;
  background: radial-gradient(circle at 50% 35%, #22406e, #141d33 72%);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  transition: transform 60ms ease, border-color 160ms ease;
}

.tap-btn:active {
  transform: scale(0.96);
  border-color: #5fa8ff;
}

.tap-icon {
  font-size: 26px;
  line-height: 1;
}

.tap-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 4px;
  text-indent: 4px;
  color: #cfe3ff;
}

.pulse {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid #5fa8ff;
  pointer-events: none;
  animation: pulse-out 420ms ease-out forwards;
}

@keyframes pulse-out {
  from {
    transform: scale(0.92);
    opacity: 0.9;
  }
  to {
    transform: scale(1.4);
    opacity: 0;
  }
}

.tap-meta {
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  color: #7f9ac0;
}

.tap-meta b {
  color: #cfe3ff;
  font-weight: 600;
}

.stead.good {
  color: #6fd3a8;
}

.stead.mid {
  color: #e6c07a;
}

.stead.low {
  color: #e08b8b;
}

.tap-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.tap-hint {
  font-size: 11px;
  color: #5f728c;
}

.mini {
  flex: none;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  color: #7f9ac0;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

/* ---------- 结果 ---------- */
.bpm-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin: 18px 0 2px;
}

.num {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -1px;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.unit {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 1px;
}

.desc {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: #7f9ac0;
}

.conf {
  margin: 6px 0 0;
  text-align: center;
  font-size: 11px;
}

.conf.good {
  color: #6fd3a8;
}

.conf.mid {
  color: #e6c07a;
}

.conf.low {
  color: #e08b8b;
}

.alt {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 14px 0 12px;
}

.alt-label {
  font-size: 11px;
  color: #5f728c;
}

.alt-btn {
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 12px;
  padding: 5px 11px;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
}

.alt-btn.on {
  border-color: #2f6fd0;
  background: #16233c;
  color: #e6edf7;
  font-weight: 600;
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0 0 12px;
  padding: 10px;
  background: #0f1729;
  border-radius: 10px;
}

.facts div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}

dt {
  font-size: 10px;
  color: #5f728c;
}

dd {
  margin: 0;
  font-size: 13px;
  color: #cfe3ff;
  font-variant-numeric: tabular-nums;
}

.tip {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #9db6d6;
  background: rgba(74, 143, 224, 0.08);
  border-left: 2px solid #2f6fd0;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

.tip b {
  color: #cfe3ff;
}

.primary {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(180deg, #3d86e8, #2a63c2);
  box-shadow: 0 6px 18px rgba(47, 111, 208, 0.35);
  transition: transform 100ms ease;
  font-family: inherit;
}

.primary:active {
  transform: translateY(1px);
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}

.hint.warn {
  color: #e6c07a;
}

.hint b {
  color: #9db6d6;
}
</style>

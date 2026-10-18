<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import { bpm as sharedBpm, requestOpenPanel } from '../composables/sharedState.js'
import { analyzeBpm } from '../composables/bpmAnalysis.js'

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

const summary = computed(() => (result.value ? `${result.value.bpm} BPM` : '未分析'))

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

function describe(b) {
  if (b < 90) return '慢速 · 适合拆解动作'
  if (b < 130) return '中速 · 常见副歌区间'
  if (b < 170) return '快速 · 需要一定熟练度'
  return '极快 · 注意保护手腕'
}

const practice = computed(() => {
  const b = Number(selected.value)
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

function sendToMetronome() {
  const b = Number(selected.value)
  if (!b) return
  sharedBpm.value = Math.min(220, Math.max(40, Math.round(b)))
  requestOpenPanel('metronome')
}
</script>

<template>
  <CollapsibleCard id="bpm" title="BPM 测试" :summary="summary" :default-open="false">
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

    <template v-if="result && practice">
      <div class="bpm-row">
        <span class="num">{{ selected }}</span>
        <span class="unit">BPM</span>
      </div>
      <p class="desc">{{ practice.desc }}</p>
      <p class="conf" :class="confidenceLabel.cls">
        {{ confidenceLabel.text }} · 相关系数 {{ (result.confidence * 100).toFixed(0) }}%
      </p>

      <div class="alt">
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
        用 {{ selected }} BPM 去练 →
      </button>
    </template>

    <p class="hint">
      算法看的是「能量上升沿」的周期性，鼓点清晰的曲子准，自由节奏或速度变化的曲子会偏。常见误差是倍速 / 半速 / 1.5 倍，用上面的候选按钮修正。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
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

.bpm-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin: 16px 0 2px;
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
</style>

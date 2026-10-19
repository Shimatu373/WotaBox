<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'

const {
  fileName,
  duration,
  isPlaying,
  position,
  loopA,
  loopB,
  loopEnabled,
  rate,
  sections,
  loading,
  error,
  hasAudio,
  canLoop,
  load,
  reset,
  toggle,
  seek,
  setRate,
  setA,
  setB,
  nudgeA,
  nudgeB,
  toggleLoop,
  saveSection,
  applySection,
  deleteSection,
  fmtTime,
} = useAudioPlayer()

const scrubbing = ref(false)
const scrubPos = ref(0)

const rates = [0.5, 0.75, 1]

const summary = computed(() => {
  if (!hasAudio.value) return '未载入'
  if (isPlaying.value) return `播放中 · ${fmtTime(position.value)}`
  return `${fmtTime(duration.value)} · ${sections.value.length} 个片段`
})

const displayPos = computed(() => (scrubbing.value ? scrubPos.value : position.value))

function pct(t) {
  return duration.value ? Math.min(100, Math.max(0, (t / duration.value) * 100)) : 0
}

const abStyle = computed(() => ({
  left: pct(loopA.value) + '%',
  width: Math.max(0, pct(loopB.value) - pct(loopA.value)) + '%',
}))

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  await load(file)
  if (e.target) e.target.value = ''
}

function onScrubInput(e) {
  scrubbing.value = true
  scrubPos.value = Number(e.target.value)
}

function onScrubEnd(e) {
  seek(Number(e.target.value))
  scrubbing.value = false
}

function addSection() {
  if (!canLoop.value) {
    window.alert('先把 A 和 B 点标记好（区间至少 0.2 秒）')
    return
  }
  const suggestion = ['主歌', '副歌', 'C 段'][sections.value.length] || '片段'
  const name = window.prompt('给这个片段起个名字', suggestion)
  if (name === null) return
  saveSection(name || suggestion)
}
</script>

<template>
  <CollapsibleCard id="player" title="音乐播放器" :summary="summary" :default-open="false">
    <label v-if="!hasAudio" class="picker" :class="{ busy: loading }">
      <input
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac"
        :disabled="loading"
        @change="onFile"
      />
      <span class="picker-icon">{{ loading ? '⏳' : '🎧' }}</span>
      <span class="picker-title">{{ loading ? '解码中…' : '选择音频文件' }}</span>
      <span class="picker-sub">mp3 / wav / m4a · 本机播放，不上传</span>
    </label>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="hasAudio">
      <div class="file-row">
        <span class="fname">{{ fileName }}</span>
        <button class="mini" type="button" @click="reset">换一首</button>
      </div>

      <div class="bar-wrap">
        <span class="ab-range" :style="abStyle" />
        <span class="mark a" :style="{ left: pct(loopA) + '%' }" />
        <span class="mark b" :style="{ left: pct(loopB) + '%' }" />
        <input
          class="seek"
          type="range"
          min="0"
          :max="duration || 0"
          step="0.01"
          :value="displayPos"
          @input="onScrubInput"
          @change="onScrubEnd"
        />
      </div>
      <div class="times">
        <span class="cur">{{ fmtTime(displayPos) }}</span>
        <span class="dur">{{ fmtTime(duration) }}</span>
      </div>

      <div class="transport">
        <button class="play" type="button" :class="{ on: isPlaying }" @click="toggle">
          {{ isPlaying ? '暂停' : '播放' }}
        </button>
        <button class="toggle" type="button" :class="{ on: loopEnabled }" @click="toggleLoop">
          循环 {{ loopEnabled ? '开' : '关' }}
        </button>
      </div>

      <div class="points">
        <div class="pt">
          <span class="tag tag-a">A</span>
          <span class="val">{{ fmtTime(loopA) }}</span>
          <button class="nudge" type="button" @click="nudgeA(-0.1)">−0.1</button>
          <button class="nudge" type="button" @click="nudgeA(0.1)">+0.1</button>
          <button class="setter" type="button" @click="setA">设为当前</button>
        </div>
        <div class="pt">
          <span class="tag tag-b">B</span>
          <span class="val">{{ fmtTime(loopB) }}</span>
          <button class="nudge" type="button" @click="nudgeB(-0.1)">−0.1</button>
          <button class="nudge" type="button" @click="nudgeB(0.1)">+0.1</button>
          <button class="setter" type="button" @click="setB">设为当前</button>
        </div>
      </div>

      <div class="row">
        <span class="row-label">速度</span>
        <div class="seg">
          <button
            v-for="r in rates"
            :key="r"
            class="seg-btn"
            :class="{ on: rate === r }"
            type="button"
            @click="setRate(r)"
          >
            {{ r }}×
          </button>
        </div>
      </div>

      <div class="sections">
        <div class="sec-head">
          <span>片段</span>
          <span v-if="!sections.length" class="sec-empty">还没有保存的片段</span>
        </div>
        <div class="chips">
          <button
            v-for="s in sections"
            :key="s.id"
            class="sec-chip"
            type="button"
            @click="applySection(s.id)"
          >
            <span class="sec-name">{{ s.name }}</span>
            <span class="sec-time">{{ fmtTime(s.a) }}–{{ fmtTime(s.b) }}</span>
            <span class="sec-del" @click.stop="deleteSection(s.id)">×</span>
          </button>
          <button class="sec-chip add" type="button" @click="addSection">＋ 存为片段</button>
        </div>
      </div>
    </template>

    <p class="hint">
      音乐与节拍器共用同一个音频时钟，<b>可以同时出声</b> —— 放原曲、开节拍器，跟着一起练。片段会按「文件名 + 时长」记在本机，下次打开同一首歌还在。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
/* ---------- 选文件 ---------- */
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
  transition: border-color 160ms ease;
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

.error {
  margin: 10px 0 0;
  font-size: 12px;
  color: #e08b8b;
  background: rgba(224, 139, 139, 0.08);
  border-left: 2px solid #7a3b3b;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

/* ---------- 文件行 ---------- */
.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.fname {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #9db6d6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini {
  flex: none;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  color: #7f9ac0;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

/* ---------- 进度条 ---------- */
.bar-wrap {
  position: relative;
  height: 34px;
  display: flex;
  align-items: center;
}

.ab-range {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 6px;
  border-radius: 3px;
  background: rgba(74, 143, 224, 0.35);
  pointer-events: none;
}

.mark {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 16px;
  transform: translate(-1px, -50%);
  border-radius: 1px;
  pointer-events: none;
  z-index: 2;
}

.mark.a {
  background: #4a8fe0;
}

.mark.b {
  background: #f5a524;
}

.seek {
  position: relative;
  z-index: 3;
  width: 100%;
  appearance: none;
  background: transparent;
  height: 34px;
  margin: 0;
  outline: none;
}

.seek::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: #22304d;
}

.seek::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #2f6fd0;
  cursor: pointer;
}

.seek::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: #22304d;
}

.seek::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #2f6fd0;
  cursor: pointer;
}

.times {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b7f9c;
  font-variant-numeric: tabular-nums;
  margin-bottom: 12px;
}

.cur {
  color: #cfe3ff;
}

/* ---------- 播放控制 ---------- */
.transport {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.play {
  flex: 2;
  height: 48px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(180deg, #3d86e8, #2a63c2);
  box-shadow: 0 6px 18px rgba(47, 111, 208, 0.32);
  font-family: inherit;
  transition: transform 100ms ease;
}

.play.on {
  background: linear-gradient(180deg, #d9534f, #b23a36);
  box-shadow: 0 6px 18px rgba(217, 83, 79, 0.28);
}

.play:active {
  transform: translateY(1px);
}

.toggle {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
}

.toggle.on {
  border-color: #2f6fd0;
  background: #16233c;
  color: #cfe3ff;
  font-weight: 600;
}

/* ---------- A / B 点 ---------- */
.points {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.pt {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}

.tag-a {
  background: #33507a;
}

.tag-b {
  background: #7a5a1f;
}

.val {
  flex: 1;
  font-size: 13px;
  color: #cfe3ff;
  font-variant-numeric: tabular-nums;
}

.nudge {
  flex: none;
  height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: transparent;
  color: #7f9ac0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.setter {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid #2f6fd0;
  background: rgba(47, 111, 208, 0.16);
  color: #cfe3ff;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

/* ---------- 速度 ---------- */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-bottom: 10px;
}

.row-label {
  font-size: 13px;
  color: var(--muted);
}

.seg {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: #0f1729;
  border: 1px solid var(--line);
}

.seg-btn {
  border: 0;
  background: transparent;
  color: #7f9ac0;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 7px;
  cursor: pointer;
  font-family: inherit;
  transition: background 140ms ease, color 140ms ease;
}

.seg-btn.on {
  background: #2f6fd0;
  color: #fff;
  font-weight: 600;
}

/* ---------- 片段 ---------- */
.sections {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  color: #8fa3bf;
}

.sec-empty {
  color: #5f728c;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sec-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #cfe3ff;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 140ms ease;
}

.sec-chip:active {
  border-color: #2f6fd0;
}

.sec-chip.add {
  border-style: dashed;
  color: #7fd0ff;
}

.sec-name {
  font-weight: 600;
}

.sec-time {
  font-size: 10px;
  color: #6b7f9c;
  font-variant-numeric: tabular-nums;
}

.sec-del {
  font-size: 13px;
  color: #5f728c;
  padding-left: 2px;
}

.sec-del:active {
  color: #e08b8b;
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}

.hint b {
  color: #9db6d6;
}
</style>

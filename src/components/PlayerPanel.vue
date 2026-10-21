<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import DifficultyBar from './DifficultyBar.vue'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import { clipsOfSong, addClip, removeClip } from '../composables/useChoreo.js'
import { WAZA } from '../data/waza.js'

const {
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
  canLoop,
  bpmInfo,
  bpmAnalyzing,
  applyBpm,
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
  fmtTime,
} = useAudioPlayer()

const scrubbing = ref(false)
const scrubPos = ref(0)

const wazaMap = computed(() => Object.fromEntries(WAZA.map((w) => [w.id, w])))
const nameOf = (id) => wazaMap.value[id]?.nameZh || wazaMap.value[id]?.nameJa || id

const currentSong = computed(() => ({ fileName: fileName.value, duration: duration.value }))
const clips = computed(() => clipsOfSong(currentSong.value))

const summary = computed(() => {
  if (!hasAudio.value) return '未载入'
  if (isPlaying.value) return `播放中 · ${fmtTime(position.value)}`
  return `${fmtTime(duration.value)} · ${clips.value.length} 个片段`
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

function onRateInput(e) {
  setRate(Number(e.target.value))
}

function onRateChange(e) {
  setRate(Number(e.target.value))
}

const draft = ref(null)
const picking = ref(false)
const kw = ref('')

function startSave() {
  if (!canLoop.value) {
    window.alert('先把 A 和 B 点标记好（区间至少 0.2 秒）')
    return
  }
  const suggested = ['主歌', '副歌', 'C 段'][clips.value.length] || '片段'
  draft.value = { name: suggested, a: loopA.value, b: loopB.value, wazaIds: [], note: '' }
  picking.value = false
  kw.value = ''
}

function cancelSave() {
  draft.value = null
  picking.value = false
  kw.value = ''
}

function confirmSave() {
  if (!draft.value) return
  addClip({
    song: currentSong.value,
    name: draft.value.name,
    a: draft.value.a,
    b: draft.value.b,
    wazaIds: draft.value.wazaIds,
    note: draft.value.note,
  })
  draft.value = null
  picking.value = false
  kw.value = ''
}

const pickList = computed(() => {
  const k = kw.value.trim().toLowerCase()
  const base = k
    ? WAZA.filter((w) =>
        [w.nameJa, w.nameZh, w.series].filter(Boolean).join(' ').toLowerCase().includes(k)
      )
    : WAZA
  return base.slice(0, 30)
})

function pickWaza(id) {
  if (!draft.value) return
  draft.value.wazaIds.push(id)
  picking.value = false
  kw.value = ''
}

function removeWazaAt(i) {
  draft.value?.wazaIds.splice(i, 1)
}

function moveWaza(i, delta) {
  const arr = draft.value?.wazaIds
  if (!arr) return
  const j = i + delta
  if (j < 0 || j >= arr.length) return
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
}

function applyClip(clip) {
  loopA.value = clip.a
  loopB.value = clip.b
  loopEnabled.value = true
  seek(clip.a)
}

function delClip(clip) {
  if (window.confirm(`删除片段「${clip.name}」？`)) removeClip(clip.id)
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
      <span class="picker-sub">导入后会自动识别 BPM 并同步到节拍器</span>
    </label>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="hasAudio">
      <div class="file-row">
        <span class="fname">{{ fileName }}</span>
        <button class="mini" type="button" @click="reset">换一首</button>
      </div>

      <div class="bpm">
        <span class="bpm-tag">BPM</span>
        <template v-if="bpmAnalyzing">
          <span class="bpm-val dim">分析中…</span>
        </template>
        <template v-else-if="bpmInfo">
          <span class="bpm-val">{{ bpmInfo.bpm }}</span>
          <span class="bpm-sync">已同步节拍器</span>
          <button
            v-for="c in bpmInfo.candidates"
            :key="c"
            class="bpm-chip"
            :class="{ on: Math.abs(c - bpmInfo.bpm) < 0.01 }"
            type="button"
            @click="applyBpm(c)"
          >
            {{ c }}
          </button>
        </template>
        <template v-else>
          <span class="bpm-val dim">未识别</span>
        </template>
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

      <div class="rate">
        <span class="row-label">速度</span>
        <input
          class="rate-slider"
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          :value="rate"
          @input="onRateInput"
        />
        <input
          class="rate-num"
          type="number"
          min="0.5"
          max="1.5"
          step="0.05"
          :value="rate"
          @change="onRateChange"
        />
        <span class="rate-unit">×</span>
        <button class="mini" type="button" @click="setRate(1)">1×</button>
      </div>

      <div class="sections">
        <div class="sec-head">
          <span>片段</span>
          <span v-if="!clips.length" class="sec-empty">还没有保存的片段</span>
        </div>

        <div class="chips">
          <button
            v-for="c in clips"
            :key="c.id"
            class="sec-chip"
            type="button"
            @click="applyClip(c)"
          >
            <span class="sec-name">{{ c.name }}</span>
            <span class="sec-time">{{ fmtTime(c.a) }}–{{ fmtTime(c.b) }}</span>
            <span v-if="c.wazaIds.length" class="sec-n">{{ c.wazaIds.length }} 技</span>
            <span class="sec-del" @click.stop="delClip(c)">×</span>
          </button>
          <button v-if="!draft" class="sec-chip add" type="button" @click="startSave">
            ＋ 存为片段
          </button>
        </div>

        <div v-if="draft" class="editor">
          <div class="ed-row">
            <span class="ed-label">名称</span>
            <input
              v-model="draft.name"
              class="ed-input"
              type="text"
              placeholder="主歌 / 副歌 / C 段"
            />
          </div>

          <div class="ed-row">
            <span class="ed-label">区间</span>
            <span class="ed-time">{{ fmtTime(draft.a) }} – {{ fmtTime(draft.b) }}</span>
          </div>

          <div class="ed-block">
            <div class="ed-label">副歌技（按顺序）</div>
            <ol v-if="draft.wazaIds.length" class="wz-list">
              <li v-for="(id, i) in draft.wazaIds" :key="i">
                <span class="wz-idx">{{ i + 1 }}</span>
                <span class="wz-name">{{ nameOf(id) }}</span>
                <button class="wz-btn" type="button" @click="moveWaza(i, -1)">↑</button>
                <button class="wz-btn" type="button" @click="moveWaza(i, 1)">↓</button>
                <button class="wz-btn del" type="button" @click="removeWazaAt(i)">×</button>
              </li>
            </ol>
            <p v-else class="ed-empty">还没有关联技，可以添加，也可以留空</p>

            <button v-if="!picking" class="wz-add" type="button" @click="picking = true">
              ＋ 添加副歌技
            </button>

            <div v-else class="picker-box">
              <input
                v-model="kw"
                class="ed-input"
                type="search"
                placeholder="搜技名，点一条即可追加"
                autocomplete="off"
              />
              <ul class="pick-list">
                <li v-for="w in pickList" :key="w.id">
                  <button type="button" @click="pickWaza(w.id)">
                    <span class="pk-ja">{{ w.nameJa }}<DifficultyBar :level="w.difficulty" /></span>
                    <span class="pk-zh">{{ w.nameZh || w.series || '' }}</span>
                  </button>
                </li>
              </ul>
              <button class="wz-add" type="button" @click="picking = false">收起</button>
            </div>
          </div>

          <div class="ed-row">
            <span class="ed-label">备注</span>
            <input v-model="draft.note" class="ed-input" type="text" placeholder="可选" />
          </div>

          <div class="ed-actions">
            <button class="save-btn" type="button" @click="confirmSave">保存片段</button>
            <button class="mini" type="button" @click="cancelSave">取消</button>
          </div>
        </div>
      </div>
    </template>

    <p class="hint">
      音乐与节拍器共用同一个音频时钟，<b>可以同时出声</b>。导入后自动识别 BPM 并写入节拍器，候选值可一键替换。片段会存进「编排」页，带上副歌技顺序，方便交流。
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
  text-align: center;
  line-height: 1.6;
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

.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
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

.bpm {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: 10px;
  background: #0f1729;
}

.bpm-tag {
  font-size: 10px;
  color: #5f728c;
  letter-spacing: 1px;
}

.bpm-val {
  font-size: 16px;
  font-weight: 700;
  color: #cfe3ff;
  font-variant-numeric: tabular-nums;
}

.bpm-val.dim {
  font-size: 12px;
  font-weight: 400;
  color: #5f728c;
}

.bpm-sync {
  font-size: 10px;
  color: #6fd3a8;
}

.bpm-chip {
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: #7f9ac0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.bpm-chip.on {
  border-color: #2f6fd0;
  color: #cfe3ff;
  background: #16233c;
}

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

.rate {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-bottom: 12px;
}

.row-label {
  flex: none;
  font-size: 13px;
  color: var(--muted);
}

.rate-slider {
  flex: 1;
  min-width: 0;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, #2f6fd0, #4a8fe0);
  outline: none;
}

.rate-slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #2f6fd0;
  cursor: pointer;
}

.rate-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #2f6fd0;
  cursor: pointer;
}

.rate-num {
  flex: none;
  width: 62px;
  height: 30px;
  padding: 0 6px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #cfe3ff;
  font-size: 12px;
  font-family: inherit;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: none;
}

.rate-unit {
  flex: none;
  font-size: 11px;
  color: #6b7f9c;
}

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

.sec-n {
  font-size: 10px;
  color: #7fa8d8;
}

.sec-del {
  font-size: 13px;
  color: #5f728c;
  padding-left: 2px;
}

.sec-del:active {
  color: #e08b8b;
}

.editor {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #2f6fd0;
  border-radius: 12px;
  background: rgba(47, 111, 208, 0.06);
}

.ed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ed-label {
  flex: none;
  width: 72px;
  font-size: 11px;
  color: #8fa3bf;
}

.ed-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0b1020;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.ed-input:focus {
  border-color: #2f6fd0;
}

.ed-time {
  font-size: 12px;
  color: #cfe3ff;
  font-variant-numeric: tabular-nums;
}

.ed-block {
  margin: 10px 0;
}

.wz-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
}

.wz-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  margin-bottom: 5px;
  border-radius: 8px;
  background: #0b1020;
}

.wz-idx {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #22304d;
  color: #9db6d6;
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wz-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #e6edf7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wz-btn {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: transparent;
  color: #7f9ac0;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.wz-btn.del:active {
  color: #e08b8b;
}

.ed-empty {
  margin: 4px 0 0;
  font-size: 11px;
  color: #5f728c;
}

.wz-add {
  margin-top: 8px;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px dashed var(--line);
  background: transparent;
  color: #7fd0ff;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.picker-box {
  margin-top: 8px;
  padding: 8px;
  border-radius: 10px;
  background: #0b1020;
  border: 1px solid var(--line);
}

.pick-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 190px;
  overflow-y: auto;
}

.pick-list li button {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.pick-list li button:active {
  background: #16233c;
}

.pk-ja {
  font-size: 12px;
  color: #e6edf7;
}

.pk-zh {
  font-size: 10px;
  color: #5f728c;
}

.ed-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.save-btn {
  flex: 1;
  height: 36px;
  border-radius: 9px;
  border: 0;
  background: #2f6fd0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
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

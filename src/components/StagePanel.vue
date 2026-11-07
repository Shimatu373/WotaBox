<script setup>
/**
 * 站位 / 走位视图（全屏子页面，横屏布局）
 *
 * 布局按星沫的草图：
 *   左侧窄栏：选中打师的信息（顶部）＋ 该打师在各片段的动作（下面几条彩色块）
 *   右侧大区：舞台（圆点＝打师）＋ 舞台下方一条进度条（片段区间投射在上面）
 *
 * 走位模型：某帧里有这个打师的坐标＝在场，没有＝不在场，采样时自动淡入淡出，
 * 所以「接力 / 上下场」不需要额外字段。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fmtClock, stageOf, textStep } from '../composables/useChoreo.js'
import { playerClock, clockHasFile } from '../composables/playerClock.js'
import {
  addDancer,
  clearPos,
  cloneSegments,
  importClipSteps,
  pasteSegments,
  removeDancer,
  removeKeyAt,
  removeSegment,
  renameDancer,
  sampleAt,
  segmentsInRange,
  segmentsOf,
  setPos,
  toggleHard,
} from '../composables/stageModel.js'

const props = defineProps({
  song: { type: Object, required: true }, // { songKey, fileName, duration, clips[] }
  nameOf: { type: Function, default: (id) => id },
})
const emit = defineEmits(['close'])

const stage = stageOf(props.song.songKey)
const clips = computed(() => props.song.clips || [])
const dur = computed(() => Math.max(props.song.duration || 0, ...clips.value.map((c) => c.b), 1))

/* ---------------- 时间轴 ---------------- */

const localTime = ref(0)
const playing = ref(false)
const followMode = ref(false)
const recordMode = ref(false)
const followAvailable = computed(() => clockHasFile(props.song.fileName))

const time = computed(() => localTime.value)

let rafId = 0
let lastTs = 0

function tick(ts) {
  if (!playing.value) return
  const dt = lastTs ? (ts - lastTs) / 1000 : 0
  lastTs = ts
  localTime.value = Math.min(dur.value, localTime.value + dt)
  if (localTime.value >= dur.value) {
    playing.value = false
    return
  }
  rafId = requestAnimationFrame(tick)
}

function playLocal() {
  if (playing.value) return
  followMode.value = false
  if (localTime.value >= dur.value) localTime.value = 0
  playing.value = true
  lastTs = 0
  rafId = requestAnimationFrame(tick)
}

function pauseLocal() {
  playing.value = false
  cancelAnimationFrame(rafId)
}

function seek(t) {
  pauseLocal()
  localTime.value = Math.max(0, Math.min(dur.value, Number(t) || 0))
}

// 跟随播放器：位置镜像过来（只读，不回写播放器）
watch(
  () => playerClock.position,
  (p) => {
    if (followMode.value) localTime.value = Math.min(dur.value, p)
  },
)

function toggleFollow() {
  if (!followAvailable.value) return
  followMode.value = !followMode.value
  if (followMode.value) {
    pauseLocal()
    localTime.value = playerClock.position
  }
}

onBeforeUnmount(() => cancelAnimationFrame(rafId))

/* ---------------- 打师与拖拽 ---------------- */

const selectedKey = ref(stage.dancers[0]?.key || null)
const selected = computed(() => stage.dancers.find((d) => d.key === selectedKey.value) || null)
const sampled = computed(() => sampleAt(stage, time.value))
const stageEl = ref(null)

function addOne() {
  const d = addDancer(stage)
  selectedKey.value = d.key
}

function pickDancer(key) {
  selectedKey.value = key
}

function rename() {
  const d = selected.value
  if (!d) return
  const name = window.prompt('打师名字', d.name)
  if (name) renameDancer(stage, d.key, name)
}

function dropDancer() {
  const d = selected.value
  if (!d) return
  if (!window.confirm(`删除打师「${d.name}」？他的动作线和走位都会一起删掉。`)) return
  removeDancer(stage, d.key)
  selectedKey.value = stage.dancers[0]?.key || null
}

const dragging = ref('')
let dragKey = ''

function startDrag(e, dancerKey) {
  if (!recordMode.value) {
    selectedKey.value = dancerKey
    return
  }
  selectedKey.value = dancerKey
  dragKey = dancerKey
  dragging.value = dancerKey
  e.target.setPointerCapture?.(e.pointerId)
  moveTo(e)
}

function moveTo(e) {
  if (!dragKey || !stageEl.value) return
  const rect = stageEl.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  setPos(stage, dragKey, time.value, x, y)
}

function endDrag(e) {
  if (!dragKey) return
  e?.target?.releasePointerCapture?.(e.pointerId)
  dragKey = ''
  dragging.value = ''
}

/** 让当前打师在「此刻」离场（这一帧没有他的坐标 = 不在场） */
function leaveNow() {
  if (!selected.value) return
  clearPos(stage, selected.value.key, time.value)
}

/** 把当前画面的所有站位存成关键帧（方便复制一个队形到别的时间点） */
function snapshotHere() {
  const s = sampled.value
  for (const [k, p] of Object.entries(s)) {
    if (p.alpha > 0.5) setPos(stage, k, time.value, p.x, p.y)
  }
}

function dropKeyAt(t) {
  removeKeyAt(stage, t)
}

/* ---------------- 复制动作线 ---------------- */
// 模块级剪贴板：关掉子页面再打开也还在（复制一条动作线，换首歌/换个打师都能粘）
const lineClip = ref(null)

function copyLine() {
  if (!selected.value) return
  lineClip.value = cloneSegments(stage, selected.value.key)
  flash('已复制该打师的动作线')
}

function pasteLine() {
  if (!selected.value || !lineClip.value) return
  pasteSegments(stage, selected.value.key, lineClip.value)
  flash('已粘贴到当前打师')
}

const flashText = ref('')
function flash(t) {
  flashText.value = t
  setTimeout(() => {
    if (flashText.value === t) flashText.value = ''
  }, 1600)
}

/* ---------------- 片段 ↔ 打师动作 ---------------- */

const selectedClipId = ref(null)

const clipRows = computed(() => {
  const d = selected.value
  if (!d) return []
  return clips.value.map((c, i) => ({
    clip: c,
    color: CLIP_COLORS[i % CLIP_COLORS.length],
    segments: segmentsInRange(stage, d.key, c.a, c.b),
  }))
})

const CLIP_COLORS = ['#e0574f', '#e08b3c', '#4a8fe0', '#43c463', '#a970e6', '#22b8cf']

function importFromClip(clip) {
  if (!selected.value) return
  importClipSteps(stage, selected.value.key, clip)
  flash(`已把「${clip.name}」的动作给 ${selected.value.name}`)
}

function clearInClip(clip) {
  const d = selected.value
  if (!d) return
  const list = segmentsOf(stage, d.key)
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]
    if (s.at >= clip.a - 1e-6 && s.at < clip.b - 1e-6) {
      const idx = stage.lines[d.key].indexOf(list[i])
      if (idx !== -1) removeSegment(stage, d.key, idx)
    }
  }
  flash('已清空该片段的动作')
}

function addTextToClip(clip) {
  const d = selected.value
  if (!d) return
  const text = window.prompt(`给 ${d.name} 在「${clip.name}」加一段自定义动作：`, '')
  if (!text) return
  if (!Array.isArray(stage.lines[d.key])) stage.lines[d.key] = []
  const at = clip.a
  const seg = stage.lines[d.key].find((s) => Math.abs(s.at - at) <= 0.5)
  const step = textStep(text)
  if (seg) seg.steps.push(step)
  else stage.lines[d.key].push({ at, steps: [step] })
  stage.lines[d.key].sort((x, y) => x.at - y.at)
}

/* ---------------- 进度条 ---------------- */

function onBarPointer(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  seek(((e.clientX - rect.left) / rect.width) * dur.value)
}

const pct = (t) => `${(Math.max(0, Math.min(dur.value, t)) / dur.value) * 100}%`
</script>

<template>
  <Teleport to="body">
    <div class="overlay">
      <!-- 顶栏 -->
      <header class="head">
        <button class="ghost" type="button" @click="emit('close')">← 返回编排</button>
        <span class="file">{{ song.fileName }}</span>
        <span class="tc">{{ fmtClock(time) }} / {{ fmtClock(dur) }}</span>

        <div class="head-actions">
          <button class="ghost" type="button" :class="{ on: recordMode }" @click="recordMode = !recordMode">
            {{ recordMode ? '✋ 走位编辑中' : '解锁走位编辑' }}
          </button>
          <button
            class="ghost"
            type="button"
            :class="{ on: followMode }"
            :disabled="!followAvailable"
            :title="followAvailable ? '跟着播放器的进度走' : '先在播放器里载入这首歌'"
            @click="toggleFollow"
          >
            {{ followMode ? '⏱ 跟随播放器' : '跟随播放器' }}
          </button>
          <button class="ghost" type="button" @click="playing ? pauseLocal() : playLocal()">
            {{ playing ? '⏸ 暂停' : '▶ 预览' }}
          </button>
        </div>
      </header>

      <div class="body">
        <!-- 左栏 -->
        <aside class="left">
          <div class="panel dancer-card">
            <div v-if="selected" class="dancer-head">
              <i class="swatch" :style="{ background: selected.color }" />
              <input class="name-input" :value="selected.name" @change="renameDancer(stage, selected.key, $event.target.value)" />
              <button class="mini" type="button" @click="dropDancer">删</button>
            </div>
            <div v-else class="dancer-empty">还没有打师，点下面加一个</div>

            <div class="line-actions">
              <button class="mini" type="button" :disabled="!selected" @click="copyLine">复制动作</button>
              <button class="mini" type="button" :disabled="!lineClip" @click="pasteLine">粘贴</button>
            </div>
            <p v-if="flashText" class="flash">{{ flashText }}</p>
          </div>

          <div class="panel clips-panel">
            <div class="panel-title">该打师在各片段的动作</div>
            <div v-for="row in clipRows" :key="row.clip.id" class="clip-row">
              <div class="clip-top">
                <i class="swatch small" :style="{ background: row.color }" />
                <span class="clip-name">{{ row.clip.name }}</span>
                <span class="clip-time">{{ fmtClock(row.clip.a) }}–{{ fmtClock(row.clip.b) }}</span>
              </div>
              <div class="steps">
                <template v-if="row.segments.length">
                  <span v-for="(seg, si) in row.segments" :key="si" class="seg">
                    <span
                      v-for="(s, k) in seg.steps"
                      :key="k"
                      class="step"
                      :class="{ custom: s.kind === 'text' }"
                      >{{ s.kind === 'text' ? s.text : nameOf(s.id) }}</span
                    >
                  </span>
                </template>
                <span v-else class="none">未分配</span>
              </div>
              <div class="clip-btns">
                <button class="mini" type="button" @click="importFromClip(row.clip)">从片段导入</button>
                <button class="mini" type="button" @click="addTextToClip(row.clip)">＋文字</button>
                <button class="mini" type="button" @click="clearInClip(row.clip)">清空</button>
              </div>
            </div>
            <p v-if="!clipRows.length" class="none">先选一个打师</p>
          </div>

          <div class="panel">
            <div class="panel-title">打师</div>
            <div class="dancer-list">
              <button
                v-for="d in stage.dancers"
                :key="d.key"
                class="dancer-chip"
                :class="{ on: d.key === selectedKey }"
                type="button"
                @click="pickDancer(d.key)"
              >
                <i class="swatch small" :style="{ background: d.color }" />{{ d.name }}
              </button>
              <button class="dancer-chip add" type="button" @click="addOne">＋ 加打师</button>
            </div>
          </div>
        </aside>

        <!-- 右侧：舞台 + 进度条 -->
        <section class="right">
          <div class="stage-wrap">
            <div ref="stageEl" class="stage" :class="{ recording: recordMode }">
              <div
                v-for="d in stage.dancers"
                :key="d.key"
                class="dot"
                :class="{ sel: d.key === selectedKey, drag: dragging === d.key }"
                :style="{
                  left: ((sampled[d.key]?.x ?? 0.5) * 100) + '%',
                  top: ((sampled[d.key]?.y ?? 0.7) * 100) + '%',
                  background: d.color,
                  opacity: sampled[d.key]?.alpha ?? 0,
                }"
                @pointerdown="startDrag($event, d.key)"
                @pointermove="moveTo($event)"
                @pointerup="endDrag($event)"
                @pointercancel="endDrag($event)"
              >
                <span class="dot-name">{{ d.name }}</span>
              </div>
              <p v-if="!stage.dancers.length" class="stage-empty">左侧「＋ 加打师」开始摆站位</p>
              <p v-if="recordMode" class="record-hint">走位编辑：拖动圆点即在当前时刻记录位置</p>
            </div>
          </div>

          <div class="bar" @pointerdown="onBarPointer">
            <div
              v-for="(c, i) in clips"
              :key="c.id"
              class="seg"
              :style="{ left: pct(c.a), width: pct(c.b - c.a), background: CLIP_COLORS[i % CLIP_COLORS.length] }"
              :title="`${c.name} ${fmtClock(c.a)}–${fmtClock(c.b)}`"
              @pointerdown.stop="seek(c.a)"
            >
              <span class="seg-label">{{ c.name }}</span>
            </div>
            <div class="playhead" :style="{ left: pct(time) }" />
          </div>

          <div class="bar-tools">
            <button class="mini" type="button" :disabled="!selected" @click="leaveNow">此刻让选中打师离场</button>
            <button class="mini" type="button" @click="snapshotHere">把当前队形存成关键帧</button>
            <span class="kf">关键帧 {{ stage.keys.length }}</span>
            <span v-if="followMode" class="kf">跟随播放器：{{ fmtClock(playerClock.position) }}</span>
          </div>

          <div v-if="stage.keys.length" class="keys">
            <button
              v-for="k in stage.keys"
              :key="k.t"
              class="kf-chip"
              :class="{ hard: k.hard }"
              type="button"
              @click="seek(k.t)"
            >
              {{ fmtClock(k.t) }}
              <span class="kf-n">{{ Object.keys(k.pos).length }}人</span>
              <span class="kf-hard" @click.stop="toggleHard(stage, k.t)">{{ k.hard ? '硬切' : '滑' }}</span>
              <span class="kf-del" @click.stop="dropKeyAt(k.t)">×</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: #06090f;
  display: flex;
  flex-direction: column;
  color: var(--text);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  flex: none;
  flex-wrap: wrap;
}

.file {
  font-size: 12px;
  color: #cfe3ff;
  max-width: 30vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tc {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #7f9ac0;
}

.head-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ghost {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

.ghost.on {
  border-color: #2f6fd0;
  background: #16233c;
  color: #cfe3ff;
}

.ghost:disabled {
  opacity: 0.4;
  cursor: default;
}

.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 232px 1fr;
  gap: 10px;
  padding: 10px;
}

@media (max-width: 760px) {
  .body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

.left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
}

.panel {
  background: #0f1729;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
}

.panel-title {
  font-size: 10px;
  color: #5f728c;
  margin-bottom: 6px;
}

.dancer-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex: none;
}

.swatch.small {
  width: 8px;
  height: 8px;
}

.name-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #05090f;
  color: #e6edf7;
  font-size: 12px;
  font-family: inherit;
  padding: 0 6px;
  outline: none;
}

.dancer-empty {
  font-size: 11px;
  color: #5f728c;
}

.line-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.flash {
  margin: 6px 0 0;
  font-size: 10px;
  color: #43c463;
}

.mini {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #16233c;
  color: #9db6d6;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
}

.mini:disabled {
  opacity: 0.4;
  cursor: default;
}

.clips-panel {
  flex: 0 0 auto;
}

.clip-row {
  border-top: 1px solid var(--line);
  padding-top: 6px;
  margin-top: 6px;
}

.clip-row:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.clip-top {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.clip-name {
  color: #cfe3ff;
  font-weight: 600;
}

.clip-time {
  margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: #5f728c;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 5px 0;
}

.step {
  font-size: 10px;
  color: #cfe3ff;
  background: #16233c;
  border-radius: 5px;
  padding: 2px 6px;
}

.step.custom {
  color: #e6c07a;
  background: rgba(230, 192, 122, 0.12);
  font-style: italic;
}

.none {
  font-size: 10px;
  color: #4d5a70;
}

.clip-btns {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.dancer-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dancer-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #9db6d6;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
}

.dancer-chip.on {
  border-color: #2f6fd0;
  background: #16233c;
  color: #cfe3ff;
}

.dancer-chip.add {
  border-style: dashed;
  color: #7fd0ff;
}

.right {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.stage-wrap {
  flex: 1;
  min-height: 0;
}

.stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  background:
    radial-gradient(ellipse at 50% 40%, #12203a 0%, #0a1220 70%),
    #0a1220;
  border: 1px solid #2a3b52;
  border-radius: 12px;
  overflow: hidden;
  touch-action: none;
}

.stage.recording {
  border-color: #e0574f;
}

.dot {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: left 80ms linear, top 80ms linear;
  touch-action: none;
}

.dot.sel {
  box-shadow: 0 0 0 4px rgba(127, 208, 255, 0.35);
}

.dot.drag {
  transition: none;
  cursor: grabbing;
}

.dot-name {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: #cfe3ff;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000;
}

.stage-empty,
.record-hint {
  position: absolute;
  left: 12px;
  margin: 0;
  font-size: 11px;
  color: #4d5a70;
}

.stage-empty {
  top: 12px;
}

.record-hint {
  bottom: 10px;
  color: #e0574f;
}

.bar {
  position: relative;
  height: 26px;
  border-radius: 8px;
  background: #0f1729;
  border: 1px solid var(--line);
  overflow: hidden;
  flex: none;
  cursor: pointer;
}

.seg {
  position: absolute;
  top: 0;
  bottom: 0;
  opacity: 0.35;
  display: flex;
  align-items: center;
  padding: 0 4px;
  overflow: hidden;
  border-right: 1px solid rgba(0, 0, 0, 0.4);
}

.seg-label {
  font-size: 9px;
  color: #fff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #7fd0ff;
  box-shadow: 0 0 6px rgba(127, 208, 255, 0.8);
}

.bar-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: none;
}

.kf {
  font-size: 10px;
  color: #5f728c;
}

.keys {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  max-height: 56px;
  overflow-y: auto;
  flex: none;
}

.kf-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #9db6d6;
  font-size: 9px;
  font-family: inherit;
  cursor: pointer;
}

.kf-chip.hard {
  border-color: #e0574f;
  color: #f5b1ac;
}

.kf-n {
  color: #5f728c;
}

.kf-hard {
  padding: 0 3px;
  border-radius: 4px;
  background: #16233c;
}

.kf-del {
  color: #e0574f;
}
</style>

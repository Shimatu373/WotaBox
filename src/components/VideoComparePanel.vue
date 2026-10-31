<script setup>
/**
 * 视频对比器：本地视频的逐帧 / 慢放 / 镜像 对照工具。
 *
 * 为什么只吃本地文件：平台视频（B站/YouTube）是跨域 iframe，拿不到解码后的帧，
 * 也没法把播放位置精确到某一帧。要做到「逐帧看动作」只能用自己的 <video> 播本地文件。
 *
 * 时间轴怎么设计的：
 *   - 每个视频有**自己的位置**（pos.A / pos.B），互不干扰
 *   - 顶部那条「联动时间轴」拖动时，两边**同时平移相同的量**，对齐关系不变
 *   - 要错开两个视频（两段录影起点不同），打开「分别微调」，各拖各的滑条
 *   - 分别微调的滑条平时收起，播放时自动隐藏（那时用不上）
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'

/** 常见帧率，探测失败时可以手动选 */
const FPS_PRESETS = [24, 25, 30, 50, 60, 120]

const A = ref(makeSlot('A'))
const B = ref(makeSlot('B'))

const rate = ref(1)
const playing = ref(false)
const showTrim = ref(false) // 「分别微调」是否展开
const measuring = ref(false)
/** 两个视频各自的位置（秒） */
const pos = ref({ A: 0, B: 0 })

function makeSlot(label) {
  return {
    label,
    name: '',
    url: '',
    fps: 30,
    fpsDetected: false,
    mirrorX: false,
    mirrorY: false,
    duration: 0,
  }
}

/** 两个 <video> 的 DOM 引用（普通对象即可，不需要响应式） */
const elStore = { A: null, B: null }
const rafId = ref(0)
/** 帧时间采样（用于自动探测帧率） */
const samples = { A: [], B: [] }

const dur = computed(() => Math.max(A.value.duration || 0, B.value.duration || 0))
const bothLoaded = computed(() => Boolean(A.value.url && B.value.url))
/** B 比 A 晚多少（秒）。正数＝B 落后 A */
const diffSeconds = computed(() => pos.value.B - pos.value.A)
const diffFrames = computed(() => Math.round(diffSeconds.value * (A.value.fps || 30)))

const summary = computed(() => {
  const n = [A.value, B.value].filter((s) => s.url).length
  return n ? `${n} 个视频 · ${rate.value}×` : '还没有载入视频'
})

/** 秒 → mm:ss.ff（ff 是帧号，方便对照动作） */
function fmt(t, fps) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const f = Math.floor((t % 1) * (fps || 30))
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`
}

function elOf(slot) {
  return elStore[slot] || null
}

function slotRef(slot) {
  return slot === 'A' ? A : B
}

/** 常见的 29.97 / 59.94 归到 30 / 60，避免帧步进出现 0.0333 这种怪数 */
function snapFps(raw) {
  if (!Number.isFinite(raw) || raw <= 1 || raw > 240) return null
  const near = FPS_PRESETS.find((p) => Math.abs(p - raw) < 1.2)
  return near || Math.round(raw)
}

/** 用 requestVideoFrameCallback 采样帧间隔，估算真实帧率 */
function startFpsProbe(slot) {
  const el = elOf(slot)
  if (!el || typeof el.requestVideoFrameCallback !== 'function') return
  const obj = slotRef(slot)

  const tick = (_, meta) => {
    if (!el.isConnected) return
    const arr = samples[slot]
    const prev = arr[arr.length - 1]
    if (prev !== undefined) {
      const d = meta.mediaTime - prev
      if (d > 0.0005 && d < 0.2) {
        arr.push(meta.mediaTime)
        if (arr.length > 24) arr.shift()
        const gaps = []
        for (let i = 1; i < arr.length; i++) gaps.push(arr[i] - arr[i - 1])
        gaps.sort((x, y) => x - y)
        const median = gaps[Math.floor(gaps.length / 2)]
        const fps = snapFps(median ? 1 / median : null)
        if (fps) {
          obj.value.fps = fps
          obj.value.fpsDetected = true
        }
      } else {
        samples[slot] = [meta.mediaTime]
      }
    } else {
      samples[slot] = [meta.mediaTime]
    }
    if (arr.length < 20 && !el.paused) el.requestVideoFrameCallback(tick)
  }
  el.requestVideoFrameCallback(tick)
}

function pickFile(slot, e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const obj = slotRef(slot)
  if (obj.value.url) URL.revokeObjectURL(obj.value.url)
  samples[slot] = []
  obj.value = { ...makeSlot(slot), name: file.name, url: URL.createObjectURL(file) }
  pos.value = { ...pos.value, [slot]: 0 }
  e.target.value = ''
}

function onLoaded(slot) {
  const el = elOf(slot)
  if (!el) return
  slotRef(slot).value.duration = el.duration || 0
  el.playbackRate = rate.value
  startFpsProbe(slot)
  seek(slot, pos.value[slot], { force: true })
}

/** 单独定位某一个视频 */
function seek(slot, t, { force = false } = {}) {
  const el = elOf(slot)
  const d = slotRef(slot).value.duration || Infinity
  const clamped = Math.max(0, Math.min(t, d))
  pos.value = { ...pos.value, [slot]: clamped }
  if (el && (force || Math.abs(el.currentTime - clamped) > 0.004)) el.currentTime = clamped
}

/** 两边同时平移 delta 秒（联动轴拖动 / 逐帧都走这里，对齐关系保持不变） */
function seekBoth(delta, { force = false } = {}) {
  for (const slot of ['A', 'B']) {
    if (elOf(slot)) seek(slot, pos.value[slot] + delta, { force })
  }
}

/* ---------------- 播放与同步 ---------------- */

/** 播放起点，用于判断两边「各自走了多远」，而不是比较绝对位置 */
let start = { A: 0, B: 0 }

function tickSync() {
  const a = elStore.A
  const b = elStore.B
  if (a && !a.paused) pos.value = { ...pos.value, A: a.currentTime }
  if (b && !b.paused) pos.value = { ...pos.value, B: b.currentTime }

  // 同步：比较「从起点各走了多少」，谁走得快就把另一个拉到同等进度，
  // 这样即使两段视频本来错开几秒也对得上
  if (a && b && !a.paused && !b.paused) {
    const advA = a.currentTime - start.A
    const advB = b.currentTime - start.B
    const toler = 0.05 + rate.value * 0.04
    if (advA - advB > toler) b.currentTime = start.B + advA
    else if (advB - advA > toler) a.currentTime = start.A + advB
  }
  if (playing.value) rafId.value = requestAnimationFrame(tickSync)
}

function play() {
  const a = elStore.A
  const b = elStore.B
  if (!a && !b) return
  start = { A: a ? a.currentTime : 0, B: b ? b.currentTime : 0 }
  if (a) a.playbackRate = rate.value
  if (b) b.playbackRate = rate.value
  playing.value = true
  showTrim.value = false // 播放时收起分别微调（那时用不上）
  if (a) a.play().catch(() => {})
  if (b) b.play().catch(() => {})
  cancelAnimationFrame(rafId.value)
  rafId.value = requestAnimationFrame(tickSync)
}

function pause() {
  // 停之前先把真实位置记下来，否则逐帧会从旧位置起步
  if (elStore.A && !elStore.A.paused) pos.value = { ...pos.value, A: elStore.A.currentTime }
  if (elStore.B && !elStore.B.paused) pos.value = { ...pos.value, B: elStore.B.currentTime }
  playing.value = false
  cancelAnimationFrame(rafId.value)
  elStore.A?.pause()
  elStore.B?.pause()
}

function togglePlay() {
  if (playing.value) pause()
  else play()
}

/** 逐帧：先暂停，再两边各走 1/fps */
function step(frames) {
  pause()
  seekBoth(frames / (A.value.fps || 30), { force: true })
}

function setRate(v) {
  rate.value = v
  if (elStore.A) elStore.A.playbackRate = v
  if (elStore.B) elStore.B.playbackRate = v
}

/* ---------------- 时间轴 ---------------- */

/** 联动轴（以 A 的位置为准，拖动时两边同量平移） */
function onLinkedTime(e) {
  pause()
  const target = Number(e.target.value)
  seekBoth(target - pos.value.A, { force: true })
}

/** 单视频滑条 */
function onTrimTime(slot, e) {
  pause()
  seek(slot, Number(e.target.value), { force: true })
}

function resetAlign() {
  pause()
  seek('B', pos.value.A, { force: true })
}

function setFps(slot, value) {
  const obj = slotRef(slot)
  obj.value.fps = Number(value) || 30
  obj.value.fpsDetected = false
}

/** 自动测量帧率：短暂播一下取帧间隔中位数，测完两个视频都停回原位 */
function measureFps(slot) {
  const el = elOf(slot)
  if (!el || !el.currentSrc) return
  if (typeof el.requestVideoFrameCallback !== 'function') return
  measuring.value = true
  samples[slot] = []
  const resume = { ...pos.value }
  const restore = () => {
    el.pause()
    elStore.A?.pause()
    elStore.B?.pause()
    playing.value = false
    cancelAnimationFrame(rafId.value)
    measuring.value = false
    seek('A', resume.A, { force: true })
    seek('B', resume.B, { force: true })
  }
  startFpsProbe(slot)
  el.play()
    .then(() => setTimeout(restore, 900))
    .catch(() => {
      measuring.value = false
    })
}

function toggleMirror(slot, axis) {
  const obj = slotRef(slot)
  const key = axis === 'x' ? 'mirrorX' : 'mirrorY'
  obj.value[key] = !obj.value[key]
}

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId.value)
  if (A.value.url) URL.revokeObjectURL(A.value.url)
  if (B.value.url) URL.revokeObjectURL(B.value.url)
})
</script>

<template>
  <CollapsibleCard id="video" title="视频对比器" :summary="summary" :default-open="false">
    <p class="tip">
      逐帧 / 慢放 / 镜像看动作细节。**只支持本地视频文件** —— 平台视频（B站、YouTube）
      是跨域内容，拿不到解码后的帧，无法逐帧定位。
    </p>

    <div class="stage">
      <section v-for="slot in ['A', 'B']" :key="slot" class="slot">
        <div class="slot-head">
          <span class="badge">{{ slot }}</span>
          <span class="fname">{{ (slot === 'A' ? A : B).name || '未选择文件' }}</span>
        </div>

        <div class="video-box">
          <video
            :ref="(el) => { elStore[slot] = el }"
            :src="(slot === 'A' ? A : B).url || undefined"
            playsinline
            preload="metadata"
            :style="{
              transform: `scaleX(${(slot === 'A' ? A : B).mirrorX ? -1 : 1}) scaleY(${(slot === 'A' ? A : B).mirrorY ? -1 : 1})`,
            }"
            @loadedmetadata="onLoaded(slot)"
            @ended="pause"
          />
          <p v-if="!(slot === 'A' ? A : B).url" class="placeholder">点下面的按钮选一个视频文件</p>
        </div>

        <div class="slot-actions">
          <label class="pick">
            选择视频
            <input type="file" accept="video/*" @change="pickFile(slot, $event)" />
          </label>
          <button
            class="mini"
            type="button"
            :class="{ on: (slot === 'A' ? A : B).mirrorX }"
            title="左右镜像"
            @click="toggleMirror(slot, 'x')"
          >
            ↔ 镜像
          </button>
          <button
            class="mini"
            type="button"
            :class="{ on: (slot === 'A' ? A : B).mirrorY }"
            title="上下翻转"
            @click="toggleMirror(slot, 'y')"
          >
            ↕ 翻转
          </button>
        </div>

        <div class="slot-meta">
          <span class="t">{{ fmt(pos[slot], (slot === 'A' ? A : B).fps) }}</span>
          <span class="fps"
            >{{ (slot === 'A' ? A : B).fps }}fps{{ (slot === 'A' ? A : B).fpsDetected ? '' : '?' }}</span
          >
          <select class="fps-pick" @change="setFps(slot, $event.target.value)">
            <option value="">改帧率</option>
            <option v-for="f in FPS_PRESETS" :key="f" :value="f">{{ f }}</option>
          </select>
          <button class="mini" type="button" @click="measureFps(slot)">
            {{ measuring ? '测量中…' : '测帧率' }}
          </button>
        </div>
      </section>
    </div>

    <div class="transport">
      <button class="btn" type="button" title="后退一帧" @click="step(-1)">◀ 帧</button>
      <button class="btn primary" type="button" @click="togglePlay">
        {{ playing ? '⏸ 暂停' : '▶ 同步播放' }}
      </button>
      <button class="btn" type="button" title="前进一帧" @click="step(1)">帧 ▶</button>

      <label class="rate">
        速度
        <select :value="rate" @change="setRate(Number($event.target.value))">
          <option v-for="r in [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]" :key="r" :value="r">{{ r }}×</option>
        </select>
      </label>
    </div>

    <!-- 联动时间轴：拖动时两段同量平移，对齐关系不变 -->
    <div class="timeline">
      <div class="tl-label">
        <span>联动时间轴</span>
        <span class="tl-hint">拖动时两段同量平移；要错开用下面的「分别微调」</span>
      </div>
      <input
        type="range"
        :min="0"
        :max="dur || 1"
        :step="1 / (A.fps || 30)"
        :value="pos.A"
        @input="onLinkedTime"
      />
      <div class="time-row">
        <span class="t">{{ fmt(pos.A, A.fps) }}</span>
        <span class="total">/ {{ fmt(dur, A.fps) }}</span>
        <span v-if="bothLoaded" class="diff" :class="{ warn: Math.abs(diffFrames) > 0 }">
          B 比 A {{ diffSeconds >= 0 ? '慢' : '快' }} {{ Math.abs(diffFrames) }} 帧
        </span>
        <span class="sync-tag">{{ playing ? '同步播放中' : '已暂停' }}</span>
      </div>
    </div>

    <!-- 分别微调：默认收起，播放时自动隐藏 -->
    <div class="trim">
      <button class="btn ghost" type="button" @click="showTrim = !showTrim">
        {{ showTrim ? '收起分别微调' : '分别微调（各自的时间轴）' }}
      </button>
      <button v-if="showTrim && bothLoaded" class="btn ghost" type="button" @click="resetAlign">
        B 对齐到 A
      </button>
    </div>

    <div v-if="showTrim && !playing" class="trim-body">
      <div v-for="slot in ['A', 'B']" :key="slot" class="trim-row">
        <span class="trim-name">{{ slot }}</span>
        <input
          type="range"
          :min="0"
          :max="(slot === 'A' ? A : B).duration || 1"
          :step="1 / ((slot === 'A' ? A : B).fps || 30)"
          :value="pos[slot]"
          @input="onTrimTime(slot, $event)"
        />
        <span class="trim-time">{{ fmt(pos[slot], (slot === 'A' ? A : B).fps) }}</span>
      </div>
      <p class="trim-hint">
        两条滑条互不影响 —— 把两段录影的同一个动作对齐后，回到上面的联动轴播放，就始终是同一时刻。
      </p>
    </div>

    <p class="hint">
      逐帧 / 拖拽 / 播放都会让两个视频保持同步；对齐靠「分别微调」里各自的滑条，不用再一帧一帧地挪。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
.tip {
  margin: 0 0 12px;
  font-size: 11px;
  line-height: 1.7;
  color: #8fa3bf;
  background: #0f1729;
  border-left: 2px solid #2f6fd0;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

.stage {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

@media (max-width: 560px) {
  .stage {
    grid-template-columns: 1fr;
  }
}

.slot {
  min-width: 0;
}

.slot-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.badge {
  font-size: 10px;
  font-weight: 700;
  color: #cfe3ff;
  background: #16233c;
  border-radius: 4px;
  padding: 1px 6px;
  flex: none;
}

.fname {
  font-size: 11px;
  color: #7f9ac0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-box {
  position: relative;
  background: #05090f;
  border: 1px solid var(--line);
  border-radius: 10px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-box video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  transition: transform 160ms ease;
}

.placeholder {
  position: absolute;
  margin: 0;
  font-size: 11px;
  color: #4d5a70;
  text-align: center;
  padding: 0 12px;
}

.slot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.pick {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  color: #cfe3ff;
  background: #16233c;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 12px;
  cursor: pointer;
}

.pick input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.mini {
  font-size: 11px;
  color: #7f9ac0;
  background: #0f1729;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 10px;
  cursor: pointer;
  font-family: inherit;
}

.mini.on {
  border-color: #2f6fd0;
  color: #cfe3ff;
  background: #16233c;
}

.slot-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 10px;
  color: #5f728c;
  flex-wrap: wrap;
}

.slot-meta .t {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cfe3ff;
  font-size: 11px;
}

.fps-pick,
.rate select {
  font-size: 11px;
  color: #cfe3ff;
  background: #0f1729;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 2px 4px;
  font-family: inherit;
}

.transport {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.btn {
  font-size: 12px;
  color: #cfe3ff;
  background: #0f1729;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-family: inherit;
}

.btn.primary {
  background: #2f6fd0;
  border-color: #2f6fd0;
  color: #fff;
  font-weight: 600;
  min-width: 110px;
}

.btn.ghost {
  padding: 6px 10px;
  font-size: 11px;
  color: #7f9ac0;
}

.rate {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #7f9ac0;
}

.timeline {
  margin-bottom: 10px;
}

.tl-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 10px;
  color: #7f9ac0;
  margin-bottom: 2px;
}

.tl-hint {
  color: #4d5a70;
}

.timeline input[type='range'] {
  width: 100%;
  accent-color: #2f6fd0;
}

.time-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: #7f9ac0;
  flex-wrap: wrap;
}

.t {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cfe3ff;
}

.total {
  color: #5f728c;
}

.diff {
  font-size: 10px;
  color: #5f728c;
}

.diff.warn {
  color: #e6c07a;
}

.sync-tag {
  margin-left: auto;
  font-size: 10px;
  color: #5f728c;
}

.trim {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.trim-body {
  background: #0f1729;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
}

.trim-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.trim-name {
  font-size: 11px;
  font-weight: 700;
  color: #cfe3ff;
  width: 14px;
  flex: none;
}

.trim-row input[type='range'] {
  flex: 1;
  min-width: 0;
  accent-color: #2f6fd0;
}

.trim-time {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #9db6d6;
  flex: none;
}

.trim-hint {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: #5f728c;
}

.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: #5f728c;
}
</style>

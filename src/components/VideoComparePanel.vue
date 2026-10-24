<script setup>
/**
 * 视频对比器：本地视频的逐帧 / 慢放 / 镜像 对照工具。
 *
 * 为什么只吃本地文件：平台视频（B站/YouTube）是跨域 iframe，拿不到解码后的帧，
 * 也没法把播放位置精确到某一帧。要做到「逐帧看动作」只能用自己的 <video> 播本地文件。
 *
 * 同步思路：A 是主时钟，B 跟随 A（可加帧偏移）。播放时每帧检查两者偏差，
 * 超过阈值就把 B 拉回去；逐帧/拖时间轴时两个一起 seek，所以永远保持同一时刻。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'

/** 常见帧率，探测失败时可以手动选 */
const FPS_PRESETS = [24, 25, 30, 50, 60, 120]

const A = ref(makeSlot('A'))
const B = ref(makeSlot('B'))

const rate = ref(1)
const playing = ref(false)
const position = ref(0) // 当前时间（秒，以 A 为准）
const measuring = ref(false)

function makeSlot(label) {
  return {
    label,
    name: '',
    url: '',
    fps: 30, // 探测出来后会被覆盖
    fpsDetected: false,
    mirrorX: false,
    mirrorY: false,
    duration: 0,
    offsetFrames: 0, // 仅 B 用：B 相对 A 的帧偏移
  }
}

/** 两个 <video> 的 DOM 引用（普通对象即可，不需要响应式） */
const elStore = { A: null, B: null }

const rafId = ref(0)
/** 帧时间采样（用于自动探测帧率） */
const samples = { A: [], B: [] }

const duration = computed(() => Math.max(A.value.duration || 0, B.value.duration || 0))
const hasAny = computed(() => Boolean(A.value.url || B.value.url))
const offsetSeconds = computed(() => {
  const fps = B.value.fps || 30
  return (B.value.offsetFrames || 0) / fps
})

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
  const obj = slot === 'A' ? A : B

  const tick = (_, meta) => {
    if (!el.isConnected) return
    const arr = samples[slot]
    const prev = arr[arr.length - 1]
    if (prev !== undefined) {
      const d = meta.mediaTime - prev
      if (d > 0.0005 && d < 0.2) {
        samples[slot].push(meta.mediaTime)
        if (samples[slot].length > 24) samples[slot].shift()
        const gaps = []
        for (let i = 1; i < samples[slot].length; i++) gaps.push(samples[slot][i] - samples[slot][i - 1])
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
    // 采样够多就停，继续播时不必一直算
    if (samples[slot].length < 20 && !el.paused) el.requestVideoFrameCallback(tick)
  }
  el.requestVideoFrameCallback(tick)
}

async function pickFile(slot, e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  const obj = slot === 'A' ? A : B
  if (obj.value.url) URL.revokeObjectURL(obj.value.url)
  samples[slot] = []
  obj.value = {
    ...makeSlot(slot),
    name: file.name,
    url: URL.createObjectURL(file),
  }
  // 换片后等元数据就位再对齐
  e.target.value = ''
}

function onLoaded(slot) {
  const el = elOf(slot)
  if (!el) return
  const obj = slot === 'A' ? A : B
  obj.value.duration = el.duration || 0
  el.playbackRate = rate.value
  startFpsProbe(slot)
  if (!playing.value) seekAll(position.value, { force: true })
}

/** 把两个视频同时定位到 t（A 的时刻）；B 减去偏移 */
async function seekAll(t, { force = false } = {}) {
  const a = elStore.A
  const b = elStore.B
  const clamped = Math.max(0, Math.min(t, duration.value || t))
  position.value = clamped
  if (a) {
    const ta = Math.min(clamped, a.duration || clamped)
    if (force || Math.abs(a.currentTime - ta) > 0.005) a.currentTime = ta
  }
  if (b) {
    const tb = Math.min(Math.max(clamped - offsetSeconds.value, 0), b.duration || clamped)
    if (force || Math.abs(b.currentTime - tb) > 0.005) b.currentTime = tb
  }
}

/** 播放中每帧对齐：偏差超过阈值就把 B 拉回 A 的时间点 */
function tickSync() {
  const a = elStore.A
  const b = elStore.B
  // 主时钟优先用 A；只有 B 时用 B - 偏移
  if (a && !a.paused) position.value = a.currentTime
  else if (!a && b && !b.paused) position.value = Math.max(b.currentTime + offsetSeconds.value, 0)
  if (a && b && !b.paused) {
    const want = a.currentTime - offsetSeconds.value
    const toler = 0.04 + rate.value * 0.03
    if (want >= 0 && Math.abs(b.currentTime - want) > toler) b.currentTime = want
  }
  if (playing.value) rafId.value = requestAnimationFrame(tickSync)
}

async function play() {
  const a = elStore.A
  const b = elStore.B
  if (!a && !b) return
  await seekAll(position.value, { force: true })
  if (a) a.playbackRate = rate.value
  if (b) b.playbackRate = rate.value
  playing.value = true
  if (a) a.play().catch(() => {})
  if (b) b.play().catch(() => {})
  cancelAnimationFrame(rafId.value)
  rafId.value = requestAnimationFrame(tickSync)
}

function pause() {
  // 停之前先把 A 的真实位置记下来，否则逐帧会从上一帧的位置起步
  if (elStore.A && !elStore.A.paused) position.value = elStore.A.currentTime
  playing.value = false
  cancelAnimationFrame(rafId.value)
  elStore.A?.pause()
  elStore.B?.pause()
}

function togglePlay() {
  if (playing.value) pause()
  else play()
}

/** 逐帧：先暂停，再按 1/fps 步进；两个视频保持同步 */
async function step(frames) {
  pause()
  const fps = A.value.fps || 30
  const t = position.value + frames / fps
  await seekAll(t, { force: true })
}

function setRate(v) {
  rate.value = v
  if (elStore.A) elStore.A.playbackRate = v
  if (elStore.B) elStore.B.playbackRate = v
}

function nudgeOffset(frames) {
  B.value.offsetFrames = (B.value.offsetFrames || 0) + frames
  seekAll(position.value, { force: true })
}

function resetOffset() {
  B.value.offsetFrames = 0
  seekAll(position.value, { force: true })
}

/** 自动测量帧率：短暂播一下取帧间隔中位数，测完两个视频都停回原位 */
function measureFps(slot) {
  const el = elOf(slot)
  if (!el || !el.currentSrc) return
  if (typeof el.requestVideoFrameCallback !== 'function') return
  measuring.value = true
  samples[slot] = []
  const resumeAt = position.value
  const restore = () => {
    el.pause()
    elStore.A?.pause()
    elStore.B?.pause()
    playing.value = false
    cancelAnimationFrame(rafId.value)
    measuring.value = false
    seekAll(resumeAt, { force: true })
  }
  startFpsProbe(slot)
  el.play()
    .then(() => setTimeout(restore, 900))
    .catch(() => {
      measuring.value = false
    })
}

function setFps(slot, value) {
  const obj = slot === 'A' ? A : B
  obj.value.fps = Number(value) || 30
  obj.value.fpsDetected = false
}

function onTimeline(e) {
  pause()
  seekAll(Number(e.target.value), { force: true })
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
            @click="(slot === 'A' ? A : B).mirrorX = !(slot === 'A' ? A : B).mirrorX"
          >
            ↔ 镜像
          </button>
          <button
            class="mini"
            type="button"
            :class="{ on: (slot === 'A' ? A : B).mirrorY }"
            title="上下翻转"
            @click="(slot === 'A' ? A : B).mirrorY = !(slot === 'A' ? A : B).mirrorY"
          >
            ↕ 翻转
          </button>
        </div>

        <div class="slot-meta">
          <span>帧率 {{ (slot === 'A' ? A : B).fps }}{{ (slot === 'A' ? A : B).fpsDetected ? '（已校准）' : '（估算）' }}</span>
          <select class="fps-pick" @change="setFps(slot, $event.target.value)">
            <option value="">改帧率</option>
            <option v-for="f in FPS_PRESETS" :key="f" :value="f">{{ f }} fps</option>
          </select>
          <button class="mini" type="button" @click="measureFps(slot)">
            {{ measuring ? '测量中…' : '自动测量' }}
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

    <div class="timeline">
      <input
        type="range"
        :min="0"
        :max="duration || 1"
        :step="1 / (A.fps || 30)"
        :value="position"
        @input="onTimeline"
      />
      <div class="time-row">
        <span class="t">{{ fmt(position, A.fps) }}</span>
        <span class="t total">/ {{ fmt(duration, A.fps) }}</span>
        <span class="sync-tag">{{ playing ? '同步播放中' : '已暂停' }}</span>
      </div>
    </div>

    <div class="offset">
      <span class="olabel">B 相对 A 的偏移</span>
      <button class="mini" type="button" @click="nudgeOffset(-1)">−1 帧</button>
      <span class="oval">{{ B.offsetFrames > 0 ? '+' : '' }}{{ B.offsetFrames }} 帧</span>
      <button class="mini" type="button" @click="nudgeOffset(1)">+1 帧</button>
      <button class="mini" type="button" @click="resetOffset">归零</button>
      <span class="ohint">{{ offsetSeconds ? `${offsetSeconds.toFixed(3)} 秒` : '完全对齐' }}</span>
    </div>

    <p class="hint">
      两个视频共用一条时间轴：播放、拖拽、逐帧都会把两边一起定位。对不齐时用「B 相对 A 的偏移」按帧微调，
      适合比较同一动作的不同版本（原版 / 改版 / 自己的练习）。
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
}

.t {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cfe3ff;
}

.total {
  color: #5f728c;
}

.sync-tag {
  margin-left: auto;
  font-size: 10px;
  color: #5f728c;
}

.offset {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #7f9ac0;
  background: #0f1729;
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

.olabel {
  color: #8fa3bf;
}

.oval {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #cfe3ff;
  min-width: 46px;
  text-align: center;
}

.ohint {
  color: #5f728c;
  margin-left: auto;
}

.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: #5f728c;
}
</style>

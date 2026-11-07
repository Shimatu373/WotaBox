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
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import {
  addDancer,
  canDragDancer,
  clearPos,
  cloneSegments,
  importClipSteps,
  isOnStageDuring,
  pasteSegments,
  removeDancer,
  removeKeyAt,
  renameDancer,
  sampleAt,
  lastPosOf,
  moveKey,
  retimeKey,
  setEnterDir,
  setKeyDuration,
  seedKey,
  removeClipSegments,
  segmentsOfClip,
  setPos,
  toggleSelection,
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
const playing = ref(false) // 静默预览状态（不驱动播放器时用）
const recordMode = ref(false)

/** 播放器（全局单例）：载入了同一首歌时，由这个页面遥控它 */
const player = useAudioPlayer()
const playerReady = computed(() => clockHasFile(props.song.fileName))
/** 界面上显示的播放状态：有播放器就看播放器，否则看静默预览 */
if (playerReady.value) localTime.value = Math.min(dur.value, player.position.value)

const playingNow = computed(() => (playerReady.value ? player.isPlaying.value : playing.value))

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

/**
 * 播放：载入了同一首歌就**遥控播放器**（有声），否则用静默预览时钟。
 * 方向是「走位页 → 播放器」，所以这里的播放/暂停/跳转都要落到播放器上。
 */
function playLocal() {
  if (playerReady.value) {
    if (localTime.value >= dur.value) localTime.value = 0
    player.seek(localTime.value)
    player.play()
    return
  }
  if (playing.value) return
  if (localTime.value >= dur.value) localTime.value = 0
  playing.value = true
  lastTs = 0
  rafId = requestAnimationFrame(tick)
}

function pauseLocal() {
  playing.value = false
  cancelAnimationFrame(rafId)
  if (playerReady.value && player.isPlaying.value) player.pause()
}

/** 跳转：同步给播放器（播放中的话会自动从新位置继续） */
function seek(t) {
  const target = Math.max(0, Math.min(dur.value, Number(t) || 0))
  cancelAnimationFrame(rafId)
  playing.value = false
  localTime.value = target
  if (playerReady.value) {
    player.seek(target)
    if (player.isPlaying.value) player.play()
  }
}

// 时间以播放器为准：只要它在放这首歌，走位页就跟着它的进度走
watch(
  () => playerClock.position,
  (p) => {
    if (playerReady.value && player.isPlaying.value) localTime.value = Math.min(dur.value, p)
  },
)

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
  // 再点一次同一个打师 = 取消选中（右侧进度条会显示全部片段）
  selectedKey.value = toggleSelection(selectedKey.value, key)
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
  // 点到别的打师：先选中，不拖 —— 只靠一次点击就搬动别人太危险
  if (selectedKey.value !== dancerKey) {
    selectedKey.value = dancerKey
    return
  }
  const alpha = sampled.value[dancerKey]?.alpha ?? 0
  if (!canDragDancer({ selectedKey: selectedKey.value, dancerKey, recordMode: recordMode.value, alpha })) {
    if (recordMode.value && alpha <= 0.05) flash('这名打师此刻不在场，先「此刻上场」再拖')
    return
  }
  // 关键：先把「此刻全队在哪儿」写进这一帧，再改被拖的那个人
  // 否则新建的帧里只有他一个人，其他人会被采样判成「不在场」而集体淡出
  seedKey(stage, time.value, sampled.value)
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
  // 同样先固定住其他人的位置，否则这一帧里只有「缺席」信息，别人会被判成离场
  seedKey(stage, time.value, sampled.value)
  clearPos(stage, selected.value.key, time.value)
  setKeyDuration(stage, time.value, transDur.value)
  flash(`${selected.value.name} 已下场`)
}

/** 让选中的打师在此刻上场：优先回到他上次的位置 */
function enterNow() {
  const d = selected.value
  if (!d) return
  seedKey(stage, time.value, sampled.value)
  const prev = lastPosOf(stage, d.key, time.value)
  setPos(stage, d.key, time.value, prev?.x ?? 0.5, prev?.y ?? 0.7)
  setEnterDir(stage, d.key, time.value, enterDir.value)
  setKeyDuration(stage, time.value, transDur.value)
  flash(`${d.name} 已上场${enterDir.value === 'auto' ? '' : `（从${DIR_LABEL[enterDir.value]}）`}`)
}

/** 此刻这个打师在不在场上（alpha 0 = 不在场，中间值 = 淡入/淡出中） */
const stateNow = computed(() => {
  const k = selectedKey.value
  if (!k) return null
  const s = sampled.value[k]
  if (!s) return { label: '不在场', alpha: 0, cls: 'off' }
  if (s.alpha >= 0.995) return { label: '在场', alpha: 1, cls: 'on' }
  if (s.alpha <= 0.005) return { label: '不在场', alpha: 0, cls: 'off' }
  return { label: s.alpha < 0.5 ? '正在下场' : '正在上场', alpha: s.alpha, cls: 'mid' }
})

/** 上场方向：auto = 按目标位置自动选最近的边 */
const enterDir = ref('auto')
const DIR_LABEL = { left: '左侧', right: '右侧', top: '上方', bottom: '下方' }
/** 上下场过渡时长（秒）：点「上场 / 下场」时写进那一帧 */
const transDur = ref(0.5)

// 左侧「各片段动作」面板：可折叠 + 内部滚动
const clipsOpen = ref(true)

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
/** 逐帧微调按 30fps 算（音频没有帧率概念，1/30 秒作为"一帧"精度足够用） */
const STEP_FRAME = 1 / 30

/** 关键帧逐帧前后挪 */
function nudgeKey(t, dir) {
  const res = moveKey(stage, t, dir * STEP_FRAME)
  if (res?.moved) seek(res.t)
  else if (res) flash('这一格已经有关键帧了')
}

/** 直接输入时间（精确到毫秒） */
function editKeyTime(t) {
  const input = window.prompt('关键帧时间（秒，可带小数）', String(Number(t.toFixed(3))))
  if (input === null) return
  const next = Number(input)
  if (!Number.isFinite(next) || next < 0) return
  const res = retimeKey(stage, t, next)
  if (res?.moved) seek(res.t)
  else if (res) flash('那个位置已经有关键帧了')
}

/** 关键帧时间显示到百分秒，方便看精度 */
/** 直接编辑某一帧的上下场时长；留空 = 恢复「占满整段间隔」 */
function editKeyDur(t) {
  const key = stage.keys.find((k) => Math.abs(k.t - t) <= 0.061)
  if (!key) return
  const input = window.prompt('这一帧的上下场时长（秒，留空 = 自动占满间隔）', key.dur ? String(key.dur) : '')
  if (input === null) return
  setKeyDuration(stage, t, input.trim() === '' ? null : Number(input))
}

function fmtKey(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.round((t % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
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
    segments: segmentsOfClip(stage, d.key, c),
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
  removeClipSegments(stage, d.key, clip)
  flash('已清空该片段的动作')
}

function addTextToClip(clip) {
  const d = selected.value
  if (!d) return
  const text = window.prompt(`给 ${d.name} 在「${clip.name}」加一段自定义动作：`, '')
  if (!text) return
  if (!Array.isArray(stage.lines[d.key])) stage.lines[d.key] = []
  const at = clip.a
  const step = textStep(text)
  let seg = stage.lines[d.key].find((s) => s.clipId === clip.id)
  if (!seg) seg = stage.lines[d.key].find((s) => !s.clipId && Math.abs(s.at - at) <= 0.5)
  if (seg) {
    seg.steps.push(step)
    seg.clipId = clip.id
  } else {
    stage.lines[d.key].push({ at, clipId: clip.id, steps: [step] })
  }
  stage.lines[d.key].sort((x, y) => x.at - y.at)
}

/* ---------------- 进度条 ---------------- */

/** 进度条：按下即跳、按住拖动连续跟随（pointer capture 保证手指滑出条外也不断） */
const barEl = ref(null)
let barDragging = false

function barTimeAt(e) {
  const el = barEl.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  return ((e.clientX - rect.left) / rect.width) * dur.value
}

function startBar(e) {
  barDragging = true
  e.currentTarget.setPointerCapture?.(e.pointerId)
  seek(barTimeAt(e))
}

function moveBar(e) {
  if (barDragging) seek(barTimeAt(e))
}

function endBar(e) {
  barDragging = false
  e.currentTarget?.releasePointerCapture?.(e.pointerId)
}

/** 关键帧列表只显示「和当前打师有关」的那些，避免几十个 chip 挤成一团 */
const visibleKeys = computed(() => {
  const k = selectedKey.value
  if (!k) return stage.keys
  return stage.keys.filter((key) => key.pos[k])
})

/** 进度条上要画的片段：选了打师就只显示他上过场的片段 */
const barSegments = computed(() =>
  clips.value
    .map((c, i) => ({ clip: c, color: CLIP_COLORS[i % CLIP_COLORS.length] }))
    .filter(({ clip }) => !selectedKey.value || isOnStageDuring(stage, selectedKey.value, clip.a, clip.b)),
)

/** 被隐藏掉的片段数（用于提示，避免以为数据丢了） */
const hiddenClipCount = computed(() => clips.value.length - barSegments.value.length)

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
          <span class="sync-state" :class="{ on: playerReady }">
            {{ playerReady ? '🔊 本页控制播放器' : '🔇 静默预览（播放器未载入这首歌）' }}
          </span>
          <button class="ghost" type="button" @click="playingNow ? pauseLocal() : playLocal()">
            {{ playingNow ? '⏸ 暂停' : '▶ 播放' }}
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
            <div v-else class="dancer-empty">
              {{ stage.dancers.length ? '未选中打师（点下面的名字选中，再点一次取消）' : '还没有打师，点下面加一个' }}
            </div>

            <div v-if="selected && stateNow" class="dancer-state" :class="stateNow.cls">
              <i class="state-dot" />
              此刻：{{ stateNow.label }}
              <span v-if="stateNow.alpha > 0 && stateNow.alpha < 1" class="state-alpha">
                {{ Math.round(stateNow.alpha * 100) }}%
              </span>
            </div>

            <div class="line-actions">
              <button class="mini" type="button" :disabled="!selected" @click="copyLine">复制动作</button>
              <button class="mini" type="button" :disabled="!lineClip" @click="pasteLine">粘贴</button>
            </div>
            <p v-if="flashText" class="flash">{{ flashText }}</p>
          </div>

          <div class="panel clips-panel">
            <button class="panel-toggle" type="button" @click="clipsOpen = !clipsOpen">
              <span class="panel-title">该打师在各片段的动作</span>
              <span class="caret">{{ clipsOpen ? '▾' : '▸' }}</span>
            </button>
            <div v-show="clipsOpen" class="clips-body">
            <div v-for="row in clipRows" :key="row.clip.id" class="clip-row">
              <div class="clip-top">
                <i class="swatch small" :style="{ background: row.color }" />
                <button class="mini jump" type="button" title="跳到这个片段的开头" @click="seek(row.clip.a)">⏮</button>
                <span class="clip-name">{{ row.clip.name }}</span>
                <span class="clip-time">{{ fmtClock(row.clip.a) }}–{{ fmtClock(row.clip.b) }}</span>
              </div>
              <div class="steps">
                <template v-if="row.segments.length">
                  <span v-for="(seg, si) in row.segments" :key="si" class="act-seg">
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
                :class="{
                  sel: d.key === selectedKey,
                  drag: dragging === d.key,
                  off: (sampled[d.key]?.alpha ?? 0) <= 0.05,
                }"
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
              <!-- 舞台朝向：图的下方＝观众那一面 -->
              <div class="front-edge" aria-hidden="true">
                <span class="front-label">舞台正面 · 观众侧</span>
              </div>

              <p v-if="!stage.dancers.length" class="stage-empty">左侧「＋ 加打师」开始摆站位</p>
              <p v-if="recordMode" class="record-hint">走位编辑：只能拖动**当前选中**的打师，拖动即在当前时刻记录位置</p>
            </div>
          </div>

          <div
            ref="barEl"
            class="bar"
            @pointerdown="startBar"
            @pointermove="moveBar"
            @pointerup="endBar"
            @pointercancel="endBar"
          >
            <div
              v-for="item in barSegments"
              :key="item.clip.id"
              class="seg"
              :style="{ left: pct(item.clip.a), width: pct(item.clip.b - item.clip.a), background: item.color }"
              :title="`${item.clip.name} ${fmtClock(item.clip.a)}–${fmtClock(item.clip.b)}`"
            >
              <span class="seg-label">{{ item.clip.name }}</span>
            </div>
            <div
              v-for="k in stage.keys"
              :key="'mk' + k.t"
              class="kf-mark"
              :class="{ on: selectedKey && k.pos[selectedKey] }"
              :style="{ left: pct(k.t) }"
              :title="fmtKey(k.t)"
            />
            <div class="playhead" :style="{ left: pct(time) }" />
          </div>

          <!-- 时间显示 / 关键帧信息：舞台缩小后这里才有地方 -->
          <div class="time-row">
            <span class="t-now">{{ fmtClock(time) }}</span>
            <span class="t-total">/ {{ fmtClock(dur) }}</span>
            <span class="t-sep">·</span>
            <span class="t-info">
              片段 {{ barSegments.length }}<template v-if="hiddenClipCount">／{{ clips.length }}（隐藏 {{ hiddenClipCount }}
                段未上场）</template>
            </span>
            <span class="t-sep">·</span>
            <span class="t-info">
              关键帧 {{ stage.keys.length }}<template v-if="selected">（{{ selected.name }}：{{ visibleKeys.length }}）</template>
            </span>
            <span v-if="playerReady && player.loopEnabled" class="t-follow">播放器 A-B 循环开启中</span>
          </div>

          <div class="bar-tools">
            <label class="mini dir-pick">
              上场方向
              <select v-model="enterDir">
                <option value="auto">就近边缘</option>
                <option value="left">左侧</option>
                <option value="right">右侧</option>
                <option value="top">上方</option>
                <option value="bottom">下方</option>
              </select>
            </label>
            <label class="mini dur-pick">
              时长
              <input v-model.number="transDur" type="number" min="0.05" max="30" step="0.1" />
              秒
            </label>
            <button class="mini" type="button" :disabled="!selected || stateNow?.cls === 'on'" @click="enterNow">
              此刻上场
            </button>
            <button class="mini" type="button" :disabled="!selected || stateNow?.cls === 'off'" @click="leaveNow">
              此刻下场
            </button>
            <button class="mini" type="button" @click="snapshotHere">把当前队形存成关键帧</button>
          </div>

          <div v-if="visibleKeys.length" class="keys">
            <span v-for="k in visibleKeys" :key="k.t" class="kf-chip" :class="{ hard: k.hard }" @click="seek(k.t)">
              <button class="kf-mini" type="button" title="提前一帧" @click.stop="nudgeKey(k.t, -1)">◀</button>
              <span class="kf-t">{{ fmtKey(k.t) }}</span>
              <button class="kf-mini" type="button" title="延后一帧" @click.stop="nudgeKey(k.t, 1)">▶</button>
              <button class="kf-mini" type="button" title="直接输入时间" @click.stop="editKeyTime(k.t)">✎</button>
              <button class="kf-mini" type="button" title="上下场时长" @click.stop="editKeyDur(k.t)">⏱</button>
              <span v-if="k.dur" class="kf-dur">{{ k.dur }}s</span>
              <span class="kf-n">{{ Object.keys(k.pos).length }}人</span>
              <span class="kf-hard" @click.stop="toggleHard(stage, k.t)">{{ k.hard ? '硬切' : '滑' }}</span>
              <span class="kf-del" @click.stop="dropKeyAt(k.t)">×</span>
            </span>
          </div>
          <p v-else-if="stage.keys.length" class="keys-empty">
            这个打师还没有关键帧（选中某个打师时，这里只显示他自己的帧）
          </p>
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
.sync-state {
  font-size: 10px;
  color: #7f9ac0;
  padding: 4px 8px;
  border-radius: 6px;
  background: #0f1729;
  border: 1px solid var(--line);
}

.sync-state.on {
  color: #7fd0ff;
  border-color: #2f6fd0;
}
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

.act-seg {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
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


/* 打师此刻状态：在场 / 不在场 / 淡入淡出中 */
.dancer-state {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 10px;
  color: #7f9ac0;
}

.state-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4d5a70;
  flex: none;
}

.dancer-state.on .state-dot {
  background: #43c463;
  box-shadow: 0 0 6px rgba(67, 196, 99, 0.7);
}

.dancer-state.off .state-dot {
  background: #44556f;
}

.dancer-state.mid .state-dot {
  background: #e8b53c;
  box-shadow: 0 0 6px rgba(232, 181, 60, 0.7);
}

.dancer-state.on {
  color: #a8e6b8;
}

.dancer-state.mid {
  color: #f7dc9a;
}

.state-alpha {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* 片段动作面板：可折叠 + 内部滚动 */
.panel-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: 0;
  padding: 0 0 6px;
  cursor: pointer;
  font-family: inherit;
}

.caret {
  font-size: 10px;
  color: #5f728c;
}

.clips-body {
  max-height: 34vh;
  overflow-y: auto;
  padding-right: 2px;
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

/* 舞台别占满：留出进度条、时间与关键帧的位置 */
.stage-wrap {
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.stage {
  position: relative;
  width: min(100%, calc(46vh * 16 / 9));
  aspect-ratio: 16 / 9;
  max-height: 46vh;
  background:
    radial-gradient(ellipse at 50% 40%, #12203a 0%, #0a1220 70%),
    #0a1220;
  border: 1px solid #2a3b52;
  border-radius: 12px;
  overflow: hidden;
  touch-action: none;
}


/* 舞台正面：下方边缘一条线 + 文字，只做提示，不挡拖拽 */
.front-edge {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 26px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 3px;
  border-bottom: 1px solid rgba(127, 208, 255, 0.35);
  background: linear-gradient(to top, rgba(47, 111, 208, 0.14), transparent);
  pointer-events: none;
}

.front-label {
  font-size: 9px;
  letter-spacing: 2px;
  color: rgba(127, 208, 255, 0.6);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
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

.dot.off {
  pointer-events: none;
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
  bottom: 32px;
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
  touch-action: none;
}

/* 片段色块只做视觉，不挡进度条的拖动 */
.seg {
  position: absolute;
  top: 0;
  bottom: 0;
  opacity: 0.35;
  pointer-events: none;
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

.time-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: #5f728c;
  flex: none;
  flex-wrap: wrap;
}

.t-now {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  color: #cfe3ff;
}

.t-total {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #5f728c;
}

.t-sep {
  color: #33405a;
}

.t-info {
  font-size: 10px;
  color: #7f9ac0;
}

.t-follow {
  margin-left: auto;
  font-size: 10px;
  color: #7fd0ff;
}


.dir-pick {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 6px;
}

.dir-pick select {
  background: #0f1729;
  color: #9db6d6;
  border: 1px solid var(--line);
  border-radius: 5px;
  font-size: 10px;
  font-family: inherit;
  padding: 1px 2px;
}
.keys-empty {
  margin: 0;
  font-size: 10px;
  color: #4d5a70;
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
/* 进度条上的关键帧标记（只做视觉，不挡拖动） */
.kf-mark {
  position: absolute;
  top: 0;
  width: 2px;
  height: 7px;
  margin-left: -1px;
  background: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

.kf-mark.on {
  background: #e6c07a;
}

/* 关键帧 chip 里的小按钮 */
.kf-mini {
  border: 0;
  background: transparent;
  color: #7f9ac0;
  font-size: 9px;
  padding: 0 1px;
  cursor: pointer;
  font-family: inherit;
}

.kf-mini:hover {
  color: #cfe3ff;
}


.dur-pick {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.dur-pick input {
  width: 46px;
  background: #0f1729;
  color: #cfe3ff;
  border: 1px solid var(--line);
  border-radius: 5px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 3px;
  text-align: center;
}

.kf-dur {
  color: #7fd0ff;
}
.kf-t {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.jump {
  padding: 0 5px;
  flex: none;
}
</style>

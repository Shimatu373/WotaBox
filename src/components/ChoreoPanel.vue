<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import DifficultyBar from './DifficultyBar.vue'
import StagePanel from './StagePanel.vue'
import { openHelp } from '../composables/useHelp.js'
import { downloadChoreo, importChoreoFile } from '../composables/useChoreoShare.js'
import { WAZA } from '../data/waza.js'
import {
  choreoStore,
  clipsBySong,
  removeClip,
  toText,
  updateClip,
  fmtClock,
  wazaStep,
  textStep,
} from '../composables/useChoreo.js'

const wazaMap = computed(() => Object.fromEntries(WAZA.map((w) => [w.id, w])))
const nameOf = (id) => wazaMap.value[id]?.nameZh || wazaMap.value[id]?.nameJa || id

const groups = computed(() => clipsBySong())

const summary = computed(() => {
  const n = choreoStore.clips.length
  return n ? `${n} 条记录 · ${groups.value.length} 首歌` : '还没有记录'
})

const copiedKey = ref('')

async function copyGroup(group) {
  const text = toText(group, nameOf)
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = group.songKey
    setTimeout(() => {
      if (copiedKey.value === group.songKey) copiedKey.value = ''
    }, 1800)
  } catch {
    window.prompt('复制下面的内容：', text)
  }
}

function del(id, name) {
  if (window.confirm(`删除片段「${name}」？`)) removeClip(id)
}

/* ---------------- 单独导出 / 导入编排 ---------------- */

const shareMsg = ref('')

function exportChoreo() {
  const n = downloadChoreo()
  shareMsg.value = `已导出 ${n.clips} 条片段、${n.songs} 首歌的站位（不含收藏夹）`
  setTimeout(() => (shareMsg.value = ''), 4000)
}

async function importChoreo(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  try {
    const s = await importChoreoFile(file)
    const parts = [`新增 ${s.clipsAdded} 条`, `更新 ${s.clipsUpdated} 条`]
    if (s.songsImported) parts.push(`站位 ${s.songsImported} 首`)
    if (s.songsSkipped) parts.push(`跳过 ${s.songsSkipped} 首（本地已有站位，不覆盖）`)
    shareMsg.value = '导入完成：' + parts.join('，')
  } catch (err) {
    shareMsg.value = err.message || '导入失败'
  }
  e.target.value = ''
}

/** 站位视图（全屏子页面） */
const stageSong = ref(null)
function openStage(group) {
  stageSong.value = group
}

/* ---------------- 编辑（解锁） ---------------- */

const editingId = ref(null)
const editDraft = ref(null)
const editPicking = ref(false)
const editKw = ref('')
const editCustom = ref('')

/** 把一条片段拷进草稿，避免直接改原对象（取消时不脏数据） */
function startEdit(clip) {
  editingId.value = clip.id
  editDraft.value = {
    name: clip.name,
    a: clip.a,
    b: clip.b,
    note: clip.note,
    steps: clip.steps.map((s) => ({ ...s })),
  }
  editPicking.value = false
  editKw.value = ''
  editCustom.value = ''
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = null
  editPicking.value = false
  editKw.value = ''
  editCustom.value = ''
}

function saveEdit() {
  if (!editDraft.value || !editingId.value) return
  const d = editDraft.value
  const a = Math.max(0, Number(d.a) || 0)
  const b = Math.max(a + 0.1, Number(d.b) || 0)
  if (b - a < 0.1) {
    window.alert('结束时间要比起始时间至少多 0.1 秒')
    return
  }
  updateClip(editingId.value, {
    name: d.name,
    a,
    b,
    note: d.note,
    steps: d.steps,
  })
  cancelEdit()
}

function nudgeTime(field, delta) {
  if (!editDraft.value) return
  editDraft.value[field] = Math.max(0, Math.round((Number(editDraft.value[field]) + delta) * 10) / 10)
}

function removeStep(i) {
  editDraft.value?.steps.splice(i, 1)
}

function moveStep(i, delta) {
  const arr = editDraft.value?.steps
  if (!arr) return
  const j = i + delta
  if (j < 0 || j >= arr.length) return
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
}

function addCustom() {
  const text = editCustom.value.trim()
  if (!text || !editDraft.value) return
  editDraft.value.steps.push(textStep(text))
  editCustom.value = ''
}

const editPickList = computed(() => {
  const k = editKw.value.trim().toLowerCase()
  const base = k
    ? WAZA.filter((w) =>
        [w.nameJa, w.nameZh, w.series].filter(Boolean).join(' ').toLowerCase().includes(k),
      )
    : WAZA
  return base.slice(0, 20)
})

function addWaza(id) {
  editDraft.value?.steps.push(wazaStep(id))
  editPicking.value = false
  editKw.value = ''
}
</script>

<template>
  <CollapsibleCard id="choreo" title="编排" :summary="summary" :default-open="false">
    <p v-if="!groups.length" class="empty">
      还没有编排记录。去「音乐播放器」里选一首歌、标好 A-B 点，点「＋ 存为片段」并关联副歌技，就会出现在这里。
    </p>

    <div v-for="g in groups" :key="g.songKey" class="song">
      <div class="song-head">
        <span class="song-name">{{ g.fileName }}</span>
        <span class="song-len">{{ fmtClock(g.duration) }}</span>
        <button class="help-mini" type="button" @click="openHelp('stage')">怎么用？</button>
        <button class="copy stage-btn" type="button" @click="openStage(g)">站位视图</button>
        <button class="copy" type="button" @click="copyGroup(g)">
          {{ copiedKey === g.songKey ? '已复制 ✓' : '复制编排' }}
        </button>
      </div>

      <div v-for="(c, i) in g.clips" :key="c.id" class="clip" :class="{ editing: editingId === c.id }">
        <!-- 只读态 -->
        <template v-if="editingId !== c.id">
          <div class="clip-head">
            <span class="idx">{{ i + 1 }}</span>
            <span class="cname">{{ c.name }}</span>
            <span class="ctime">{{ fmtClock(c.a) }}–{{ fmtClock(c.b) }}</span>
            <button class="edit" type="button" title="编辑这条编排" @click="startEdit(c)">✎</button>
            <button class="del" type="button" @click="del(c.id, c.name)">×</button>
          </div>

          <div v-if="c.steps.length" class="chain">
            <template v-for="(s, k) in c.steps" :key="k">
              <span class="wz" :class="{ custom: s.kind === 'text' }">
                <span class="wz-idx">{{ k + 1 }}</span>
                <template v-if="s.kind === 'text'">{{ s.text }}</template>
                <template v-else>{{ nameOf(s.id) }}<DifficultyBar :level="wazaMap[s.id]?.difficulty" /></template>
              </span>
              <span v-if="k < c.steps.length - 1" class="arrow">→</span>
            </template>
          </div>
          <div v-else class="chain empty-chain">还没有动作</div>

          <p v-if="c.note" class="note">{{ c.note }}</p>
        </template>

        <!-- 编辑态（解锁） -->
        <div v-else class="editor">
          <div class="ed-title">
            <span class="lock-open">✎ 编辑中</span>
            <span class="ed-sub">改完点保存；取消则原样不动</span>
          </div>

          <div class="ed-row">
            <span class="ed-label">名称</span>
            <input v-model="editDraft.name" class="ed-input" type="text" placeholder="副歌 / 主歌 / C 段" />
          </div>

          <div class="ed-row">
            <span class="ed-label">区间</span>
            <div class="ed-time">
              <button class="tiny" type="button" @click="nudgeTime('a', -0.1)">−</button>
              <input v-model.number="editDraft.a" class="ed-num" type="number" min="0" step="0.1" />
              <button class="tiny" type="button" @click="nudgeTime('a', 0.1)">＋</button>
              <span class="sep">→</span>
              <button class="tiny" type="button" @click="nudgeTime('b', -0.1)">−</button>
              <input v-model.number="editDraft.b" class="ed-num" type="number" min="0" step="0.1" />
              <button class="tiny" type="button" @click="nudgeTime('b', 0.1)">＋</button>
            </div>
            <span class="ed-now">{{ fmtClock(editDraft.a) }}–{{ fmtClock(editDraft.b) }}</span>
          </div>

          <div class="ed-block">
            <div class="ed-label">动作（按顺序）</div>
            <ol v-if="editDraft.steps.length" class="ed-list">
              <li v-for="(s, k) in editDraft.steps" :key="k">
                <span class="wz-idx">{{ k + 1 }}</span>
                <span class="wz-name" :class="{ custom: s.kind === 'text' }">
                  {{ s.kind === 'text' ? s.text : nameOf(s.id) }}
                </span>
                <button class="wz-btn" type="button" @click="moveStep(k, -1)">↑</button>
                <button class="wz-btn" type="button" @click="moveStep(k, 1)">↓</button>
                <button class="wz-btn del" type="button" @click="removeStep(k)">×</button>
              </li>
            </ol>
            <p v-else class="ed-empty">还没有动作</p>

            <button v-if="!editPicking" class="wz-add" type="button" @click="editPicking = true">
              ＋ 从图鉴添加
            </button>
            <div v-else class="picker-box">
              <input
                v-model="editKw"
                class="ed-input"
                type="search"
                placeholder="搜技名，点一条即可追加"
                autocomplete="off"
              />
              <ul class="pick-list">
                <li v-for="w in editPickList" :key="w.id">
                  <button type="button" @click="addWaza(w.id)">
                    <span class="pk-ja">{{ w.nameJa }}<DifficultyBar :level="w.difficulty" /></span>
                    <span class="pk-zh">{{ w.nameZh || w.series || '' }}</span>
                  </button>
                </li>
              </ul>
              <button class="wz-add" type="button" @click="editPicking = false">收起</button>
            </div>

            <div class="custom-row">
              <input
                v-model="editCustom"
                class="ed-input"
                type="text"
                placeholder="自定义动作：原创 / 缝合"
                @keyup.enter="addCustom"
              />
              <button class="wz-add" type="button" @click="addCustom">＋ 加自定义</button>
            </div>
          </div>

          <div class="ed-row">
            <span class="ed-label">备注</span>
            <input v-model="editDraft.note" class="ed-input" type="text" placeholder="可选" />
          </div>

          <div class="ed-actions">
            <button class="save-btn" type="button" @click="saveEdit">保存修改</button>
            <button class="mini" type="button" @click="cancelEdit">取消</button>
          </div>
        </div>
      </div>
    </div>

    <div class="share-row">
      <button class="copy" type="button" @click="exportChoreo">导出编排</button>
      <label class="copy file-label">
        导入编排
        <input type="file" accept="application/json,.json" @change="importChoreo" />
      </label>
      <span v-if="shareMsg" class="share-msg">{{ shareMsg }}</span>
    </div>

    <p class="hint">
      「复制编排」会生成一段纯文本，可以直接发群里和同伴对动作；
      「导出编排」给的是 JSON 文件，**只含片段与站位，不含收藏夹**，方便单独分享。
      数据都存本机，不上传。
    </p>
  </CollapsibleCard>

  <!-- 站位 / 走位视图（全屏子页面，横屏布局） -->
  <StagePanel v-if="stageSong" :song="stageSong" :name-of="nameOf" @close="stageSong = null" />
</template>

<style scoped>
.empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #5f728c;
}

.song {
  margin-bottom: 18px;
}

.song:last-of-type {
  margin-bottom: 8px;
}

.song-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 10px;
}

.song-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #cfe3ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-len {
  font-size: 11px;
  color: #5f728c;
  font-variant-numeric: tabular-nums;
}

.copy {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid #2f6fd0;
  background: rgba(47, 111, 208, 0.14);
  color: #cfe3ff;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

/* 站位视图入口：暖色，和「复制编排」区分开 */
.stage-btn {
  border-color: #b8892f;
  background: rgba(230, 192, 122, 0.12);
  color: #e6c07a;
}

.clip {
  padding: 10px 11px;
  margin-bottom: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #0f1729;
}

.clip-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.idx {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: #22304d;
  color: #9db6d6;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.cname {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #e6edf7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctime {
  font-size: 11px;
  color: #6b7f9c;
  font-variant-numeric: tabular-nums;
}

.del {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 0;
  background: transparent;
  color: #5f728c;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.del:active {
  background: #22304d;
  color: #e08b8b;
}

.chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.wz {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 7px;
  background: #16233c;
  color: #cfe3ff;
  font-size: 11px;
}

/* 自定义文本动作（原创 / 缝合）：暖色 + 斜体，和图鉴技区分开 */
.wz.custom {
  background: rgba(230, 192, 122, 0.12);
  color: #e6c07a;
  font-style: italic;
}

.wz-idx {
  font-size: 9px;
  color: #7fa8d8;
  font-variant-numeric: tabular-nums;
}

.arrow {
  color: #4d5a70;
  font-size: 11px;
}

.empty-chain {
  color: #5f728c;
  font-size: 11px;
}

.note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #8fa3bf;
  border-left: 2px solid var(--line);
  padding-left: 8px;
}


.help-mini {
  flex: none;
  height: 28px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px dashed var(--line);
  background: transparent;
  color: #7f9ac0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

.share-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.file-label {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
}

.file-label input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.share-msg {
  font-size: 10px;
  color: #7fd0ff;
  flex: 1;
  min-width: 0;
}
.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}

/* ---------------- 编辑（解锁） ---------------- */

.clip.editing {
  background: #0f1729;
  border-radius: 10px;
  padding: 10px;
  margin: 8px -4px;
}

.edit {
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 12px;
  line-height: 1;
  padding: 4px 7px;
  border-radius: 7px;
  cursor: pointer;
  font-family: inherit;
  flex: none;
}

.edit:hover {
  border-color: #2f6fd0;
  color: #cfe3ff;
}

.ed-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.lock-open {
  font-size: 11px;
  font-weight: 600;
  color: #7fd0ff;
}

.ed-sub {
  font-size: 10px;
  color: #5f728c;
}

.ed-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.ed-label {
  font-size: 10px;
  color: #5f728c;
  flex: none;
  min-width: 28px;
}

.ed-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #05090f;
  color: #e6edf7;
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

.ed-input:focus {
  border-color: #2f6fd0;
}

.ed-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tiny {
  width: 24px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #16233c;
  color: #cfe3ff;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  flex: none;
}

.ed-num {
  width: 62px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #05090f;
  color: #e6edf7;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 0 6px;
  outline: none;
}

.sep {
  color: #4d5a70;
  font-size: 11px;
}

.ed-now {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  color: #5f728c;
}

.ed-block {
  margin-bottom: 8px;
}

.ed-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
}

.ed-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 0;
  border-top: 1px solid var(--line);
  font-size: 12px;
}

.wz-name {
  flex: 1;
  min-width: 0;
  color: #cfe3ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wz-name.custom {
  color: #e6c07a;
  font-style: italic;
}

.wz-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #16233c;
  color: #7f9ac0;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  flex: none;
}

.wz-btn.del {
  color: #e0574f;
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
}

.pick-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}

.pick-list button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 7px 8px;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--line);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pk-ja {
  font-size: 12px;
  color: #e6edf7;
}

.pk-zh {
  font-size: 10px;
  color: #6b7f9c;
}

.custom-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.custom-row .ed-input {
  flex: 1;
}

.custom-row .wz-add {
  margin-top: 0;
  white-space: nowrap;
}

.ed-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.save-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: 0;
  background: #2f6fd0;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.mini {
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
</style>

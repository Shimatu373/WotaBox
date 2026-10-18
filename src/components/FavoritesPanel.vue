<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import { WAZA } from '../data/waza.js'
import {
  collections,
  STATUS_DEF,
  statusMeta,
  createCollection,
  renameCollection,
  removeCollection,
  removeWaza,
  cycleStatus,
  statsOf,
} from '../composables/useCollections.js'

const activeId = ref(collections[0]?.id ?? 'fav')
const creating = ref(false)
const newName = ref('')
const editingName = ref(false)
const nameDraft = ref('')

const wazaMap = computed(() => Object.fromEntries(WAZA.map((w) => [w.id, w])))

const active = computed(
  () => collections.find((c) => c.id === activeId.value) || collections[0]
)

const items = computed(() => {
  const c = active.value
  if (!c) return []
  return c.items
    .map((i) => ({ ...i, waza: wazaMap.value[i.wazaId] }))
    .filter((i) => i.waza)
})

const stats = computed(() => statsOf(active.value?.id))
const total = computed(() => items.value.length)

function pct(n) {
  return total.value ? (n / total.value) * 100 : 0
}

const summary = computed(() => {
  const n = collections.reduce((s, c) => s + c.items.length, 0)
  return `${collections.length} 个收藏夹 · ${n} 条记录`
})

function startCreate() {
  creating.value = true
  newName.value = ''
}

function confirmCreate() {
  const name = newName.value.trim()
  if (!name) {
    creating.value = false
    return
  }
  const c = createCollection(name)
  activeId.value = c.id
  creating.value = false
  newName.value = ''
}

function startRename() {
  editingName.value = true
  nameDraft.value = active.value?.name ?? ''
}

function confirmRename() {
  if (active.value) renameCollection(active.value.id, nameDraft.value)
  editingName.value = false
}

function deleteActive() {
  const c = active.value
  if (!c || c.builtin) return
  if (!window.confirm(`删除收藏夹「${c.name}」？里面的 ${c.items.length} 条记录也会一起删除。`)) return
  removeCollection(c.id)
  activeId.value = collections[0]?.id ?? 'fav'
}
</script>

<template>
  <CollapsibleCard id="favorites" title="收藏夹" :summary="summary" :default-open="false">
    <div class="chips">
      <button
        v-for="c in collections"
        :key="c.id"
        class="chip"
        :class="{ on: c.id === activeId }"
        type="button"
        @click="activeId = c.id"
      >
        <i class="cdot" :style="{ background: c.color }" />
        <span class="chip-name">{{ c.name }}</span>
        <span class="chip-n">{{ c.items.length }}</span>
      </button>
      <button class="chip add" type="button" title="新建收藏夹" @click="startCreate">＋</button>
    </div>

    <div v-if="creating" class="edit-row">
      <input
        v-model="newName"
        class="input"
        type="text"
        placeholder="收藏夹名称，比如「2026 春 副歌」"
        autocomplete="off"
        @keyup.enter="confirmCreate"
      />
      <button class="mini" type="button" @click="confirmCreate">建立</button>
      <button class="mini ghost" type="button" @click="creating = false">取消</button>
    </div>

    <template v-if="active">
      <div class="head">
        <template v-if="!editingName">
          <h3 class="name">{{ active.name }}</h3>
          <button class="mini ghost" type="button" @click="startRename">改名</button>
          <button v-if="!active.builtin" class="mini danger" type="button" @click="deleteActive">
            删除
          </button>
        </template>
        <template v-else>
          <input
            v-model="nameDraft"
            class="input"
            type="text"
            autocomplete="off"
            @keyup.enter="confirmRename"
          />
          <button class="mini" type="button" @click="confirmRename">保存</button>
          <button class="mini ghost" type="button" @click="editingName = false">取消</button>
        </template>
      </div>

      <div v-if="total" class="stats">
        <div class="bar">
          <span
            v-for="s in STATUS_DEF"
            :key="s.key"
            class="seg"
            :style="{ width: pct(stats[s.key]) + '%', background: s.color }"
          />
        </div>
        <div class="legend">
          <span v-for="s in STATUS_DEF" :key="s.key" class="lg">
            <i class="cdot" :style="{ background: s.color }" />{{ s.label }}
            <b>{{ stats[s.key] }}</b>
          </span>
        </div>
      </div>

      <ul v-if="items.length" class="items">
        <li
          v-for="it in items"
          :key="it.wazaId"
          class="item"
          :style="{ borderColor: statusMeta(it.status).color }"
        >
          <div class="info">
            <span class="ja">{{ it.waza.nameJa }}</span>
            <span class="zh">{{ it.waza.nameZh || it.waza.nameRomaji }}</span>
          </div>
          <button
            class="badge"
            type="button"
            :style="{
              borderColor: statusMeta(it.status).color,
              color: statusMeta(it.status).text,
            }"
            @click="cycleStatus(active.id, it.wazaId)"
          >
            {{ statusMeta(it.status).label }}
          </button>
          <button class="x" type="button" title="移出收藏夹" @click="removeWaza(active.id, it.wazaId)">
            ×
          </button>
        </li>
      </ul>

      <p v-else class="empty">
        这个收藏夹还是空的 —— 去上面「技图鉴」里点开一个技，在「收藏夹」那一栏点一下就能加进来。
      </p>
    </template>

    <p class="hint">
      点状态徽章循环切换：未掌握 → 已习得 → 已上手，边框颜色会跟着变。数据只存在本机，不上传。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 12px;
  padding: 6px 11px;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
}

.chip.on {
  border-color: #2f6fd0;
  background: #16233c;
  color: #e6edf7;
  font-weight: 600;
}

.chip.add {
  color: #7fd0ff;
  border-style: dashed;
  padding: 6px 12px;
}

.chip-n {
  font-size: 10px;
  color: #5f728c;
  background: #0b1020;
  border-radius: 999px;
  padding: 1px 6px;
}

.cdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.edit-row {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.input:focus {
  border-color: #2f6fd0;
}

.mini {
  flex: none;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #2f6fd0;
  background: #2f6fd0;
  color: #fff;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.mini.ghost {
  background: transparent;
  border-color: var(--line);
  color: #7f9ac0;
}

.mini.danger {
  background: transparent;
  border-color: #7a3b3b;
  color: #e08b8b;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.name {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #cfe3ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats {
  margin-bottom: 12px;
}

.bar {
  display: flex;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: #0f1729;
  margin-bottom: 6px;
}

.seg {
  height: 100%;
  transition: width 260ms ease;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: #7f9ac0;
}

.lg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.lg b {
  color: #cfe3ff;
  font-weight: 600;
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 11px;
  margin-bottom: 8px;
  border: 1px solid var(--line);
  border-left-width: 3px;
  border-radius: 10px;
  background: #0f1729;
  transition: border-color 200ms ease;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.ja {
  font-size: 13px;
  font-weight: 600;
  color: #e6edf7;
  letter-spacing: 0.5px;
}

.zh {
  font-size: 11px;
  color: #6b7f9c;
}

.badge {
  flex: none;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 200ms ease, color 200ms ease;
  -webkit-tap-highlight-color: transparent;
}

.x {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #5f728c;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.x:active {
  background: #22304d;
  color: #e08b8b;
}

.empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #5f728c;
  padding: 10px 0;
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>

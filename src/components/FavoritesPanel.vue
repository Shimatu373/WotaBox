<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import DifficultyBar from './DifficultyBar.vue'
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
  poolOf,
} from '../composables/useCollections.js'

const mode = ref('collections') // collections | pool
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


const poolGroups = computed(() => {
  const byId = wazaMap.value
  const all = poolOf()
    .map((x) => ({ ...x, waza: byId[x.wazaId] }))
    .filter((x) => x.waza)
  const byName = (a, b) => a.waza.nameJa.localeCompare(b.waza.nameJa, 'ja')
  return {
    proficient: all.filter((x) => x.status === 'proficient').sort(byName),
    learned: all.filter((x) => x.status === 'learned').sort(byName),
  }
})

const summary = computed(() => {
  if (mode.value === 'pool') {
    const { proficient, learned } = poolGroups.value
    return `${proficient.length} 已上手 · ${learned.length} 已习得`
  }
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
    <div class="tabs">
      <button
        class="tab"
        :class="{ on: mode === 'collections' }"
        type="button"
        @click="mode = 'collections'"
      >
        收藏夹
      </button>
      <button class="tab" :class="{ on: mode === 'pool' }" type="button" @click="mode = 'pool'">
        个人技池
      </button>
    </div>
    <div v-if="mode === 'collections'" class="chips">
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

    <div v-if="mode === 'collections' && creating" class="edit-row">
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

    <template v-if="mode === 'collections' && active">
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
            <span class="ja">{{ it.waza.nameJa }}<DifficultyBar :level="it.waza.difficulty" /></span>
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

    <p v-if="mode === 'collections'" class="hint">
      点状态徽章循环切换：未掌握 → 已习得 → 已上手，边框颜色会跟着变。数据只存在本机，不上传。
    </p>

    <template v-else>
      <p
        v-if="!poolGroups.proficient.length && !poolGroups.learned.length"
        class="empty"
      >
        技池还是空的 —— 在收藏夹里把技标成「已习得」或「已上手」，它就会出现在这里。
      </p>

      <template v-else>
        <section v-if="poolGroups.proficient.length" class="group">
          <div class="ghead">
            <span class="lbl gold">已上手</span>
            <span class="gn">{{ poolGroups.proficient.length }}</span>
          </div>
          <ul class="pool-list">
            <li v-for="x in poolGroups.proficient" :key="x.wazaId" class="pool-item gold">
              <span class="pja">{{ x.waza.nameJa }}<DifficultyBar :level="x.waza.difficulty" /></span>
              <span class="pzh">{{ x.waza.nameZh || x.waza.series || '' }}</span>
            </li>
          </ul>
        </section>

        <section v-if="poolGroups.learned.length" class="group">
          <div class="ghead">
            <span class="lbl blue">已习得</span>
            <span class="gn">{{ poolGroups.learned.length }}</span>
          </div>
          <ul class="pool-list">
            <li v-for="x in poolGroups.learned" :key="x.wazaId" class="pool-item blue">
              <span class="pja">{{ x.waza.nameJa }}<DifficultyBar :level="x.waza.difficulty" /></span>
              <span class="pzh">{{ x.waza.nameZh || x.waza.series || '' }}</span>
            </li>
          </ul>
        </section>
      </template>

      <p class="hint">
        个人技池由所有收藏夹汇总而成，只读。同一技在多个收藏夹里有不同状态时，按最高状态显示。
      </p>
    </template>
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

.group {
  margin-bottom: 14px;
}

.ghead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
}

.ghead .lbl {
  font-weight: 600;
}

.lbl.gold {
  color: #ffd98a;
}

.lbl.blue {
  color: #a8d0ff;
}

.gn {
  color: #5f728c;
  font-variant-numeric: tabular-nums;
}

.pool-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  margin-bottom: 7px;
  border-radius: 10px;
  border: 1px solid var(--line);
  border-left-width: 3px;
  background: #0f1729;
}

.pool-item.gold {
  border-color: #f5a524;
}

.pool-item.blue {
  border-color: #4a8fe0;
}

.pja {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #e6edf7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pzh {
  flex: none;
  font-size: 11px;
  color: #6b7f9c;
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import DifficultyBar from './DifficultyBar.vue'
import { WAZA, SERIES_INFO, wikiUrl, allSeries, typeMeta } from '../data/waza.js'
import { loadWazaDetail } from '../data/wiki-detail.js'
import { DIFFICULTY_DEF, DIFFICULTY_ORDER, difficultyMeta } from '../data/difficulty.js'
import {
  collections,
  statusMeta,
  isInCollection,
  toggleWazaInCollection,
  bestStatusOf,
} from '../composables/useCollections.js'

const keyword = ref('')
const activeSeries = ref('全部')
const expandedId = ref(null)
// 难度筛选：多选，空数组 = 不过滤。'unknown' 代表「待评定」
const activeDiffs = ref([])

const seriesList = computed(() => ['全部', ...allSeries()])

const diffChips = computed(() => [
  ...DIFFICULTY_ORDER.map((k) => ({ key: k, ...DIFFICULTY_DEF[k] })),
  { key: 'unknown', ...difficultyMeta(null) },
])

const diffKeyOf = (w) => w.difficulty || 'unknown'

function toggleDiff(key) {
  activeDiffs.value = activeDiffs.value.includes(key)
    ? activeDiffs.value.filter((k) => k !== key)
    : [...activeDiffs.value, key]
}

// 「全部」时按系列归组，方便在几十个技里扫读
const groupedFiltered = computed(() => {
  const list = [...filtered.value]
  const order = (w) => {
    const i = seriesList.value.indexOf(w.series || '未分类')
    return i === -1 ? 999 : i
  }
  list.sort((a, b) => order(a) - order(b))

  const counts = {}
  for (const w of list) {
    const s = w.series || '未分类'
    counts[s] = (counts[s] || 0) + 1
  }

  let last = null
  return list.map((w) => {
    const s = w.series || '未分类'
    const showHead = s !== last
    last = s
    return { ...w, showHead, headName: s, seriesCount: counts[s] }
  })
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return WAZA.filter((w) => {
    if (activeSeries.value !== '全部' && (w.series || '未分类') !== activeSeries.value) return false
    if (activeDiffs.value.length && !activeDiffs.value.includes(diffKeyOf(w))) return false
    if (!kw) return true
    const haystack = [w.nameJa, w.nameRomaji, w.nameZh, w.series, ...(w.aliases || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(kw)
  })
})

const summary = computed(() => `${WAZA.length} 个技 · ${allSeries().length} 个系列`)

// 详情（作成者 / 参考视频 / 要点）按需加载：点开某个技时才拉它那一块
const details = reactive({})
const detailLoading = ref(null)

function detailOf(w) {
  return details[w.nameJa] === undefined ? null : details[w.nameJa]
}

async function ensureDetail(w) {
  if (!w || details[w.nameJa] !== undefined) return
  detailLoading.value = w.nameJa
  try {
    details[w.nameJa] = await loadWazaDetail(w.nameJa)
  } finally {
    if (detailLoading.value === w.nameJa) detailLoading.value = null
  }
}

watch(expandedId, (id) => {
  if (!id) return
  const w = WAZA.find((x) => x.id === id)
  if (w) ensureDetail(w)
})

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function seriesMeta(name) {
  return SERIES_INFO[name] || null
}
</script>

<template>
  <CollapsibleCard id="waza" title="技图鉴" :summary="summary" :default-open="false">
    <div class="search-row">
      <input
        v-model="keyword"
        class="search"
        type="search"
        placeholder="搜技名 / 罗马音 / 中文 / 系列"
        autocomplete="off"
      />
    </div>

    <div class="chips">
      <button
        v-for="s in seriesList"
        :key="s"
        class="chip"
        :class="{ on: activeSeries === s }"
        type="button"
        @click="activeSeries = s"
      >
        {{ s }}
      </button>
    </div>

    <p v-if="activeSeries !== '全部' && seriesMeta(activeSeries)" class="series-note">
      <strong>{{ activeSeries }}</strong> · 本家 {{ seriesMeta(activeSeries).origin }} —
      {{ seriesMeta(activeSeries).note }}
    </p>

    <div class="chips diff-chips">
      <button
        class="chip"
        :class="{ on: !activeDiffs.length }"
        type="button"
        @click="activeDiffs = []"
      >
        难度：全部
      </button>
      <button
        v-for="d in diffChips"
        :key="d.key"
        class="chip dchip"
        :class="{ on: activeDiffs.includes(d.key) }"
        :style="
          activeDiffs.includes(d.key) ? { borderColor: d.color, color: d.text } : null
        "
        type="button"
        @click="toggleDiff(d.key)"
      >
        <i class="lg-bar" :style="{ background: d.color }" />{{ d.label }}
      </button>
    </div>

    <p class="count">共 {{ filtered.length }} 条</p>

    <ul v-if="groupedFiltered.length" class="list">
      <li v-for="w in groupedFiltered" :key="w.id" class="item" :class="{ open: expandedId === w.id, 'has-head': w.showHead }">
        <div v-if="w.showHead" class="group-head">
          <span class="group-name">{{ w.headName }}</span>
          <span class="group-n">{{ w.seriesCount }} 个</span>
        </div>

        <button class="row" type="button" :aria-expanded="expandedId === w.id" @click="toggle(w.id)">
          <span class="names">
            <span class="ja">{{ w.nameJa }}<DifficultyBar :level="w.difficulty" /></span>
            <span class="sub">
              <span v-if="w.nameZh" class="zh">{{ w.nameZh }}</span>
              <span v-if="w.nameRomaji" class="romaji">{{ w.nameRomaji }}</span>
            </span>
          </span>
          <span
            v-if="bestStatusOf(w.id)"
            class="status-dot"
            :style="{ background: statusMeta(bestStatusOf(w.id)).color }"
          />
          <span class="right">
            <span v-if="w.bars" class="bars">{{ w.bars }} 八拍</span>
            <span class="arrow">›</span>
          </span>
        </button>

        <div class="detail">
          <div class="detail-inner">
            <div class="content">
              <dl class="meta">
                <div v-if="w.series">
                  <dt>系列</dt>
                  <dd>{{ w.series }}</dd>
                </div>
                <div v-if="detailOf(w)?.creator">
                  <dt>作成者</dt>
                  <dd>{{ detailOf(w).creator }}</dd>
                </div>
                <div v-else-if="detailOf(w)?.origin">
                  <dt>本家</dt>
                  <dd>{{ detailOf(w).origin }}</dd>
                </div>
                <div v-if="detailOf(w)?.creator && detailOf(w)?.origin && detailOf(w).origin !== detailOf(w).creator">
                  <dt>本家</dt>
                  <dd>{{ detailOf(w).origin }}</dd>
                </div>
                <div v-if="detailOf(w)?.year">
                  <dt>年份</dt>
                  <dd>{{ detailOf(w).year }}</dd>
                </div>
                <div>
                  <dt>八拍数</dt>
                  <dd>{{ w.bars ? w.bars + ' 个八拍' : '待确认' }}</dd>
                </div>
                <div>
                  <dt>难度</dt>
                  <dd class="diff-dd">
                    <DifficultyBar :level="w.difficulty" tall />
                    <span :style="{ color: difficultyMeta(w.difficulty).text }">{{
                      difficultyMeta(w.difficulty).label
                    }}</span>
                  </dd>
                </div>
                <div>
                  <dt>技类型</dt>
                  <dd>
                    <span
                      class="type-pill"
                      :style="{ color: typeMeta(w.type).text, borderColor: typeMeta(w.type).color }"
                      >{{ typeMeta(w.type).label }}</span
                    >
                  </dd>
                </div>
              </dl>

              <div v-if="detailOf(w)?.tags?.length" class="tags">
                <span v-for="t in detailOf(w).tags" :key="t" class="tag">{{ t }}</span>
              </div>

              <p v-if="detailLoading === w.nameJa && !detailOf(w)" class="detail-loading">正在读取 wiki 元数据…</p>

              <section v-if="detailOf(w)?.videos?.length" class="block">
                <h3>参考视频</h3>
                <ul class="videos">
                  <li v-for="(v, i) in detailOf(w).videos" :key="i">
                    <span class="vkind">{{ v.kind }}</span>
                    <a :href="v.url" target="_blank" rel="noopener noreferrer">{{ v.title }}</a>
                    <span class="vmeta">
                      <span v-if="v.performer">{{ v.performer }}</span>
                      <span v-if="v.time" class="vtime">{{ v.time }}</span>
                    </span>
                  </li>
                </ul>
              </section>

              <section class="block">
                <h3>收藏夹</h3>
                <div class="coll-chips">
                  <button
                    v-for="c in collections"
                    :key="c.id"
                    class="coll-chip"
                    :class="{ on: isInCollection(c.id, w.id) }"
                    type="button"
                    @click="toggleWazaInCollection(c.id, w.id)"
                  >
                    <i class="cdot" :style="{ background: c.color }" />
                    {{ c.name }}
                  </button>
                </div>
                <p v-if="bestStatusOf(w.id)" class="coll-hint">
                  掌握状态：{{ statusMeta(bestStatusOf(w.id)).label }}
                </p>
              </section>

              <section v-if="detailOf(w)?.pitfalls" class="block">
                <h3>要点 / 常见失误</h3>
                <p class="pitfall">{{ detailOf(w).pitfalls }}</p>
              </section>

              <a
                v-if="w.wiki"
                class="source"
                :href="wikiUrl(w.wiki)"
                target="_blank"
                rel="noopener noreferrer"
              >
                在中文WOTA艺wiki查看完整词条 ↗
              </a>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="empty big">没有匹配的技</p>

    <p class="hint">
      数据存在 <code>src/data/waza.js</code>，本地、离线、不联网。加技就是往里加一条对象。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
.search-row {
  margin-bottom: 10px;
}

.search {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  appearance: none;
}

.search::placeholder {
  color: #5f728c;
}

.search:focus {
  border-color: #2f6fd0;
}

.chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  margin-bottom: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}

.chip.on {
  background: #2f6fd0;
  border-color: #2f6fd0;
  color: #fff;
  font-weight: 600;
}

.series-note {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.6;
  color: #7f9ac0;
  background: #0f1729;
  border-left: 2px solid #2f6fd0;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

.series-note strong {
  color: #cfe3ff;
}

.count {
  margin: 0 0 10px;
  font-size: 11px;
  color: #5f728c;
}

/* 难度筛选 chip：色条 + 文字 */
.diff-chips {
  margin-bottom: 8px;
}

.dchip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* 选中态用难度自己的颜色描边，避免和系列 chip 的蓝底撞色 */
.dchip.on {
  background: #16233c;
  font-weight: 600;
}

.lg-bar {
  display: inline-block;
  width: 3px;
  height: 11px;
  border-radius: 2px;
  flex: none;
}

.diff-dd {
  display: flex;
  align-items: center;
  gap: 6px;
}

.detail-loading {
  margin: 0 0 10px;
  font-size: 11px;
  color: #5f728c;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  border-top: 1px solid var(--line);
}

.item:first-child {
  border-top: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 12px 2px;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.names {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.ja {
  font-size: 14px;
  font-weight: 600;
  color: #e6edf7;
  letter-spacing: 0.5px;
}

.sub {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #6b7f9c;
  flex-wrap: wrap;
}

.romaji {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0;
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.bars {
  font-size: 10px;
  color: #7fa8d8;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
}

.arrow {
  color: #4d5a70;
  font-size: 16px;
  transition: transform 200ms ease;
}

.item.open .arrow {
  transform: rotate(90deg);
}

.detail {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 260ms cubic-bezier(0.4, 0, 0.2, 1);
}

.item.open .detail {
  grid-template-rows: 1fr;
}

.detail-inner {
  overflow: hidden;
  min-height: 0;
}

.content {
  padding: 2px 0 14px;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin: 0 0 10px;
  padding: 10px;
  background: #0f1729;
  border-radius: 10px;
}

.meta div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

dt {
  font-size: 10px;
  color: #5f728c;
}

dd {
  margin: 0;
  font-size: 12px;
  color: #cfe3ff;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.tag {
  font-size: 10px;
  color: #8fb4e0;
  background: #16233c;
  border-radius: 999px;
  padding: 3px 9px;
}

.block {
  margin-bottom: 12px;
}

.block h3 {
  font-size: 11px;
  font-weight: 600;
  color: #8fa3bf;
  margin: 0 0 6px;
  letter-spacing: 0.5px;
}

.videos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.videos li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.vkind {
  font-size: 10px;
  color: #7fa8d8;
  background: #16233c;
  border-radius: 4px;
  padding: 1px 6px;
  flex: none;
}

.videos a {
  color: #7fd0ff;
  text-decoration: none;
  word-break: break-word;
}

.videos a:active {
  opacity: 0.7;
}

.vmeta {
  font-size: 11px;
  color: #5f728c;
  display: flex;
  gap: 6px;
}

.vtime {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #9db6d6;
}

.steps {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.8;
  color: #c8d6ea;
}

.steps li {
  margin-bottom: 4px;
}

.pitfall {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #e6c07a;
  background: rgba(230, 192, 122, 0.08);
  border-left: 2px solid #b8892f;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

.empty {
  margin: 0;
  font-size: 12px;
  color: #5f728c;
  line-height: 1.7;
}

.empty.big {
  text-align: center;
  padding: 16px 0;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  background: #16233c;
  padding: 1px 5px;
  border-radius: 4px;
  color: #9db6d6;
}

.source {
  display: inline-block;
  font-size: 12px;
  color: #7fd0ff;
  text-decoration: none;
  border-bottom: 1px dashed rgba(127, 208, 255, 0.4);
  padding-bottom: 1px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.coll-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.coll-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #7f9ac0;
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
}

.coll-chip.on {
  border-color: #2f6fd0;
  background: #16233c;
  color: #cfe3ff;
}

.cdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.coll-hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: #7f9ac0;
}

.item.has-head {
  border-top: none;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 2px 4px;
  border-top: 1px solid var(--line);
}

.item:first-child .group-head {
  border-top: none;
  padding-top: 2px;
}

.group-name {
  font-size: 12px;
  font-weight: 600;
  color: #a8c4e6;
  letter-spacing: 0.5px;
}

.group-n {
  font-size: 10px;
  color: #5f728c;
  flex: none;
}

.type-pill {
  display: inline-block;
  font-size: 11px;
  line-height: 1.6;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>

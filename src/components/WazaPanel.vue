<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import { WAZA, SERIES_INFO, wikiUrl, allSeries } from '../data/waza.js'

const keyword = ref('')
const activeSeries = ref('全部')
const expandedId = ref(null)

const seriesList = computed(() => ['全部', ...allSeries()])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return WAZA.filter((w) => {
    if (activeSeries.value !== '全部' && w.series !== activeSeries.value) return false
    if (!kw) return true
    const haystack = [w.nameJa, w.nameRomaji, w.nameZh, w.series, ...(w.aliases || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(kw)
  })
})

const summary = computed(() => `${WAZA.length} 个技 · ${allSeries().length} 个系列`)

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

    <p class="count">共 {{ filtered.length }} 条</p>

    <ul v-if="filtered.length" class="list">
      <li v-for="w in filtered" :key="w.id" class="item" :class="{ open: expandedId === w.id }">
        <button class="row" type="button" :aria-expanded="expandedId === w.id" @click="toggle(w.id)">
          <span class="names">
            <span class="ja">{{ w.nameJa }}</span>
            <span class="sub">
              <span v-if="w.nameZh" class="zh">{{ w.nameZh }}</span>
              <span v-if="w.nameRomaji" class="romaji">{{ w.nameRomaji }}</span>
            </span>
          </span>
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
                <div v-if="w.creator">
                  <dt>作成者</dt>
                  <dd>{{ w.creator }}</dd>
                </div>
                <div v-if="w.year">
                  <dt>年份</dt>
                  <dd>{{ w.year }}</dd>
                </div>
                <div>
                  <dt>八拍数</dt>
                  <dd>{{ w.bars ? w.bars + ' 个八拍' : '待确认' }}</dd>
                </div>
                <div>
                  <dt>难度</dt>
                  <dd>{{ w.difficulty ? '★'.repeat(w.difficulty) : '待评定' }}</dd>
                </div>
              </dl>

              <div v-if="w.tags && w.tags.length" class="tags">
                <span v-for="t in w.tags" :key="t" class="tag">{{ t }}</span>
              </div>

              <section v-if="w.videos && w.videos.length" class="block">
                <h3>参考视频</h3>
                <ul class="videos">
                  <li v-for="(v, i) in w.videos" :key="i">
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
                <h3>动作分解</h3>
                <ol v-if="w.steps && w.steps.length" class="steps">
                  <li v-for="(s, i) in w.steps" :key="i">{{ s }}</li>
                </ol>
                <p v-else class="empty">待补充 —— 在 <code>src/data/waza.js</code> 里填这个技的 <code>steps</code></p>
              </section>

              <section v-if="w.pitfalls" class="block">
                <h3>要点 / 常见失误</h3>
                <p class="pitfall">{{ w.pitfalls }}</p>
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
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
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

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>

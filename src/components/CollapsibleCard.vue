<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: true },
})

const storageKey = 'wota:panel:' + props.id

function readStored() {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    /* localStorage 不可用（隐私模式等），忽略 */
  }
  return null
}

const stored = readStored()
const open = ref(stored === null ? props.defaultOpen : stored)

watch(open, (v) => {
  try {
    localStorage.setItem(storageKey, v ? '1' : '0')
  } catch {
    /* 忽略 */
  }
})

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <section class="card panel" :class="{ open }">
    <button class="head" type="button" :aria-expanded="open" @click="toggle">
      <span class="title">{{ title }}</span>
      <span class="head-right">
        <span v-if="summary" class="summary">{{ summary }}</span>
        <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>

    <div class="body">
      <div class="inner">
        <div class="content">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  padding: 0;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: #cfe3ff;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.summary {
  font-size: 11px;
  color: #7f9ac0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.chevron {
  color: #7f9ac0;
  transition: transform 240ms ease;
}

.open .chevron {
  transform: rotate(180deg);
}

/* 0fr <-> 1fr 实现高度自适应折叠动画，不依赖固定高度 */
.body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 260ms cubic-bezier(0.4, 0, 0.2, 1);
}

.open .body {
  grid-template-rows: 1fr;
}

.inner {
  overflow: hidden;
  min-height: 0;
}

.content {
  padding: 0 16px 16px;
}
</style>

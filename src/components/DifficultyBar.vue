<script setup>
/**
 * 难度色条：技名后面的一条小竖线。
 * 基础=绿 / 进阶=黄 / 专家=红 / 大师=紫；待评定=比背景略亮的半透明白条。
 */
import { computed } from 'vue'
import { difficultyMeta } from '../data/difficulty.js'

const props = defineProps({
  level: { type: String, default: null },
  /** 详情页那种可以顺手放大一点的场合传 true */
  tall: { type: Boolean, default: false },
})

const meta = computed(() => difficultyMeta(props.level))
</script>

<template>
  <i
    class="diff-bar"
    :class="{ tall }"
    :style="{ background: meta.color }"
    :title="`难度：${meta.label}`"
    :aria-label="`难度：${meta.label}`"
    role="img"
  />
</template>

<style scoped>
.diff-bar {
  display: inline-block;
  width: 3px;
  height: 13px;
  border-radius: 2px;
  margin-left: 6px;
  vertical-align: -1px;
  flex: none;
}

.diff-bar.tall {
  height: 15px;
  width: 4px;
  vertical-align: -2px;
}
</style>

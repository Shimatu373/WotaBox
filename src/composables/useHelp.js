/**
 * 帮助页的开关（全局共享）
 *
 * 多个面板都要能打开帮助：顶栏「帮助」、编排里的「不会用？看这里」、
 * 站位视图顶栏的「?」。用模块级 ref 就不用一层层传事件了。
 */
import { ref } from 'vue'

export const helpOpen = ref(false)
export const helpTarget = ref('')

/** 打开帮助；section 可选，会直接跳到那一节（对应 src/data/help.js 的 id） */
export function openHelp(section = '') {
  helpTarget.value = section || ''
  helpOpen.value = true
}

export function closeHelp() {
  helpOpen.value = false
  helpTarget.value = ''
}

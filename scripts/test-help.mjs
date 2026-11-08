/**
 * 帮助页目录结构测试
 *
 * 目的很朴素：帮助页里每个目录项都要能在正文里找到对应的锚点，
 * 否则点了没反应（这类问题在浏览器里才发现，很浪费时间）。
 *
 * 用法：node scripts/test-help.mjs
 */
import { readFileSync } from 'node:fs'
import { HELP_GROUPS, HELP_SECTIONS } from '../src/data/help.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`✗ ${name}${extra ? '：' + extra : ''}`)
  }
}

const panel = readFileSync(new URL('../src/components/HelpPanel.vue', import.meta.url), 'utf8')

ok('目录不为空', HELP_SECTIONS.length >= 8, `${HELP_SECTIONS.length} 节`)

const ids = HELP_SECTIONS.map((s) => s.id)
ok('id 不重复', new Set(ids).size === ids.length)
ok('id 都是英文小写', ids.every((id) => /^[a-z][a-z0-9-]*$/.test(id)), ids.join(','))

const groups = new Set(HELP_SECTIONS.map((s) => s.group))
ok('分组都在声明的分组里', [...groups].every((g) => HELP_GROUPS.includes(g)), [...groups].join(','))
ok('每个分组都有内容', HELP_GROUPS.every((g) => groups.has(g)))

// 正文锚点：<section id="help-xxx">
const anchors = [...panel.matchAll(/<section id="help-([a-z0-9-]+)"/g)].map((m) => m[1])
ok('正文锚点数与目录一致', anchors.length === ids.length, `正文 ${anchors.length} / 目录 ${ids.length}`)
for (const id of ids) {
  ok(`目录「${id}」有对应正文`, anchors.includes(id))
}
for (const id of anchors) {
  ok(`正文「${id}」在目录里`, ids.includes(id))
}

// 侧边目录由 HELP_SECTIONS 生成，点目录要能滚到对应锚点
ok('侧边目录由 HELP_SECTIONS 生成', /from '\.\.\/data\/help\.js'/.test(panel) && panel.includes('HELP_SECTIONS'))
ok('点击目录会滚动到锚点', /getElementById\('help-' \+ id\)/.test(panel))

// 语气检查：文档里不该出现居高临下的说法
for (const word of ['文盲', '看不懂吧', '很简单的']) {
  ok(`文档不含「${word}」`, !panel.includes(word))
}

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
console.log(fail === 0 ? 'OK 帮助页结构通过' : 'FAIL 见上面的 ✗')
process.exit(fail === 0 ? 0 : 1)

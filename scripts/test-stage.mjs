/**
 * 站位 / 走位模型测试
 *
 * 重点是采样逻辑：位置插值、淡入淡出、硬切，以及删除打师后的清理。
 *
 * 用法：node scripts/test-stage.mjs
 */
import {
  addDancer,
  clearPos,
  cloneSegments,
  importClipSteps,
  pasteSegments,
  removeDancer,
  removeKeyAt,
  renameDancer,
  sampleAt,
  segmentsInRange,
  setPos,
  toggleHard,
} from '../src/composables/stageModel.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`✗ ${name}${extra ? '：' + extra : ''}`)
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`)

const fresh = () => ({ dancers: [], keys: [], lines: {} })

/* ---------- 打师 ---------- */

const st = fresh()
const d1 = addDancer(st, 'Aka')
ok('addDancer 生成 key', d1.key === 'd1', d1.key)
ok('addDancer 分配颜色', /^#/.test(d1.color))
ok('默认站位落在 0–1 内', d1 && st.keys.length === 1 && st.keys[0].pos.d1.x > 0 && st.keys[0].pos.d1.x < 1)
const d2 = addDancer(st)
ok('第二个打师 key 不重复', d2.key === 'd2', d2.key)
ok('两个打师颜色不同', d1.color !== d2.color)

renameDancer(st, 'd1', '红')
ok('改名生效', st.dancers[0].name === '红')

/* ---------- 关键帧写入 ---------- */

const st2 = fresh()
addDancer(st2, 'A') // 注意：addDancer 会顺手在 0 秒落一帧默认站位
setPos(st2, 'd1', 10, 0.2, 0.8)
setPos(st2, 'd1', 20, 0.8, 0.2)
eq('关键帧数（含 0 秒的默认帧）', st2.keys.length, 3)

// 同一时刻再写：应更新而不是新增
setPos(st2, 'd1', 10.01, 0.4, 0.6)
eq('相近时间合并成一个帧', st2.keys.length, 3)
ok('坐标被更新', near(st2.keys.find((k) => near(k.t, 10)).pos.d1.x, 0.4))

// 超出范围的坐标被钳制
setPos(st2, 'd1', 30, 5, -3)
const k30 = st2.keys.find((k) => near(k.t, 30))
ok('坐标钳制', k30 && k30.pos.d1.x === 1 && k30.pos.d1.y === 0, JSON.stringify(k30?.pos))

/* ---------- 采样：位置插值 ---------- */

const s10 = sampleAt(st2, 10)
const s15 = sampleAt(st2, 15)
const s20 = sampleAt(st2, 20)
ok('t=10 在起点', near(s10.d1.x, 0.4) && near(s10.d1.y, 0.6), JSON.stringify(s10))
ok('t=15 线性插值到中点', near(s15.d1.x, 0.6) && near(s15.d1.y, 0.4), JSON.stringify(s15))
ok('插值时不透明', near(s15.d1.alpha, 1))
ok('t=20 到第二帧', near(s20.d1.x, 0.8) && near(s20.d1.y, 0.2))

/* ---------- 采样：淡出（下一帧没有他） ---------- */

const st3 = fresh()
addDancer(st3, 'A')
setPos(st3, 'd1', 0, 0.3, 0.7)
setPos(st3, 'd1', 20, 0.3, 0.7)
// 第 20 秒起让他离场：清掉 20 秒那一帧里的坐标
clearPos(st3, 'd1', 20)
const fade = sampleAt(st3, 10)
ok('离场前一半淡出到 0.5', near(fade.d1.alpha, 0.5), JSON.stringify(fade))
ok('淡出时位置保持', near(fade.d1.x, 0.3))
const gone = sampleAt(st3, 20)
ok('到点后彻底离场', gone.d1 === undefined, JSON.stringify(gone))

/* ---------- 采样：淡入（上一帧没有他） ---------- */

const st4c = fresh()
// 0 秒时只有 d2，10 秒时 d1 出现
addDancer(st4c, 'A') // d1 存在于场景
clearPos(st4c, 'd1', 0) // 0 秒时 d1 不在场
setPos(st4c, 'd1', 10, 0.8, 0.2)
const half = sampleAt(st4c, 5)
ok('淡入进行中 alpha 0.5', near(half.d1?.alpha ?? -1, 0.5), JSON.stringify(half))
ok('淡入时用出现帧的位置', near(half.d1.x, 0.8))

/* ---------- 采样：硬切 ---------- */

const st5 = fresh()
addDancer(st5, 'A')
setPos(st5, 'd1', 0, 0.2, 0.5)
setPos(st5, 'd1', 10, 0.9, 0.5)
toggleHard(st5, 10)
const before = sampleAt(st5, 9.9)
ok('硬切：到点前保持原位置', near(before.d1.x, 0.2), JSON.stringify(before))
const at = sampleAt(st5, 10)
ok('硬切：到点瞬间跳到新位置', near(at.d1.x, 0.9), JSON.stringify(at))

/* ---------- 关键帧删除 ---------- */

const st6 = fresh()
addDancer(st6, 'A')
setPos(st6, 'd1', 0, 0.1, 0.1)
setPos(st6, 'd1', 5, 0.5, 0.5)
ok('删除关键帧', removeKeyAt(st6, 5) === true && st6.keys.length === 1)

/* ---------- 删除打师后的清理 ---------- */

const st7 = fresh()
addDancer(st7, 'A')
addDancer(st7, 'B')
setPos(st7, 'd1', 0, 0.1, 0.1)
setPos(st7, 'd1', 5, 0.2, 0.2)
st7.lines.d1 = [{ at: 0, steps: [{ kind: 'text', text: 'x' }] }]
removeDancer(st7, 'd1')
ok('打师被删', st7.dancers.length === 1 && st7.dancers[0].key === 'd2')
ok('清理关键帧里的坐标', st7.keys.every((k) => !k.pos.d1))
ok('清理动作线', !st7.lines.d1)

/* ---------- 片段 → 打师动作 ---------- */

const st8 = fresh()
addDancer(st8, 'A')
const clip = { id: 'c1', name: '副歌', a: 30, b: 60, steps: [{ kind: 'text', text: '原版动作' }] }
importClipSteps(st8, 'd1', clip)
eq('导入片段动作', st8.lines.d1[0].steps, [{ kind: 'text', text: '原版动作' }])
ok('动作线记在片段起点', st8.lines.d1[0].at === 30)

// 再导一次：同一时间点覆盖，不重复
importClipSteps(st8, 'd1', { ...clip, steps: [{ kind: 'text', text: '改过的动作' }] })
eq('重复导入覆盖', st8.lines.d1.length, 1)
eq('内容已更新', st8.lines.d1[0].steps, [{ kind: 'text', text: '改过的动作' }])

eq('按区间取动作', segmentsInRange(st8, 'd1', 0, 29).length, 0)
eq('区间内能取到', segmentsInRange(st8, 'd1', 0, 60).length, 1)

/* ---------- 复制 / 粘贴整条动作线 ---------- */

const copy = cloneSegments(st8, 'd1')
copy[0].steps[0].text = '被改过的拷贝'
eq('克隆是深拷贝（不影响原数据）', st8.lines.d1[0].steps[0].text, '改过的动作')

addDancer(st8, 'B')
pasteSegments(st8, 'd2', cloneSegments(st8, 'd1'))
eq('粘贴到另一个打师', st8.lines.d2[0].steps, [{ kind: 'text', text: '改过的动作' }])
ok('两个打师的动作互不影响', st8.lines.d1 !== st8.lines.d2)

/* ---------- 结果 ---------- */

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
console.log(fail === 0 ? 'OK 站位模型通过' : 'FAIL 见上面的 ✗')
process.exit(fail === 0 ? 0 : 1)

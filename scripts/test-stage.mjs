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
  autoEdge,
  canDragDancer,
  enterStart,
  lastPosOf,
  moveKey,
  setEnterDir,
  setKeyDuration,
  retimeKey,
  seedKey,
  removeClipSegments,
  segmentsInRange,
  segmentsOfClip,
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
ok('滑入中途尚未到达目标位置', Math.abs(half.d1.x - 0.8) + Math.abs(half.d1.y - 0.2) > 0.01, JSON.stringify(half))

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

/* ---------- 回归：拖动新建帧不能把其他人「挤」下线 ---------- */

const st9 = fresh()
addDancer(st9, 'A')
addDancer(st9, 'B')
// 0 秒两人都在场
setPos(st9, 'd1', 0, 0.3, 0.7)
setPos(st9, 'd2', 0, 0.7, 0.7)
// 10 秒时只拖 d1：先按真实流程 seed 当前队形，再改 d1
const at10 = sampleAt(st9, 10)
seedKey(st9, 10, at10)
setPos(st9, 'd1', 10, 0.1, 0.2)
const mid = sampleAt(st9, 10)
ok('被拖的打师到了新位置', near(mid.d1.x, 0.1) && near(mid.d1.y, 0.2), JSON.stringify(mid))
ok('没被拖的打师仍在场（不会被淡出）', mid.d2 && near(mid.d2.alpha, 1), JSON.stringify(mid))
ok('没被拖的打师位置被固定住', near(mid.d2.x, 0.7) && near(mid.d2.y, 0.7))

// seedKey 不覆盖帧里已有的坐标
seedKey(st9, 10, { d1: { x: 0.9, y: 0.9, alpha: 1 } })
const k10 = st9.keys.find((k) => near(k.t, 10))
ok('seedKey 不覆盖已有坐标', near(k10.pos.d1.x, 0.1))

// 已淡出的不会被补进来
const st10 = fresh()
addDancer(st10, 'A')
setPos(st10, 'd1', 0, 0.5, 0.5)
setPos(st10, 'd1', 20, 0.5, 0.5)
clearPos(st10, 'd1', 20) // 20 秒离场
seedKey(st10, 20, sampleAt(st10, 20.001))
const k20 = st10.keys.find((k) => near(k.t, 20))
ok('已经离场的人不会被 seed 补回来', !k20.pos.d1, JSON.stringify(k20.pos))

/* ---------- 关键帧时间编辑 ---------- */

const st11 = fresh()
addDancer(st11, 'A') // 会在 0 秒落一帧
removeKeyAt(st11, 0) // 清掉，方便后面测「挪到 0 秒」
setPos(st11, 'd1', 5, 0.2, 0.2)
setPos(st11, 'd1', 10, 0.8, 0.8)

const moved = moveKey(st11, 5, 1 / 30)
// 时间戳按毫秒取整，所以 5 + 1/30 → 5.033
ok('逐帧微调：时间前移 1/30 秒', moved?.moved === true && near(moved.t, 5.033, 1e-9), JSON.stringify(moved))
ok('关键帧仍按时间排序', st11.keys[0].t < st11.keys[1].t)

const retimed = retimeKey(st11, moved.t, 7.25)
ok('直接改时间', retimed?.moved === true && near(retimed.t, 7.25), JSON.stringify(retimed))

// 撞到另一个关键帧：不移动，交给界面提示
const clash = retimeKey(st11, 7.25, 10)
ok('撞帧时不覆盖（返回 moved:false）', clash?.moved === false, JSON.stringify(clash))
ok('原帧位置不变', st11.keys.some((k) => near(k.t, 7.25)))
ok('目标帧也没被动', st11.keys.some((k) => near(k.t, 10)))

// 挪到 0 秒：允许（0 秒此时没有帧）
const toZero = retimeKey(st11, 7.25, 0)
ok('可以挪到 0 秒', toZero?.moved === true && near(toZero.t, 0), JSON.stringify(toZero))

// 负数被钳到 0——此时 0 秒已被占用，应当拒绝而不是合并
const negative = retimeKey(st11, 10, -3)
ok('负数钳到 0 且遇占位不合并', negative?.moved === false, JSON.stringify(negative))

/* ---------- 上场：找回上一次的位置 ---------- */

const st12 = fresh()
addDancer(st12, 'A')
setPos(st12, 'd1', 10, 0.25, 0.8)
setPos(st12, 'd1', 20, 0.75, 0.2)
clearPos(st12, 'd1', 20) // 20 秒下场

ok('能找到下场前的位置', JSON.stringify(lastPosOf(st12, 'd1', 30)) === JSON.stringify({ x: 0.25, y: 0.8 }))
const st13 = fresh()
addDancer(st13, 'A')
removeKeyAt(st13, 0) // 去掉 addDancer 顺手落的 0 秒帧
setPos(st13, 'd1', 10, 0.25, 0.8)
ok('之前没有帧时用后面那帧兜底', JSON.stringify(lastPosOf(st13, 'd1', 0)) === JSON.stringify({ x: 0.25, y: 0.8 }))
ok('从未出现过的打师返回 null', lastPosOf(st12, 'd9', 10) === null)

/* ---------- 上场：从舞台边缘滑入 ---------- */

const stE = fresh()
addDancer(stE, 'A')
removeKeyAt(stE, 0)
// 0 秒只有 d2（d1 不在），10 秒 d1 出现在 (0.5, 0.5)
setPos(stE, 'd1', 0, 0.5, 0.5)
clearPos(stE, 'd1', 0)
setPos(stE, 'd1', 10, 0.5, 0.5)

const earlyIn = sampleAt(stE, 1) // p≈0.1，还在舞台外
const halfIn = sampleAt(stE, 5)
ok('默认从最近边缘滑入：起点在舞台外（x<0）', earlyIn.d1.x < 0, JSON.stringify(earlyIn))
ok('滑入中途 alpha 约 0.5', Math.abs(halfIn.d1.alpha - 0.5) < 1e-6, JSON.stringify(halfIn))

// 指定方向：上方
setEnterDir(stE, 'd1', 10, 'top')
const topEarly = sampleAt(stE, 1)
ok('指定上方后从上方进场（y<0）', topEarly.d1.y < 0, JSON.stringify(topEarly))

// 自动选边：目标靠右 → right
ok('autoEdge 靠右时选右', autoEdge({ x: 0.95, y: 0.5 }) === 'right', autoEdge({ x: 0.95, y: 0.5 }))
ok('autoEdge 靠下时选下', autoEdge({ x: 0.5, y: 0.95 }) === 'bottom', autoEdge({ x: 0.5, y: 0.95 }))
eq('enterStart 左侧起点', enterStart({ x: 0.3, y: 0.4 }, 'left').x < 0, true)

// 硬切时不做滑入：到点前不出现，到点直接到位
setEnterDir(stE, 'd1', 10, 'left')
toggleHard(stE, 10)
const before10 = sampleAt(stE, 9.9)
ok('硬切：到点前不出现', before10.d1 === undefined || before10.d1.alpha === 0, JSON.stringify(before10))
const atEnter = sampleAt(stE, 10)
ok('硬切：到点直接到位', near(atEnter.d1.x, 0.5) && near(atEnter.d1.y, 0.5) && near(atEnter.d1.alpha, 1), JSON.stringify(atEnter))

/* ---------- 上下场时长可调 ---------- */

// 间隔 10 秒，但把过渡时长设成 1 秒：应该只在最后 1 秒淡出，前面一直满不透明
const stD = fresh()
addDancer(stD, 'A')
removeKeyAt(stD, 0)
setPos(stD, 'd1', 0, 0.5, 0.7)
setPos(stD, 'd1', 10, 0.5, 0.7)
clearPos(stD, 'd1', 10) // 10 秒下场
setKeyDuration(stD, 10, 1)

ok('间隔前段保持在场', near(sampleAt(stD, 5).d1?.alpha ?? -1, 1), JSON.stringify(sampleAt(stD, 5)))
ok('过渡窗口前半段 alpha≈0.5', near(sampleAt(stD, 9.5).d1?.alpha ?? -1, 0.5, 1e-6), JSON.stringify(sampleAt(stD, 9.5)))
ok('过渡窗口开始前仍满不透明', near(sampleAt(stD, 8.9).d1?.alpha ?? -1, 1), JSON.stringify(sampleAt(stD, 8.9)))

// 上场同理：1 秒内滑入，之前一直不可见
const stU = fresh()
addDancer(stU, 'A')
removeKeyAt(stU, 0)
setPos(stU, 'd1', 0, 0.5, 0.5)
clearPos(stU, 'd1', 0)
setPos(stU, 'd1', 10, 0.5, 0.5)
setKeyDuration(stU, 10, 1)
ok('未到窗口时仍是全透明（不可见）', near(sampleAt(stU, 8).d1?.alpha ?? 0, 0), JSON.stringify(sampleAt(stU, 8)))
ok('窗口内 alpha≈0.5', near(sampleAt(stU, 9.5).d1?.alpha ?? -1, 0.5, 1e-6), JSON.stringify(sampleAt(stU, 9.5)))

// 时长清空 = 回到整段间隔
setKeyDuration(stU, 10, null)
ok('清空时长后回到整段插值', near(sampleAt(stU, 5).d1?.alpha ?? -1, 0.5, 1e-6), JSON.stringify(sampleAt(stU, 5)))

// 时长超过间隔时按整段算（不会更慢）
setKeyDuration(stU, 10, 30)
ok('时长超过间隔按整段处理', near(sampleAt(stU, 5).d1?.alpha ?? -1, 0.5, 1e-6), JSON.stringify(sampleAt(stU, 5)))

/* ---------- 拖动权限：只能动当前选中、且在场的打师 ---------- */

ok('选中自己 + 编辑模式 + 在场 → 可拖', canDragDancer({ selectedKey: 'd1', dancerKey: 'd1', recordMode: true, alpha: 1 }))
ok('未开编辑模式 → 不可拖', canDragDancer({ selectedKey: 'd1', dancerKey: 'd1', recordMode: false, alpha: 1 }) === false)
ok('不是选中的打师 → 不可拖', canDragDancer({ selectedKey: 'd1', dancerKey: 'd2', recordMode: true, alpha: 1 }) === false)
ok('不在场（alpha 0）→ 不可拖', canDragDancer({ selectedKey: 'd1', dancerKey: 'd1', recordMode: true, alpha: 0 }) === false)
ok('刚淡入一点点也能拖', canDragDancer({ selectedKey: 'd1', dancerKey: 'd1', recordMode: true, alpha: 0.2 }))
ok('没传 dancerKey → 不可拖', canDragDancer({ selectedKey: null, dancerKey: null, recordMode: true, alpha: 1 }) === false)

/* ---------- 回归：片段时间相邻/重叠时，动作不能串到别的片段 ---------- */

// 两个片段的起点只差 0.4 秒（老实现用「±0.5 秒」判断已有段，会把前一个覆盖掉）
const stC = fresh()
addDancer(stC, 'A')
const clip3 = { id: 'c3', name: '第三段', a: 30, b: 40, steps: [{ kind: 'text', text: '第三段动作' }] }
const clip4 = { id: 'c4', name: '第四段', a: 30.4, b: 50, steps: [{ kind: 'text', text: '第四段动作' }] }
importClipSteps(stC, 'd1', clip3)
importClipSteps(stC, 'd1', clip4)

eq('两段各存一条', stC.lines.d1.length, 2)
eq('第三段还是自己的动作', segmentsOfClip(stC, 'd1', clip3)[0].steps, [{ kind: 'text', text: '第三段动作' }])
eq('第四段是自己的动作', segmentsOfClip(stC, 'd1', clip4)[0].steps, [{ kind: 'text', text: '第四段动作' }])

// 区间重叠：第三段 [30,40)，第四段可能从 35 开始
const clip5 = { id: 'c5', name: '第五段', a: 35, b: 45, steps: [{ kind: 'text', text: '第五段动作' }] }
importClipSteps(stC, 'd1', clip5)
eq('重叠区间不串到第三段', segmentsOfClip(stC, 'd1', clip3).length, 1)
eq('重叠区间里第五段只有自己的', segmentsOfClip(stC, 'd1', clip5).map((s) => s.steps[0].text), ['第五段动作'])

// 清空只删自己那段
removeClipSegments(stC, 'd1', clip5)
eq('清空第五段后第五段为空', segmentsOfClip(stC, 'd1', clip5).length, 0)
eq('第三、四段没被牵连', [segmentsOfClip(stC, 'd1', clip3).length, segmentsOfClip(stC, 'd1', clip4).length], [1, 1])

// 重复导入同一片段：覆盖而不是新增
importClipSteps(stC, 'd1', { ...clip4, steps: [{ kind: 'text', text: '改过的四段' }] })
eq('重复导入覆盖', stC.lines.d1.filter((s) => s.clipId === 'c4').length, 1)
eq('内容已更新', segmentsOfClip(stC, 'd1', clip4)[0].steps, [{ kind: 'text', text: '改过的四段' }])

// 老数据（没有 clipId）按区间兜底显示
const stL = fresh()
addDancer(stL, 'A')
stL.lines.d1 = [{ at: 30, steps: [{ kind: 'text', text: '老数据' }] }]
eq('无 clipId 时退回区间判断', segmentsOfClip(stL, 'd1', clip3).length, 1)
eq('无 clipId 时不落到区间外的片段', segmentsOfClip(stL, 'd1', clip4).length, 0)

/* ---------- 结果 ---------- */

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
console.log(fail === 0 ? 'OK 站位模型通过' : 'FAIL 见上面的 ✗')
process.exit(fail === 0 ? 0 : 1)

/**
 * 端到端迁移测试：假 localStorage + 真实的 useChoreo 模块
 *
 * 验证：
 *   - 只有 v1 数据时，加载后自动变成 v2（clips 的 wazaIds → steps）
 *   - v1 键保留不删（误迁移时的退路）
 *   - 增删改会写回 wota:choreo:v2
 *
 * 用法：node scripts/test-choreo-migrate.mjs
 */
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}

const V1 = {
  clips: [
    {
      id: 'c_old',
      songKey: 'live.mp3::240',
      fileName: 'live.mp3',
      duration: 240,
      name: '副歌',
      a: 32.5,
      b: 48,
      wazaIds: ['wa', 'wb'],
      note: '旧数据',
      createdAt: 1,
    },
  ],
}
localStorage.setItem('wota:choreo:v1', JSON.stringify(V1))

const mod = await import('../src/composables/useChoreo.js')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`✗ ${name}${extra ? '：' + extra : ''}`)
  }
}

ok('迁移后读到 1 条片段', mod.choreoStore.clips.length === 1, `实际 ${mod.choreoStore.clips.length}`)

const clip = mod.choreoStore.clips[0]
ok('wazaIds 已转成 steps', JSON.stringify(clip.steps) === JSON.stringify([{ kind: 'waza', id: 'wa' }, { kind: 'waza', id: 'wb' }]), JSON.stringify(clip.steps))
ok('区间保留', clip.a === 32.5 && clip.b === 48, `${clip.a}–${clip.b}`)
ok('备注保留', clip.note === '旧数据')

ok('已经落盘成 v2', Boolean(localStorage.getItem('wota:choreo:v2')))
ok('v1 原样保留（可回退）', Boolean(localStorage.getItem('wota:choreo:v1')))

// 加一条带自定义文本的，验证写回
const song = { fileName: 'live.mp3', duration: 240 }
const added = mod.addClip({
  song,
  name: 'C 段',
  a: 100,
  b: 120,
  steps: [{ kind: 'text', text: '社团原创：抬手转身' }, mod.wazaStep('wa')],
})
ok('新增片段成功', mod.choreoStore.clips.length === 2)

mod.updateClip(added.id, { name: 'C 段改', b: 130, steps: [{ kind: 'text', text: '只留自定义' }] })
const saved = JSON.parse(localStorage.getItem('wota:choreo:v2'))
const savedClip = saved.clips.find((c) => c.id === added.id)
ok('改动写回了 localStorage', savedClip && savedClip.name === 'C 段改' && savedClip.b === 130, JSON.stringify(savedClip))
ok(
  '自定义文本持久化',
  savedClip && savedClip.steps.length === 1 && savedClip.steps[0].kind === 'text',
  JSON.stringify(savedClip && savedClip.steps),
)

// 站位数据（本期只建壳，P3 再填）
const stage = mod.stageOf('live.mp3::240')
ok('stageOf 建出结构', Array.isArray(stage.dancers) && Array.isArray(stage.keys) && typeof stage.lines === 'object')

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
console.log(fail === 0 ? 'OK 迁移与持久化通过' : 'FAIL 见上面的 ✗')
process.exit(fail === 0 ? 0 : 1)

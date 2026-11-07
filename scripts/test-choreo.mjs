/**
 * 编排数据模型的单元测试（纯函数，不需要浏览器）
 *
 * 重点覆盖：
 *   - v1（wazaIds）→ v2（steps）迁移
 *   - steps 的规整（脏数据不能崩、字符串兼容）
 *   - 增删改、按歌分组、导出文本（含自定义动作）
 *   - 站位数据（dancers / keys / lines）的规整与坐标钳制
 *
 * 用法：node scripts/test-choreo.mjs
 */
import {
  addClipToState,
  clipsBySongIn,
  clipsOfSongIn,
  emptyState,
  migrateV1,
  normalizeClip,
  normalizeState,
  normalizeSteps,
  removeClipFromState,
  songOf,
  stepCount,
  stepLabel,
  stepsFromWazaIds,
  textStep,
  toTextOfGroup,
  updateClipInState,
  wazaStep,
} from '../src/composables/choreoModel.js'

let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`✗ ${name}${extra ? '：' + extra : ''}`)
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  ok(name, a === b, `期望 ${b}，实际 ${a}`)
}

/* ---------- steps 规整 ---------- */

eq('wazaIds → steps', stepsFromWazaIds(['w1', 'w2']), [
  { kind: 'waza', id: 'w1' },
  { kind: 'waza', id: 'w2' },
])

eq(
  'normalizeSteps 兼容字符串与脏数据',
  normalizeSteps(['w1', { kind: 'text', text: '缝合：A→B' }, { kind: 'text', text: '   ' }, null, 42, { id: 'w9' }]),
  [{ kind: 'waza', id: 'w1' }, { kind: 'text', text: '缝合：A→B' }, { kind: 'waza', id: 'w9' }],
)

ok('normalizeSteps 非数组返回空', normalizeSteps(undefined).length === 0)

eq('stepLabel：技走 nameOf', stepLabel({ kind: 'waza', id: 'w1' }, () => '雷蛇'), '雷蛇')
eq('stepLabel：文本原样', stepLabel(textStep('自己的缝合')), '自己的缝合')

/* ---------- v1 → v2 迁移 ---------- */

const v1 = {
  clips: [
    {
      id: 'c1',
      songKey: 'a.mp3::180',
      fileName: 'a.mp3',
      duration: 180,
      name: '副歌',
      a: 10,
      b: 20,
      wazaIds: ['w1', 'w2'],
      note: '备注',
      createdAt: 1,
    },
  ],
}
const migrated = migrateV1(v1)
eq('迁移后片段数', migrated.clips.length, 1)
eq('迁移后 steps', migrated.clips[0].steps, [
  { kind: 'waza', id: 'w1' },
  { kind: 'waza', id: 'w2' },
])
ok('迁移后没有 songs 残留问题', migrated.songs && Object.keys(migrated.songs).length === 0)
eq('迁移保留时间', [migrated.clips[0].a, migrated.clips[0].b], [10, 20])

/* ---------- normalizeClip ---------- */

ok('normalizeClip 拒绝脏数据', normalizeClip({ id: 1 }) === null)
const legacyClip = normalizeClip({ id: 'x', fileName: 'b.mp3', a: 1, b: 2, wazaIds: ['w3'] })
eq('normalizeClip 把 wazaIds 转成 steps', legacyClip.steps, [{ kind: 'waza', id: 'w3' }])
eq('normalizeClip 补 songKey', legacyClip.songKey, 'b.mp3::0')

/* ---------- 增删改查 ---------- */

const state = emptyState()
const song = { fileName: 'song.mp3', duration: 200 }
const clip = addClipToState(state, {
  song,
  name: '主歌',
  a: 5,
  b: 12,
  steps: [wazaStep('w1'), textStep('社团原创：抬手转身')],
  note: '试试',
})
ok('addClip 生成 id', typeof clip.id === 'string' && clip.id.startsWith('c'))
eq('addClip 的 songKey', clip.songKey, 'song.mp3::200')
eq('addClip 的动作数', stepCount(clip), 2)

updateClipInState(state, clip.id, { name: '副歌', b: 30, steps: [textStep('只留文本')] })
const updated = state.clips[0]
eq('update 名称', updated.name, '副歌')
eq('update 结束时间', updated.b, 30)
eq('update 动作', updated.steps, [{ kind: 'text', text: '只留文本' }])

addClipToState(state, { song, name: '第二段', a: 40, b: 50, steps: [] })
const ofSong = clipsOfSongIn(state, song)
eq('按歌取片段并按 a 排序', ofSong.map((c) => c.name), ['副歌', '第二段'])
eq('分组', clipsBySongIn(state).length, 1)

ok('删除返回 true', removeClipFromState(state, clip.id) === true)
ok('重复删除返回 false', removeClipFromState(state, clip.id) === false)
eq('删除后剩 1 条', state.clips.length, 1)

/* ---------- 导出文本 ---------- */

const group = {
  fileName: 'song.mp3',
  duration: 200,
  clips: [
    {
      name: '副歌',
      a: 10,
      b: 20,
      note: '情绪上扬',
      steps: [wazaStep('w1'), textStep('缝合：雷蛇 → 苍月剑')],
    },
  ],
}
const text = toTextOfGroup(group, () => '雷蛇')
ok('导出含技名', text.includes('雷蛇'))
ok('导出含自定义文本', text.includes('缝合：雷蛇 → 苍月剑'))
ok('导出含备注', text.includes('情绪上扬'))

/* ---------- 站位数据 ---------- */

const st = emptyState()
const stage = songOf(st, 'song.mp3::200')
eq('songOf 建空壳', [stage.dancers.length, stage.keys.length], [0, 0])

const dirty = normalizeState({
  clips: [],
  songs: {
    'song.mp3::200': {
      dancers: [{ key: 'd1', name: 'A' }, { bad: true }],
      keys: [
        { t: 10, pos: { d1: { x: 1.4, y: -0.2 } } },
        { t: 5, pos: { d1: { x: 0.5, y: 0.5 } }, hard: true },
      ],
      lines: { d1: [{ at: 3, steps: ['w1', { kind: 'text', text: '接棒' }] }] },
    },
  },
})
const s2 = dirty.songs['song.mp3::200']
eq('打师过滤脏数据', s2.dancers.length, 1)
ok('打师补默认颜色', typeof s2.dancers[0].color === 'string' && s2.dancers[0].color.startsWith('#'))
eq('关键帧按时间排序', s2.keys.map((k) => k.t), [5, 10])
eq('坐标钳制到 0–1', [s2.keys[1].pos.d1.x, s2.keys[1].pos.d1.y], [1, 0])
ok('硬切标记保留', s2.keys[0].hard === true)
eq('打师动作线', s2.lines.d1[0].steps, [{ kind: 'waza', id: 'w1' }, { kind: 'text', text: '接棒' }])

/* ---------- 结果 ---------- */

console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
console.log(fail === 0 ? 'OK 编排数据模型通过' : 'FAIL 见上面的 ✗')
process.exit(fail === 0 ? 0 : 1)

import { useTapTempo } from '../src/composables/useTapTempo.js'

let pass = 0
let total = 0

function check(name, actual, expected, tolPct) {
  total++
  const ok = Math.abs(actual - expected) / expected <= tolPct / 100
  if (ok) pass++
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(30)} 得到 ${String(actual).padEnd(7)} 期望 ~${expected}（±${tolPct}%）`
  )
}

// 1) 标准等间隔：500ms -> 120 BPM
{
  const t = useTapTempo()
  let now = 0
  for (let i = 0; i < 10; i++) { t.tap(now); now += 500 }
  check('等间隔 500ms', t.bpm.value, 120, 0.5)
}

// 2) 有抖动 ±20ms，中位数应该稳住
{
  const t = useTapTempo()
  let now = 0
  const jitter = [500, 518, 484, 512, 490, 506, 495, 510, 488, 502]
  for (const j of jitter) { t.tap(now); now += j }
  check('抖动 ±20ms', t.bpm.value, 120, 3)
}

// 3) 中间一次误触（50ms 的超短间隔）应被丢弃
{
  const t = useTapTempo()
  let now = 0
  for (let i = 0; i < 5; i++) { t.tap(now); now += 500 }
  t.tap(now - 450)   // 误触：距上一次只有 50ms
  now += 500
  for (let i = 0; i < 4; i++) { t.tap(now); now += 500 }
  check('夹一次误触 50ms', t.bpm.value, 120, 1)
}

// 4) 停顿 3 秒后重新开始，不应被算成一个超长间隔
{
  const t = useTapTempo()
  let now = 0
  for (let i = 0; i < 4; i++) { t.tap(now); now += 500 }
  const before = t.bpm.value
  now += 3000
  t.tap(now)
  const afterCount = t.tapCount.value
  total++
  const ok = t.bpm.value === null && afterCount === 1
  if (ok) pass++
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${'停顿 3 秒后重置'.padEnd(30)} bpm=${t.bpm.value} 计数=${afterCount}（之前 ${before}）`)
}

// 5) 慢速 60 BPM（1000ms）
{
  const t = useTapTempo()
  let now = 0
  for (let i = 0; i < 8; i++) { t.tap(now); now += 1000 }
  check('慢速 1000ms', t.bpm.value, 60, 0.5)
}

// 6) 快速 180 BPM（333ms）
{
  const t = useTapTempo()
  let now = 0
  for (let i = 0; i < 8; i++) { t.tap(now); now += 333.3 }
  check('快速 333ms', t.bpm.value, 180, 1)
}

console.log('-'.repeat(78))
console.log(`通过 ${pass}/${total}`)
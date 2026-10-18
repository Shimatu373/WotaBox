import { analyzeAudioBuffer } from '../src/composables/bpmAnalysis.js'

const SR = 44100
const SECONDS = 25

/** 合成一段「鼓点轨」：每拍底鼓 + 半拍处踩镲 + 每 4 拍一个重音 */
function makeTrack(bpm) {
  const n = Math.floor(SECONDS * SR)
  const d = new Float32Array(n)
  const beat = (60 / bpm) * SR
  const half = beat / 2

  let seed = 987654321
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const HIT = Math.floor(0.03 * SR)
  function hit(at, amp, freq, decaySec) {
    const start = Math.round(at)
    for (let k = 0; k < HIT && start + k < n; k++) {
      const t = k / SR
      const env = Math.exp(-t / decaySec)
      const v = Math.sin(2 * Math.PI * freq * t) * 0.6 + (rand() * 2 - 1) * 0.4
      d[start + k] += env * amp * v
    }
  }

  let idx = 0
  for (let t = 0; t < n; t += beat) {
    const accent = idx % 4 === 0 ? 1.15 : 1
    hit(t, 0.8 * accent, 110, 0.01)
    hit(t + half, 0.22, 3400, 0.004)
    idx++
  }
  return d
}

const cases = [90, 100, 120, 128, 140, 150, 160, 175]
let pass = 0
let passLenient = 0

console.log('期望  检出    倍数   候选                        判定')
console.log('-'.repeat(74))

for (const bpm of cases) {
  const data = makeTrack(bpm)
  const buffer = {
    sampleRate: SR,
    duration: SECONDS,
    length: data.length,
    numberOfChannels: 1,
    getChannelData: () => data,
  }

  const r = analyzeAudioBuffer(buffer)
  const ratio = r.bpm / bpm
  // 候选里只要有一个与真值相差 1.5% 以内，就算用户能一键修正
  const has = r.candidates.some((c) => Math.abs(c - bpm) / bpm < 0.015)

  let verdict
  if (Math.abs(ratio - 1) < 0.01) {
    verdict = 'OK  精确命中'
    pass++
    passLenient++
  } else if (has) {
    verdict = '~   偏差(候选含正解)'
    passLenient++
  } else {
    verdict = 'X   错误'
  }

  console.log(
    String(bpm).padEnd(6) +
      String(r.bpm).padEnd(8) +
      ratio.toFixed(2).padEnd(7) +
      ('[' + r.candidates.join(', ') + ']').padEnd(28) +
      verdict
  )
}

console.log('-'.repeat(74))
console.log(`精确命中 ${pass}/${cases.length}    可修正(含候选) ${passLenient}/${cases.length}`)
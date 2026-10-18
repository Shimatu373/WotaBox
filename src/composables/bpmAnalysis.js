/**
 * BPM 分析（纯前端，不联网、不上传）
 *
 * 流程：
 *   1. 用 Web Audio 解码音频（支持 mp3 / wav / m4a / flac 等浏览器能解的格式）
 *   2. 混单声道 + 整数倍降采样到约 11 kHz（够用且快）
 *   3. 分帧算能量，取「对数差分」并只保留上升沿 → 起音强度包络
 *   4. 包络去局部均值、归一化
 *   5. 对包络做自相关，用「梳状加权 + 速度先验」选出最可能的 BPM
 *
 * 局限：电子 / 流行 / 有明确鼓点的曲子准确率高；
 *       自由节奏、纯人声、速度变化大的曲子会不准。
 *       常见错误是「倍速 / 半速」混淆，所以界面上给了 ×2 / ÷2 备选。
 */

const TARGET_RATE = 11025
const FRAME = 1024
const HOP = 256
const MIN_BPM = 60
const MAX_BPM = 200
const MAX_WINDOW_SEC = 120

export async function analyzeBpm(file, { onStatus } = {}) {
  onStatus?.('decoding')

  const arrayBuffer = await file.arrayBuffer()
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) throw new Error('当前浏览器不支持 Web Audio')

  const ctx = new AC()
  let buffer
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer)
  } catch {
    throw new Error('浏览器无法解码这个文件，试试 mp3 / wav / m4a')
  } finally {
    if (ctx.state !== 'closed') ctx.close().catch(() => {})
  }

  onStatus?.('analyzing')
  // 让 loading 状态先渲染出来，避免界面看起来卡死
  await new Promise((r) => setTimeout(r, 30))

  const { data, rate } = toMonoDownsampled(buffer)
  if (data.length < rate * 5) throw new Error('音频太短了，至少需要 5 秒')

  const onset = onsetEnvelope(data)
  const fps = rate / HOP
  return detectTempo(onset, fps)
}

/** 取一段（长曲子只分析中间 2 分钟），混单声道并降采样 */
function toMonoDownsampled(buffer) {
  const sr = buffer.sampleRate
  const dur = buffer.duration
  const startSec = dur > 150 ? Math.min(20, dur * 0.1) : 0
  const winSec = Math.min(MAX_WINDOW_SEC, Math.max(0, dur - startSec))

  const i0 = Math.floor(startSec * sr)
  const i1 = Math.min(buffer.length, Math.floor((startSec + winSec) * sr))

  const ch0 = buffer.getChannelData(0)
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null

  const factor = Math.max(1, Math.round(sr / TARGET_RATE))
  const n = Math.floor((i1 - i0) / factor)
  const out = new Float32Array(n)

  for (let k = 0; k < n; k++) {
    const base = i0 + k * factor
    let sum = 0
    for (let j = 0; j < factor; j++) {
      const idx = base + j
      const v = ch1 ? (ch0[idx] + ch1[idx]) * 0.5 : ch0[idx]
      sum += v
    }
    out[k] = sum / factor
  }

  return { data: out, rate: sr / factor }
}

/** 起音强度包络：能量 → 对数差分 → 去局部均值 → 归一化 */
function onsetEnvelope(x) {
  const nFrames = Math.floor((x.length - FRAME) / HOP)
  if (nFrames < 32) throw new Error('音频太短了')

  const energy = new Float32Array(nFrames)
  for (let f = 0; f < nFrames; f++) {
    const o = f * HOP
    let sum = 0
    for (let i = 0; i < FRAME; i++) {
      const v = x[o + i]
      sum += v * v
    }
    energy[f] = sum / FRAME
  }

  const onset = new Float32Array(nFrames)
  for (let f = 1; f < nFrames; f++) {
    // 只保留能量的「上升沿」——鼓点、起音都在这里
    onset[f] = Math.max(0, Math.log(1e-10 + energy[f]) - Math.log(1e-10 + energy[f - 1]))
  }

  // 减去局部均值，压掉整首歌的强弱变化
  const W = 17
  const centered = new Float32Array(nFrames)
  for (let f = 0; f < nFrames; f++) {
    let sum = 0
    let cnt = 0
    const lo = Math.max(0, f - W)
    const hi = Math.min(nFrames - 1, f + W)
    for (let g = lo; g <= hi; g++) {
      sum += onset[g]
      cnt++
    }
    centered[f] = onset[f] - sum / cnt
  }

  // 归一化到零均值、单位方差，让自相关直接等于相关系数
  let mean = 0
  for (let i = 0; i < centered.length; i++) mean += centered[i]
  mean /= centered.length

  let variance = 0
  for (let i = 0; i < centered.length; i++) {
    const d = centered[i] - mean
    variance += d * d
  }
  const std = Math.sqrt(variance / centered.length) || 1

  const out = new Float32Array(centered.length)
  for (let i = 0; i < centered.length; i++) out[i] = (centered[i] - mean) / std
  return out
}

function detectTempo(onset, fps) {
  const n = onset.length
  const lagMin = Math.max(2, Math.floor((fps * 60) / MAX_BPM))
  const lagMax = Math.min(Math.floor(n / 3), Math.ceil((fps * 60) / MIN_BPM) * 3 + 2)

  // 自相关
  const r = new Float32Array(lagMax + 3)
  for (let lag = 0; lag <= lagMax + 2; lag++) {
    const cnt = n - lag
    if (cnt <= 0) continue
    let s = 0
    for (let i = lag; i < n; i++) s += onset[i] * onset[i - lag]
    r[lag] = s / cnt
  }

  const at = (lag) => {
    const L = Math.round(lag)
    if (L < 0 || L >= r.length) return 0
    return r[L]
  }

  let best = null
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.5) {
    const lag = (fps * 60) / bpm
    if (lag < lagMin || lag > lagMax) continue

    // 梳状加权：同时看 1 倍、2 倍、3 倍周期，避免抓到弱峰
    const comb = at(lag) + 0.6 * at(lag * 2) + 0.3 * at(lag * 3)

    // 速度先验：以 120 为中心的对数正态，抑制倍速 / 半速误判
    const prior = Math.exp(-Math.pow(Math.log2(bpm / 120), 2) / (2 * 0.5 * 0.5))

    const score = comb * prior
    if (!best || score > best.score) best = { bpm, score, lag }
  }

  if (!best) throw new Error('没能分析出结果，换首歌或换个片段试试')

  const confidence = Math.max(0, Math.min(1, at(best.lag)))
  const round1 = (v) => Math.round(v * 10) / 10

  const main = round1(best.bpm)
  const set = new Set([main])
  for (const m of [0.5, 2]) {
    const v = round1(best.bpm * m)
    if (v >= 40 && v <= 220) set.add(v)
  }

  return {
    bpm: main,
    confidence,
    candidates: [...set].sort((a, b) => a - b),
  }
}

/**
 * 全局共用的 AudioContext
 *
 * 音乐播放器和节拍器共用同一个音频时钟，因此：
 *   - 两者可以同时发声（放原曲 + 节拍器打拍）
 *   - 不需要多个上下文抢占音频设备
 *
 * 注意：共用上下文**不能在某个面板卸载时关闭**，否则会连累另一个面板。
 */

let ctx = null

export function getAudioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) throw new Error('当前浏览器不支持 Web Audio')
    ctx = new AC()
  }
  return ctx
}

/** 移动端必须在用户手势里恢复上下文，否则静音 */
export async function resumeAudio() {
  const c = getAudioContext()
  if (c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      /* 忽略 */
    }
  }
  return c
}

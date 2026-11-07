/**
 * 播放器的「共享只读时钟」
 *
 * 为什么要单独一层：`useAudioPlayer()` 每次调用都是独立状态（每处一份 buffer / position），
 * 其它面板拿不到播放进度。站位面板要「跟着歌走」，就需要一个全局可读的时间镜。
 *
 * 约定：**只有播放器写，其它面板只读**。谁也别从这里往回改播放器。
 */
import { reactive } from 'vue'

export const playerClock = reactive({
  fileName: '',
  duration: 0,
  position: 0,
  isPlaying: false,
})

/** 播放器每次状态变化时调一下（内部用） */
export function syncPlayerClock(patch) {
  if (patch.fileName !== undefined) playerClock.fileName = patch.fileName
  if (patch.duration !== undefined) playerClock.duration = patch.duration
  if (patch.position !== undefined) playerClock.position = patch.position
  if (patch.isPlaying !== undefined) playerClock.isPlaying = patch.isPlaying
}

/** 这个文件是否正被播放器载入 */
export function clockHasFile(fileName) {
  return Boolean(fileName) && playerClock.fileName === fileName
}

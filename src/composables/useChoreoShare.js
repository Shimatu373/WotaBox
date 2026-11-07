/**
 * 编排的单独导出 / 导入
 *
 * 为什么要单独一份：整包备份会把收藏夹、设置一起带走，
 * 只想把「这首歌怎么打」发到群里时那样太重，也容易把别人的收藏夹冲掉。
 *
 * 文件格式（wotabox-choreo）：
 *   { app:'WotaBox', kind:'wotabox-choreo', version:2, exportedAt, counts, data:{ clips, songs } }
 */
import { buildChoreoPayload, mergeChoreoState, CHOREO_EXPORT_KIND } from './choreoModel.js'
import { choreoStore, saveChoreoNow } from './useChoreo.js'

function stamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/** 导出并触发下载，返回 { clips, songs } */
export function downloadChoreo() {
  const payload = buildChoreoPayload(choreoStore)
  const text = JSON.stringify(payload, null, 2)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `wotabox-choreo-${stamp()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)

  return payload.counts
}

/** 导入别人分享的编排：片段合并、站位不覆盖本地已有的 */
export async function importChoreoFile(file) {
  const text = await file.text()

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('文件不是合法的 JSON')
  }

  if (!payload || payload.kind !== CHOREO_EXPORT_KIND || !payload.data) {
    throw new Error('这不是 WotaBox 的编排文件（应该是「导出编排」生成的那份）')
  }
  if (!Array.isArray(payload.data.clips)) {
    throw new Error('文件里没有片段数据')
  }

  const stats = mergeChoreoState(choreoStore, payload.data)
  saveChoreoNow()
  return stats
}

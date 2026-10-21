import { WAZA } from '../src/data/waza.js'

const target = process.argv[2] || 'スネイク系'
const missing = WAZA.filter((w) => w.series === target && !w.creator && !w.videos?.length)
for (const w of missing) {
  const title = w.wiki
  const url = 'https://wotagei.huijiwiki.com/index.php?title=' + encodeURIComponent(title) + '&action=raw'
  console.log(`${w.nameJa}\t${url}`)
}

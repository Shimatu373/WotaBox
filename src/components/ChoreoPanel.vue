<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import { WAZA } from '../data/waza.js'
import { choreoStore, clipsBySong, removeClip, toText, fmtClock } from '../composables/useChoreo.js'

const wazaMap = computed(() => Object.fromEntries(WAZA.map((w) => [w.id, w])))
const nameOf = (id) => wazaMap.value[id]?.nameZh || wazaMap.value[id]?.nameJa || id

const groups = computed(() => clipsBySong())

const summary = computed(() => {
  const n = choreoStore.clips.length
  return n ? `${n} 条记录 · ${groups.value.length} 首歌` : '还没有记录'
})

const copiedKey = ref('')

async function copyGroup(group) {
  const text = toText(group, nameOf)
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = group.songKey
    setTimeout(() => {
      if (copiedKey.value === group.songKey) copiedKey.value = ''
    }, 1800)
  } catch {
    window.prompt('复制下面的内容：', text)
  }
}

function del(id, name) {
  if (window.confirm(`删除片段「${name}」？`)) removeClip(id)
}
</script>

<template>
  <CollapsibleCard id="choreo" title="编排" :summary="summary" :default-open="false">
    <p v-if="!groups.length" class="empty">
      还没有编排记录。去「音乐播放器」里选一首歌、标好 A-B 点，点「＋ 存为片段」并关联副歌技，就会出现在这里。
    </p>

    <div v-for="g in groups" :key="g.songKey" class="song">
      <div class="song-head">
        <span class="song-name">{{ g.fileName }}</span>
        <span class="song-len">{{ fmtClock(g.duration) }}</span>
        <button class="copy" type="button" @click="copyGroup(g)">
          {{ copiedKey === g.songKey ? '已复制 ✓' : '复制编排' }}
        </button>
      </div>

      <div v-for="(c, i) in g.clips" :key="c.id" class="clip">
        <div class="clip-head">
          <span class="idx">{{ i + 1 }}</span>
          <span class="cname">{{ c.name }}</span>
          <span class="ctime">{{ fmtClock(c.a) }}–{{ fmtClock(c.b) }}</span>
          <button class="del" type="button" @click="del(c.id, c.name)">×</button>
        </div>

        <div v-if="c.wazaIds.length" class="chain">
          <template v-for="(wid, k) in c.wazaIds" :key="k">
            <span class="wz">
              <span class="wz-idx">{{ k + 1 }}</span>
              {{ nameOf(wid) }}
            </span>
            <span v-if="k < c.wazaIds.length - 1" class="arrow">→</span>
          </template>
        </div>
        <div v-else class="chain empty-chain">未关联副歌技</div>

        <p v-if="c.note" class="note">{{ c.note }}</p>
      </div>
    </div>

    <p class="hint">
      「复制编排」会生成一段纯文本，可以直接发群里和同伴对动作。数据存在本机，不上传。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
.empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #5f728c;
}

.song {
  margin-bottom: 18px;
}

.song:last-of-type {
  margin-bottom: 8px;
}

.song-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 10px;
}

.song-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #cfe3ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-len {
  font-size: 11px;
  color: #5f728c;
  font-variant-numeric: tabular-nums;
}

.copy {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid #2f6fd0;
  background: rgba(47, 111, 208, 0.14);
  color: #cfe3ff;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

.clip {
  padding: 10px 11px;
  margin-bottom: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #0f1729;
}

.clip-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.idx {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: #22304d;
  color: #9db6d6;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.cname {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #e6edf7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctime {
  font-size: 11px;
  color: #6b7f9c;
  font-variant-numeric: tabular-nums;
}

.del {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 0;
  background: transparent;
  color: #5f728c;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.del:active {
  background: #22304d;
  color: #e08b8b;
}

.chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.wz {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 7px;
  background: #16233c;
  color: #cfe3ff;
  font-size: 11px;
}

.wz-idx {
  font-size: 9px;
  color: #7fa8d8;
  font-variant-numeric: tabular-nums;
}

.arrow {
  color: #4d5a70;
  font-size: 11px;
}

.empty-chain {
  color: #5f728c;
  font-size: 11px;
}

.note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #8fa3bf;
  border-left: 2px solid var(--line);
  padding-left: 8px;
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>

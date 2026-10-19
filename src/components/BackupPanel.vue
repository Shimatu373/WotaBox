<script setup>
import { computed, ref } from 'vue'
import CollapsibleCard from './CollapsibleCard.vue'
import {
  downloadBackup,
  importBackup,
  hasSnapshot,
  restoreSnapshot,
  localOverview,
} from '../composables/useBackup.js'

const overview = ref(localOverview())
const canUndo = ref(hasSnapshot())
const message = ref('')
const needReload = ref(false)
const busy = ref(false)

const summary = computed(() => {
  const o = overview.value
  const parts = []
  if (o.collections) parts.push(`${o.collections} 个收藏夹`)
  if (o.clips) parts.push(`${o.clips} 条编排`)
  return parts.length ? parts.join(' · ') : '还没有数据'
})

function refresh() {
  overview.value = localOverview()
  canUndo.value = hasSnapshot()
}

function doExport() {
  try {
    const n = downloadBackup()
    message.value = `已导出 ${n} 项数据，检查一下浏览器的下载文件夹`
  } catch (e) {
    message.value = '导出失败：' + (e?.message || e)
  }
}

async function doImport(e) {
  const file = e.target.files?.[0]
  if (e.target) e.target.value = ''
  if (!file) return

  if (!window.confirm('导入会用备份文件覆盖当前所有数据（收藏夹、编排、设置）。\n\n如果导错了，可以用「撤销导入」还原。继续吗？')) {
    return
  }

  busy.value = true
  message.value = ''
  try {
    const res = await importBackup(file)
    message.value = `已导入 ${res.count} 项数据${res.exportedAt ? `（备份创建于 ${res.exportedAt.slice(0, 10)}）` : ''}。需要刷新页面才会生效。`
    needReload.value = true
    refresh()
  } catch (err) {
    message.value = '导入失败：' + (err?.message || err)
  } finally {
    busy.value = false
  }
}

function doUndo() {
  if (!window.confirm('恢复成上次导入之前的数据？')) return
  try {
    restoreSnapshot()
    message.value = '已撤销导入，需要刷新页面才会生效。'
    needReload.value = true
    refresh()
  } catch (e) {
    message.value = '撤销失败：' + (e?.message || e)
  }
}

function reload() {
  window.location.reload()
}
</script>

<template>
  <CollapsibleCard id="backup" title="数据备份" :summary="summary" :default-open="false">
    <div class="overview">
      <div class="ov-item">
        <span class="ov-n">{{ overview.collections }}</span>
        <span class="ov-l">收藏夹</span>
      </div>
      <div class="ov-item">
        <span class="ov-n">{{ overview.wazaRecords }}</span>
        <span class="ov-l">技记录</span>
      </div>
      <div class="ov-item">
        <span class="ov-n">{{ overview.clips }}</span>
        <span class="ov-l">编排片段</span>
      </div>
    </div>

    <div class="actions">
      <button class="primary" type="button" @click="doExport">导出备份文件</button>

      <label class="secondary" :class="{ busy }">
        <input type="file" accept="application/json,.json" :disabled="busy" @change="doImport" />
        {{ busy ? '导入中…' : '导入备份文件' }}
      </label>
    </div>

    <button v-if="canUndo" class="undo" type="button" @click="doUndo">撤销上次导入</button>

    <button v-if="needReload" class="reload" type="button" @click="reload">刷新页面以生效</button>

    <p v-if="message" class="message">{{ message }}</p>

    <p class="hint">
      备份包含收藏夹（含掌握状态）、编排片段、节拍器设置等全部本地数据，是一个 JSON 文件，可以直接发给自己。换手机时先在旧机导出，新机导入即可。
    </p>
  </CollapsibleCard>
</template>

<style scoped>
.overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px 10px;
  border-radius: 10px;
  background: #0f1729;
}

.ov-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.ov-n {
  font-size: 20px;
  font-weight: 700;
  color: #cfe3ff;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.ov-l {
  font-size: 10px;
  color: #5f728c;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.primary {
  height: 46px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(180deg, #3d86e8, #2a63c2);
  box-shadow: 0 6px 18px rgba(47, 111, 208, 0.3);
  font-family: inherit;
  transition: transform 100ms ease;
}

.primary:active {
  transform: translateY(1px);
}

.secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #2f6fd0;
  background: rgba(47, 111, 208, 0.12);
  color: #cfe3ff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.secondary.busy {
  opacity: 0.6;
  cursor: default;
}

.secondary input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.undo {
  width: 100%;
  height: 38px;
  margin-top: 8px;
  border-radius: 10px;
  border: 1px solid #7a5a1f;
  background: transparent;
  color: #e6c07a;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}

.reload {
  width: 100%;
  height: 38px;
  margin-top: 8px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #16233c;
  color: #cfe3ff;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}

.message {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #9db6d6;
  background: rgba(47, 111, 208, 0.08);
  border-left: 2px solid #2f6fd0;
  padding: 8px 10px;
  border-radius: 0 8px 8px 0;
}

.hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #5f728c;
}
</style>

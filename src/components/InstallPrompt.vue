<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 安装到桌面
 *
 * 安卓 / 桌面 Chrome：监听 beforeinstallprompt，拿到事件后自己控制何时弹窗。
 * iOS Safari：没有该事件，只能提示用户手动「添加到主屏幕」。
 * 非安全上下文（局域网 HTTP）：Service Worker 注册不了，浏览器直接判定不可安装，
 * 这种情况要说清楚原因，而不是让按钮凭空消失。
 */

const KEY = 'wota:install-dismissed'

const deferred = ref(null)
const installed = ref(false)
const iosHint = ref(false)
const insecure = ref(false)
const dismissed = ref(false)

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function onPrompt(e) {
  // 阻止浏览器默认的迷你提示条，改由我们自己的按钮触发
  e.preventDefault()
  deferred.value = e
}

function onInstalled() {
  installed.value = true
  deferred.value = null
}

onMounted(() => {
  try {
    dismissed.value = localStorage.getItem(KEY) === '1'
  } catch {
    /* 忽略 */
  }

  installed.value = isStandalone()
  iosHint.value = /iphone|ipad|ipod/i.test(navigator.userAgent) && !installed.value
  insecure.value = !window.isSecureContext

  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onPrompt)
  window.removeEventListener('appinstalled', onInstalled)
})

async function install() {
  const ev = deferred.value
  if (!ev) return
  ev.prompt()
  try {
    const choice = await ev.userChoice
    if (choice?.outcome === 'accepted') installed.value = true
  } catch {
    /* 用户取消或浏览器不支持 */
  }
  deferred.value = null
}

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* 忽略 */
  }
}

const canShow = computed(() => {
  if (installed.value || dismissed.value) return false
  return !!deferred.value || iosHint.value || insecure.value
})
</script>

<template>
  <div v-if="canShow" class="install">
    <div class="txt">
      <strong class="title">把工具箱装到桌面</strong>
      <span v-if="deferred" class="sub">全屏打开、离线也能用，像真 App 一样</span>
      <span v-else-if="iosHint" class="sub">
        用 Safari 底部「分享」→「添加到主屏幕」
      </span>
      <span v-else-if="insecure" class="sub warn">
        当前是 HTTP 局域网地址，浏览器不允许安装 —— 换 HTTPS 访问才能装
      </span>
    </div>

    <div class="actions">
      <button v-if="deferred" class="btn" type="button" @click="install">安装</button>
      <button class="x" type="button" aria-label="不再提示" @click="dismiss">×</button>
    </div>
  </div>
</template>

<style scoped>
.install {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid #2f6fd0;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(47, 111, 208, 0.16), rgba(47, 111, 208, 0.05));
}

.txt {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: #cfe3ff;
}

.sub {
  font-size: 11px;
  line-height: 1.6;
  color: #8fa3bf;
}

.sub.warn {
  color: #e6c07a;
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.btn {
  height: 34px;
  padding: 0 16px;
  border: none;
  border-radius: 9px;
  background: #2f6fd0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: transform 100ms ease;
}

.btn:active {
  transform: translateY(1px);
}

.x {
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #6b7f9c;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.x:active {
  background: #22304d;
  color: #cfe3ff;
}
</style>

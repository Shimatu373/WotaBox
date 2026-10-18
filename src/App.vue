<script setup>
import { ref, onMounted } from 'vue'

const features = ref([
  { icon: '📖', name: '技图鉴', desc: '技名 · 动作分解 · 要点提示' },
  { icon: '🥁', name: '节拍器', desc: 'BPM 可调 · 八拍口令' },
  { icon: '⏱️', name: '练习计时', desc: '计时 · 打卡 · 训练记录' },
  { icon: '🎥', name: '视频镜像', desc: '慢放 · 左右翻转对照' },
])

const info = ref({ size: '', dpr: '', ua: '' })

onMounted(() => {
  info.value = {
    size: `${window.innerWidth} × ${window.innerHeight}`,
    dpr: String(window.devicePixelRatio),
    ua: navigator.userAgent,
  }
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="badge">阶段 0 · 已跑通</div>
      <h1>WOTA 工具箱</h1>
      <p class="sub">给打师的学习与练习助手 🐋</p>
    </header>

    <section class="card">
      <h2>✅ 你的第一个网页已经在手机上跑起来了</h2>
      <p class="hint">
        看到这个页面，说明「写代码 → 构建 → 手机浏览」这条链路已经打通。
        以后每加一个功能，就刷新一下手机，立刻能看到变化。
      </p>
      <dl class="info">
        <div><dt>屏幕</dt><dd>{{ info.size }}</dd></div>
        <div><dt>像素比</dt><dd>{{ info.dpr }}</dd></div>
      </dl>
      <p class="ua">{{ info.ua }}</p>
    </section>

    <section class="card">
      <h2>接下来要做的事</h2>
      <ul class="feat">
        <li v-for="f in features" :key="f.name">
          <span class="ico">{{ f.icon }}</span>
          <span class="txt">
            <strong>{{ f.name }}</strong>
            <em>{{ f.desc }}</em>
          </span>
          <span class="tag">待开发</span>
        </li>
      </ul>
    </section>

    <footer>v0.0.1 · 本地开发中</footer>
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.hero {
  text-align: center;
  padding: 16px 0 24px;
}

.badge {
  display: inline-block;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #1b3a6b;
  color: #8ec5ff;
  margin-bottom: 12px;
}

h1 {
  font-size: 28px;
  margin: 0 0 6px;
  letter-spacing: 1px;
}

.sub {
  color: var(--muted);
  margin: 0;
  font-size: 14px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
}

.card h2 {
  font-size: 15px;
  margin: 0 0 10px;
  color: #cfe3ff;
  font-weight: 600;
}

.hint {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.7;
  margin: 0 0 12px;
}

.info {
  display: flex;
  gap: 20px;
  margin: 0 0 8px;
}

.info div {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
}

.ua {
  font-size: 11px;
  color: #5b6b85;
  word-break: break-all;
  margin: 0;
}

.feat {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feat li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.feat li:first-child {
  border-top: none;
}

.ico {
  font-size: 20px;
}

.txt {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.txt strong {
  font-size: 14px;
  font-weight: 600;
}

.txt em {
  font-style: normal;
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.tag {
  font-size: 11px;
  color: #7a8aa3;
  border: 1px solid var(--line);
  padding: 2px 8px;
  border-radius: 999px;
}

footer {
  text-align: center;
  font-size: 11px;
  color: #4d5a70;
  margin-top: 24px;
}
</style>
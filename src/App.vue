<script setup>
import MetronomePanel from './components/MetronomePanel.vue'
import WazaPanel from './components/WazaPanel.vue'
import CollapsibleCard from './components/CollapsibleCard.vue'

const upcoming = [
  { icon: '⏱️', name: '练习计时', desc: '计时 · 打卡 · 训练记录' },
  { icon: '🎥', name: '视频镜像', desc: '慢放 · 左右翻转对照' },
]
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1>WOTA 工具箱</h1>
      <p class="sub">给打师的学习与练习助手 🐋</p>
    </header>

    <MetronomePanel />

    <WazaPanel />

    <CollapsibleCard id="upcoming" title="接下来" summary="2 项" :default-open="false">
      <ul class="feat">
        <li v-for="f in upcoming" :key="f.name">
          <span class="ico">{{ f.icon }}</span>
          <span class="txt">
            <strong>{{ f.name }}</strong>
            <em>{{ f.desc }}</em>
          </span>
          <span class="tag">待开发</span>
        </li>
      </ul>
    </CollapsibleCard>

    <footer>v0.4.0 · 节拍器 + 技图鉴</footer>
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
  padding: 8px 0 20px;
}

h1 {
  font-size: 26px;
  margin: 0 0 6px;
  letter-spacing: 1px;
}

.sub {
  color: var(--muted);
  margin: 0;
  font-size: 14px;
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
  line-height: 1;
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
  white-space: nowrap;
}

footer {
  text-align: center;
  font-size: 11px;
  color: #4d5a70;
  margin-top: 24px;
}
</style>
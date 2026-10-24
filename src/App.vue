<script setup>
import MetronomePanel from './components/MetronomePanel.vue'
import PlayerPanel from './components/PlayerPanel.vue'
import ChoreoPanel from './components/ChoreoPanel.vue'
import BpmPanel from './components/BpmPanel.vue'
import WazaPanel from './components/WazaPanel.vue'
import VideoComparePanel from './components/VideoComparePanel.vue'
import FavoritesPanel from './components/FavoritesPanel.vue'
import BackupPanel from './components/BackupPanel.vue'
import CollapsibleCard from './components/CollapsibleCard.vue'
import InstallPrompt from './components/InstallPrompt.vue'

/** 版本号由 vite.config.js 从 package.json 注入（__APP_VERSION__） */
const appVersion = __APP_VERSION__

const upcoming = [
  { icon: '🗺️', name: '全国光棒地图', desc: '收录各地界隈与活动场地，找同好、走圣地巡礼' },
  { icon: '💡', name: '你知道吗', desc: '光棒小知识合集' },
]
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1>WotaBox</h1>
      <p class="sub">给打师的学习与练习助手 🐋</p>
    </header>

    <InstallPrompt />

    <MetronomePanel />

    <PlayerPanel />

    <ChoreoPanel />

    <BpmPanel />

    <WazaPanel />

    <VideoComparePanel />

    <FavoritesPanel />

    <BackupPanel />

    <CollapsibleCard id="upcoming" title="接下来" :summary="`${upcoming.length} 项`" :default-open="false">
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

    <footer>v{{ appVersion }} · WotaBox</footer>
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
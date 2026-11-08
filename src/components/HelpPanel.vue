<script setup>
/**
 * 帮助子页面
 *
 * 参考 Cloudflare Docs 的布局：左边目录、右边正文、顶部搜索框。
 * 目标读者是**第一次打开这个网页的打师**，所以：
 *   - 不用术语开头，先用一句白话解释，再给「点哪里 → 会看到什么」
 *   - 每个步骤都写清按钮上的字，不写「点击此处」
 *   - 手机和电脑的操作都提一句
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { HELP_GROUPS, HELP_SECTIONS } from '../data/help.js'

const props = defineProps({ initial: { type: String, default: '' } })
const emit = defineEmits(['close'])

const kw = ref('')
const activeId = ref(props.initial || 'start')
const bodyEl = ref(null)

const nav = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return HELP_GROUPS.map((group) => ({
    group,
    items: HELP_SECTIONS.filter(
      (s) => s.group === group && (!k || s.title.toLowerCase().includes(k) || s.id.includes(k)),
    ),
  })).filter((g) => g.items.length)
})

function go(id) {
  activeId.value = id
  const el = document.getElementById('help-' + id)
  if (!el || !bodyEl.value) return
  // 在正文容器内滚动，避免整页跟着跑
  bodyEl.value.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
}

/** 滚动时高亮当前小节 */
function onScroll() {
  const el = bodyEl.value
  if (!el) return
  const top = el.scrollTop + 24
  let current = HELP_SECTIONS[0].id
  for (const s of HELP_SECTIONS) {
    const node = document.getElementById('help-' + s.id)
    if (node && node.offsetTop <= top) current = s.id
  }
  activeId.value = current
}

onMounted(() => {
  if (props.initial) {
    // 等一帧，保证锚点已经在 DOM 里
    requestAnimationFrame(() => go(props.initial))
  }
  bodyEl.value?.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => bodyEl.value?.removeEventListener('scroll', onScroll))
</script>

<template>
  <Teleport to="body">
    <div class="overlay">
      <header class="topbar">
        <button class="back" type="button" @click="emit('close')">← 返回</button>
        <span class="brand">WotaBox 帮助</span>
        <span class="tag">编排 · 站位 · 走位</span>
        <input v-model="kw" class="search" type="search" placeholder="搜一下，比如「关键帧」" />
      </header>

      <div class="shell">
        <!-- 目录 -->
        <nav class="side">
          <div v-for="g in nav" :key="g.group" class="group">
            <p class="group-title">{{ g.group }}</p>
            <button
              v-for="s in g.items"
              :key="s.id"
              class="nav-item"
              :class="{ on: activeId === s.id }"
              type="button"
              @click="go(s.id)"
            >
              {{ s.title }}
            </button>
          </div>
          <p v-if="!nav.length" class="empty">没搜到，换个词试试</p>
        </nav>

        <!-- 正文 -->
        <main ref="bodyEl" class="body">
          <section id="help-start" class="sec">
            <h1>五分钟上手</h1>
            <p class="lead">
              WotaBox 的「编排」就是一份**电子节目单**：把一首歌切成几段，每段记下谁在打什么歌技、
              站在哪儿、什么时候上下场。全程离线，数据只存在你自己的浏览器里。
            </p>

            <div class="card">
              <strong>最短路径（按顺序走一遍）</strong>
              <ol class="steps">
                <li>打开「音乐播放器」，选一个本地 mp3 → 点「播放」</li>
                <li>听到要用的那一段，暂停 → 点 <code>A</code> 那一行的「设为当前」，再往后拖一点 →
                  点 <code>B</code> 那一行的「设为当前」</li>
                <li>点「＋ 存为片段」，给它起个名字（副歌 / 主歌 / C 段）→ 「保存片段」</li>
                <li>回到「编排」卡片，就能看到这条片段了。想编站位就点它右上方的「站位视图」</li>
              </ol>
            </div>

            <p class="note">
              建议第一次先随便存两条试试，熟悉之后再正式编 —— 存错了随时能改（见
              <a href="#" @click.prevent="go('edit')">第三步</a>）。
            </p>
          </section>

          <section id="help-concept" class="sec">
            <h1>先弄清三个词</h1>
            <div class="cards">
              <div class="mini-card">
                <h3>片段</h3>
                <p>歌里的一段时间，比如「1:23 – 1:51 的副歌」。片段是编排的最小单位。</p>
              </div>
              <div class="mini-card">
                <h3>动作</h3>
                <p>这一段里按顺序打的技。既能从图鉴里挑，也能直接写文字（原创技、缝合动作）。</p>
              </div>
              <div class="mini-card">
                <h3>站位 / 走位</h3>
                <p>几个人在舞台上的位置，以及随着时间怎么移动、什么时候上场下场。</p>
              </div>
            </div>
            <p class="note">
              这三个是分开存的：一条片段可以先只有时间、没有动作、没有站位。所以不用一次填完，
              想到哪补到哪。
            </p>
          </section>

          <section id="help-clip" class="sec">
            <h1>第一步：切出片段</h1>
            <ol class="steps">
              <li>「音乐播放器」→ 选文件（手机上是选本地音频，电脑上是选本地 mp3/m4a）</li>
              <li>播放，听到段落开头就暂停 → <code>A</code> 那行点「设为当前」</li>
              <li>继续播放到段落结尾 → <code>B</code> 那行点「设为当前」</li>
              <li>
                时间不准就用 <code>−0.1</code> / <code>+0.1</code> 微调，配合「循环 开」反复听接头对不对
              </li>
              <li>点「＋ 存为片段」→ 填名字 → 「保存片段」</li>
            </ol>
            <p class="warn">
              A 和 B 之间至少要 0.2 秒，否则会提示「先把 A 和 B 点标记好」。
            </p>
          </section>

          <section id="help-actions" class="sec">
            <h1>第二步：给片段填动作</h1>
            <p>存片段时（或之后编辑时）会看到「动作（按顺序）」这一块，两种加法：</p>
            <ul class="bullets">
              <li><strong>从图鉴里挑</strong>：点「＋ 从图鉴添加」→ 搜技名（日文名、中文名、系列名都能搜）→ 点一条就加进列表</li>
              <li>
                <strong>直接写文字</strong>：在下面的输入框写「蒼月剣 → 雷蛇」这类，回车或点「＋ 加自定义」。
                图鉴里没有的原创技、临时缝合的动作都这么记
              </li>
            </ul>
            <p>列表里每一条都能 <code>↑</code> <code>↓</code> 调整顺序、<code>×</code> 删掉。顺序就是打出来的顺序。</p>
            <p class="note">
              自定义动作在列表里是**暖色斜体**，和图鉴技区分开；导出编排时也会原样带上。
            </p>
          </section>

          <section id="help-edit" class="sec">
            <h1>第三步：改已经存好的片段</h1>
            <ol class="steps">
              <li>到「编排」卡片，找到那条片段</li>
              <li>点它右边的 <code>✎</code> —— 会展开成编辑状态（显示「编辑中」）</li>
              <li>名称、区间（数字框 + <code>−</code> <code>＋</code> 微调 0.1 秒）、动作、备注都能改</li>
              <li>点「保存修改」；点「取消」则原样不动</li>
            </ol>
            <p class="note">改完立刻生效，也会立刻存到本机，不用再点别的地方。</p>
          </section>

          <section id="help-stage" class="sec">
            <h1>站位视图：把人摆上去</h1>
            <p>在「编排」里点某首歌后面的「站位视图」，会打开一个全屏页面（手机建议横屏）：</p>
            <div class="shot">
              <pre class="diagram">┌──────────────┬────────────────────────────┐
│ 打师 A  ●在场 │                            │
│ [复制动作]    │        ●A        ●B        │
│──────────────│                            │
│ ▉ 副歌        │                 ●C         │
│ ▉ 主歌        │                            │
│ ▉ C 段        │────────────────────────────│
│ [⏮][从片段导入]│ ▓▓副歌▓▓  ▓▓主歌▓▓  ▓▓C段▓▓ │
└──────────────┴────────────────────────────┘
                舞台正面 · 观众侧 ↑ 这段是观众那一面</pre>
            </div>
            <ol class="steps">
              <li>左侧「＋ 加打师」，加够人数（每人自动分到一个颜色）</li>
              <li>点顶部「解锁走位编辑」（按钮变成红色「✋ 走位编辑中」）</li>
              <li>在舞台上按住圆点拖动，摆成你要的队形 —— 松手就记下来了</li>
              <li>舞台下方写着「舞台正面 · 观众侧」，是给你判断左右前后的</li>
            </ol>
            <p class="warn">
              拖动有三条限制，不是 bug：① 要先「解锁走位编辑」 ② 只能拖**当前选中**的那个圆点
              ③ 不在场的打师拖不动（他这一秒没上场）。点一下圆点可以先选中他。
            </p>
          </section>

          <section id="help-keyframe" class="sec">
            <h1>关键帧（白话版）</h1>
            <p class="lead">
              「关键帧」这个词有点工程味，实际上它就是**给某一秒钟拍一张站位照片**。
            </p>
            <div class="card">
              <p>举例：</p>
              <ol class="steps">
                <li>把进度条拖到 <code>0:32</code>，把三个人摆成一排 → 这一秒的照片存好了</li>
                <li>拖到 <code>0:45</code>，把人摆成两排 → 又存了一张</li>
                <li>点「▶ 播放」，软件会在两张照片之间自动做过渡 —— 人从原位滑到新位，这就是走位</li>
              </ol>
              <p class="note">
                所以：**两张照片之间的位移 = 走位**；某张照片里**没有**某个人 = 他这段时间不在场（会自动淡出）。
              </p>
            </div>
            <p>具体怎么操作：</p>
            <ol class="steps">
              <li>顶部点「解锁走位编辑」</li>
              <li>拖舞台下方的进度条，到你要做走位的那一秒</li>
              <li>按住某个圆点拖到新位置 → 松手，这一秒的关键帧就存下了</li>
              <li>底部会出现一个写着时间的标签（比如 <code>0:32.00</code>），说明存好了</li>
              <li>再拖到下一个时间点，重复一次</li>
              <li>点「▶ 播放」看整段过渡顺不顺</li>
            </ol>

            <h3>关键帧上的四个小按钮</h3>
            <ul class="bullets">
              <li><code>◀</code> <code>▶</code> —— 把这一帧往前/往后挪 1 帧（1/30 秒），用来对拍子</li>
              <li><code>✎</code> —— 直接输入时间（精确到毫秒），比拖更准</li>
              <li><code>⏱</code> —— 这一帧的上下场时长（见下一节）</li>
              <li><code>×</code> —— 删掉这一帧；标签上的「滑 / 硬切」点一下可以切换</li>
            </ul>
            <p class="note">
              进度条上那些小竖线就是关键帧的位置；属于当前选中打师的会显示成暖色。
              底部标签只列出**和当前打师有关**的帧，人多了也不会乱。
            </p>
          </section>

          <section id="help-inout" class="sec">
            <h1>上下场：谁什么时候上、什么时候下</h1>
            <p>选中一个打师后，底部有两个按钮：<code>此刻上场</code> / <code>此刻下场</code>。</p>
            <ol class="steps">
              <li>拖到他要上场的时间点</li>
              <li>（可选）左边选择「上场方向」：就近边缘 / 左侧 / 右侧 / 上方 / 下方 —— 他会从那个方向滑进来</li>
              <li>（可选）设置「时长」：0.5 秒 = 干脆利落，2 秒 = 慢慢走上来</li>
              <li>点「此刻上场」→ 这一帧就记下了他在场的位置与入场方式</li>
              <li>拖到他退场的时间点，点「此刻下场」</li>
            </ol>
            <p>
              左上角打师卡会实时显示状态：<span class="dot-g" />在场、
              <span class="dot-y" />正在上场 42%、<span class="dot-g2" />不在场。
            </p>
            <p class="note">
              想改某一帧的上下场速度，就点那个帧标签上的 <code>⏱</code> 单独设；留空表示
              「按两帧之间的整段时间慢慢过渡」。
            </p>
          </section>

          <section id="help-parts" class="sec">
            <h1>给每个打师配动作</h1>
            <p>片段里的动作是「这段整体打什么」；站位视图里还能记「谁具体打什么」：</p>
            <ol class="steps">
              <li>左侧选中某个打师</li>
              <li>
                在「该打师在各片段的动作」里找到对应片段，点「从片段导入」—— 把片段已有的动作复制给他
              </li>
              <li>点「＋文字」可以给他单独加一段文字动作；点「清空」清掉他在这一段的动作</li>
              <li>想把他整套动作给别人：点「复制动作」→ 选另一个打师 → 点「粘贴」</li>
            </ol>
            <p class="note">
              每个打师的动作是挂在**片段 id** 上的，所以片段时间相邻、重叠也不会串到别的片段去。
              点左侧片段标题前面的 <code>⏮</code> 可以直接跳到那段开头。
            </p>
          </section>

          <section id="help-share" class="sec">
            <h1>分享给同伴</h1>
            <p>两种方式，按需要选：</p>
            <div class="cards">
              <div class="mini-card">
                <h3>复制编排</h3>
                <p>生成一段纯文本，直接发群里对动作。别人不用装任何东西就能看。</p>
              </div>
              <div class="mini-card">
                <h3>导出编排</h3>
                <p>下载一个 JSON 文件，包含片段、动作、站位与走位，**不含收藏夹**。同伴点「导入编排」就能合并进他的 WotaBox。</p>
              </div>
            </div>
            <p class="note">
              导入是**合并**不是覆盖：同 id 的片段会更新，本地已经有站位的歌不会被别人的覆盖。
            </p>
          </section>

          <section id="help-data" class="sec">
            <h1>数据存在哪 / 怎么备份</h1>
            <ul class="bullets">
              <li>全部存在**你这台设备的浏览器**里（localStorage），不上传任何服务器</li>
              <li>清理浏览器数据 / 卸载应用时清缓存 → 会**一起消失**</li>
              <li>「数据备份」卡片可以导出**整包**（含收藏夹、编排、设置），换设备或换浏览器时用它</li>
            </ul>
            <p class="warn">建议每次大改之后导出一份备份，放网盘或发给自己。</p>
          </section>

          <section id="help-faq" class="sec">
            <h1>常见问题</h1>

            <h3>圆点怎么拖都拖不动</h3>
            <p>
              按顺序检查：① 顶部是不是「✋ 走位编辑中」（没解锁是拖不动的）
              ② 拖的是不是当前选中的那个打师（点一下可以先选中）③ 他这一秒是不是不在场（左上角状态会写「不在场」）。
            </p>

            <h3>某个打师突然消失了</h3>
            <p>
              说明当前这一帧里没有他的坐标 —— 软件理解为「他这时候不在场」，会淡出。
              拖到他在的时间点，或者点「此刻上场」把他加回来。
            </p>

            <h3>两个人叠在一起了</h3>
            <p>直接在舞台上拖开；也可以先选中其中一个，点「此刻上场」，他会回到自己上一次的位置。</p>

            <h3>关键帧的时间对不准拍子</h3>
            <p>用帧标签上的 <code>◀</code> <code>▶</code> 一帧一帧挪，或者 <code>✎</code> 直接输时间（比如 32.5）。</p>

            <h3>点「从片段导入」以后，别的地方也变了？</h3>
            <p>
              这是旧版本的 bug，v0.10.3 之后已修（动作现在按片段 id 归属）。如果还有残留，
              重新点一次「从片段导入」把内容正回来即可。
            </p>

            <h3>手机上字太小 / 摆不下</h3>
            <p>站位视图建议**横屏**使用；宽度不足时会变成上下布局，舞台仍然可以拖。</p>

            <h3>能不能和别人一起编辑同一份编排</h3>
            <p>暂时不行 —— 现在是各编各的，再用「导出编排 / 导入编排」互相合并。协同编辑需要后端，还没做。</p>

            <p class="foot-note">
              以上都看完还是卡住：把卡住的那一步截图发过来（最好带上你点的是哪个按钮），我照着改文档或者改界面。
            </p>
          </section>
        </main>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: #06090f;
  display: flex;
  flex-direction: column;
  color: var(--text);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  flex: none;
  flex-wrap: wrap;
}

.back {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0f1729;
  color: #9db6d6;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.brand {
  font-size: 13px;
  font-weight: 700;
  color: #e6edf7;
}

.tag {
  font-size: 10px;
  color: #5f728c;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
}

.search {
  margin-left: auto;
  width: min(240px, 45vw);
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #0b1220;
  color: #e6edf7;
  font-size: 12px;
  font-family: inherit;
  padding: 0 10px;
  outline: none;
}

.search:focus {
  border-color: #2f6fd0;
}

.shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 210px 1fr;
}

@media (max-width: 760px) {
  .shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .side {
    max-height: 34vh;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}

.side {
  border-right: 1px solid var(--line);
  padding: 12px 10px;
  overflow-y: auto;
}

.group {
  margin-bottom: 12px;
}

.group-title {
  margin: 0 0 4px;
  font-size: 10px;
  letter-spacing: 1px;
  color: #4d5a70;
  text-transform: uppercase;
}

.nav-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9db6d6;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.nav-item:hover {
  background: #0f1729;
  color: #cfe3ff;
}

.nav-item.on {
  background: #16233c;
  color: #cfe3ff;
  box-shadow: inset 2px 0 0 #2f6fd0;
}

.empty {
  font-size: 11px;
  color: #4d5a70;
}

.body {
  overflow-y: auto;
  padding: 18px 22px 60px;
  scroll-behavior: smooth;
}

.sec {
  max-width: 760px;
  margin: 0 auto 34px;
  padding-bottom: 8px;
  border-bottom: 1px solid #131c2b;
}

.sec:last-child {
  border-bottom: 0;
}

h1 {
  font-size: 20px;
  margin: 0 0 10px;
  color: #f0f6ff;
}

h3 {
  font-size: 13px;
  margin: 16px 0 6px;
  color: #cfe3ff;
}

.lead {
  font-size: 13px;
  line-height: 1.8;
  color: #b6c6db;
}

p,
li {
  font-size: 13px;
  line-height: 1.8;
  color: #b6c6db;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: #16233c;
  color: #cfe3ff;
  border-radius: 4px;
  padding: 1px 5px;
}

.steps {
  padding-left: 20px;
  margin: 8px 0;
}

.steps li {
  margin: 4px 0;
}

.bullets {
  padding-left: 20px;
  margin: 8px 0;
}

.card {
  background: #0b1220;
  border: 1px solid var(--line);
  border-left: 2px solid #2f6fd0;
  border-radius: 0 10px 10px 0;
  padding: 12px 14px;
  margin: 12px 0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin: 12px 0;
}

.mini-card {
  background: #0f1729;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
}

.mini-card h3 {
  margin: 0 0 4px;
}

.mini-card p {
  margin: 0;
  font-size: 12px;
  color: #8fa3bf;
}

.note,
.warn {
  font-size: 12px;
  line-height: 1.8;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 10px 0;
}

.note {
  color: #8fa3bf;
  background: #0f1729;
  border-left: 2px solid #3d5a80;
}

.warn {
  color: #f0d7a4;
  background: rgba(230, 192, 122, 0.1);
  border-left: 2px solid #b8892f;
}

.shot {
  margin: 12px 0;
  overflow-x: auto;
}

.diagram {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #7f9ac0;
  background: #0b1220;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
}

.foot-note {
  margin-top: 16px;
  font-size: 12px;
  color: #6b7f9c;
}

.dot-g,
.dot-y,
.dot-g2 {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin: 0 3px 0 6px;
  vertical-align: middle;
}

.dot-g {
  background: #43c463;
}

.dot-y {
  background: #e8b53c;
}

.dot-g2 {
  background: #44556f;
}

a {
  color: #7fd0ff;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>

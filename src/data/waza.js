/**
 * 技（わざ）数据
 *
 * 字段设计参考了中文WOTA艺wiki的词条模板与日本「ヲタ芸技辞典」的记法，
 * 但额外增加了教学侧的字段（steps / pitfalls / difficulty），这是本工具的重点。
 *
 * ┌─ 基础信息（可与 wiki 对应）──────────────────────────────
 * │ id          唯一标识，英文/拼音，用作 key
 * │ nameJa      日文名（本家定名）
 * │ nameRomaji  罗马音
 * │ nameZh      中文译名
 * │ aliases     别名 / 额外搜索关键词
 * │ series      所属系列（如「蒼月剣系」）
 * │ creator     作成者
 * │ year        创作年份
 * │ bars        八拍数（副歌技一般为 4，未确认就填 null）
 * │ tags        标签（国人技 / オリ技 / 改 …）
 * ├─ 参考资料 ────────────────────────────────────────────────
 * │ videos[]    参考视频 { kind, performer, time, title, url }
 * │             kind: 本家 / 系列技连 / 技连 / 企划 / 教学
 * │             time: 视频内时间点，如 '00:45'
 * │ wiki        中文WOTA艺wiki 的页面标题，用来生成原文链接
 * ├─ 教学（本工具的核心，需要你自己补充）───────────────────
 * │ steps[]     动作分解，按八拍写，一条一句
 * │ pitfalls    常见失误 / 要点
 * │ difficulty  难度 1–5，null 表示未评定
 * └──────────────────────────────────────────────────────────
 *
 * 加新技：照着下面任意一条复制、改字段即可。
 * 不确定的信息就填 null 或留空，界面上会显示「待补充」，不要瞎猜。
 */

// 系列元信息（本家、说明），列表里按 series 名归组时用得上
export const SERIES_INFO = {
  蒼月剣系: {
    origin: '三水',
    note: '三水创作的长系列，变体众多，是国人技里影响最大的系列之一。',
  },
}

export const WAZA = [
  {
    id: 'sougatsuken',
    nameJa: '蒼月剣',
    nameRomaji: 'Sougatsuken',
    nameZh: '苍月剑',
    aliases: ['苍月剑', 'そうげつけん'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣〈苍月剑〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-kai',
    nameJa: '蒼月剣 改',
    nameRomaji: 'Sougatsuken Kai',
    nameZh: '苍月剑 改',
    aliases: ['苍月剑改'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技', '改'],
    videos: [],
    wiki: '蒼月剣 改〈苍月剑 改〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-mai',
    nameJa: '蒼月剣舞',
    nameRomaji: 'Sougatsuken Mai',
    nameZh: '苍月剑舞',
    aliases: ['苍月剑舞', 'そうげつけんぶ'],
    series: '蒼月剣系',
    creator: '三水',
    year: 2020,
    bars: null,
    tags: ['国人技'],
    videos: [
      {
        kind: '系列技连',
        performer: '三水',
        time: '00:45',
        title: '【三水】蒼月剣系全般【自创技集合】',
        url: 'https://www.bilibili.com/video/BV1gv4y1F7e1?t=45.2',
      },
    ],
    wiki: '蒼月剣舞〈苍月剑舞〉',
    steps: [],
    pitfalls: '三水本人提到：这个技的后两八拍相比原版做过修改。学习时注意别照抄旧版本。',
    difficulty: null,
  },
  {
    id: 'sougatsuken-zan',
    nameJa: '蒼月剣斬',
    nameRomaji: 'Sougatsuken Zan',
    nameZh: '苍月剑斩',
    aliases: ['苍月剑斩'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣斬〈苍月剑斩〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-hanafubuki',
    nameJa: '蒼月剣·花吹雪',
    nameRomaji: 'Sougatsuken Hanafubuki',
    nameZh: '苍月剑·花吹雪',
    aliases: ['苍月剑花吹雪'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣·花吹雪〈苍月剑·花吹雪〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-shuuritsu',
    nameJa: '蒼月剣「終律」',
    nameRomaji: 'Sougatsuken Shuuritsu',
    nameZh: '苍月剑「终律」',
    aliases: ['苍月剑终律'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣「終律」〈苍月剑「终律」〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-kouin',
    nameJa: '蒼月剣「弧韵」',
    nameRomaji: 'Sougatsuken Kouin',
    nameZh: '苍月剑「弧韵」',
    aliases: ['苍月剑弧韵'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣「弧韵」〈苍月剑「弧韵」〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-ransakura',
    nameJa: '蒼月剣·乱桜舞',
    nameRomaji: 'Sougatsuken Ransakura Mai',
    nameZh: '苍月剑·乱樱舞',
    aliases: ['苍月剑乱樱舞'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣·乱桜舞〈苍月剑·乱樱舞〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
  {
    id: 'sougatsuken-kyousakura',
    nameJa: '蒼月剣·狂桜斬',
    nameRomaji: 'Sougatsuken Kyousakura Zan',
    nameZh: '苍月剑·狂樱斩',
    aliases: ['苍月剑狂樱斩'],
    series: '蒼月剣系',
    creator: null,
    year: null,
    bars: null,
    tags: ['国人技'],
    videos: [],
    wiki: '蒼月剣·狂桜斬〈苍月剑·狂樱斩〉',
    steps: [],
    pitfalls: '',
    difficulty: null,
  },
]

/** 中文WOTA艺wiki 的词条链接（按标题编码生成） */
export function wikiUrl(title) {
  return 'https://wotagei.huijiwiki.com/wiki/' + encodeURIComponent(title)
}

/** 取所有系列名（用于筛选） */
export function allSeries() {
  return [...new Set(WAZA.map((w) => w.series).filter(Boolean))]
}

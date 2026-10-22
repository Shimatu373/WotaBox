/**
 * 技（わざ）数据
 *
 * 结构说明
 * ───────────────────────────────────────────────────────────
 * 用「紧凑表格 + 映射」的方式维护：
 *   ROWS 每行 = [日文名, 中文译名, 系列, 技类型, 覆盖项?]
 * 加一个新技只要往 ROWS 里加一行，不用写一大堆字段名。
 *
 * 技类型 type：
 *   'kansai' 关西（红）  'huoba' 火把（蓝）  'mixed' 综合（紫）  null 待确认
 *   ⚠️ 默认全部留空 —— 这个分类需要有实际依据才能填，不做臆测。
 *      目前只有金剛系三条（星沫查证）标成了 kansai，其余仍待确认。
 *
 * 难度 difficulty：
 *   基础/进阶/专家/大师 四档，数据在 src/data/difficulty.js 的 DIFFICULTY 表里
 *   （按日文名索引）。没核定的就是「待评定」，UI 上显示一条比背景略亮的灰条。
 *
 * 覆盖项（extra）可填：
 *   id nameRomaji creator year bars tags videos pitfalls difficulty wiki aliases
 *
 * 数据来源：中文WOTA艺wiki（灰机wiki）分类页与词条页，只收录可核实的名称与译名，
 * 其余字段留空由使用者补充。wiki 链接按「日文名〈中文译名〉」自动生成。
 * ───────────────────────────────────────────────────────────
 * 由星沫留言：
 * 这个文件的作用是把所有技的元信息整理成一个统一的数据结构，方便在前端使用。
 * 每个技都有一个唯一的 id，确保收藏夹数据不会因为排序变化而失效。在后端建成前我会公开此文件以供大家临时上传元数据
 */

import { IMPORTED, IMPORTED_SERIES } from './waza-imported.js'
import { WIKI_ADDED, WIKI_ADDED_TITLES } from './waza-wiki-extra.js'
import { SERIES_AUTO, SERIES_AUTO_INFO } from './series-auto.js'
import { WIKI_LITE } from './wiki-meta/lite.js'
import { DIFFICULTY } from './difficulty.js'

/** 技类型定义 */
export const TYPE_DEF = {
  kansai: { key: 'kansai', label: '关西', color: '#e0574f', text: '#f3a9a3' },
  huoba: { key: 'huoba', label: '火把', color: '#4a8fe0', text: '#a8d0ff' },
  mixed: { key: 'mixed', label: '综合', color: '#b48cf2', text: '#dcc8ff' },
}

const TYPE_UNKNOWN = { key: null, label: '待确认', color: '#44556f', text: '#93a7c4' }

export function typeMeta(key) {
  return TYPE_DEF[key] || TYPE_UNKNOWN
}

/** 系列元信息 */
const CURATED_SERIES_INFO = {
  蒼月剣系: {
    origin: '三水',
    note: '三水创作的长系列，变体众多，是国人技里影响最大的系列之一。',
  },
  北斗系: {
    origin: null,
    note: '以北斗七星命名的系列，各变体对应一星（天枢、天璇、天玑、天权、玉衡…）。',
  },
  門系: {
    origin: null,
    note: '以「～門」命名的系列，各地名门（虎之门、白门、赤门、长安门、光化门…）属于同一族。',
  },
  虚閃系: {
    origin: null,
    note: '以「虚閃」为核心的一族，含「掴み（握）」与「重奏」等变体及「帰刃」收尾。',
  },
  乖離系: {
    origin: null,
    note: '以「乖離」命名的一族，剑、枪、蛇、正等变体共用同一命名谱系。',
  },
}

/** 系列元信息（手写 + 批量导入 + wiki 系列名自动成组合并） */
export const SERIES_INFO = {
  ...CURATED_SERIES_INFO,
  ...IMPORTED_SERIES,
  ...SERIES_AUTO_INFO,
  スネイク系: {
    origin: 'ばっくほーん〈BackHorn〉（雷蛇改编）',
    note: 'wiki 有官方分类（分类:スネイク系），以雷蛇为原型的庞大家族。',
  },
}

/**
 * 系列归属覆盖：优先采用 wiki 的官方分类。
 * 例：乖離スネイク 既属于「乖離」命名族，也被 wiki 归入「スネイク系」——以官方为准。
 */
const SERIES_OVERRIDE = {
  'サンダースネイク': 'スネイク系',
  'AXISnake': 'スネイク系',
  'ライトニングスネイク': 'スネイク系',
  'JKスネイク': 'スネイク系',
  '黒蝶スネイク': 'スネイク系',
  '吹雪スネーク': 'スネイク系',
  '春風スネイク': 'スネイク系',
  '不知火スネイク': 'スネイク系',
  '鬼人スネイク': 'スネイク系',
  '超重力スネイク': 'スネイク系',
  '乖離スネイク': 'スネイク系',
  '乖離スネイク改': 'スネイク系',
  '旧流星スネイク': 'スネイク系',
  '流星スネイク': 'スネイク系',
  '流星スネイク 白狐ver': 'スネイク系',
  '流星スネイク ギアver': 'スネイク系',
  '流星スネイク ギアver2': 'スネイク系',
  '流星スネイク ふぇるとver': 'スネイク系',
  '流星スネイク はらver': 'スネイク系',
}

// [日文名, 中文译名, 系列, 技类型, 覆盖项?]
const ROWS = [
  // ===== 蒼月剣系（三水）=====
  [
    '蒼月剣',
    '苍月剑',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken',
      creator: '三水〈Mi3z_ui4s〉',
      year: 2020,
      videos: [
        { kind: '系列技连', performer: '三水', time: '00:10', title: '【三水】蒼月剣系全般【自创技集合】', url: '=10.5' },
      ],
    },
  ],
  [
    '蒼月剣 改',
    '苍月剑 改',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken-kai',
      creator: '三水〈Mi3z_ui4s〉',
      year: 2020,
      videos: [
        { kind: '系列技连', performer: '三水', time: '00:33', title: '【三水】蒼月剣系全般【自创技集合】', url: '=32.9' },
      ],
      pitfalls: '三水本人提到这个技没去年打得好看，建议参考「疾走闪光」。',
    },
  ],
  [
    '蒼月剣舞',
    '苍月剑舞',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken-mai',
      creator: '三水〈Mi3z_ui4s〉',
      year: 2020,
      videos: [
        {
          kind: '系列技连',
          performer: '三水',
          time: '00:45',
          title: '【三水】蒼月剣系全般【自创技集合】',
          url: 'https://www.bilibili.com/video/BV1gv4y1F7e1?t=45.2',
        },
      ],
      pitfalls: '三水本人提到：这个技的后两八拍相比原版做过修改。学习时注意别照抄旧版本。',
    },
  ],
  ['蒼月剣斬', '苍月剑斩', '蒼月剣系', null, { id: 'sougatsuken-zan' }],
  [
    '蒼月剣·花吹雪',
    '苍月剑·花吹雪',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken-hanafubuki',
      creator: '三水〈Mi3z_ui4s〉',
      year: 2020,
      videos: [
        { kind: '系列技连', performer: '三水', time: '00:22', title: '【三水】蒼月剣系全般【自创技集合】', url: '=21.5' },
      ],
    },
  ],
  [
    '蒼月剣「終律」',
    '苍月剑「终律」',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken-shuuritsu',
      creator: '三水〈Mi3z_ui4s〉',
      year: 2020,
      videos: [
        { kind: '系列技连／披露', performer: '三水', time: '01:27', title: '【三水】蒼月剣系全般【自创技集合】', url: '=87.3' },
      ],
      pitfalls: '据 wiki：【終律】是【弧韵】的对应技。',
    },
  ],
  [
    '蒼月剣「弧韵」',
    '苍月剑「弧韵」',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken-kouin',
      creator: '芒果〈芒果MangoX〉',
      videos: [
        { kind: '系列技连／披露', performer: '三水', time: '01:00', title: '【三水】蒼月剣系全般【自创技集合】', url: '=59.7' },
      ],
      pitfalls: '本家（芒果）没有发布视频，wiki 引用的是三水在自创技合集里的演绎版 —— 注意别把它当成三水的原创。',
    },
  ],
  ['蒼月剣·乱桜舞', '苍月剑·乱樱舞', '蒼月剣系', null, { id: 'sougatsuken-ransakura' }],
  ['蒼月剣·狂桜斬', '苍月剑·狂樱斩', '蒼月剣系', null, { id: 'sougatsuken-kyousakura' }],

  // ===== 北斗系 =====
  ['北斗', null, '北斗系', null],
  ['北斗·天枢', '北斗·天枢', '北斗系', null],
  ['北斗·天璇', '北斗·天璇', '北斗系', null],
  ['北斗·天玑', '北斗·天玑', '北斗系', null],
  ['北斗·天权', '北斗·天权', '北斗系', null],
  ['北斗·玉衡', '北斗·玉衡', '北斗系', null],

  // ===== 門系 =====
  ['虎ノ門', '虎之门', '門系', null],
  ['虎ノ門改', '虎之门改', '門系', null],
  ['白門', '白门', '門系', null],
  ['赤門', '赤门', '門系', null],
  ['半藏門', '半藏门', '門系', null],
  ['半藏門改', '半藏门改', '門系', null],
  ['長安門', '长安门', '門系', null],
  ['光化門', '光化门', '門系', null],
  ['氷ノ門', '冰之门', '門系', null, { wiki: '氷ノ門〈氷之门⧸冰之门〉' }],

  // ===== 虚閃系 =====
  ['掴み虚閃', '虚闪·握', '虚閃系', null],
  ['掴み虚閃・帰刃', '虚闪·握·归刃', '虚閃系', null],
  ['重奏虚閃', '重奏虚闪', '虚閃系', null],
  ['重奏虚閃・帰刃', '重奏虚闪・归刃', '虚閃系', null],

  // ===== 乖離系 =====
  ['乖離スネイク', '乖离蛇', '乖離系', null],
  ['乖離スネイク改', '乖离蛇改', '乖離系', null],
  ['乖離剣', '乖离剑', '乖離系', null],
  ['乖離剣・藍染', '乖离剑・蓝染', '乖離系', null],
  ['乖離槍', '乖离枪', '乖離系', null],
  ['乖離正', '乖离正', '乖離系', null],
  ['乖燐', null, '乖離系', null],
  ['乖ノ逆鱗', '乖之逆鳞', '乖離系', null],
  ['乖七斬', '乖七斩', '乖離系', null],
  ['乖双絶閃', '乖双绝闪', '乖離系', null],

  // ===== 单发技（未归入已知系列）=====
  ['アーリークロス', '阿里十字'],
  ['抜刀ムラマサ', '拔刀村正'],
  ['ムラマサ', '村正'],
  ['ムラサメ', '村雨'],
  ['レールガン', '超电磁炮'],
  ['ドクターペッパー', '胡椒博士', null, null, { wiki: 'ドクターペッパー〈胡椒博士〈Dr.Pepper〉〉' }],
  ['ゴリラスプラッシュ', 'GorillaSplash'],
  ['ギルガメッシュ', '吉尔伽美什'],
  ['フェニックスブレード', '凤凰刃'],
  ['鶴望蘭', '鹤望兰'],
  ['鶴槍', '鹤枪'],
  ['胡蝶刃', null],
  ['胡蝶刃改', null],
  ['胡蝶刃・神楽舞', '胡蝶刃・神乐舞'],
  ['黒蝶スネイク', '黑蝶蛇'],
  ['吹雪スネーク', '吹雪蛇'],
  ['春風スネイク', '春风蛇'],
  ['不知火スネイク', '不知火蛇'],
  ['鬼人スネイク', '鬼人蛇'],
  ['超重力スネイク', '超重力蛇'],
  ['ハウメア', '哈乌梅亚', null, null, { wiki: 'ハウメア〈哈乌梅亚〈haumea〉〉' }],
  ['八雷神', null],
  ['火雷神', null],
  ['風神', '风神'],
  ['風神乱舞', '风神乱舞'],
  ['風刃', '风刃'],
  ['花天狂骨', null],
  ['伏魔御廚子', '伏魔御厨子'],
  ['ドラアードスピア', 'Ado矛'],
  ['AXISnake', 'AXIS蛇'],
  ['Boxing', '拳击'],
  ['Christian Cross', '基督十字'],
  ['エクスプロード', 'Explode'],

  // ===== 中文WOTA艺wiki 尚未收录，但星沫确认存在的技（2026-10-22）=====
  // 名字就是这几个写法，wiki 上没有对应词条，所以 wiki 链接置空（wiki: null）
  ['翠银婢', null, null, null, { wiki: null }],
  ['城天丸', null, null, null, { wiki: null }],
  ['杰克小刀', null, null, null, { wiki: null }],
  ['无名刀·木偶', null, null, null, { wiki: null }],
]

/** 稳定 id：同一日文名永远得到同一个 id，收藏夹数据不会因为排序变化而失效 */
function hashId(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 'w' + (h >>> 0).toString(36)
}

// 手写的优先；导入数据里同名的不重复加入；wiki 批量导入的（WIKI_ADDED）最后兜底
const ALL_ROWS = [
  ...ROWS,
  ...IMPORTED.filter((r) => !ROWS.some((c) => c[0] === r[0])),
  ...WIKI_ADDED.filter((r) => !ROWS.some((c) => c[0] === r[0]) && !IMPORTED.some((c) => c[0] === r[0])),
]

export const WAZA = ALL_ROWS.map(([nameJa, nameZh, series, type, extra = {}]) => {
  // ⚠️ 这里**不再**读整包 wiki 元数据：详情字段（作成者/视频/要点）拆进了
  // src/data/wiki-meta/chunk-*.js，用 loadWazaDetail(nameJa) 按需加载。
  // 主包只保留搜索需要的读音别名（WIKI_LITE，很小）。
  const readings = WIKI_LITE[nameJa] || []

  return {
    id: extra.id || hashId(nameJa),
    nameJa,
    nameZh: nameZh || null,
    nameRomaji: extra.nameRomaji || null,
    aliases: extra.aliases?.length ? extra.aliases : readings,
    // 系列：手写 ROWS > 显式覆盖表 > wiki 系列名自动成组 > 行内声明
    series: SERIES_OVERRIDE[nameJa] || SERIES_AUTO[nameJa] || series || null,
    type: type || null,
    // 手写在 ROWS 里的作成者/视频仍然直接可用；wiki 来的要按需加载
    creator: extra.creator || null,
    origin: extra.origin || null,
    year: extra.year || null,
    bars: extra.bars ?? null,
    tags: extra.tags || [],
    videos: extra.videos || [],
    // 与 wiki 词条标题约定一致：日文名〈中文译名〉
    // 显式写 wiki: null 表示「wiki 上确实没有这个词条」，界面上不显示跳转链接（避免死链）
    wiki: extra.wiki === null ? null : extra.wiki || (nameZh ? `${nameJa}〈${nameZh}〉` : nameJa),
    pitfalls: extra.pitfalls || '',
    // 难度：waza.js 里手写 > difficulty.js 的核定表 > 待评定（null）
    difficulty: extra.difficulty ?? DIFFICULTY[nameJa] ?? null,
  }
})

/** 中文WOTA艺wiki 的词条链接（按标题编码生成） */
export function wikiUrl(title) {
  return 'https://wotagei.huijiwiki.com/wiki/' + encodeURIComponent(title)
}

/** 取所有系列名（用于筛选），有未归类的技时追加「未分类」 */
export function allSeries() {
  const list = [...new Set(WAZA.map((w) => w.series).filter(Boolean))]
  if (WAZA.some((w) => !w.series)) list.push('未分类')
  return list
}
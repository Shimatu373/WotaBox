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
 *   ⚠️ 目前全部为 null —— 这个分类需要有实际依据才能填，不做臆测。
 *      确认某个技属于哪一类时，把该行的第 4 项改成对应的 key 即可。
 *
 * 覆盖项（extra）可填：
 *   id nameRomaji creator year bars tags videos pitfalls difficulty wiki aliases
 *
 * 数据来源：中文WOTA艺wiki（灰机wiki）分类页与词条页，只收录可核实的名称与译名，
 * 其余字段留空由使用者补充。wiki 链接按「日文名〈中文译名〉」自动生成。
 * ───────────────────────────────────────────────────────────
 */

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
export const SERIES_INFO = {
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

// [日文名, 中文译名, 系列, 技类型, 覆盖项?]
const ROWS = [
  // ===== 蒼月剣系（三水）=====
  ['蒼月剣', '苍月剑', '蒼月剣系', null, { id: 'sougatsuken' }],
  ['蒼月剣 改', '苍月剑 改', '蒼月剣系', null, { id: 'sougatsuken-kai' }],
  [
    '蒼月剣舞',
    '苍月剑舞',
    '蒼月剣系',
    null,
    {
      id: 'sougatsuken-mai',
      creator: '三水',
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
  ['蒼月剣·花吹雪', '苍月剑·花吹雪', '蒼月剣系', null, { id: 'sougatsuken-hanafubuki' }],
  ['蒼月剣「終律」', '苍月剑「终律」', '蒼月剣系', null, { id: 'sougatsuken-shuuritsu' }],
  ['蒼月剣「弧韵」', '苍月剑「弧韵」', '蒼月剣系', null, { id: 'sougatsuken-kouin' }],
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

export const WAZA = ROWS.map(([nameJa, nameZh, series, type, extra = {}]) => ({
  id: extra.id || hashId(nameJa),
  nameJa,
  nameZh: nameZh || null,
  nameRomaji: extra.nameRomaji || null,
  aliases: extra.aliases || [],
  series: series || null,
  type: type || null,
  creator: extra.creator || null,
  year: extra.year || null,
  bars: extra.bars ?? null,
  tags: extra.tags || [],
  videos: extra.videos || [],
  // 与 wiki 词条标题约定一致：日文名〈中文译名〉
  wiki: extra.wiki || (nameZh ? `${nameJa}〈${nameZh}〉` : nameJa),
  pitfalls: extra.pitfalls || '',
  difficulty: extra.difficulty ?? null,
}))

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
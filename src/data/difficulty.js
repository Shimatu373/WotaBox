/**
 * 技难度（わざ なんい）
 *
 * 四档分级由星沫 2026-10-21 定下，标在技名后面的一条小竖线（色条）上：
 *   基础 = 绿   进阶 = 黄   专家 = 红   大师 = 紫
 * 还没评定的技显示一条「比背景略亮」的灰条，不猜、不默认给最低档。
 *
 * 维护方式：只往 DIFFICULTY 里加**有依据**的条目（用户查证 / wiki 明确写了）。
 * 没查到就空着 —— 空着是「待评定」，看着不体面但不会误导人。
 */

/** 四档定义（颜色即 UI 上那条小竖线的颜色） */
export const DIFFICULTY_DEF = {
  basic: { key: 'basic', label: '基础', color: '#43c463', text: '#a8e6b8' },
  advanced: { key: 'advanced', label: '进阶', color: '#e8b53c', text: '#f7dc9a' },
  expert: { key: 'expert', label: '专家', color: '#e35d54', text: '#f5b1ac' },
  master: { key: 'master', label: '大师', color: '#a970e6', text: '#d7c0f5' },
}

/** 待评定：比背景略亮的一条（半透明白，深浅背景都不会糊在一起） */
export const DIFFICULTY_UNKNOWN = { key: null, label: '待评定', color: 'rgba(255, 255, 255, 0.22)', text: '#8b9bb3' }

export function difficultyMeta(key) {
  return DIFFICULTY_DEF[key] || DIFFICULTY_UNKNOWN
}

/** 难度顺序（用于后续筛选/排序：基础 < 进阶 < 专家 < 大师 < 待评定） */
export const DIFFICULTY_ORDER = ['basic', 'advanced', 'expert', 'master']

/**
 * 已核定的难度：键 = 技的日文名（与 waza.js 的 ROWS 第一列一致）
 *
 * 金剛系三条由星沫查证后提供：
 *   金剛、金剛改 = 基础；金剛【天真爛漫】= 进阶
 */
export const DIFFICULTY = {
  金剛: 'basic',
  金剛改: 'basic',
  '金剛【天真爛漫】': 'advanced',
}

export default DIFFICULTY

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
 * ⚠️ 2026-10-24 起**全部回滚为「待评定」**：
 *   社团讨论后对难度判定出现分歧（同一个技大家看法不一），在没有可靠分类信源之前
 *   宁可不评 —— 写一个看起来权威、其实各说各话的档位，比空着有害得多。
 *
 * 要恢复分类，先落实「可靠的分类信源」（官方分级 / 社团统一评审记录 / 教学机构标准），
 * 再往下面这张表里加条目。
 *
 * 留空时界面显示「待评定」+ 一条比背景略亮的灰条 —— 留白 ≠ 最低档。
 */
export const DIFFICULTY = {}

export default DIFFICULTY

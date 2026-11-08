/**
 * 帮助页的目录结构（纯数据，方便测试）
 *
 * group 用来在侧边栏分组；id 必须唯一，且与 HelpPanel 里的 section 锚点一致。
 */
export const HELP_GROUPS = ['开始', '编排', '站位与走位', '分享与数据', '疑难']

export const HELP_SECTIONS = [
  { id: 'start', title: '五分钟上手', group: '开始' },
  { id: 'concept', title: '先弄清三个词', group: '开始' },
  { id: 'clip', title: '第一步：切出片段', group: '编排' },
  { id: 'actions', title: '第二步：给片段填动作', group: '编排' },
  { id: 'edit', title: '第三步：改已经存好的片段', group: '编排' },
  { id: 'stage', title: '站位视图：把人摆上去', group: '站位与走位' },
  { id: 'keyframe', title: '关键帧（白话版）', group: '站位与走位' },
  { id: 'inout', title: '上下场：谁什么时候上', group: '站位与走位' },
  { id: 'parts', title: '给每个打师配动作', group: '站位与走位' },
  { id: 'share', title: '分享给同伴', group: '分享与数据' },
  { id: 'data', title: '数据存在哪 / 怎么备份', group: '分享与数据' },
  { id: 'faq', title: '常见问题', group: '疑难' },
]

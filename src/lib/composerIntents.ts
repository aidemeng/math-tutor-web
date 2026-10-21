export const COMPOSER_INTENTS = {
  analysis: {
    label: '解题讲解',
    prompt: '请识别这道题，给出答案与完整解析，解释关键步骤的思路；有匹配的题库原题时沿用参考解析。',
  },
  similar: {
    label: '找相似题',
    prompt: '请根据这道题，检索题库中同考点、同方法的相似真题，并展示完整题卡。',
  },
  diagnosis: {
    label: '错题分析',
    prompt: '请分析这道错题，区分原题、学生作答和批改痕迹，指出有依据的错误与可能错因，并给一道验证题；作答过程不足时不要直接确定错因。',
  },
  search: {
    label: '智能找题',
    prompt: '请根据我补充的知识点、学生情况和题量，从题库挑选合适的真题；如果我提供了原题并要求找相似题，则检索同考点、同方法的相似真题。说明选题理由。',
  },
  method: {
    label: '方法微课',
    prompt: '请根据我补充的数学方法、学生年级和讲解要求，准备约2分钟的方法微课，讲清何时用、为什么这样用和常见误区，按需配题库真题演示。先保存讲解稿供我预览，确认后再制作视频；缺少教学主题时先询问，不直接制作。',
  },
};
export type ComposerIntentId = keyof typeof COMPOSER_INTENTS;

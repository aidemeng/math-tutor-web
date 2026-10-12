/** 后端错误码 → 面向老师的可读提示。 */

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const MESSAGES: Record<string, string> = {
  SPEECH_NOT_CONFIGURED: '语音服务暂未配置',
  SPEECH_RECOGNITION_FAILED: '语音识别失败，请重试',
  SPEECH_EMPTY: '没有听清，请再说一次',
  SPEECH_RATE_LIMITED: '语音使用较频繁，请稍后再试',
  SPEECH_AUDIO_INVALID: '录音格式异常，请重新录音',
  SPEECH_AUDIO_TOO_LONG: '录音最长60秒，请分段输入',
  NETWORK_ERROR: '无法连接服务，请检查网络和服务地址',
  REQUEST_TIMEOUT: '请求超时，请重试',
  SERVICE_NOT_CONFIGURED: '服务暂未配置',
  REQUEST_TOO_LARGE: '内容过长，请精简后重试',
  INVALID_RESPONSE: '服务返回异常，请重试',
  INVALID_JSON: '请求格式有误',
  INVALID_INPUT: '输入不符合要求，请检查',
  NOT_FOUND: '接口不存在，请确认服务地址',
  INTERNAL_ERROR: '服务开小差了，请稍后重试',

  AUTH_REQUIRED: '登录已过期，请重新登录',
  SESSION_INVALID: '登录已过期，请重新登录',
  ACCOUNT_DISABLED: '账号暂不可用，请联系管理员',
  LOGIN_INVALID: '账号或密码不正确',
  USERNAME_TAKEN: '这个账号已注册，请登录或换一个账号',
  AUTH_RATE_LIMITED: '注册或登录较频繁，请稍后再试',
  AUTH_BUSY: '登录服务较忙，请稍后再试',
  AUTH_UNAVAILABLE: '登录服务暂不可用，请稍后再试',
  ORIGIN_DENIED: '请从正式网站登录',
  WECHAT_NOT_CONFIGURED: '微信登录暂不可用',
  WECHAT_LOGIN_FAILED: '登录失败，请重试',
  WECHAT_CODE_INVALID: '微信登录凭证无效，请重试',
  WECHAT_CODE_USED: '微信登录凭证已使用，请重试',
  WECHAT_CONFIG_INVALID: '微信登录配置异常，请联系管理员',
  WECHAT_UNAVAILABLE: '微信登录服务暂不可用，请稍后重试',
  WECHAT_RATE_LIMITED: '登录较频繁，请稍后重试',

  AGENT_BUSY: '助手当前较忙，请稍后重试',
  AGENT_TIMEOUT: '助手响应超时，请重试',
  AGENT_UNAVAILABLE: '助手暂时不可用，请稍后重试',
  AGENT_FAILED: '这次未能完成，请重试',
  AGENT_STREAM_INTERRUPTED: '回复中断，请重试',
  MODEL_NOT_CONFIGURED: '模型服务暂未配置',
  MODEL_RATE_LIMIT: '模型服务较忙，请稍后重试',
  MODEL_UNAVAILABLE: '模型服务暂不可用，请稍后重试',
  MODEL_INCOMPLETE: '模型回复未完成，请重试',
  MODEL_STREAM_INTERRUPTED: '模型回复中断，请重试',
  MODEL_INVALID_RESPONSE: '模型返回异常，请重试',
  MODEL_RESPONSE_TOO_LARGE: '回复内容过长，请缩小问题范围',
  MODEL_TOKEN_LIMIT: '本次处理已达上限，请缩小问题范围',
  MODEL_TURN_LIMIT: '本次处理已达上限，请补充条件后重试',
  MODEL_TOOL_LIMIT: '本次处理已达上限，请缩小问题范围',
  MODEL_CONNECTION_FAILED: '模型连接失败，请稍后重试',
  RUNTIME_NOT_CONFIGURED: '服务端运行时未配置，请检查后端',
  USER_CHAT_LIMIT: '已有两条对话正在处理，请等待完成',
  CONVERSATION_BUSY: '这条对话正在处理，请稍候',
  CONVERSATION_NOT_FOUND: '这条对话不存在或已被删除',
  MESSAGE_IN_PROGRESS: '请等待当前回复完成',
  MESSAGE_REQUIRED: '请输入内容或上传题目照片',
  INVALID_SAVED_MESSAGE: '历史记录存在无法解析的内容',

  VIDEO_CONFIRMATION_REQUIRED: '请先查看讲解稿，再确认制作视频',
  VIDEO_DRAFT_NOT_FOUND: '讲解稿不存在，请重新生成',
  CREDITS_EXHAUSTED: '视频额度不足',
  JOB_NOT_FAILED: '该任务无需重试',
  VIDEO_NOT_READY: '视频尚未完成',
  SHARE_LIMIT_REACHED: '今天创建的分享较多，请明天再试',
  SHARE_NOT_FOUND: '分享不存在或已撤销',
  SHARE_ASSET_UNSUPPORTED: '暂不支持此题目配图格式',
  VIDEO_NOT_FOUND: '视频任务不存在',
  ASSET_NOT_FOUND: '题目配图不存在',
  BANK_ASSET_MISSING: '题目配图暂时不可用',
  MEDIA_DOWNLOAD_FAILED: '素材下载失败，请重试',

  PHOTO_TOO_LARGE: '图片过大，请裁剪后重试',
  PHOTO_DIMENSIONS_INVALID: '图片尺寸过大，请裁剪后重试',
  PHOTO_FORMAT_INVALID: '请选择 JPG 或 PNG 图片',
  PHOTO_BASE64_INVALID: '图片读取失败，请重新选择',
  PHOTO_READ_FAILED: '图片读取失败，请重新选择',
  PHOTO_LIMIT_REACHED: '今天上传图片较多，请稍后再试',

  ABORTED: '已取消',
};

export function friendlyError(error: unknown): string {
  if (!error) return '操作未完成，请重试';
  if (typeof error === 'string') return MESSAGES[error] ?? error;
  const code = (error as { code?: string; message?: string }).code ?? (error as Error).message ?? '';
  if (MESSAGES[code]) return MESSAGES[code];
  if (/TimeoutError|timed out|timeout/i.test(String(error))) return MESSAGES.REQUEST_TIMEOUT;
  // 浏览器原生网络错误
  if (/Failed to fetch|NetworkError|Load failed/i.test(code)) return MESSAGES.NETWORK_ERROR;
  if (/AbortError/i.test(code)) return MESSAGES.ABORTED;
  return code && !/^[A-Z0-9_]+$/.test(code) ? code : '操作未完成，请重试';
}

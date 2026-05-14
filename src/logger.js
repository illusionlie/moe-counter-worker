/**
 * 轻量级结构化日志模块
 *
 * 在 Cloudflare Workers 中，console.* 输出会被 runtime 捕获，
 * 可通过 `wrangler tail` 实时查看，也会出现在 Workers Dashboard 的日志中。
 *
 * 设计原则：
 * - JSON 结构化输出，便于日志聚合和检索
 * - 支持请求级上下文（requestId, method, url）
 * - 零外部依赖
 * - 支持 log level 过滤
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** @type {'debug'|'info'|'warn'|'error'} */
let globalLevel = 'info';

/**
 * 设置全局日志级别
 * @param {'debug'|'info'|'warn'|'error'} level
 */
const setLogLevel = (level) => {
  if (level in LOG_LEVELS) {
    globalLevel = level;
  }
};

/**
 * 生成短随机请求 ID（8 字符 hex）
 * @returns {string}
 */
const generateRequestId = () => {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * 格式化日志条目为 JSON 字符串
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object} context
 * @returns {string}
 */
const formatEntry = (level, message, context) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  return JSON.stringify(entry);
};

/**
 * 创建带请求上下文的 logger 实例
 * @param {object} [requestContext]
 * @param {string} [requestContext.requestId]
 * @param {string} [requestContext.method]
 * @param {string} [requestContext.url]
 * @returns {Logger}
 */
const createLogger = (requestContext = {}) => {
  const emit = (level, message, extra = {}) => {
    if (LOG_LEVELS[level] < LOG_LEVELS[globalLevel]) {
      return;
    }

    const context = { ...requestContext, ...extra };
    const output = formatEntry(level, message, context);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  };

  return {
    debug: (message, extra) => emit('debug', message, extra),
    info: (message, extra) => emit('info', message, extra),
    warn: (message, extra) => emit('warn', message, extra),
    error: (message, extra) => emit('error', message, extra),

    /**
     * 创建子 logger，继承当前上下文并附加额外字段
     * @param {object} childContext
     * @returns {Logger}
     */
    child: (childContext) => createLogger({ ...requestContext, ...childContext }),
  };
};

/**
 * @typedef {object} Logger
 * @property {(message: string, extra?: object) => void} debug
 * @property {(message: string, extra?: object) => void} info
 * @property {(message: string, extra?: object) => void} warn
 * @property {(message: string, extra?: object) => void} error
 * @property {(childContext: object) => Logger} child
 */

export { createLogger, generateRequestId, setLogLevel, LOG_LEVELS };

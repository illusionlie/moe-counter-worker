import { error } from 'itty-router';
import { createLogger, generateRequestId } from './logger.js';
import { ValidationError } from './errors.js';

/**
 * 请求追踪中间件
 * 为每个请求生成唯一 ID，创建请求级 logger，并记录请求开始
 */
const withRequestTracing = (req) => {
  const requestId = req.headers.get('x-request-id') || generateRequestId();
  const url = new URL(req.url);

  const logger = createLogger({
    requestId,
    method: req.method,
    path: url.pathname,
  });

  // 将 logger 和 requestId 挂载到请求对象上，供后续中间件和处理器使用
  req.logger = logger;
  req.requestId = requestId;
  req.startTime = Date.now();

  logger.info('Request received', {
    query: Object.fromEntries(url.searchParams),
    userAgent: req.headers.get('user-agent') || 'unknown',
  });
};

/**
 * 请求完成日志中间件（作为 response handler 使用）
 * 记录响应状态和耗时
 */
const withResponseLogging = (response, req) => {
  if (req.logger && req.startTime) {
    const duration = Date.now() - req.startTime;
    req.logger.info('Request completed', {
      status: response.status,
      duration: `${duration}ms`,
    });
  }
  return response;
};

/**
 * Counter ID 格式校验中间件
 */
const validateId = (req) => {
  const { id } = req.params;
  if (!/^[a-z0-9:.@_-]{1,32}$/i.test(id)) {
    const err = new ValidationError('Invalid Counter ID', { field: 'id', value: id });
    if (req.logger) {
      req.logger.warn('Validation failed', { field: 'id', value: id });
    }
    return error(400, err.message);
  }
};

export { withRequestTracing, withResponseLogging, validateId };

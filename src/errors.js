/**
 * 自定义错误类型和全局错误处理器
 *
 * 设计原则：
 * - 区分业务错误（可预期）和系统错误（不可预期）
 * - 错误携带 HTTP 状态码和结构化上下文
 * - 全局错误处理器统一记录日志并返回规范化响应
 */

/**
 * 应用级错误基类
 * 用于可预期的业务错误，携带 HTTP 状态码
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {object} options
   * @param {number} [options.status=500] HTTP 状态码
   * @param {string} [options.code] 错误码，用于程序化判断
   * @param {object} [options.context] 附加上下文信息
   */
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', context = {} } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

/**
 * 数据库操作错误
 */
class DatabaseError extends AppError {
  constructor(message, { cause, operation, context = {} } = {}) {
    super(message, {
      status: 503,
      code: 'DATABASE_ERROR',
      context: { operation, ...context },
    });
    this.name = 'DatabaseError';
    this.cause = cause;
  }
}

/**
 * 输入验证错误
 */
class ValidationError extends AppError {
  constructor(message, { field, value } = {}) {
    super(message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      context: { field, value },
    });
    this.name = 'ValidationError';
  }
}

/**
 * 资源未找到错误
 */
class NotFoundError extends AppError {
  constructor(message = 'Not Found', { resource, id } = {}) {
    super(message, {
      status: 404,
      code: 'NOT_FOUND',
      context: { resource, id },
    });
    this.name = 'NotFoundError';
  }
}

/**
 * 将错误对象序列化为可安全记录的 plain object
 * @param {Error} err
 * @returns {object}
 */
const serializeError = (err) => {
  const serialized = {
    name: err.name || 'Error',
    message: err.message,
    stack: err.stack,
  };

  if (err instanceof AppError) {
    serialized.status = err.status;
    serialized.code = err.code;
    serialized.context = err.context;
  }

  if (err.cause) {
    serialized.cause = err.cause instanceof Error ? serializeError(err.cause) : String(err.cause);
  }

  return serialized;
};

/**
 * 全局错误处理器 - 替代 itty-router 的 error()
 * 记录错误日志并返回规范化 JSON 响应
 *
 * @param {Error} err
 * @param {Logger} [logger] - 请求级 logger 实例
 * @returns {Response}
 */
const handleError = (err, logger) => {
  const isAppError = err instanceof AppError;
  const status = isAppError ? err.status : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  // 记录错误日志
  if (logger) {
    const logData = { error: serializeError(err) };

    if (status >= 500) {
      // 系统错误 - error 级别，包含完整堆栈
      logger.error(`Unhandled error: ${err.message}`, logData);
    } else if (status >= 400) {
      // 客户端错误 - warn 级别
      logger.warn(`Client error: ${err.message}`, logData);
    }
  }

  // 构建响应体 - 生产环境不暴露内部错误细节
  const body = {
    error: {
      code,
      message: isAppError ? err.message : 'Internal Server Error',
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

export { AppError, DatabaseError, ValidationError, NotFoundError, serializeError, handleError };

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  serializeError,
  handleError,
} from '../src/errors.js';

test('AppError 默认状态码 500 / 默认 code INTERNAL_ERROR / context 空对象', () => {
  const err = new AppError('boom');
  assert.equal(err.status, 500);
  assert.equal(err.code, 'INTERNAL_ERROR');
  assert.deepEqual(err.context, {});
  assert.equal(err.name, 'AppError');
  assert.equal(err.message, 'boom');
});

test('AppError 可自定义 status/code/context', () => {
  const err = new AppError('nope', { status: 418, code: 'IM_A_TEAPOT', context: { a: 1 } });
  assert.equal(err.status, 418);
  assert.equal(err.code, 'IM_A_TEAPOT');
  assert.deepEqual(err.context, { a: 1 });
});

test('DatabaseError 映射到 503 / DATABASE_ERROR，携带 cause 与 operation', () => {
  const cause = new Error('d1 down');
  const err = new DatabaseError('写失败', { cause, operation: 'setNum', context: { counterId: 'x' } });
  assert.equal(err.status, 503);
  assert.equal(err.code, 'DATABASE_ERROR');
  assert.equal(err.operation, undefined); // operation 进了 context，不是自有字段
  assert.equal(err.context.operation, 'setNum');
  assert.equal(err.context.counterId, 'x');
  assert.equal(err.cause, cause);
  assert.equal(err.name, 'DatabaseError');
});

test('ValidationError 映射到 400 / VALIDATION_ERROR，携带 field+value', () => {
  const err = new ValidationError('Invalid Counter ID', { field: 'id', value: '!!' });
  assert.equal(err.status, 400);
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.equal(err.context.field, 'id');
  assert.equal(err.context.value, '!!');
});

test('NotFoundError 默认 message "Not Found"、404、携带 resource/id', () => {
  const err = new NotFoundError(undefined, { resource: 'theme', id: 'nope' });
  assert.equal(err.status, 404);
  assert.equal(err.code, 'NOT_FOUND');
  assert.equal(err.message, 'Not Found');
  assert.equal(err.context.resource, 'theme');
  assert.equal(err.context.id, 'nope');
});

test('serializeError 包含 name/message/stack，AppError 额外含 status/code/context', () => {
  const err = new ValidationError('bad', { field: 'id', value: 'z' });
  const s = serializeError(err);
  assert.equal(s.name, 'ValidationError');
  assert.equal(s.message, 'bad');
  assert.equal(typeof s.stack, 'string');
  assert.equal(s.status, 400);
  assert.equal(s.code, 'VALIDATION_ERROR');
  assert.deepEqual(s.context, { field: 'id', value: 'z' });
});

test('serializeError 递归序列化 cause 链', () => {
  const root = new Error('root');
  const wrapped = new DatabaseError('wrapped', { cause: root, operation: 'getNum' });
  const s = serializeError(wrapped);
  assert.equal(s.cause.name, 'Error');
  assert.equal(s.cause.message, 'root');
  // 非 Error 的 cause 走 String()
  const w2 = new DatabaseError('x', { cause: { raw: 1 }, operation: 'x' });
  assert.equal(serializeError(w2).cause, '[object Object]');
  assert.equal(typeof serializeError(w2).cause, 'string');
});

test('handleError 对 AppError 返回规范 JSON 响应', async () => {
  const err = new ValidationError('Invalid Counter ID', { field: 'id', value: '!!' });
  const res = handleError(err);
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = await res.json();
  assert.deepEqual(body, { error: { code: 'VALIDATION_ERROR', message: 'Invalid Counter ID' } });
});

test('handleError 对非 AppError 走 500 并隐藏内部细节', () => {
  const res = handleError(new Error('secret stack leak'));
  assert.equal(res.status, 500);
  // 用同步 json 解析：Response.json() 是 async，这里 body 不大，用 text 后手解析
  return res.text().then((text) => {
    const body = JSON.parse(text);
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.equal(body.error.message, 'Internal Server Error');
  });
});

test('handleError 按状态码选择日志级别：4xx warn / 5xx error', () => {
  const calls = [];
  const logger = { warn: (m, e) => calls.push(['warn', m, e]), error: (m, e) => calls.push(['error', m, e]) };

  handleError(new ValidationError('bad'), logger);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'warn');
  assert.equal(calls[0][2].error.code, 'VALIDATION_ERROR');

  handleError(new Error('boom'), logger);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], 'error');
  assert.equal(calls[1][2].error.name, 'Error');
});

test('handleError 无 logger 时不抛错', () => {
  const res = handleError(new ValidationError('bad', { field: 'id', value: 1 }));
  assert.equal(res.status, 400);
});
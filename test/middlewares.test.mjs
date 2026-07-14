import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLogLevel } from '../src/logger.js';
import { withRequestTracing, withResponseLogging, validateId } from '../src/middlewares.js';

/** 构造一个最小可用的 itty-router 请求 mock */
const makeReq = ({ id = 'valid-id', method = 'GET', url = 'https://test.local/@valid-id', userAgent = 'fake-ua/1.0', requestId } = {}) => ({
  params: { id },
  method,
  url,
  headers: {
    get(name) {
      const n = name.toLowerCase();
      if (n === 'x-request-id') return requestId ?? null;
      if (n === 'user-agent') return userAgent;
      return null;
    },
  },
});

test('validateId: 合法 id 返回 undefined（放行）', () => {
  for (const id of ['abc', '123', '@a:b.c-d_e', 'CAPS', 'a'.repeat(32)]) {
    const req = makeReq({ id });
    assert.equal(validateId(req), undefined, `expected pass for id=${id}`);
  }
});

test('validateId: 非法 id 返回 400 Response', async () => {
  for (const id of ['', '!!', 'a b', 'a'.repeat(33)]) {
    const req = makeReq({ id });
    const ret = validateId(req);
    assert.ok(ret, `expected error for id=${JSON.stringify(id)}`);
    assert.equal(ret.status, 400);
    assert.equal(ret.headers.get('content-type'), 'application/json; charset=utf-8');
    const body = await ret.json();
    assert.match(String(body.error), /Invalid Counter ID/);
  }
});

test('validateId: 允许的字符集覆盖数字/字母/:.@_-', () => {
  const req = makeReq({ id: 'github:moe-counter_v1.0@main' });
  assert.equal(validateId(req), undefined);
});

test('validateId: 中文 / 空格 / 超长一律拒绝', () => {
  assert.ok(validateId(makeReq({ id: '测试' })));
  assert.ok(validateId(makeReq({ id: 'has space' })));
  assert.ok(validateId(makeReq({ id: 'x'.repeat(33) })));
});

/** 劫持 console.info 抓 withRequestTracing 的入口日志 */
const spyConsoleInfo = (fn) => {
  const orig = console.info;
  const lines = [];
  console.info = (m) => lines.push(m);
  try {
    return fn(lines);
  } finally {
    console.info = orig;
  }
};

test('withRequestTracing: 挂载 logger/requestId/startTime 并记入口日志', () => {
  setLogLevel('info');
  spyConsoleInfo((lines) => {
    const req = makeReq({ url: 'https://test.local/@demo?theme=moebooru' });
    assert.equal(req.logger, undefined); // 调用前没有

    withRequestTracing(req);

    assert.ok(req.logger && typeof req.logger.info === 'function');
    assert.match(req.requestId, /^[0-9a-f]{8}$/);
    assert.equal(typeof req.startTime, 'number');

    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.message, 'Request received');
    assert.equal(entry.method, 'GET');
    assert.equal(entry.path, '/@demo');
    assert.equal(entry.query.theme, 'moebooru');
    assert.equal(entry.userAgent, 'fake-ua/1.0');
  });
});

test('withRequestTracing: 优先采用上游 x-request-id', () => {
  setLogLevel('info');
  spyConsoleInfo(() => {
    const req = makeReq({ requestId: 'upstream-123' });
    withRequestTracing(req);
    assert.equal(req.requestId, 'upstream-123');
  });
});

test('withResponseLogging: 记录状态码+耗时并原样返回 response', () => {
  const calls = [];
  const req = { startTime: Date.now() - 42, logger: { info: (m, e) => calls.push([m, e]) } };
  const response = new Response('ok', { status: 200 });

  const ret = withResponseLogging(response, req);

  assert.equal(ret, response); // 原样返回
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'Request completed');
  assert.equal(calls[0][1].status, 200);
  assert.match(calls[0][1].duration, /^\d+ms$/);
});

test('withResponseLogging: 无 logger/time 时静默不抛', () => {
  const response = new Response(null, { status: 404 });
  const ret = withResponseLogging(response, {});
  assert.equal(ret, response);
});
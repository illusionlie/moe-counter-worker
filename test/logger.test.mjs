import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, generateRequestId, setLogLevel, LOG_LEVELS } from '../src/logger.js';

/** 临时劫持 console.* 的辅助，结束后还原 */
const withConsoleSpy = (fn) => {
  const spies = [];
  const levels = ['debug', 'info', 'warn', 'error'];
  const originals = levels.map((l) => console[l]);
  const records = {};
  levels.forEach((l) => {
    records[l] = [];
    console[l] = (msg) => records[l].push(msg);
    spies.push({ l });
  });
  try {
    return fn(records);
  } finally {
    levels.forEach((l, i) => (console[l] = originals[i]));
  }
};

test('generateRequestId 返回 8 位 hex', () => {
  const id = generateRequestId();
  assert.match(id, /^[0-9a-f]{8}$/);

  // 唯一性抽查
  const ids = new Set(Array.from({ length: 50 }, generateRequestId));
  assert.equal(ids.size, 50);
});

test('LOG_LEVELS 优先级 debug<info<warn<error', () => {
  assert.equal(LOG_LEVELS.debug, 0);
  assert.equal(LOG_LEVELS.info, 1);
  assert.equal(LOG_LEVELS.warn, 2);
  assert.equal(LOG_LEVELS.error, 3);
});

test('createLogger 返回完整接口', () => {
  const log = createLogger({ requestId: 'r1' });
  for (const m of ['debug', 'info', 'warn', 'error']) {
    assert.equal(typeof log[m], 'function');
  }
  assert.equal(typeof log.child, 'function');
});

test('logger 默认级别 info：suppress debug，emit info', () => {
  setLogLevel('info');
  withConsoleSpy((rec) => {
    const log = createLogger({ requestId: 'r2' });
    log.debug('d', { x: 1 });
    log.info('i', { y: 2 });
    assert.equal(rec.debug.length, 0); // 被过滤
    assert.equal(rec.info.length, 1);

    const entry = JSON.parse(rec.info[0]);
    assert.equal(entry.level, 'info');
    assert.equal(entry.message, 'i');
    assert.equal(entry.requestId, 'r2');
    assert.equal(entry.y, 2);
  });
});

test('setLogLevel 可过滤掉 info', () => {
  setLogLevel('warn');
  withConsoleSpy((rec) => {
    const log = createLogger();
    log.info('should be hidden');
    log.warn('should pass', { a: 1 });
    assert.equal(rec.info.length, 0);
    assert.equal(rec.warn.length, 1);
  });
  setLogLevel('info'); // 还原默认
});

test('error 级别总是输出', () => {
  setLogLevel('error');
  withConsoleSpy((rec) => {
    const log = createLogger();
    log.warn('hidden');
    log.error('boom', { code: 'X' });
    assert.equal(rec.warn.length, 0);
    assert.equal(rec.error.length, 1);
    const entry = JSON.parse(rec.error[0]);
    assert.equal(entry.code, 'X');
  });
  setLogLevel('info');
});

test('child logger 继承父上下文并叠加字段', () => {
  setLogLevel('info');
  withConsoleSpy((rec) => {
    const parent = createLogger({ requestId: 'r3', method: 'GET' });
    const child = parent.child({ phase: 'db' });
    child.info('write', { op: 'setNum' });

    const entry = JSON.parse(rec.info[0]);
    assert.equal(entry.requestId, 'r3'); // 继承
    assert.equal(entry.method, 'GET'); // 继承
    assert.equal(entry.phase, 'db'); // 叠加
    assert.equal(entry.op, 'setNum'); // 本次 extra
    assert.equal(entry.message, 'write');
  });
});

test('每条日志都带 ISO timestamp', () => {
  withConsoleSpy((rec) => {
    const log = createLogger();
    log.info('t');
    const entry = JSON.parse(rec.info[0]);
    assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
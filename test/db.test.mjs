import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNum, setNum, incrementCounter } from '../src/db.js';
import { DatabaseError } from '../src/errors.js';

/**
 * 构造一个可控的 D1 mock。
 * 每个 case 可校验 prepare 的 SQL、bind 的参数，并控制 first/run 的返回或抛错。
 */
const makeD1 = (opts = {}) => {
  const calls = [];
  const db = {
    prepare(sql) {
      calls.push(['prepare', sql]);
      return {
        bind(...args) {
          calls.push(['bind', args]);
          return {
            async first(col) {
              if (opts.throwOn === 'first') throw new Error(opts.throwMsg ?? 'd1 read fail');
              const row = opts.firstRow;
              return col && row ? row[col] : row;
            },
            async run() {
              if (opts.throwOn === 'run') throw new Error(opts.throwMsg ?? 'd1 write fail');
              calls.push(['run', { success: true }]);
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, calls };
};

test('getNum: 行存在时返回 num 字段', async () => {
  const { db, calls } = makeD1({ firstRow: { num: 42 } });
  const num = await getNum(db, 'counter-a');
  assert.equal(num, 42);
  assert.equal(calls[0][0], 'prepare');
  assert.match(calls[0][1], /SELECT num FROM view WHERE id = \?/);
  assert.deepEqual(calls[1], ['bind', ['counter-a']]);
});

test('getNum: first 返回 null/undefined 时归一化为 0', async () => {
  const { db } = makeD1({ firstRow: null });
  const num = await getNum(db, 'missing-id');
  assert.equal(num, 0);
});

test('getNum: SELECT 整行（无 num 列名）返回 falsy 时也为 0', async () => {
  const { db } = makeD1({ firstRow: undefined });
  assert.equal(await getNum(db, 'x'), 0);
});

test('getNum: prepare/first 抛错时包装成 DatabaseError(503)', async () => {
  const { db } = makeD1({ throwOn: 'first', throwMsg: 'connection lost' });
  await assert.rejects(
    () => getNum(db, 'counter-a'),
    (err) => {
      assert.ok(err instanceof DatabaseError);
      assert.equal(err.status, 503);
      assert.equal(err.code, 'DATABASE_ERROR');
      assert.equal(err.context.operation, 'getNum');
      assert.equal(err.context.counterId, 'counter-a');
      assert.equal(err.cause.message, 'connection lost');
      return true;
    },
  );
});

test('setNum: 用 upsert 写入（INSERT ... ON CONFLICT ... DO UPDATE）', async () => {
  const { db, calls } = makeD1();
  await setNum(db, 'counter-b', 99);
  assert.match(calls[0][1], /INSERT INTO view \(id, num\) VALUES \(\?1, \?2\)/);
  assert.match(calls[0][1], /ON CONFLICT \(id\) DO UPDATE SET num = \?2/);
  assert.deepEqual(calls[1], ['bind', ['counter-b', 99]]);
  assert.deepEqual(calls[2], ['run', { success: true }]);
});

test('setNum: run 抛错时包装成 DatabaseError，context 含 value', async () => {
  const { db } = makeD1({ throwOn: 'run', throwMsg: 'disk full' });
  await assert.rejects(
    () => setNum(db, 'counter-b', 7),
    (err) => {
      assert.ok(err instanceof DatabaseError);
      assert.equal(err.status, 503);
      assert.equal(err.code, 'DATABASE_ERROR');
      assert.equal(err.context.operation, 'setNum');
      assert.equal(err.context.counterId, 'counter-b');
      assert.equal(err.context.value, 7);
      assert.equal(err.cause.message, 'disk full');
      return true;
    },
  );
});

test('incrementCounter: 走单条 UPSERT+RETURNING，SQL 含 num = num + 1 与 RETURNING num', async () => {
  const { db, calls } = makeD1({ firstRow: { num: 42 } });
  const num = await incrementCounter(db, 'counter-c');
  assert.equal(num, 42);
  assert.match(calls[0][1], /INSERT INTO view \(id, num\) VALUES \(\?1, 1\)/);
  assert.match(calls[0][1], /ON CONFLICT \(id\) DO UPDATE SET num = num \+ 1/);
  assert.match(calls[0][1], /RETURNING num/);
  assert.deepEqual(calls[1], ['bind', ['counter-c']]);
  assert.equal(calls.length, 2); // 只有 prepare + bind，不再有 run（路径走 first）
});

test('incrementCounter: first 返回 null/undefined 时兜底为 1', async () => {
  assert.equal(await incrementCounter(makeD1({ firstRow: null }).db, 'x'), 1);
  assert.equal(await incrementCounter(makeD1({ firstRow: undefined }).db, 'x'), 1);
});

test('incrementCounter: first 返回 0 时原样保留（?? 仅兜底 null/undefined，非 falsy）', async () => {
  // 语义边界：用 ?? 而非 ||，所以 0 不会被瘦足为 1。
  // 实际 RETURNING 不会产生 0（首次 INSERT num=1，UPDATE num+1），此例固化边界语义。
  const { db } = makeD1({ firstRow: { num: 0 } });
  assert.equal(await incrementCounter(db, 'x'), 0);
});

test('incrementCounter: prepare/first 抛错时包装成 DatabaseError(503)，无 value 字段', async () => {
  const { db } = makeD1({ throwOn: 'first', throwMsg: 'write conflict' });
  await assert.rejects(
    () => incrementCounter(db, 'counter-c'),
    (err) => {
      assert.ok(err instanceof DatabaseError);
      assert.equal(err.status, 503);
      assert.equal(err.code, 'DATABASE_ERROR');
      assert.equal(err.context.operation, 'incrementCounter');
      assert.equal(err.context.counterId, 'counter-c');
      assert.equal(err.context.value, undefined); // 与 setNum不同：这里不带 value
      assert.equal(err.cause.message, 'write conflict');
      return true;
    },
  );
});
import { DatabaseError } from './errors.js';

/**
 * 获取计数器当前值
 * @param {D1Database} db
 * @param {string} id
 * @param {Logger} [logger]
 * @returns {Promise<number>}
 */
const getNum = async (db, id, logger) => {
  try {
    const stmt = db.prepare('SELECT num FROM view WHERE id = ?').bind(id);
    const num = await stmt.first('num');
    return num || 0;
  } catch (err) {
    if (logger) {
      logger.debug('Database read failed', {
        operation: 'getNum',
        counterId: id,
      });
    }
    throw new DatabaseError('Failed to read counter value', {
      cause: err,
      operation: 'getNum',
      context: { counterId: id },
    });
  }
};

/**
 * 设置计数器值（upsert）
 *
 * 注意：这是一次「写」操作，不读回原值。counterHandler 的自增路径应使用
 * `incrementCounter`（单条原子），这里保留用于手动覆写计数场景。
 *
 * @param {D1Database} db
 * @param {string} id
 * @param {number} num
 * @param {Logger} [logger]
 * @returns {Promise<void>}
 */
const setNum = async (db, id, num, logger) => {
  try {
    const stmt = db
      .prepare('INSERT INTO view (id, num) VALUES (?1, ?2) ON CONFLICT (id) DO UPDATE SET num = ?2')
      .bind(id, num);
    await stmt.run();
  } catch (err) {
    if (logger) {
      logger.debug('Database write failed', {
        operation: 'setNum',
        counterId: id,
        value: num,
      });
    }
    throw new DatabaseError('Failed to write counter value', {
      cause: err,
      operation: 'setNum',
      context: { counterId: id, value: num },
    });
  }
};

/**
 * 原子自增计数器：单条 UPSERT + RETURNING，消除 read-modify-write 竞态
 *
 * 首次写入 num=1；已存在则 `num = num + 1`。SQLite 行级写锁保证自增原子，
 * `RETURNING num` 直接取回更新后的值，高并发下不丢计数。
 *
 * @param {D1Database} db
 * @param {string} id
 * @param {Logger} [logger]
 * @returns {Promise<number>}
 */
const incrementCounter = async (db, id, logger) => {
  try {
    const num = await db
      .prepare('INSERT INTO view (id, num) VALUES (?1, 1) ON CONFLICT (id) DO UPDATE SET num = num + 1 RETURNING num')
      .bind(id)
      .first('num');
    return num ?? 1;
  } catch (err) {
    if (logger) {
      logger.debug('Database increment failed', {
        operation: 'incrementCounter',
        counterId: id,
      });
    }
    throw new DatabaseError('Failed to increment counter', {
      cause: err,
      operation: 'incrementCounter',
      context: { counterId: id },
    });
  }
};

export { getNum, setNum, incrementCounter };

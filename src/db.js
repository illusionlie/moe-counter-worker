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

export { getNum, setNum };

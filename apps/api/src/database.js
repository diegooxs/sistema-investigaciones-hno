import mariadb from 'mariadb';
import { config } from './config.js';

export function createDatabasePool(overrides = {}) {
  return mariadb.createPool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
    connectionLimit: config.db.connectionLimit,
    bigIntAsNumber: true,
    insertIdAsNumber: true,
    ...overrides
  });
}

export async function closeDatabasePool(pool) {
  if (pool) await pool.end();
}

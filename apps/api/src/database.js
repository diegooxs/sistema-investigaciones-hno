import mariadb from 'mariadb';
import { config } from './config.js';

export function createDatabasePool(overrides = {}) {
  const options = {
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
    connectionLimit: config.db.connectionLimit,
    bigIntAsNumber: true,
    insertIdAsNumber: true,
    ...overrides
  };
  if (config.db.ssl && options.ssl === undefined) options.ssl = true;
  return mariadb.createPool(options);
}

export async function closeDatabasePool(pool) {
  if (pool) await pool.end();
}

import { createApp } from './app.js';
import { config, validateProductionConfig } from './config.js';
import { createMariaDbStore } from './mariadb-store.js';

const store = createMariaDbStore();

try {
  validateProductionConfig();
  await store.health();
  const app = createApp({ store });
  const server = app.listen(config.port, () => {
    console.log(`API HNO disponible en http://localhost:${config.port} con MariaDB`);
  });
  const shutdown = async () => {
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error('No fue posible conectar con MariaDB. Revisa .env y ejecuta pnpm db:up.', error.message);
  await store.close().catch(() => {});
  process.exit(1);
}

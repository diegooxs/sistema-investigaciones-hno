import { config as loadEnv } from 'dotenv';

loadEnv({ path: new URL('../../../.env', import.meta.url) });

export const config = Object.freeze({
  port: Number(process.env.API_PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'solo-desarrollo-cambiar-esta-clave',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  environment: process.env.NODE_ENV ?? 'development',
  db: Object.freeze({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    name: process.env.DB_NAME ?? 'hno_investigaciones',
    user: process.env.DB_USER ?? 'hno_app',
    password: process.env.DB_PASSWORD ?? 'cambiar_en_desarrollo',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5)
  })
});

export function validateProductionConfig() {
  if (config.environment !== 'production') return;
  const problems = [];
  if (config.jwtSecret.length < 32 || config.jwtSecret.includes('cambiar')) problems.push('JWT_SECRET debe ser una clave aleatoria de al menos 32 caracteres');
  if (!config.webOrigin.startsWith('https://')) problems.push('WEB_ORIGIN debe utilizar HTTPS');
  if (!config.db.password || config.db.password.includes('cambiar') || config.db.password === 'Admin2027') problems.push('DB_PASSWORD debe reemplazarse por una contraseña segura');
  if (problems.length) throw new Error(`Configuración de producción inválida: ${problems.join('; ')}`);
}

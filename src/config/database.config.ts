import { registerAs } from '@nestjs/config';

/**
 * Configuración de base de datos.
 * Usa las mismas variables que Laravel (DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD)
 * para poder compartir la misma base de datos "flux".
 */
export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'flux',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'flux',
  dialect: 'postgres' as const,
  logging: process.env.DB_LOGGING === 'true',
  autoLoadModels: true,
  synchronize: false, // Tables/schemas created by Laravel migrations
}));

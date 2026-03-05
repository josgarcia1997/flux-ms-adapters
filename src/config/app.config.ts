import { registerAs } from '@nestjs/config';

/**
 * Tenant fijo para todas las peticiones del microservicio.
 * No se recibe por parámetro; se usa siempre este valor.
 */
export default registerAs('app', () => ({
  tenantId: process.env.TENANT_ID ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
}));

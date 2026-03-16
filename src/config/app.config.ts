import { registerAs } from '@nestjs/config';

/**
 * Tenant fijo para todas las peticiones del microservicio.
 * No se recibe por parámetro; se usa siempre este valor.
 */
export default registerAs('app', () => ({
  tenantId: process.env.TENANT_ID ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  oauthClientId: process.env.OAUTH_CLIENT_ID ? parseInt(process.env.OAUTH_CLIENT_ID, 10) : 1,
  /** Base URL del orquestador (ej. http://localhost:8080). Lee de .env ORCHESTRATOR_URL. */
  orchestratorUrl: process.env.ORCHESTRATOR_URL ?? 'http://localhost:8080',
  /** URL completa para onboarding wallet-ledger. Si no hay WALLET_LEDGER_URL, se construye con orchestratorUrl + /api/v1/wallet-ledger/onboard. */
  walletLedgerUrl:
    process.env.WALLET_LEDGER_URL ??
    `${(process.env.ORCHESTRATOR_URL ?? 'http://localhost:8080').replace(/\/$/, '')}/api/v1/wallet-ledger/onboard`,
}));

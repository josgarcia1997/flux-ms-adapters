import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Proporciona el tenant ID fijo para todas las peticiones.
 * Valor definido en TENANT_ID (env), no por parámetro.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly configService: ConfigService) {}

  getTenantId(): string {
    const id = this.configService.get<string>('app.tenantId');
    if (!id) {
      throw new Error('TENANT_ID no está configurado. Defina la variable de entorno TENANT_ID.');
    }
    return id;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';

export interface CreateTokenPairResult {
  accessTokenId: string;
}

export interface FindByRefreshTokenHashResult {
  userId: string;
  accessTokenId: string;
}

@Injectable()
export class OAuthTokenRepository {
  constructor(
    @InjectModel(OAuthAccessToken)
    private readonly accessTokenModel: typeof OAuthAccessToken,
    @InjectModel(OAuthRefreshToken)
    private readonly refreshTokenModel: typeof OAuthRefreshToken,
  ) {}

  /** Genera un id para oauth_access_tokens (string ≤100 caracteres). */
  generateAccessTokenId(): string {
    return require('crypto').randomBytes(50).toString('hex');
  }

  /**
   * Crea una fila en oauth_access_tokens y otra en oauth_refresh_tokens (tablas sin schema = public, como Laravel).
   * refreshTokenHash debe ser el hash (ej. SHA256 hex) del token que se devuelve al cliente.
   */
  async createTokenPair(
    userId: string,
    refreshTokenHash: string,
    refreshExpiresAt: Date,
    clientId: number,
  ): Promise<CreateTokenPairResult> {
    const accessTokenId = this.generateAccessTokenId();
    const sequelize = this.accessTokenModel.sequelize;
    if (!sequelize) throw new Error('Sequelize not available');
    await sequelize.query(
      `INSERT INTO oauth_access_tokens (id, user_id, client_id, name, scopes, revoked, created_at, updated_at, expires_at)
       VALUES (:id, :userId, :clientId, NULL, NULL, false, NOW(), NOW(), NULL)`,
      {
        replacements: { id: accessTokenId, userId, clientId },
        type: QueryTypes.RAW,
      },
    );
    await sequelize.query(
      `INSERT INTO oauth_refresh_tokens (id, access_token_id, revoked, expires_at)
       VALUES (:id, :accessTokenId, false, :expiresAt)`,
      {
        replacements: { id: refreshTokenHash, accessTokenId, expiresAt: refreshExpiresAt },
        type: QueryTypes.RAW,
      },
    );
    return { accessTokenId };
  }

  /**
   * Busca por hash del refresh token usando SQL crudo (mismas tablas que Laravel: public.oauth_*).
   */
  async findByRefreshTokenHash(hash: string): Promise<FindByRefreshTokenHashResult | null> {
    const sequelize = this.refreshTokenModel.sequelize;
    if (!sequelize) return null;
    const rows = await sequelize.query<{ user_id: string; access_token_id: string }>(
      `SELECT a.user_id, r.access_token_id
       FROM oauth_refresh_tokens r
       INNER JOIN oauth_access_tokens a ON a.id = r.access_token_id
       WHERE r.id = :hash AND r.revoked = false
         AND (r.expires_at IS NULL OR r.expires_at > NOW())
         AND a.revoked = false AND a.user_id IS NOT NULL
       LIMIT 1`,
      { replacements: { hash }, type: QueryTypes.SELECT },
    );
    const row = rows?.[0];
    if (!row?.user_id || !row?.access_token_id) return null;
    return { userId: row.user_id, accessTokenId: row.access_token_id };
  }

  /**
   * Revoca un access token y su refresh token asociado (logout o rotación).
   */
  async revokeByAccessTokenId(accessTokenId: string): Promise<void> {
    await this.refreshTokenModel.update({ revoked: true }, { where: { accessTokenId } });
    await this.accessTokenModel.update({ revoked: true }, { where: { id: accessTokenId } });
  }

  /**
   * Revoca el refresh token con este access_token_id (para rotación en refresh).
   */
  async revokeRefreshTokenByAccessTokenId(accessTokenId: string): Promise<void> {
    await this.refreshTokenModel.update({ revoked: true }, { where: { accessTokenId } });
  }
}

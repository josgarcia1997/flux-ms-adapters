import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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
   * Crea una fila en oauth_access_tokens y otra en oauth_refresh_tokens.
   * refreshTokenHash debe ser el hash (ej. SHA256 hex) del token que se devuelve al cliente.
   */
  async createTokenPair(
    userId: string,
    refreshTokenHash: string,
    refreshExpiresAt: Date,
    clientId: number,
  ): Promise<CreateTokenPairResult> {
    const accessTokenId = this.generateAccessTokenId();
    await this.accessTokenModel.create({
      id: accessTokenId,
      userId,
      clientId,
      name: null,
      scopes: null,
      revoked: false,
      expiresAt: null,
    } as any);
    await this.refreshTokenModel.create({
      id: refreshTokenHash,
      accessTokenId,
      revoked: false,
      expiresAt: refreshExpiresAt,
    } as any);
    return { accessTokenId };
  }

  /**
   * Busca por hash del refresh token. Devuelve userId y accessTokenId si es válido (no revocado, no expirado).
   */
  async findByRefreshTokenHash(hash: string): Promise<FindByRefreshTokenHashResult | null> {
    const refresh = await this.refreshTokenModel.findOne({
      where: { id: hash, revoked: false, expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: OAuthAccessToken, as: 'accessToken', required: true }],
    });
    if (!refresh?.accessToken || (refresh.accessToken as OAuthAccessToken).revoked) return null;
    const access = refresh.accessToken as OAuthAccessToken;
    if (!access.userId) return null;
    return { userId: access.userId, accessTokenId: access.id };
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

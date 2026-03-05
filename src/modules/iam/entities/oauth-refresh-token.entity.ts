import { Table, Column, Model, PrimaryKey, ForeignKey, BelongsTo } from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { OAuthAccessToken } from './oauth-access-token.entity';

/**
 * Tabla oauth_refresh_tokens (compatible con Laravel Passport).
 * id = hash del refresh token (SHA256 hex). access_token_id → oauth_access_tokens.id.
 */
@Table({ tableName: 'oauth_refresh_tokens', underscored: true, timestamps: false })
export class OAuthRefreshToken extends Model {
  @PrimaryKey
  @Column(DataTypes.STRING(100))
  declare id: string;

  @ForeignKey(() => OAuthAccessToken)
  @Column(DataTypes.STRING(100))
  declare accessTokenId: string;

  @Column(DataTypes.BOOLEAN)
  declare revoked: boolean;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare expiresAt: Date | null;

  @BelongsTo(() => OAuthAccessToken)
  accessToken: OAuthAccessToken;
}

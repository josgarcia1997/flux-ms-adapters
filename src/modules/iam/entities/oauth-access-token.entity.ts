import {
  Table,
  Column,
  Model,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { User } from './user.entity';

/**
 * Tabla oauth_access_tokens (compatible con Laravel Passport).
 * Una fila por "sesión" de login; el id se lleva en el JWT como sessionId para logout.
 */
@Table({ tableName: 'oauth_access_tokens', underscored: true })
export class OAuthAccessToken extends Model {
  @PrimaryKey
  @Column(DataTypes.STRING(100))
  declare id: string;

  @ForeignKey(() => User)
  @Column({ type: DataTypes.UUID, allowNull: true })
  declare userId: string | null;

  @Column(DataTypes.BIGINT)
  declare clientId: number;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare name: string | null;

  @Column({ type: DataTypes.TEXT, allowNull: true })
  declare scopes: string | null;

  @Column(DataTypes.BOOLEAN)
  declare revoked: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare expiresAt: Date | null;

  @BelongsTo(() => User)
  user: User;
}

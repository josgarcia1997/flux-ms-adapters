import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { User } from './user.entity';

@Table({ tableName: 'sessions', schema: 'iam', underscored: true })
export class Session extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @Column(DataTypes.UUID)
  declare userId: string;

  @Column(DataTypes.STRING(255))
  declare refreshTokenHash: string;

  @Column(DataTypes.DATE)
  declare expiresAt: Date;

  @Column({ type: DataTypes.STRING(64), allowNull: true })
  declare ipAddress: string | null;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare userAgent: string | null;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: true })
  declare isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => User)
  user: User;
}

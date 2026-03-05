import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
} from 'sequelize-typescript';
import { User } from './user.entity';
const DataTypes = require('sequelize').DataTypes;

@Table({ tableName: 'tenants', schema: 'tenant', underscored: true })
export class Tenant extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @Column(DataTypes.STRING(150))
  declare name: string;

  @Column(DataTypes.STRING(80))
  declare code: string;

  @Column({ type: DataTypes.STRING(30), defaultValue: 'active' })
  declare status: string;

  @Column({ type: DataTypes.STRING(30), defaultValue: 'free' })
  declare plan: string;

  @Column({ type: DataTypes.STRING(64), defaultValue: 'America/Bogota' })
  declare timezone: string;

  @Column({ type: DataTypes.STRING(2), allowNull: true })
  declare country: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @HasMany(() => User)
  users: User[];
}

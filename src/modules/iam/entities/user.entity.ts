import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Tenant } from './tenant.entity';
import { Role } from './role.entity';
import { UserRole } from './user-role.entity';

@Table({ tableName: 'users', schema: 'iam', underscored: true, paranoid: true })
export class User extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @ForeignKey(() => Tenant)
  @Column(DataTypes.UUID)
  declare tenantId: string;

  @Column(DataTypes.STRING(190))
  declare email: string;

  @Column({ type: DataTypes.STRING(80), allowNull: true })
  declare username: string | null;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare passwordHash: string | null;

  @Column({ type: DataTypes.STRING(30), defaultValue: 'active' })
  declare status: string;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare pinHash: string | null;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare lastLoginAt: Date | null;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare termsAcceptedAt: Date | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @DeletedAt
  declare deletedAt: Date | null;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsToMany(() => Role, () => UserRole)
  roles: Role[];
}

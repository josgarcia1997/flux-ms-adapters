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
  BelongsToMany,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Tenant } from './tenant.entity';
import { Permission } from './permission.entity';
import { RolePermission } from './role-permission.entity';
import { User } from './user.entity';
import { UserRole } from './user-role.entity';

@Table({ tableName: 'roles', schema: 'iam', underscored: true })
export class Role extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @ForeignKey(() => Tenant)
  @Column(DataTypes.UUID)
  declare tenantId: string;

  @Column(DataTypes.STRING(80))
  declare name: string;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare description: string | null;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: false })
  declare isSystem: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => Tenant)
  tenant: Tenant;

  @BelongsToMany(() => Permission, () => RolePermission)
  permissions: Permission[];

  @BelongsToMany(() => User, () => UserRole)
  users: User[];
}

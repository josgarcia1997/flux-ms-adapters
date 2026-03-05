import {
  Table,
  Column,
  Model,
  ForeignKey,
  PrimaryKey,
  CreatedAt,
} from 'sequelize-typescript';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Table({ tableName: 'role_permissions', schema: 'iam', underscored: true, timestamps: true, updatedAt: false })
export class RolePermission extends Model {
  @Column
  declare tenantId: string;

  @PrimaryKey
  @ForeignKey(() => Role)
  @Column
  declare roleId: string;

  @PrimaryKey
  @ForeignKey(() => Permission)
  @Column
  declare permissionId: string;

  @CreatedAt
  declare createdAt: Date;
}

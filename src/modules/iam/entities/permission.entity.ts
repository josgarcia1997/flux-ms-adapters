import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  BelongsToMany,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';

@Table({ tableName: 'permissions', schema: 'iam', underscored: true })
export class Permission extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @Column(DataTypes.STRING(140))
  declare key: string;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare description: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsToMany(() => Role, () => RolePermission)
  roles: Role[];
}

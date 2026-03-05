import {
  Table,
  Column,
  Model,
  ForeignKey,
  PrimaryKey,
  CreatedAt,
} from 'sequelize-typescript';
import { User } from './user.entity';
import { Role } from './role.entity';

@Table({ tableName: 'user_roles', schema: 'iam', underscored: true, timestamps: true, updatedAt: false })
export class UserRole extends Model {
  @Column
  declare tenantId: string;

  @PrimaryKey
  @ForeignKey(() => User)
  @Column
  declare userId: string;

  @PrimaryKey
  @ForeignKey(() => Role)
  @Column
  declare roleId: string;

  @CreatedAt
  declare createdAt: Date;
}

import { Table, Column, Model, PrimaryKey, CreatedAt } from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;

/**
 * Tabla password_resets (misma que Laravel para forgot-password).
 * Se usa también para OTP de registro: mismo formato (email, token hash, created_at).
 * Si tu migración tiene tenant_id o purpose, indícalo para adaptar las búsquedas.
 */
@Table({ tableName: 'password_resets', underscored: true, timestamps: true, updatedAt: false })
export class PasswordReset extends Model {
  @PrimaryKey
  @Column(DataTypes.STRING(255))
  declare email: string;

  @Column(DataTypes.STRING(255))
  declare token: string;

  @CreatedAt
  declare createdAt: Date;
}

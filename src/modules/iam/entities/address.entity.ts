import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Party } from './party.entity';

@Table({ tableName: 'addresses', schema: 'party', underscored: true })
export class Address extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @ForeignKey(() => Party)
  @Column(DataTypes.UUID)
  declare partyId: string;

  @Column(DataTypes.UUID)
  declare tenantId: string;

  @Column({ type: DataTypes.STRING(30), allowNull: true })
  declare type: string | null;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare line1: string | null;

  @Column({ type: DataTypes.STRING(255), allowNull: true })
  declare line2: string | null;

  @Column({ type: DataTypes.STRING(120), allowNull: true })
  declare city: string | null;

  @Column({ type: DataTypes.STRING(120), allowNull: true })
  declare state: string | null;

  @Column({ type: DataTypes.STRING(20), allowNull: true })
  declare postalCode: string | null;

  @Column({ type: DataTypes.STRING(120), allowNull: true })
  declare country: string | null;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: false })
  declare isPrimary: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

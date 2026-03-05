import { Table, Column, Model, PrimaryKey, Default, CreatedAt, UpdatedAt, ForeignKey } from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Party } from './party.entity';

@Table({ tableName: 'documents', schema: 'party', underscored: true })
export class Document extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @ForeignKey(() => Party)
  @Column(DataTypes.UUID)
  declare partyId: string;

  @Column(DataTypes.UUID)
  declare tenantId: string;

  @Column(DataTypes.STRING(20))
  declare docType: string;

  @Column(DataTypes.STRING(60))
  declare docNumber: string;

  @Column({ type: DataTypes.STRING(10), allowNull: true })
  declare country: string | null;

  @Column({ type: DataTypes.DATEONLY, allowNull: true })
  declare issuedAt: string | null;

  @Column({ type: DataTypes.DATEONLY, allowNull: true })
  declare expiresAt: string | null;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: false })
  declare isPrimary: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

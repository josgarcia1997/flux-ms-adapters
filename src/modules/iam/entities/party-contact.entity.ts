import { Table, Column, Model, PrimaryKey, Default, CreatedAt, UpdatedAt, ForeignKey } from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Party } from './party.entity';

@Table({ tableName: 'party_contacts', schema: 'party', underscored: true })
export class PartyContact extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @Column(DataTypes.UUID)
  declare tenantId: string;

  @ForeignKey(() => Party)
  @Column(DataTypes.UUID)
  declare partyId: string;

  @Column(DataTypes.STRING(30))
  declare kind: string; // email | phone

  @Column({ type: DataTypes.STRING(30), allowNull: true })
  declare label: string | null;

  @Column(DataTypes.STRING(190))
  declare value: string;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: false })
  declare isPrimary: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

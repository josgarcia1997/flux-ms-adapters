import { Table, Column, Model, PrimaryKey, Default, CreatedAt, UpdatedAt } from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;

@Table({ tableName: 'countries', schema: 'core', underscored: true })
export class Country extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @Column(DataTypes.STRING(2))
  declare countryCode: string;

  @Column(DataTypes.STRING(100))
  declare country: string;

  @Column({ type: DataTypes.STRING(3), allowNull: true })
  declare currencyCode: string | null;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: true })
  declare status: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

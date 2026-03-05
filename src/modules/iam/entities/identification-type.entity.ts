import { Table, Column, Model, PrimaryKey, Default, CreatedAt, UpdatedAt, ForeignKey } from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Country } from './country.entity';

@Table({ tableName: 'identification_types', schema: 'core', underscored: true })
export class IdentificationType extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @ForeignKey(() => Country)
  @Column(DataTypes.UUID)
  declare countryId: string;

  @Column(DataTypes.STRING(20))
  declare docType: string;

  @Column(DataTypes.STRING(120))
  declare description: string;

  @Column({ type: DataTypes.BOOLEAN, defaultValue: true })
  declare status: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

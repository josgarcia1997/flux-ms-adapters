import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;

@Table({ tableName: 'parties', schema: 'party', underscored: true, paranoid: true })
export class Party extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @Column(DataTypes.UUID)
  declare tenantId: string;

  @Column(DataTypes.STRING(30))
  declare type: string;

  @Column(DataTypes.STRING(190))
  declare displayName: string;

  @Column({ type: DataTypes.STRING(190), allowNull: true })
  declare legalName: string | null;

  @Column({ type: DataTypes.STRING(20), allowNull: true })
  declare documentType: string | null;

  @Column({ type: DataTypes.STRING(60), allowNull: true })
  declare documentNumber: string | null;

  @Column({ type: DataTypes.DATEONLY, allowNull: true })
  declare dateBirth: string | null;

  @Column({ type: DataTypes.STRING(30), defaultValue: 'active' })
  declare status: string;

  @Column({ type: DataTypes.STRING(190), allowNull: true })
  declare externalRef: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @DeletedAt
  declare deletedAt: Date | null;
}

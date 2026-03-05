import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
  ForeignKey,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;
import { Party } from './party.entity';

@Table({ tableName: 'kyc_cases', schema: 'party', underscored: true, paranoid: true })
export class KycCase extends Model {
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
  declare status: string; // pending | submitted | approved | rejected

  @Column({ type: DataTypes.STRING(30), allowNull: true })
  declare level: string | null;

  @Column({ type: DataTypes.JSONB, allowNull: true })
  declare metadata: Record<string, unknown> | null;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare submittedAt: Date | null;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare reviewedAt: Date | null;

  @Column({ type: DataTypes.UUID, allowNull: true })
  declare reviewedBy: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @DeletedAt
  declare deletedAt: Date | null;
}

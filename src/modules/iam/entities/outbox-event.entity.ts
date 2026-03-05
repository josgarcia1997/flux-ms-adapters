import {
  Table,
  Column,
  Model,
  PrimaryKey,
  Default,
  CreatedAt,
} from 'sequelize-typescript';
const DataTypes = require('sequelize').DataTypes;

@Table({ tableName: 'outbox_events', schema: 'audit', underscored: true, timestamps: true, updatedAt: false })
export class OutboxEvent extends Model {
  @PrimaryKey
  @Default(DataTypes.UUIDV4)
  @Column(DataTypes.UUID)
  declare id: string;

  @Column(DataTypes.UUID)
  declare tenantId: string;

  @Column(DataTypes.STRING(160))
  declare eventName: string;

  @Column({ type: DataTypes.STRING(60), allowNull: true })
  declare aggregateType: string | null;

  @Column({ type: DataTypes.UUID, allowNull: true })
  declare aggregateId: string | null;

  @Column(DataTypes.JSONB)
  declare payloadJson: object;

  @Column({ type: DataTypes.STRING(30), defaultValue: 'pending' })
  declare status: string;

  @Column({ type: DataTypes.INTEGER, defaultValue: 0 })
  declare attempts: number;

  @Column({ type: DataTypes.DATE, allowNull: true })
  declare nextRetryAt: Date | null;

  @Column({ type: DataTypes.DATE, defaultValue: DataTypes.NOW })
  declare occurredAt: Date;

  @CreatedAt
  declare createdAt: Date;
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { OutboxEvent } from '../entities/outbox-event.entity';

export interface EnqueueOptions {
  eventName: string;
  payload: Record<string, unknown>;
  tenantId: string;
  aggregateType?: string;
  aggregateId?: string;
}

@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(OutboxEvent)
    private readonly outboxModel: typeof OutboxEvent,
  ) {}

  async enqueue(options: EnqueueOptions): Promise<OutboxEvent> {
    const { eventName, payload, tenantId, aggregateType, aggregateId } = options;
    return this.outboxModel.create({
      tenantId,
      eventName,
      aggregateType: aggregateType ?? null,
      aggregateId: aggregateId ?? null,
      payloadJson: payload,
      status: 'pending',
      attempts: 0,
      occurredAt: new Date(),
    } as any);
  }
}

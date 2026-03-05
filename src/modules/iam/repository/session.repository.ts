import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Session } from '../entities/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectModel(Session)
    private readonly sessionModel: typeof Session,
  ) {}

  async create(data: Partial<Session>): Promise<Session> {
    return this.sessionModel.create(data as any);
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    return this.sessionModel.findOne({
      where: { refreshTokenHash: hash, isActive: true },
    });
  }

  async invalidate(id: string): Promise<[number]> {
    return this.sessionModel.update({ isActive: false }, { where: { id } });
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessionModel.findByPk(id);
  }

  async invalidateAllForUser(userId: string): Promise<number> {
    const [n] = await this.sessionModel.update(
      { isActive: false },
      { where: { userId } },
    );
    return n;
  }
}

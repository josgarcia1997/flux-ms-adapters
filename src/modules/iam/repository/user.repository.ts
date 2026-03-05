import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email, tenantId } });
  }

  async create(data: Partial<User>): Promise<User> {
    return this.userModel.create(data as any);
  }
}

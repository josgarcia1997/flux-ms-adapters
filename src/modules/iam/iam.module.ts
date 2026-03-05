import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import {
  Tenant,
  User,
  Role,
  Permission,
  RolePermission,
  UserRole,
  Session,
  OutboxEvent,
  PasswordReset,
  Party,
  PartyContact,
  Address,
  Document,
  KycCase,
  Country,
  IdentificationType,
} from './entities';
import { UserRepository } from './repository/user.repository';
import { SessionRepository } from './repository/session.repository';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { AuthService } from './services/auth.service';
import { OutboxService } from './services/outbox.service';
import { AuthController } from './controllers/auth.controller';
import { MeController } from './controllers/me.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret') ?? 'change-me',
        signOptions: {
          expiresIn: config.get<string>('app.jwtExpiresIn') ?? '15m',
        },
      }),
    }),
    SequelizeModule.forFeature([
      Tenant,
      User,
      Role,
      Permission,
      RolePermission,
      UserRole,
      Session,
      OutboxEvent,
      PasswordReset,
      Party,
      PartyContact,
      Address,
      Document,
      KycCase,
      Country,
      IdentificationType,
    ]),
  ],
  controllers: [AuthController, MeController],
  providers: [
    TenantContextService,
    JwtAuthGuard,
    UserRepository,
    SessionRepository,
    OutboxService,
    AuthService,
  ],
  exports: [AuthService, UserRepository, OutboxService],
})
export class IamModule {}

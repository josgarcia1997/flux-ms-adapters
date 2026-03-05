import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IamModule } from './modules/iam/iam.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, appConfig] }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get('database');
        return {
          host: db?.host ?? 'localhost',
          port: db?.port ?? 5432,
          username: db?.username ?? 'postgres',
          password: db?.password ?? '',
          database: db?.database ?? 'flux',
          dialect: 'postgres',
          logging: db?.logging ?? false,
          autoLoadModels: true,
          synchronize: false, // Tables/schemas created by Laravel migrations
        };
      },
    }),
    IamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IamModule } from './modules/iam/iam.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';

/** Rutas donde buscar .env (cwd y raíz del proyecto cuando se ejecuta desde dist/). */
const envPaths = ['.env', join(process.cwd(), '.env'), join(__dirname, '..', '.env')];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envPaths,
      load: [databaseConfig, appConfig],
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get('database');
        return {
          ...db,
          dialect: 'postgres',
          autoLoadModels: true,
          synchronize: false,
        };
      },
    }),
    IamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

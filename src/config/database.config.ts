import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export const databaseModule = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres' as const,
    url: configService.get<string>('database.url'),
    synchronize: true,
    autoLoadEntities: true,
  }),
  inject: [ConfigService],
});

export const redisCacheModule = CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('redis.host');
    const port = configService.get<number>('redis.port');
    return {
      stores: [createKeyv(`redis://${host}:${port}`)],
    };
  },
  inject: [ConfigService],
});

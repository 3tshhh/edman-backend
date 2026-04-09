import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration.js';
import { databaseModule, redisCacheModule } from './config/database.config.js';
import { GlobalModule } from './common/global.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { VolunteersModule } from './modules/volunteers/volunteers.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { CentersModule } from './modules/centers/centers.module.js';
import { RulesModule } from './modules/rules/rules.module.js';
import { PlacesModule } from './modules/places/places.module.js';
import { CampaignsModule } from './modules/campaigns/campaigns.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { UserModule } from './modules/user/user.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { MapModule } from './modules/map/map.module.js';
import { PerformanceModule } from './modules/performance/performance.module.js';
import { LocationModule } from './modules/location/location.module.js';
import { FeedModule } from './modules/feed/feed.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { VolunteersService } from './modules/volunteers/volunteers.service.js';
import { CampaignsService } from './modules/campaigns/campaigns.service.js';
import { PlacesService } from './modules/places/places.service.js';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    databaseModule,
    redisCacheModule,
    ScheduleModule.forRoot(),
    GlobalModule,
    UserModule,
    AuthModule,
    VolunteersModule,
    AdminsModule,
    CentersModule,
    RulesModule,
    PlacesModule,
    CampaignsModule,
    UploadsModule,
    SessionsModule,
    MapModule,
    PerformanceModule,
    LocationModule,
    FeedModule,
    NotificationsModule,
    ChatModule,
  ],
})
export class AppModule implements OnModuleInit, NestModule {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly volunteersService: VolunteersService,
    private readonly campaignsService: CampaignsService,
    private readonly placesService: PlacesService,
  ) {}

  onModuleInit() {
    // Wire SessionsService into services that need it (avoids circular dependency)
    this.volunteersService.setSessionsService(this.sessionsService);
    this.campaignsService.setSessionsService(this.sessionsService);
    this.placesService.setSessionsService(this.sessionsService);
    // Wire CampaignsService into SessionsService for auto-completion
    this.sessionsService.setCampaignsService(this.campaignsService);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

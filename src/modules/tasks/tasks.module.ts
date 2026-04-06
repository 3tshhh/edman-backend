import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity.js';
import { TaskEnrollment } from './entities/task-enrollment.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';
import { PlacesModule } from '../places/places.module.js';
import { VolunteersModule } from '../volunteers/volunteers.module.js';
import { RulesModule } from '../rules/rules.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskEnrollment, Session]),
    PlacesModule,
    VolunteersModule,
    RulesModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

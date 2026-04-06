import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import {
  Auth,
  AuthGroup,
  CurrentUser,
  CurrentVolunteer,
} from '../../common/decorators/index.js';
import { User } from '../user/user.entity.js';
import { UserRole } from '../../common/constants/enums.js';
import type { Volunteer } from '../volunteers/volunteer.entity.js';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('mine')
  @AuthGroup()
  findMine(@CurrentVolunteer() volunteer: Volunteer) {
    return this.tasksService.findMine(volunteer.volunteerGroup!);
  }

  @Get()
  @Auth(UserRole.ADMIN)
  findAll(@Query() query: QueryTasksDto) {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN, UserRole.SUB_ADMIN)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findById(id);
  }

  @Post(':id/enroll')
  @Auth(UserRole.VOLUNTEER, UserRole.ADMIN)
  enroll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.tasksService.enroll(id, user.id);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto, user.id);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }
}

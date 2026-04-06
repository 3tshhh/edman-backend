import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from './entities/task.entity.js';
import { TaskEnrollment } from './entities/task-enrollment.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { PlacesService } from '../places/places.service.js';
import { VolunteersService } from '../volunteers/volunteers.service.js';
import { RulesService } from '../rules/rules.service.js';
import type { SessionsService } from '../sessions/sessions.service.js';
import {
  SessionStatus,
  TaskStatus,
  VolunteerGroup,
} from '../../common/constants/enums.js';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskEnrollment)
    private readonly enrollmentRepository: Repository<TaskEnrollment>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly dataSource: DataSource,
    private readonly placesService: PlacesService,
    private readonly volunteersService: VolunteersService,
    private readonly rulesService: RulesService,
  ) {}

  private sessionsService: SessionsService | null = null;

  setSessionsService(sessionsService: SessionsService): void {
    this.sessionsService = sessionsService;
  }

  async findAll(
    query: QueryTasksDto,
  ): Promise<{ data: Task[]; total: number }> {
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.place', 'place')
      .leftJoinAndSelect('task.createdBy', 'createdBy');

    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    if (query.group) {
      qb.andWhere('task.volunteerGroup = :group', { group: query.group });
    }

    qb.orderBy('task.scheduledDate', 'DESC').addOrderBy(
      'task.startTime',
      'ASC',
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findMine(volunteerGroup: VolunteerGroup): Promise<Task[]> {
    return this.taskRepository.find({
      where: { volunteerGroup },
      order: { scheduledDate: 'ASC', startTime: 'ASC' },
    });
  }

  async findById(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('المهمة غير موجودة');
    }
    return task;
  }

  async enroll(
    taskId: string,
    userId: string,
  ): Promise<{ enrollmentId: string; sessionId: string }> {
    // 1. Rules check
    const rules = await this.rulesService.getLatest();
    const volunteer = await this.volunteersService.findByUserId(userId);
    if (!volunteer) {
      throw new NotFoundException('لم يتم العثور على ملف المتطوع');
    }

    if (rules && volunteer.rulesConfirmedVersion < rules.version) {
      throw new ForbiddenException('يجب قراءة القوانين وتأكيدها أولاً');
    }

    // 2. Task validation
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('المهمة غير موجودة');
    }
    if (task.status !== TaskStatus.OPEN) {
      throw new BadRequestException('هذه المهمة غير متاحة للتسجيل');
    }

    // 3. Check not already enrolled
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        volunteer: { id: volunteer.id },
        task: { id: taskId },
      },
    });
    if (existingEnrollment) {
      throw new ConflictException('أنت مسجل بالفعل في هذه المهمة');
    }

    // 4. Check no active session
    const activeSession = await this.sessionRepository.findOne({
      where: [
        { volunteer: { id: volunteer.id }, status: SessionStatus.ACTIVE },
        {
          volunteer: { id: volunteer.id },
          status: SessionStatus.WAITING_ARRIVAL,
        },
      ],
    });
    if (activeSession) {
      throw new ConflictException('لديك جلسة نشطة بالفعل');
    }

    // 5. Atomic transaction: enrollment + session + status update
    return this.dataSource.transaction(async (manager) => {
      const enrollment = manager.create(TaskEnrollment, {
        volunteer: { id: volunteer.id },
        task: { id: taskId },
      });
      const savedEnrollment = await manager.save(TaskEnrollment, enrollment);

      const session = manager.create(Session, {
        volunteer: { id: volunteer.id },
        task: { id: taskId },
        status: SessionStatus.WAITING_ARRIVAL,
      });
      const savedSession = await manager.save(Session, session);

      // Check if task is now full
      const enrollmentCount = await manager.count(TaskEnrollment, {
        where: { task: { id: taskId } },
      });
      if (enrollmentCount >= task.maxVolunteers) {
        await manager.update(Task, taskId, { status: TaskStatus.FULL });
      }

      return {
        enrollmentId: savedEnrollment.id,
        sessionId: savedSession.id,
      };
    });
  }

  async create(dto: CreateTaskDto, adminUserId: string): Promise<Task> {
    const place = await this.placesService.findById(dto.placeId);

    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    }

    const task = this.taskRepository.create({
      title: dto.title,
      description: dto.description,
      place,
      volunteerGroup: place.volunteerGroup,
      scheduledDate: dto.scheduledDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      maxVolunteers: dto.maxVolunteers ?? 10,
      createdBy: { id: adminUserId } as any,
    });
    return this.taskRepository.save(task);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(id);

    if (dto.placeId) {
      const place = await this.placesService.findById(dto.placeId);
      task.place = place;
      task.volunteerGroup = place.volunteerGroup;
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined)
      task.description = dto.description ?? null;
    if (dto.scheduledDate !== undefined) task.scheduledDate = dto.scheduledDate;
    if (dto.startTime !== undefined) task.startTime = dto.startTime;
    if (dto.endTime !== undefined) task.endTime = dto.endTime;
    if (dto.maxVolunteers !== undefined) task.maxVolunteers = dto.maxVolunteers;

    if (task.endTime <= task.startTime) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    }

    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findById(id);

    if (this.sessionsService) {
      const hasActive = await this.sessionsService.hasActiveSessionsForTask(id);
      if (hasActive) {
        throw new BadRequestException('لا يمكن حذف المهمة لوجود جلسات نشطة');
      }
    }

    await this.taskRepository.remove(task);
  }

  async countOpenByPlaceId(placeId: string): Promise<number> {
    return this.taskRepository.count({
      where: { place: { id: placeId }, status: TaskStatus.OPEN },
    });
  }
}

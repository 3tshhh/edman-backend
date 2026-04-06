import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Admin } from './entities/admin.entity.js';
import { SubAdmin } from './entities/sub-admin.entity.js';
import { UserService } from '../user/user.service.js';
import { UserRole, VolunteerGroup } from '../../common/constants/enums.js';
import { normalizePhone } from '../../common/utils/normalize-phone.util.js';

@Injectable()
export class AdminsService implements OnModuleInit {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(SubAdmin)
    private readonly subAdminRepository: Repository<SubAdmin>,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const adminPhone = this.configService.get<string>('ADMIN_PHONE');
    if (!adminPhone) return;

    try {
      const phone = normalizePhone(adminPhone);
      await this.seedAdmin(phone);
    } catch {
      // Seed failed — admin may already exist or phone is invalid
    }
  }

  async seedAdmin(phone: string): Promise<void> {
    let user = await this.userService.findByPhone(phone);
    if (!user) {
      user = await this.userService.createUser(phone);
    }

    const existing = await this.adminRepository.findOne({
      where: { user: { id: user.id } },
    });
    if (existing) return;

    await this.userService.setRole(user.id, UserRole.ADMIN);
    await this.userService.markPhoneVerified(user.id);

    const admin = this.adminRepository.create({ user: { id: user.id } as any });
    await this.adminRepository.save(admin);
  }

  async findAdminByUserId(userId: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { user: { id: userId } },
    });
  }

  async findSubAdminByUserId(userId: string): Promise<SubAdmin | null> {
    return this.subAdminRepository.findOne({
      where: { user: { id: userId } },
    });
  }

  async createSubAdmin(
    phone: string,
    assignedGroup: VolunteerGroup,
  ): Promise<SubAdmin> {
    const normalized = normalizePhone(phone);

    let user = await this.userService.findByPhone(normalized);
    if (!user) {
      user = await this.userService.createUser(normalized);
    }

    const existing = await this.subAdminRepository.findOne({
      where: { user: { id: user.id } },
    });
    if (existing) {
      throw new ConflictException('هذا المستخدم مسجل كمشرف فرعي بالفعل');
    }

    await this.userService.setRole(user.id, UserRole.SUB_ADMIN);
    await this.userService.markPhoneVerified(user.id);

    const subAdmin = this.subAdminRepository.create({
      user: { id: user.id } as any,
      assignedGroup,
    });
    return this.subAdminRepository.save(subAdmin);
  }

  async findAllSubAdmins(): Promise<SubAdmin[]> {
    return this.subAdminRepository.find();
  }

  async removeSubAdmin(id: string): Promise<void> {
    const subAdmin = await this.subAdminRepository.findOne({
      where: { id },
    });
    if (!subAdmin) {
      throw new NotFoundException('المشرف الفرعي غير موجود');
    }

    // Reset user role to null
    await this.userService.setRole(subAdmin.user.id, null as any);
    await this.subAdminRepository.remove(subAdmin);
  }
}

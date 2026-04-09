import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Admin } from './entities/admin.entity.js';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { AdminRegisterDto } from './dto/admin-register.dto.js';
import { TokenService } from '../../common/services/token.service.js';
import {
  generateHash,
  compareHash,
} from '../../common/utils/encryption/hash.utils.js';

@Injectable()
export class AdminsService implements OnModuleInit {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_DEFAULT_EMAIL');
    const password = this.configService.get<string>('ADMIN_DEFAULT_PASSWORD');
    if (!email || !password) return;

    try {
      await this.seedAdmin(email, password);
    } catch {
      // Seed failed — admin may already exist
    }
  }

  async seedAdmin(email: string, password: string): Promise<void> {
    const existing = await this.adminRepository.findOne({ where: { email } });
    if (existing) return;

    const admin = this.adminRepository.create({
      email,
      password: generateHash(password),
      name: 'مدير النظام',
      nationalId: '00000000000000',
    });
    await this.adminRepository.save(admin);
  }

  async login(dto: AdminLoginDto) {
    const admin = await this.adminRepository.findOne({
      where: { email: dto.email },
    });
    if (!admin) {
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const isPasswordValid = compareHash(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const tokens = this.tokenService.generateAccessRefreshToken({
      adminId: admin.id,
      role: 'admin',
    });

    return {
      ...tokens,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        nationalId: admin.nationalId,
      },
    };
  }

  async register(dto: AdminRegisterDto) {
    const existing = await this.adminRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    const existingNationalId = await this.adminRepository.findOne({
      where: { nationalId: dto.nationalId },
    });
    if (existingNationalId) {
      throw new ConflictException('الرقم القومي مستخدم بالفعل');
    }

    const admin = this.adminRepository.create({
      email: dto.email,
      password: generateHash(dto.password),
      name: dto.name,
      nationalId: dto.nationalId,
    });
    const saved = await this.adminRepository.save(admin);

    return {
      id: saved.id,
      email: saved.email,
      name: saved.name,
      nationalId: saved.nationalId,
    };
  }

  async findById(adminId: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { id: adminId } });
  }
}

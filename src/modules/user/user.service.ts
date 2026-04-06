import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';
import { UserRole } from '../../common/constants/enums.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async createUser(phone: string): Promise<User> {
    const user = this.userRepository.create({ phone });
    return this.userRepository.save(user);
  }

  async markPhoneVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isPhoneVerified: true });
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepository.update(userId, { fcmToken });
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    await this.userRepository.save(user);
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OtpVerificationStrategy } from './otp-verification.strategy.js';
import { UserService } from '../../user/user.service.js';
import type { OtpPayload } from '../../../common/types/auth.types.js';

@Injectable()
export class ChangePhoneOtpStrategy extends OtpVerificationStrategy {
  constructor(private readonly userService: UserService) {
    super();
  }

  async postVerification(
    payload: OtpPayload,
  ): Promise<{ message: string }> {
    const { oldPhone, phone } = payload;

    const user = await this.userService.findByPhone(oldPhone!);
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const existing = await this.userService.findByPhone(phone);
    if (existing) throw new ConflictException('رقم الهاتف مستخدم بالفعل');

    await this.userService.updatePhone(user.id, phone);

    return { message: 'تم تغيير رقم الهاتف بنجاح' };
  }
}

import { BadRequestException } from '@nestjs/common';

export function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-()]/g, '');
  const match = stripped.match(/^(?:\+?2)?(01[0-9]{9})$/);
  if (!match) throw new BadRequestException('رقم الهاتف غير صحيح');
  return match[1];
}

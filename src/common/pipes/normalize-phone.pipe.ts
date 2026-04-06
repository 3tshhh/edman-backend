import { Injectable, PipeTransform } from '@nestjs/common';
import { normalizePhone } from '../utils/normalize-phone.util.js';

@Injectable()
export class NormalizePhonePipe implements PipeTransform {
  transform(value: { phone: string }) {
    value.phone = normalizePhone(value.phone);
    return value;
  }
}

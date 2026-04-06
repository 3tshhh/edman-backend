import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';

@Injectable()
export class UnifiedResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const res = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        return {
          statusCode: res.statusCode,
          message: 'success',
          data: data,
        };
      }),
    );
  }
}

import { Global, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './services/token.service.js';

@Global()
@Module({
  providers: [TokenService, JwtService],
  exports: [TokenService],
})
export class GlobalModule {}

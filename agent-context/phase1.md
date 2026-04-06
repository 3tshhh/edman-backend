# Phase 1 — Foundation

> **Status:** COMPLETE — all code written, builds successfully.

---

## Scope

```
Step 0:  Project scaffold (nest new, package.json, tsconfig, .env, docker-compose)
Step 1:  src/config/           configuration.ts + database.config.ts
Step 2:  src/common/           enums, utils, filters, guards, decorators, interceptors, services
Step 3:  src/modules/otp/      copy from tm as-is (adapt imports)
Step 4:  src/modules/user/     create new (phone-only, no email)
Step 5:  src/modules/auth/     copy from tm, apply modifications
Step 6:  src/main.ts           bootstrap with globals
Step 7:  src/app.module.ts     assemble Phase 1 modules
```

---

## Step 0 — Project Scaffold

### 0.1 Initialize NestJS project

```bash
cd E:\Work\edman-backend
nest new . --skip-git --package-manager npm
```

### 0.2 Install dependencies

```bash
# Core
npm i @nestjs/config @nestjs/typeorm typeorm pg
npm i @nestjs/jwt @nestjs/cache-manager cache-manager @keyv/redis
npm i @nestjs/swagger
npm i class-validator class-transformer
npm i bcrypt
npm i reflect-metadata rxjs

# Dev
npm i -D @types/bcrypt
```

> Packages for later phases (S3, Firebase, Socket.IO, Anthropic, @nestjs/schedule) are NOT installed now.

### 0.3 tsconfig.json

Use tm's config with `strict: true` added per backend_context:

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": false
  }
}
```

### 0.4 .env

Keep the existing `.env` file as-is. It already has all Phase 1 variables.

### 0.5 docker-compose.yml

Keep the existing `docker-compose.yml` as-is (Postgres 16 + Redis 7).

---

## Step 1 — Config

### 1.1 `src/config/configuration.ts`

Typed factory for `ConfigModule.forRoot({ load: [configuration] })`.

```typescript
export default () => ({
  database: { url: process.env.DATABASE_URL },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  jwt: {
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    prefix: 'Bearer',
    accessExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  otp: {
    sessionSecret: process.env.JWT_SECRET, // reuse JWT secret for OTP session tokens
    expiresIn: '5m',
    saltRounds: parseInt(process.env.SALT_ROUNDS || '10'),
    devCode: process.env.OTP_DEV_CODE || null,
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300'),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5'),
    attemptsWindowSeconds: parseInt(process.env.OTP_ATTEMPTS_WINDOW_SECONDS || '3600'),
  },
  location: {
    proximityDefaultMeters: parseInt(process.env.PROXIMITY_THRESHOLD_METERS || '300'),
    checkIntervalSeconds: parseInt(process.env.SESSION_LOCATION_INTERVAL_SECONDS || '30'),
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_BUCKET,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

> Note: env var names match the existing `.env` file (e.g., `DATABASE_URL`, `JWT_SECRET`, not the PLAN.md names). This avoids changing the `.env`.

### 1.2 `src/config/database.config.ts`

Copied from tm, modified to use ConfigService:

```typescript
import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export const databaseModule = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    url: configService.get<string>('database.url'),
    synchronize: true,        // dev only — disable in prod
    autoLoadEntities: true,
  }),
  inject: [ConfigService],
});

export const redisCacheModule = CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('redis.host');
    const port = configService.get<number>('redis.port');
    return {
      stores: [createKeyv(`redis://${host}:${port}`)],
    };
  },
  inject: [ConfigService],
});
```

---

## Step 2 — Common

### 2.1 `src/common/constants/enums.ts`

All enums from backend_context.md. Full Governorate (27 values) and Area enums with Arabic values.

### 2.2 `src/common/utils/encryption/hash.utils.ts`

**Copy from tm as-is:**
```typescript
import { compareSync, hashSync } from 'bcrypt';
export const generateHash = (plainText: string, saltRounds: number = parseInt(process.env.SALT_ROUNDS as string)): string => hashSync(plainText, saltRounds);
export const compareHash = (plainText: string, hash: string): boolean => compareSync(plainText, hash);
```

### 2.3 `src/common/utils/common.utils.ts`

**Copy from tm as-is:**
```typescript
export const getRemainingTTL = (exp: number) => (exp - Math.floor(Date.now() / 1000)) * 1000;
```

### 2.4 `src/common/utils/normalize-phone.util.ts`

**Create new:**
```typescript
import { BadRequestException } from '@nestjs/common';

export function normalizePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-\(\)]/g, '');
  // Accept: +201XXXXXXXXX or 01XXXXXXXXX
  const match = stripped.match(/^(?:\+?2)?(01[0-9]{9})$/);
  if (!match) throw new BadRequestException('رقم الهاتف غير صحيح');
  return match[1]; // returns 01XXXXXXXXX (11 digits)
}
```

### 2.5 `src/common/utils/location.utils.ts`

**Create new:**
```typescript
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Haversine formula — returns distance in meters
}

export function isWithinProximity(vLat: number, vLng: number, pLat: number, pLng: number, thresholdMeters: number): boolean {
  return calculateDistance(vLat, vLng, pLat, pLng) <= thresholdMeters;
}
```

### 2.6 `src/common/filters/http-exception.filter.ts`

**Create new:**
```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // Response shape: { statusCode, message, timestamp, path }
  }
}
```

### 2.7 `src/common/guards/auth.guard.ts`

**Copy from tm as-is.** Contains both `AuthGuard` and `RefreshTokenGuard`. Update import paths:
- `src/shared/services` → `src/common/services`
- `src/modules/user/user.service` → stays the same

### 2.8 `src/common/guards/roles.guard.ts`

**Copy from tm as-is.** No changes needed.

### 2.9 `src/common/guards/otp.guard.ts`

**Copy from tm as-is.** Update import paths:
- `src/shared/services` → `src/common/services`
- `src/modules/otp/otp.service` → stays the same

### 2.10 `src/common/guards/groups.guard.ts`

**Create new — mirrors roles.guard.ts:**
```typescript
@Injectable()
export class GroupsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredGroups = this.reflector.get<string[]>('groups', context.getHandler());
    if (!requiredGroups) return true; // no group restriction

    const { user } = context.switchToHttp().getRequest().loggedInUser;
    // Load volunteer's group — need to check user has a volunteerGroup set
    // If no group → throw ForbiddenException
    // Service layer does actual filtering by group
    return true;
  }
}
```

> Note: GroupsGuard needs access to the Volunteer entity to check `volunteerGroup`. Since the Volunteer module doesn't exist in Phase 1, GroupsGuard will be created as a skeleton that passes through. It will be completed in Phase 2 when volunteers module is built.

### 2.11 `src/common/interceptors/unified-response.interceptor.ts`

**Copy from tm as-is.** No changes needed.
```typescript
// Response shape: { statusCode: number, message: 'success', data: any }
```

### 2.12 `src/common/services/token.service.ts`

**Copy from tm as-is.** Update import paths:
- `src/shared/utils` → `src/common/utils`

### 2.13 `src/common/decorators/index.ts`

**Copy from tm, then modify:**

Keep:
- `OTP` — extracts `req.otpPayload`
- `Roles(...roles)` — `SetMetadata('roles', roles)`
- `Auth(...roles)` — composite: `UseGuards(AuthGuard, RolesGuard) + Roles(...roles)`
- `logoutJti` — extracts `{ jti, exp }`
- `refreshToken` — extracts `{ jti, userId, role, exp }`

Rename:
- `AuthUser` → `CurrentUser` — return `req.loggedInUser.user` (User entity only, not the wrapper)

Remove:
- `IsEmailOrPhone` — not needed (phone-only)

Add:
- `Groups(...groups)` — `SetMetadata('groups', groups)`
- `AuthGroup()` — composite: `UseGuards(AuthGuard, RolesGuard, GroupsGuard) + Roles(VOLUNTEER) + Groups()`

### 2.15 `src/common/global.module.ts`

**Based on tm's global.module.ts:**
```typescript
@Global()
@Module({
  providers: [TokenService, JwtService],
  exports: [TokenService],
})
export class GlobalModule {}
```

### 2.16 Barrel exports

Create `src/common/index.ts` or per-folder index files to clean up imports.

---

## Step 3 — OTP Module

### 3.1 `src/modules/otp/otp.module.ts`

**Copy from tm as-is.** Update import paths.

### 3.2 `src/modules/otp/otp.service.ts`

**Copy from tm as-is.** Update import paths:
- `src/shared/utils/encryption/hash.utils` → `src/common/utils/encryption/hash.utils`
- `src/shared/utils/common.utils` → `src/common/utils/common.utils`
- `src/core` → `src/common/constants/enums` (for OtpPayload type)
- `src/shared/services/token.service` → `src/common/services/token.service`

The `OtpPayload` interface needs to be redefined for edman since we're removing the `NormalizedIdentifier` concept. New interface:

```typescript
export interface OtpPayload {
  phone: string;            // was: identifier: NormalizedIdentifier
  purpose: 'login';         // was: OtpPurposeType (register removed)
  hashedCode: string;
  jti: string;
  exp: number;
  sub?: object;
}
```

> Place this in `src/common/types/auth.types.ts` or inline in otp.

### 3.3 `src/modules/otp/otp.dto.ts`

**Copy from tm as-is.** No changes needed.

---

## Step 4 — User Module

### 4.1 `src/modules/user/user.entity.ts`

**Create new** (not copied from tm — completely different schema):

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  role: UserRole | null;    // null = registered, no role yet

  @Column({ type: 'boolean', default: false })
  isPhoneVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fcmToken: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
```

Key differences from tm User:
- No `email`, `password`, `firstName`, `lastName`, `profileImage`, `isEmailVerified`, `isVerified`, `authMethod`
- No `@Check` constraint (phone is always required)
- `role` is single enum (not `simple-array` like tm) — one role per user, nullable (null = just registered)
- Added `fcmToken` for push notifications

### 4.2 `src/modules/user/user.service.ts`

**Based on tm, heavily simplified:**

```typescript
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
```

Removed from tm version:
- `findUserByIdentifier(NormalizedIdentifier)` → replaced by `findByPhone(phone)`
- `verifyUser(userId, identifierType)` → simplified (no email branch)
- `addRoleToUser` → renamed to `setRole`

### 4.3 `src/modules/user/user.module.ts`

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

---

## Step 5 — Auth Module

### 5.1 `src/modules/auth/auth.dto.ts`

**Replace entirely:**

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  phone: string;
}
```

Removed: `RegisterDto`, `RegisterForm`, `LoginForm`, `IsEmailOrPhone`, `NormalizedIdentifier`

### 5.2 `src/modules/auth/auth.service.ts`

**Copy from tm, then modify:**

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly strategyResolver: OtpStrategyResolver,
    private readonly userService: UserService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async login(phone: string) {
    // If user doesn't exist → create silently
    let user = await this.userService.findByPhone(phone);
    if (!user) {
      user = await this.userService.createUser(phone);
    }

    const otpSessionToken = this.otpService.generateOtpSession({
      phone,
      purpose: 'login',
    });

    return { otpSessionToken };
  }

  async verifyOtp(code: string, otpPayload: OtpPayload) {
    const { hashedCode, purpose, jti, exp } = otpPayload;

    const isValid = this.otpService.verifyOTP(code, hashedCode);
    if (!isValid) throw new UnauthorizedException('Invalid or expired OTP');

    this.otpService.invalidate(jti, exp);

    const strategy = this.strategyResolver.resolve(purpose);
    return strategy.postVerification(otpPayload);
  }

  // logout() and refreshToken() — keep from tm as-is
  // resendOTP() — adapt to use phone instead of identifier
}
```

Key changes:
- `register()` — **REMOVED** entirely
- `login()` — no password branch, auto-creates user if not found, uses `phone` directly
- `verifyOtp()` — passes `otpPayload` directly (no `sub` spread)

### 5.3 `src/modules/auth/auth.controller.ts`

**Copy from tm, then modify:**

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body(NormalizePhonePipe) body: LoginDto) {
    return this.authService.login(body.phone);
  }

  @Post('verify-otp')
  @UseGuards(OTPGuard)
  async verifyOtp(@Body() body: VerifyOtpDto, @OTP() otp: OtpPayload) {
    return this.authService.verifyOtp(body.code, otp);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@logoutJti() token: { jti: string; exp: number }) {
    return this.authService.logout(token);
  }

  @Post('refresh-token')
  @UseGuards(RefreshTokenGuard)
  refreshToken(@refreshToken() token: { jti: string; userId: string; role: string; exp: number }) {
    return this.authService.refreshToken(token);
  }

  @Post('resend-otp')
  @UseGuards(OTPGuard)
  resendOtp(@OTP() otpPayload: OtpPayload) {
    return this.authService.resendOTP(otpPayload);
  }
}
```

Changes:
- Removed `@Post('register')` endpoint
- Replaced `NormalizeAndTransformRegisterPipe` / `NormalizeAndTransformLoginPipe` with `NormalizePhonePipe`
- `LoginDto` now has `phone: string` only

### 5.4 `src/common/pipes/normalize-phone.pipe.ts`

**Create new** (replaces tm's two normalize pipes):

```typescript
@Injectable()
export class NormalizePhonePipe implements PipeTransform {
  transform(value: LoginDto) {
    value.phone = normalizePhone(value.phone);
    return value;
  }
}
```

### 5.5 `src/modules/auth/strategies/otp-verification.strategy.ts`

**Copy from tm, then modify:**

```typescript
import { ApplicationStatus } from 'src/common/constants/enums';

export interface OtpVerificationResult {
  accessToken: string;
  refreshToken: string;
  applicationStatus: ApplicationStatus | null;  // ← ADDED
  message: string;
}

export type OtpPurposeType = 'login';  // ← removed 'register'

export abstract class OtpVerificationStrategy {
  abstract postVerification(payload: object): Promise<OtpVerificationResult>;
}
```

### 5.6 `src/modules/auth/strategies/login-otp.strategy.ts`

**Copy from tm, then modify:**

```typescript
@Injectable()
export class LoginOtpStrategy extends OtpVerificationStrategy {
  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    // Note: VolunteerService not available in Phase 1
    // applicationStatus will be null until Phase 2
  ) {
    super();
  }

  async postVerification(payload: OtpPayload): Promise<OtpVerificationResult> {
    const user = await this.userService.findByPhone(payload.phone);
    if (!user) throw new UnauthorizedException('User not found');

    // Mark phone as verified
    user.isPhoneVerified = true;
    // TODO: save user (need userService.save or update method)

    return {
      ...this.tokenService.generateAccessRefreshToken({
        userId: user.id,
        role: user.role,
      }),
      applicationStatus: null,  // Phase 2: look up Volunteer record
      message: 'Login verified successfully',
    };
  }
}
```

### 5.7 `src/modules/auth/strategies/register-otp.strategy.ts`

**DELETE** — no separate register flow in edman.

### 5.8 `src/modules/auth/strategies/otp-strategy.resolver.ts`

**Copy from tm, then modify:**

```typescript
@Injectable()
export class OtpStrategyResolver {
  private readonly strategies: Record<OtpPurposeType, OtpVerificationStrategy>;

  constructor(private readonly loginStrategy: LoginOtpStrategy) {
    this.strategies = {
      login: this.loginStrategy,
      // register removed
    };
  }

  resolve(purpose: OtpPurposeType): OtpVerificationStrategy {
    const strategy = this.strategies[purpose];
    if (!strategy) throw new BadRequestException(`Unknown OTP purpose: ${purpose}`);
    return strategy;
  }
}
```

### 5.9 `src/modules/auth/auth.module.ts`

```typescript
@Module({
  imports: [OtpModule, UserModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpStrategyResolver,
    LoginOtpStrategy,
    // RegisterOtpStrategy removed
    // IsEmailOrPhoneConstraint removed
  ],
})
export class AuthModule {}
```

---

## Step 6 — main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UnifiedResponseInterceptor } from './common/interceptors/unified-response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new UnifiedResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Edman API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## Step 7 — app.module.ts (Phase 1)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { databaseModule, redisCacheModule } from './config/database.config';
import { GlobalModule } from './common/global.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    databaseModule,
    redisCacheModule,
    GlobalModule,
    AuthModule,
    // Phase 2: VolunteersModule, AdminsModule, CentersModule, RulesModule, PlacesModule, TasksModule, UploadsModule
    // Phase 3: SessionsModule, MapModule, PerformanceModule, LocationModule
    // Phase 4: FeedModule, NotificationsModule, ChatbotModule
  ],
})
export class AppModule {}
```

> AuthModule imports OtpModule and UserModule internally, so they don't need to be listed separately here.

---

## File Tree After Phase 1

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── configuration.ts
│   └── database.config.ts
├── common/
│   ├── constants/
│   │   └── enums.ts
│   ├── decorators/
│   │   └── index.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── roles.guard.ts
│   │   ├── groups.guard.ts      (skeleton — completed in Phase 2)
│   │   └── otp.guard.ts
│   ├── interceptors/
│   │   └── unified-response.interceptor.ts
│   ├── pipes/
│   │   └── normalize-phone.pipe.ts
│   ├── services/
│   │   └── token.service.ts
│   ├── types/
│   │   └── auth.types.ts        (OtpPayload, IAuthUser interfaces)
│   ├── utils/
│   │   ├── encryption/
│   │   │   └── hash.utils.ts
│   │   ├── common.utils.ts
│   │   ├── normalize-phone.util.ts
│   │   └── location.utils.ts
│   ├── global.module.ts
│   └── index.ts                 (barrel exports)
└── modules/
    ├── otp/
    │   ├── otp.module.ts
    │   ├── otp.service.ts
    │   └── otp.dto.ts
    ├── user/
    │   ├── user.module.ts
    │   ├── user.service.ts
    │   └── user.entity.ts
    └── auth/
        ├── auth.module.ts
        ├── auth.controller.ts
        ├── auth.service.ts
        ├── auth.dto.ts
        └── strategies/
            ├── otp-verification.strategy.ts
            ├── otp-strategy.resolver.ts
            └── login-otp.strategy.ts
```

---

## Endpoints Available After Phase 1

```
POST /api/auth/login           — body: { phone }        → { otpSessionToken }
POST /api/auth/verify-otp      — header: otp-session-token, body: { code } → { accessToken, refreshToken, applicationStatus: null }
POST /api/auth/logout          — header: authorization   → blacklist JTI
POST /api/auth/refresh-token   — header: authorization-refresh → { accessToken, refreshToken }
POST /api/auth/resend-otp      — header: otp-session-token → { otpSessionToken }

GET  /api/docs                 — Swagger UI
```

---

## Deferred to Phase 2

- `applicationStatus` in verify-otp response will always be `null` until VolunteersModule exists
- GroupsGuard is a pass-through skeleton until Volunteer entity is available
- `LoginOtpStrategy.postVerification()` has a TODO to look up Volunteer record
- `UserService.setRole()` will be called by VolunteersService.approve()

---

## Verification Checklist

After Phase 1 is complete, verify:
1. `docker compose up -d` starts Postgres + Redis
2. `npm run start:dev` starts without errors
3. `POST /api/auth/login { phone: "01012345678" }` returns `{ otpSessionToken }`
4. OTP code appears in console.log
5. `POST /api/auth/verify-otp` with correct code returns tokens + `applicationStatus: null`
6. `POST /api/auth/logout` blacklists the token
7. `POST /api/auth/refresh-token` returns new tokens
8. Swagger UI accessible at `/api/docs`
9. Invalid phone format returns Arabic error: `رقم الهاتف غير صحيح`

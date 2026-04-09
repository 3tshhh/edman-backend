import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AdminsService } from '../modules/admins/admins.service.js';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const adminsService = app.get(AdminsService);

  const email = process.env.ADMIN_DEFAULT_EMAIL;
  const password = process.env.ADMIN_DEFAULT_PASSWORD;

  if (!email || !password) {
    console.error('Missing ADMIN_DEFAULT_EMAIL or ADMIN_DEFAULT_PASSWORD in .env');
    await app.close();
    process.exit(1);
  }

  await adminsService.seedAdmin(email, password);
  console.log(`Admin seeded: ${email}`);

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

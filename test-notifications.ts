import { NestFactory } from '@nestjs/core';
import { AppModule } from './api/src/app.module';
import { NotificationCron } from './api/src/modules/notifications/notification.cron';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const cron = app.get(NotificationCron);
  await cron.approvalReminders();
  await app.close();
}
bootstrap();

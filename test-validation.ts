import { ValidationPipe } from '@nestjs/common';
import { UpdateAutomationConfigDto } from './api/src/modules/workspaces/dto/update-automation-config.dto';

async function test() {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const rawPayload = {
    publishingDays: ['Mon', 'Wed'],
    postingTimes: ['10:00', '15:00'],
    platforms: ['facebook'],
    isActive: true,
    unknownField: 'should-be-stripped'
  };

  try {
    const result = await pipe.transform(rawPayload, {
      type: 'body',
      metatype: UpdateAutomationConfigDto,
    });
    console.log('Result with DTO:', result);
  } catch (err: any) {
    console.error('Validation Error with DTO:', err.message);
  }

  try {
    // Simulate what was happening before (no DTO, just generic object type or Partial<Entity>)
    const resultNoDto = await pipe.transform(rawPayload, {
      type: 'body',
      metatype: Object, 
    });
    console.log('Result without DTO (before fix):', resultNoDto);
  } catch (err: any) {
    console.error('Validation Error without DTO:', err.message);
  }
}

test();

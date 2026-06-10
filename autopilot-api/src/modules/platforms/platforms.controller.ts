import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformsService } from './platforms.service';

@ApiTags('Platforms')
@Controller('api/v1/platforms')
export class PlatformsController {
  constructor(private readonly platforms: PlatformsService) {}

  @Get('capabilities')
  capabilities() {
    return this.platforms.getCapabilities();
  }
}

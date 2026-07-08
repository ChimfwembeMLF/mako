import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlansService } from './plans.service';

@ApiTags('Plans')
@Controller('api/v1/plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  /** Public pricing for landing page and billing UI */
  @Get()
  list() {
    return this.plans.getPlansList();
  }
}

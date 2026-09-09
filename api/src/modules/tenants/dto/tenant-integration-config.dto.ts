import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { IntegrationProvider } from '../entities/tenant-integration-config.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertIntegrationConfigDto {
  @ApiProperty({ enum: IntegrationProvider })
  @IsEnum(IntegrationProvider)
  @IsNotEmpty()
  provider: IntegrationProvider;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}

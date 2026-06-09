import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../user/user.entity';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { UserDto } from '../../user/dtos/user.dto';
import { TenantSummaryDto } from '../../tenants/dto/tenant-summary.dto';

export class AuthProfileDto extends UserDto {
  @ApiProperty({ type: TenantSummaryDto })
  tenant: TenantSummaryDto;

  static from(user: UserEntity, tenant: Tenants): AuthProfileDto {
    const dto = new UserDto(user) as AuthProfileDto;
    dto.tenant = TenantSummaryDto.fromEntity(tenant);
    return dto;
  }
}

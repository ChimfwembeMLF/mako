import { ApiProperty } from '@nestjs/swagger';
import { Tenants } from '../entities/tenants.entity';

export class TenantSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  ownerId: string;

  static fromEntity(tenant: Tenants): TenantSummaryDto {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      ownerId: tenant.ownerId,
    };
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { BaseResponseDto } from 'src/common/dtos';
import { UserDto } from 'src/modules/user/dtos/user.dto';
import { TenantSummaryDto } from 'src/modules/tenants/dto/tenant-summary.dto';

export class LoginPayloadDto {
  @Expose()
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @Expose()
  @ApiProperty()
  token: string;

  @Expose()
  @ApiProperty()
  refreshToken: string;

  @Expose()
  @ApiProperty({ type: TenantSummaryDto, required: false })
  tenant?: TenantSummaryDto;
}

export class LoginResponseDto extends BaseResponseDto<LoginPayloadDto> {
  @Type(() => LoginPayloadDto)
  data: LoginPayloadDto;
}

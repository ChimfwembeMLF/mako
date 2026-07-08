import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { PageMetaDto } from './page-meta.dto';

export class PageResponseDto<T> {
  @ApiPropertyOptional()
  success: boolean;
  @ApiPropertyOptional()
  message: string;
  @IsArray()
  @ApiPropertyOptional({ isArray: true })
  data: T[];

  @ApiPropertyOptional({ type: () => PageMetaDto })
  metaData: PageMetaDto;

  static from<T>(
    data: T[],
    metaData: PageMetaDto,
    message = '',
    success = true,
  ) {
    const response = new PageResponseDto<T>();
    response.success = success;
    response.message = message;
    response.metaData = metaData;
    response.data = data;
    return response;
  }
}

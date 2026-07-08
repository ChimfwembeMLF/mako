import { Type } from 'class-transformer';

export class BaseResponseDto<T> {
  success: boolean;

  message: string;
  // @Type(() => Object)
  // @ApiProperty()
  // metadata: any;

  data: T;

  static from<T>(data: T, success = true, message = '') {
    const response = new BaseResponseDto<T>();
    response.success = success;
    response.message = message;
    // response.metadata = metadata;
    response.data = data;
    return response;
  }
}

import { IsString, IsUUID } from 'class-validator';

export class FetchCommentsDto {
  @IsUUID()
  tenantId: string;
}

export class SendCommentReplyDto {
  @IsString()
  message: string;
}

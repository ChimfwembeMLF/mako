import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FetchCommentsDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}

export class SendCommentReplyDto {
  @IsString()
  message: string;
}

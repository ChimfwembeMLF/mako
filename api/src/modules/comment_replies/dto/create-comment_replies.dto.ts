import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDate,
  IsArray,
  IsNumber,
  IsInt,
} from 'class-validator';

export class CommentRepliesCreateDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  contentId: string;

  @IsString()
  platform: string;

  @IsString()
  externalCommentId: string;

  @IsString()
  externalPostId: string;

  @IsString()
  commenterName: string;

  @IsOptional()
  @IsString()
  commenterAvatarUrl?: string;

  @IsString()
  commentText: string;

  @IsOptional()
  @IsString()
  replyText?: string;

  @IsOptional()
  @IsString()
  replyType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  ruleId?: string;

  @IsOptional()
  @IsDate()
  sentAt?: Date;

  @IsOptional()
  @IsString()
  parentCommentId?: string;

  @IsDate()
  createdAt: Date;
}

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

export class CommentRepliesUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  contentId?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  externalCommentId?: string;

  @IsOptional()
  @IsString()
  externalPostId?: string;

  @IsOptional()
  @IsString()
  commenterName?: string;

  @IsOptional()
  @IsString()
  commenterAvatarUrl?: string;

  @IsOptional()
  @IsString()
  commentText?: string;

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

  @IsOptional()
  @IsDate()
  createdAt?: Date;
}

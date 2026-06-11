import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateKnowledgeDocumentDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;
}

import { RequirePermission } from '../auth/rbac/require-permission.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

class RenameMediaDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;
}

interface JwtUser {
  sub: string;
}

@ApiTags('Media')
@Controller('api/v1/media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.media.findByTenant(tenantId, workspaceId);
  }

  @RequirePermission('media.upload')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: { user: JwtUser },
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
    @Query('contentId') contentId?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.media.upload({
      tenantId,
      userId: String(req.user.sub),
      file,
      contentId,
      workspaceId,
    });
  }

  /** Anyone who can add files can name them. */
  @RequirePermission('media.upload')
  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: RenameMediaDto) {
    return this.media.rename(id, dto.tenantId, dto.name);
  }

  @RequirePermission('media.delete')
  @Delete(':id')
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.media.remove(id, tenantId);
  }
}

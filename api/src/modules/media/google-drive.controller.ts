import { Controller, Get, Post, Query, Req, Res, Body, UseGuards } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantIntegrationConfig, IntegrationProvider } from '../tenants/entities/tenant-integration-config.entity';
import { Repository } from 'typeorm';
import { EncryptionService } from '../tenants/services/encryption.service';
import { Request, Response } from 'express';
import { S3StorageService } from './s3-storage.service';
import { MediaAssets } from '../content_items/entities/media_assets.entity';

@Controller('api/v1/integrations/google-drive')
export class GoogleDriveController {
  constructor(
    private readonly googleDriveService: GoogleDriveService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly s3StorageService: S3StorageService,
    @InjectRepository(MediaAssets)
    private readonly mediaRepo: Repository<MediaAssets>,
  ) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  async getAuthUrl(@Query('tenantId') tenantId: string) {
    // Generate auth URL
    const oauth2Client = await this.googleDriveService.getOAuthClient();
    
    // We pass tenantId in the state so we know which tenant this is for when Google redirects back
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.readonly'],
      state,
    });

    return { url };
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') stateBase64: string, @Res() res: Response) {
    try {
      const state = JSON.parse(Buffer.from(stateBase64, 'base64').toString('ascii'));
      const tenantId = state.tenantId;

      if (!tenantId) {
        return res.status(400).send('Invalid state: missing tenantId');
      }

      const oauth2Client = await this.googleDriveService.getOAuthClient();
      const { tokens } = await oauth2Client.getToken(code);

      // Store tokens in tenant_integration_configs
      // Since encryptedApiKey is just a string, we can stringify the tokens object.
      // We mainly need the refresh_token. If access_token is there, we save it too.
      const tokenString = JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      });

      const { encryptedData, iv, authTag } = this.encryptionService.encrypt(tokenString);

      let config = await this.configRepo.findOne({
        where: { tenantId, provider: IntegrationProvider.GOOGLE_DRIVE },
      });

      if (config) {
        config.encryptedApiKey = encryptedData;
        config.iv = iv;
        config.authTag = authTag;
      } else {
        config = this.configRepo.create({
          tenantId,
          provider: IntegrationProvider.GOOGLE_DRIVE,
          encryptedApiKey: encryptedData,
          iv,
          authTag,
        });
      }

      await this.configRepo.save(config);

      // Redirect back to frontend settings page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings/integrations?success=google_drive`);
    } catch (error) {
      console.error('Google Drive OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/settings/integrations?error=google_drive_failed`);
    }
  }

  @Get('files')
  @UseGuards(JwtAuthGuard)
  async listFiles(@Query('tenantId') tenantId: string) {
    const config = await this.configRepo.findOne({
      where: { tenantId, provider: IntegrationProvider.GOOGLE_DRIVE },
    });

    if (!config) {
      throw new Error('Google Drive is not connected');
    }

    const tokenString = this.encryptionService.decrypt(
      config.encryptedApiKey,
      config.iv,
      config.authTag,
    );
    const tokens = JSON.parse(tokenString);

    const drive = await this.googleDriveService.getDriveClient(tokens.access_token, tokens.refresh_token);
    
    // List only images and videos
    const res = await drive.files.list({
      q: "mimeType contains 'image/' or mimeType contains 'video/'",
      fields: 'files(id, name, mimeType, thumbnailLink, size)',
      pageSize: 50,
    });

    return res.data.files;
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  async importFile(
    @Query('tenantId') tenantId: string,
    @Req() req: any,
    @Body() body: { fileId: string; fileName: string; mimeType: string; workspaceId?: string }
  ) {
    const config = await this.configRepo.findOne({
      where: { tenantId, provider: IntegrationProvider.GOOGLE_DRIVE },
    });

    if (!config) {
      throw new Error('Google Drive is not connected');
    }

    const tokenString = this.encryptionService.decrypt(
      config.encryptedApiKey,
      config.iv,
      config.authTag,
    );
    const tokens = JSON.parse(tokenString);

    const drive = await this.googleDriveService.getDriveClient(tokens.access_token, tokens.refresh_token);
    
    // Download the file from Google Drive
    const response = await drive.files.get(
      { fileId: body.fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Upload to S3
    const uploaded = await this.s3StorageService.uploadBuffer({
      tenantId,
      buffer,
      contentType: body.mimeType,
      originalName: body.fileName,
      prefix: 'uploads',
    });

    const mediaType = body.mimeType.startsWith('video/') ? 'video' : 'image';

    // Save media asset
    const asset = await this.mediaRepo.save(
      this.mediaRepo.create({
        tenantId,
        workspaceId: body.workspaceId,
        mediaUrl: uploaded.publicUrl,
        mediaType,
        name: body.fileName,
        uploadedBy: req.user?.id,
        fileSizeBytes: String(buffer.length),
        source: 'google_drive',
        externalId: body.fileId,
      }),
    );

    return asset;
  }
}

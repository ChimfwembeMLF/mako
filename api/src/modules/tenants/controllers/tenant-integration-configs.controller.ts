import { Body, Controller, Delete, Get, Param, Req, UseGuards, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantIntegrationConfig, IntegrationProvider } from '../entities/tenant-integration-config.entity';
import { UpsertIntegrationConfigDto } from '../dto/tenant-integration-config.dto';
import { EncryptionService } from '../services/encryption.service';
import { TenantAccessService } from '../../auth/rbac/tenant-access.service';

type AuthedRequest = { user: { sub: string } };

@Controller('api/v1/tenant-integration-configs')
@UseGuards(JwtAuthGuard)
export class TenantIntegrationConfigsController {
  constructor(
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly access: TenantAccessService,
  ) { }

  @Get(':tenantId')
  async getConfigs(@Req() req: AuthedRequest, @Param('tenantId') tenantId: string) {
    await this.access.assertMember(req.user.sub, tenantId);
    const configs = await this.configRepo.find({ where: { tenantId } });

    // We only return whether the key is configured, NOT the decrypted key!
    return configs.map(config => ({
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      isConfigured: true,
      updatedAt: config.updated_at,
    }));
  }

  @Put(':tenantId')
  async upsertConfig(
    @Req() req: AuthedRequest,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertIntegrationConfigDto,
  ) {
    await this.access.assertMember(req.user.sub, tenantId, 'settings.billing');
    const { encryptedData, iv, authTag } = this.encryptionService.encrypt(dto.apiKey.trim());

    let config = await this.configRepo.findOne({
      where: { tenantId, provider: dto.provider },
    });

    if (config) {
      config.encryptedApiKey = encryptedData;
      config.iv = iv;
      config.authTag = authTag;
    } else {
      config = this.configRepo.create({
        tenantId,
        provider: dto.provider,
        encryptedApiKey: encryptedData,
        iv,
        authTag,
      });
    }

    await this.configRepo.save(config);

    return {
      success: true,
      provider: config.provider,
    };
  }

  @Delete(':tenantId/:provider')
  async deleteConfig(
    @Req() req: AuthedRequest,
    @Param('tenantId') tenantId: string,
    @Param('provider') provider: IntegrationProvider,
  ) {
    await this.access.assertMember(req.user.sub, tenantId, 'settings.billing');
    await this.configRepo.delete({ tenantId, provider });
    return { success: true };
  }
}

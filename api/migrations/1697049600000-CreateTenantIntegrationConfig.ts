import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

export class CreateTenantIntegrationConfig1697049600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tenant_integration_configs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'provider', type: 'varchar', isNullable: false },
          { name: 'encrypted_api_key', type: 'text', isNullable: false },
          { name: 'iv', type: 'varchar', isNullable: false },
          { name: 'auth_tag', type: 'varchar', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createUniqueConstraint(
      'tenant_integration_configs',
      new TableUnique({ columnNames: ['tenant_id', 'provider'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenant_integration_configs');
  }
}

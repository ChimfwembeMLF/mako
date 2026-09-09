import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class DevicePushTokens1784376200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "device_push_tokens",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "user_id",
                        type: "uuid",
                    },
                    {
                        name: "token",
                        type: "varchar",
                    },
                    {
                        name: "platform",
                        type: "varchar",
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                    },
                ],
            }),
            true
        );

        await queryRunner.createForeignKey(
            "device_push_tokens",
            new TableForeignKey({
                columnNames: ["user_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "users",
                onDelete: "CASCADE",
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("device_push_tokens");
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("user_id") !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey("device_push_tokens", foreignKey);
            }
        }
        await queryRunner.dropTable("device_push_tokens");
    }
}

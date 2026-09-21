import { MigrationInterface, QueryRunner } from "typeorm";

export class ParlerVoiceProfiles1790020973365 implements MigrationInterface {
    name = 'ParlerVoiceProfiles1790020973365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chatbot_tts_voices" ADD "parler_voice_description" text`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi','hello','menu','start','0']`);
        await queryRunner.query(`ALTER TABLE "chatbot_tts_voices" ALTER COLUMN "mistral_voice_id" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chatbot_tts_voices" ALTER COLUMN "mistral_voice_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi', 'hello', 'menu', 'start', '0'`);
        await queryRunner.query(`ALTER TABLE "chatbot_tts_voices" DROP COLUMN "parler_voice_description"`);
    }

}

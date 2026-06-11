import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_SYSTEM_MESSAGE = `You are a helpful, professional assistant for this business.

- Be concise, friendly, and accurate.
- Use the brand profile and knowledge documents when answering.
- If you are unsure or information is not in context, say you do not know — never invent facts, prices, or policies.
- Do not provide medical, legal, or financial advice.
- Protect user privacy; do not request sensitive data unless necessary for support.
- When you cannot resolve an issue, suggest contacting the team directly.`;

export class ChatbotDefaultSystemMessage1717920000023 implements MigrationInterface {
  name = 'ChatbotDefaultSystemMessage1717920000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const escaped = DEFAULT_SYSTEM_MESSAGE.replace(/'/g, "''");
    await queryRunner.query(`
      UPDATE chatbot_configs
      SET system_prompt_extra = '${escaped}'
      WHERE system_prompt_extra IS NULL OR TRIM(system_prompt_extra) = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const escaped = DEFAULT_SYSTEM_MESSAGE.replace(/'/g, "''");
    await queryRunner.query(`
      UPDATE chatbot_configs
      SET system_prompt_extra = NULL
      WHERE system_prompt_extra = '${escaped}'
    `);
  }
}

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { writeFileSync } from 'fs';
import { join } from 'path';

export function setupSwagger(app: INestApplication): void {
  // Get ConfigService from the app context
  const configService = app.get(ConfigService);
  const port = process.env.PORT || configService.get<string>('PORT') || 3000;
  const appVersion = configService.get<string>('APP_VERSION');

  const documentBuilder = new DocumentBuilder()
    .setTitle('API')
    .setDescription(
      `### REST

Routes is following REST standard (Richardson level 3)

<details><summary>Detailed specification</summary>
<p>

**List:**
  - \`GET /<resources>/\`backend
    - Get the list of **<resources>** as admin
  - \`GET /user/<user_id>/<resources>/\`
    - Get the list of **<resources>** for a given **<user_id>**
    - Output a **403** if logged user is not **<user_id>**

**Detail:**
  - \`GET /<resources>/<resource_id>\`
    - Get the detail for **<resources>** of id **<resource_id>**
    - Output a **404** if not found
  - \`GET /user/<user_id>/<resources>/<resource_id>\`
    - Get the list of **<resources>** for a given **user_id**
    - Output a **404** if not found
    - Output a **403** if:
      - Logged user is not **<user_id>**
      - The **<user_id>** have no access to **<resource_id>**

**Creation / Edition / Replacement / Suppression:**
  - \`<METHOD>\` is:
    - **POST** for creation
    - **PATCH** for update (one or more fields)
    - **PUT** for replacement (all fields, not used)
    - **DELETE** for suppression (all fields, not used)
  - \`<METHOD> /<resources>/<resource_id>\`
    - Create **<resources>** with id **<resource_id>** as admin
    - Output a **400** if **<resource_id>** conflicts with existing **<resources>**
  - \`<METHOD> /user/<user_id>/<resources>/<resource_id>\`
    - Create **<resources>** with id **<resource_id>** as a given **user_id**
    - Output a **409** if **<resource_id>** conflicts with existing **<resources>**
    - Output a **403** if:
      - Logged user is not **<user_id>**
      - The **<user_id>** have no access to **<resource_id>**
</p>
</details>`,
    )
    .addBearerAuth()
    .addApiKey(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description:
          'Chatbot widget API key (`pk_live_…`). Create keys in AI Chatbot → Embed. Used for `/api/v1/widget/*` routes.',
      },
      'widget-api-key',
    );

  if (appVersion) {
    documentBuilder.setVersion(appVersion);
  }

  const document = SwaggerModule.createDocument(app, documentBuilder.build());

  // Write swagger.json to project root
  const swaggerPath = join(process.cwd(), 'swagger.json');
  writeFileSync(swaggerPath, JSON.stringify(document, null, 2), {
    encoding: 'utf8',
  });

  SwaggerModule.setup('documentation', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  console.info(`Documentation: http://localhost:${port}/documentation`);
  console.info(`Swagger JSON written to: ${swaggerPath}`);
}

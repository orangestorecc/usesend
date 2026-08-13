import { EmailRenderer } from "@usesend/email-editor/src/renderer";
import { db } from "~/server/db";
import { logger } from "~/server/logger/log";
import { STARTER_TEMPLATES } from "~/lib/constants/starter-templates";

/**
 * Provisiona os modelos iniciais (pacote de 10 templates de e-mail marketing
 * para e-commerce) em um time recém-criado, para o cliente já entrar com
 * exemplos prontos. Falha de um modelo não impede os demais nem o cadastro.
 */
export async function provisionStarterTemplates(teamId: number) {
  for (const template of STARTER_TEMPLATES) {
    try {
      const content = template.content;
      const renderer = new EmailRenderer(JSON.parse(content));
      const html = await renderer.render();

      await db.template.create({
        data: {
          teamId,
          name: template.name,
          subject: template.subject,
          content,
          html,
        },
      });
    } catch (error) {
      logger.error(
        { teamId, template: template.name, error },
        "Falha ao provisionar modelo inicial",
      );
    }
  }
}

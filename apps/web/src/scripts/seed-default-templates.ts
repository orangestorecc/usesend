/**
 * Cria os modelos básicos (DEFAULT_TEMPLATES) para um time.
 *
 * Uso (dentro de apps/web):
 *   npx tsx src/scripts/seed-default-templates.ts [teamId]
 *
 * teamId padrão: 1 (conta do admin). Idempotente: pula modelos cujo nome
 * já existe no time.
 */
import React from "react";
// O renderer é compilado com o runtime JSX clássico e espera React global.
(globalThis as any).React = React;

import { PrismaClient } from "@prisma/client";
import { EmailRenderer } from "@usesend/email-editor/src/renderer";
import { DEFAULT_TEMPLATES } from "../lib/constants/default-templates";

const db = new PrismaClient();

async function main() {
  const teamId = Number(process.argv[2] ?? 1);

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new Error(`Time ${teamId} não encontrado`);
  }

  for (const template of DEFAULT_TEMPLATES) {
    const exists = await db.template.findFirst({
      where: { teamId, name: template.name },
    });
    if (exists) {
      console.log(`- "${template.name}" já existe (${exists.id}), pulando`);
      continue;
    }

    const renderer = new EmailRenderer(template.content as any);
    const html = await renderer.render();

    const created = await db.template.create({
      data: {
        teamId,
        name: template.name,
        subject: template.subject,
        content: JSON.stringify(template.content),
        html,
      },
    });
    console.log(`+ "${template.name}" criado (${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

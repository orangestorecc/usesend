import { z } from "zod";

export const ContactBookSchema = z.object({
  id: z.string().openapi({
    description: "ID da lista de contatos",
    example: "clx1234567890",
  }),
  name: z.string().openapi({
    description: "Nome da lista de contatos",
    example: "Newsletter Subscribers",
  }),
  teamId: z.number().openapi({ description: "ID do time", example: 1 }),
  properties: z.record(z.string()).openapi({
    description: "Propriedades personalizadas da lista de contatos",
    example: { customField1: "value1" },
  }),
  variables: z.array(z.string()).openapi({
    description: "Variáveis de personalização permitidas para os contatos desta lista",
    example: ["registrationCode", "company"],
  }),
  emoji: z.string().openapi({
    description: "Emoji associado à lista de contatos",
    example: "📙",
  }),
  doubleOptInEnabled: z.boolean().optional().openapi({
    description: "Indica se o double opt-in está ativo para novos contatos",
    example: true,
  }),
  doubleOptInFrom: z.string().nullable().optional().openapi({
    description:
      "Remetente usado nos e-mails de double opt-in (precisa usar um domínio verificado)",
    example: "Newsletter <hello@example.com>",
  }),
  doubleOptInSubject: z.string().nullable().optional().openapi({
    description: "Assunto usado no e-mail de confirmação do double opt-in",
    example: "Please confirm your subscription",
  }),
  doubleOptInContent: z.string().nullable().optional().openapi({
    description:
      "Conteúdo JSON do editor usado na confirmação do double opt-in",
  }),
  createdAt: z.string().openapi({ description: "Data e hora de criação" }),
  updatedAt: z.string().openapi({ description: "Data e hora da última atualização" }),
  _count: z
    .object({
      contacts: z
        .number()
        .openapi({ description: "Quantidade de contatos na lista" }),
    })
    .optional(),
});

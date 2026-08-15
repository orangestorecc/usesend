import { DomainStatus } from "@prisma/client";
import { z } from "zod";

export const DomainStatusSchema = z.nativeEnum(DomainStatus);

export const DomainDnsRecordSchema = z.object({
  type: z.enum(["MX", "TXT"]).openapi({
    description: "Tipo do registro DNS",
    example: "TXT",
  }),
  name: z
    .string()
    .openapi({ description: "Nome do registro DNS", example: "mail" }),
  value: z
    .string()
    .openapi({
      description: "Valor do registro DNS",
      example: "v=spf1 include:amazonses.com ~all",
    }),
  ttl: z
    .string()
    .openapi({ description: "TTL do registro DNS", example: "Auto" }),
  priority: z
    .string()
    .nullish()
    .openapi({ description: "Prioridade do registro DNS", example: "10" }),
  status: DomainStatusSchema,
  recommended: z
    .boolean()
    .optional()
    .openapi({ description: "Indica se o registro é recomendado" }),
});

export const DomainSchema = z.object({
  id: z.number().openapi({ description: "ID do domínio", example: 1 }),
  name: z
    .string()
    .openapi({ description: "Nome do domínio", example: "example.com" }),
  teamId: z.number().openapi({ description: "ID do workspace", example: 1 }),
  status: DomainStatusSchema,
  region: z.string().default("us-east-1"),
  clickTracking: z.boolean().default(false),
  openTracking: z.boolean().default(false),
  publicKey: z.string(),
  dkimStatus: z.string().optional().nullish(),
  spfDetails: z.string().optional().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dmarcAdded: z.boolean().default(false),
  isVerifying: z.boolean().default(false),
  errorMessage: z.string().optional().nullish(),
  subdomain: z.string().optional().nullish(),
  verificationError: z.string().optional().nullish(),
  lastCheckedTime: z.string().optional().nullish(),
  dnsRecords: z.array(DomainDnsRecordSchema),
});

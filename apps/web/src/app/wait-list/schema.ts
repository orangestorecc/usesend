import { z } from "zod";

export const WAITLIST_EMAIL_TYPES = [
  "transactional",
  "marketing",
] as const;

export const waitlistSubmissionSchema = z.object({
 domain: z
  .string({ required_error: "O domínio é obrigatório" })
  .trim()
  .min(1, "O domínio é obrigatório")
  .max(255, "O domínio deve ter no máximo 255 caracteres")
  .regex(
    /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
    "Digite um domínio válido (ex.: example.com)"
  ),
  emailTypes: z
    .array(z.enum(WAITLIST_EMAIL_TYPES))
    .min(1, "Selecione pelo menos um tipo de e-mail"),
  emailVolume: z
    .string({ required_error: "Informe o volume esperado" })
    .trim()
    .min(1, "Conte-nos quantos e-mails você pretende enviar")
    .max(500, "Mantenha os detalhes do volume abaixo de 500 caracteres"),
  description: z
    .string({ required_error: "Forneça uma breve descrição" })
    .trim()
    .min(10, "Compartilhe um pouco mais de detalhes")
    .max(2000, "A descrição deve ter menos de 2000 caracteres"),
});

export type WaitlistSubmissionInput = z.infer<typeof waitlistSubmissionSchema>;

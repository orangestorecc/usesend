import { z } from "zod";
import { createTRPCRouter, teamProcedure } from "~/server/api/trpc";
import { env } from "~/env";

const MODEL = "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(system: string, user: string): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "IA indisponível: configure ANTHROPIC_API_KEY no ambiente do servidor.",
    );
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha na IA (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (
    json.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

export const aiRouter = createTRPCRouter({
  /**
   * Gera um rascunho de e-mail em HTML simples (parágrafos/títulos/listas) a
   * partir de um prompt. O HTML volta pra ser inserido no editor.
   */
  generateEmail: teamProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(2000),
        tone: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const system = [
        "Você é um redator de e-mail marketing em português do Brasil.",
        "Produza APENAS HTML simples e compatível com e-mail: use <h1>, <h2>, <p>, <ul>, <li>, <strong>, <a>.",
        "NÃO use <html>, <head>, <body>, <style>, <script>, classes ou CSS inline complexo.",
        "Seja objetivo, escaneável e com um CTA claro. Não inclua explicações fora do HTML.",
        input.tone ? `Tom desejado: ${input.tone}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const html = await callClaude(system, input.prompt);
      return { html };
    }),

  /**
   * Reescreve/ajusta um trecho de texto conforme uma instrução.
   */
  rewrite: teamProcedure
    .input(
      z.object({
        text: z.string().min(1).max(4000),
        instruction: z.string().min(2).max(500),
      }),
    )
    .mutation(async ({ input }) => {
      const system =
        "Você reescreve textos de e-mail em português do Brasil. Responda APENAS com o texto final, sem aspas nem comentários.";
      const user = `Instrução: ${input.instruction}\n\nTexto:\n${input.text}`;
      const text = await callClaude(system, user);
      return { text };
    }),
});

import { useCallback } from "react";
import type { AiRequest, AiResult } from "@usesend/email-editor";

import { api } from "~/trpc/react";

/**
 * Liga o executor de IA do editor às mutations tRPC.
 *
 * O pacote `email-editor` não conhece tRPC: ele só recebe uma função. Sem ela,
 * toda a UI de IA some.
 */
export function useAiRequest(): (req: AiRequest) => Promise<AiResult> {
  const generate = api.ai.generateEmail.useMutation();
  const rewrite = api.ai.rewrite.useMutation();

  return useCallback(
    async (req: AiRequest) => {
      if (req.kind === "generate") {
        return generate.mutateAsync({ prompt: req.prompt });
      }
      return rewrite.mutateAsync({
        text: req.text,
        instruction: req.instruction,
      });
    },
    [generate, rewrite],
  );
}

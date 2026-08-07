"use client";

import AddMcpKey from "./add-mcp-key";
import McpList from "./mcp-list";
import { H1 } from "@usesend/ui";

export default function McpPage() {
  return (
    <div>
      <div className="flex justify-between items-center">
        <H1>MCP</H1>
        <AddMcpKey />
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        Integrações de assistente (ChatGPT/Claude). Cada chave dá acesso ao seu
        time com os escopos que você definir.
      </p>
      <McpList />
    </div>
  );
}

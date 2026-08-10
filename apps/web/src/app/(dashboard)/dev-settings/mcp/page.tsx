"use client";

import AddMcpKey from "./add-mcp-key";
import McpList from "./mcp-list";
import ConnectMcp from "./connect-mcp";
import { H1 } from "@usesend/ui";

export default function McpPage() {
  return (
    <div className="space-y-6">
      <ConnectMcp />

      <div>
        <div className="flex items-center justify-between">
          <H1>Chaves do MCP</H1>
          <AddMcpKey />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada chave dá acesso ao seu time com os escopos que você definir.
          Use-as para gerenciar/revogar integrações.
        </p>
        <McpList />
      </div>
    </div>
  );
}

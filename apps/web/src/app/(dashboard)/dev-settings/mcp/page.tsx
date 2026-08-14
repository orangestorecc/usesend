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
          <H1>Conexões e chaves</H1>
          <AddMcpKey />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Tudo que hoje tem acesso à sua conta por IA aparece aqui — o que você
          ligou pelo ChatGPT ou Claude e as chaves fixas que você criou. Dá para
          desligar qualquer um a qualquer momento.
        </p>
        <McpList />
      </div>
    </div>
  );
}

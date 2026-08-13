"use client";

import { useState } from "react";
import { Button } from "@usesend/ui/src/button";
import { Plus } from "lucide-react";
import AddPlatform from "./add-platform";
import PlatformList from "./platform-list";
import { CatalogoPlataformas } from "./catalog";

export default function PlatformsPage() {
  // O botao do topo e o de cada card do catalogo abrem o mesmo dialogo.
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Plataformas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Conecte sua loja para importar clientes como contatos
            automaticamente, e mantenha a base sincronizada no intervalo que
            você escolher.
          </p>
        </div>
        <AddPlatform
          open={addOpen}
          onOpenChange={setAddOpen}
          trigger={
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar plataforma
            </Button>
          }
        />
      </div>

      <PlatformList />
      <CatalogoPlataformas onConectar={() => setAddOpen(true)} />
    </div>
  );
}

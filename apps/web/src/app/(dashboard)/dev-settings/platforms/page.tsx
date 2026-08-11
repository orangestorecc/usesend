"use client";

import AddPlatform from "./add-platform";
import PlatformList from "./platform-list";
import { CatalogoPlataformas } from "./catalog";

export default function PlatformsPage() {
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
        <AddPlatform />
      </div>

      <PlatformList />
      <CatalogoPlataformas />
    </div>
  );
}

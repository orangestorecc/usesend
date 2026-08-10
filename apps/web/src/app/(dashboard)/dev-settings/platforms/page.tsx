"use client";

import AddPlatform from "./add-platform";
import PlatformList from "./platform-list";

export default function PlatformsPage() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Plataformas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Conecte plataformas externas (e-commerce, analytics) e importe
            clientes como contatos automaticamente. A primeira integração puxa
            os clientes da OrangeStore e sincroniza no intervalo escolhido.
          </p>
        </div>
        <AddPlatform />
      </div>
      <PlatformList />
    </div>
  );
}

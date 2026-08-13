"use client";

import { H1 } from "@usesend/ui";
import { AddForwardingRule } from "./add-forwarding-rule";
import { ForwardingList } from "./forwarding-list";

export default function ForwardingPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <H1>Encaminhamento</H1>
        <AddForwardingRule />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        E-mails recebidos nos seus domínios podem ser reenviados para uma caixa
        externa (Gmail, Outlook, o que for). O destino precisa confirmar por
        e-mail antes de qualquer encaminhamento acontecer.
      </p>
      <ForwardingList />
    </div>
  );
}

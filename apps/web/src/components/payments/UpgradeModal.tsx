"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@usesend/ui/src/dialog";
import { CheckCircle2 } from "lucide-react";
import { useUpgradeModalStore } from "~/store/upgradeModalStore";
import { PLAN_PERKS } from "~/lib/constants/payments";
import { LimitReason } from "~/lib/constants/plans";
import { UpgradeButton } from "./UpgradeButton";

export const UpgradeModal = () => {
  const {
    isOpen,
    reason,
    action: { closeModal },
  } = useUpgradeModalStore();

  const basicPlanPerks = PLAN_PERKS.BASIC || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fazer upgrade para o plano Basic</DialogTitle>
          <DialogDescription>
            {(() => {
              const messages: Record<LimitReason, string> = {
                [LimitReason.DOMAIN]:
                  "Você atingiu o limite de domínios do seu plano atual.",
                [LimitReason.CONTACT_BOOK]:
                  "Você atingiu o limite de listas de contatos do seu plano atual.",
                [LimitReason.TEAM_MEMBER]:
                  "Você atingiu o limite de membros do time do seu plano atual.",
                [LimitReason.WEBHOOK]:
                  "Você atingiu o limite de webhooks do seu plano atual.",
                [LimitReason.EMAIL_BLOCKED]:
                  "Você atingiu o limite de envio de e-mails do seu plano atual.",
                // Bloqueio por reputação não se resolve com upgrade: o caminho é
                // higienizar a lista. Por isso a mensagem aponta para lá.
                [LimitReason.EMAIL_BOUNCE_BLOCKED]:
                  "Seus envios estão pausados porque a taxa de retorno (bounce) da sua conta passou do limite. Veja o plano de recuperação em Entregabilidade.",
                [LimitReason.EMAIL_DAILY_LIMIT_REACHED]:
                  "Você atingiu o limite de envio de e-mails do seu plano atual.",
                [LimitReason.EMAIL_FREE_PLAN_MONTHLY_LIMIT_REACHED]:
                  "Você atingiu o limite de envio de e-mails do seu plano atual.",
              };
              return reason
                ? `${messages[reason] ?? ""} Faça upgrade para desbloquear este e outros recursos.`
                : "Desbloqueie mais recursos com o nosso plano Basic.";
            })()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-3">O que você recebe:</h4>
            <ul className="space-y-2">
              {basicPlanPerks.map((perk, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <UpgradeButton />
        </div>
      </DialogContent>
    </Dialog>
  );
};

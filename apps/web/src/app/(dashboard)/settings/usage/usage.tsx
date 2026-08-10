"use client";

import { api } from "~/trpc/react";
import Spinner from "@usesend/ui/src/spinner";
import { format } from "date-fns";
import { Switch } from "@usesend/ui/src/switch";
import { PlanUpgradeButton } from "~/components/payments/plan-upgrade-button";
import { useTeam } from "~/providers/team-context";

const fmt = (n: number) => n.toLocaleString("pt-BR");

function Row({
  label,
  used,
  limit,
  valueText,
}: {
  label: string;
  used?: number;
  limit?: number;
  valueText?: string;
}) {
  const unlimited = limit !== undefined && limit < 0;
  const showBar = !unlimited && limit !== undefined && limit > 0;
  const pct = showBar ? Math.min(100, ((used ?? 0) / (limit as number)) * 100) : 0;

  const right =
    valueText ??
    (unlimited
      ? "Ilimitado"
      : `${fmt(used ?? 0)} / ${fmt(limit ?? 0)}`);

  return (
    <div className="border-b py-3 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">{right}</span>
      </div>
      {showBar ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 border-b py-8 lg:grid-cols-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {description}
        </p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function UsagePage() {
  const { currentTeam } = useTeam();
  const { data, isLoading } = api.limits.usageOverview.useQuery();

  const today = new Date();
  const billingPeriod = `${format(new Date(today.getFullYear(), today.getMonth(), 1), "dd MMM")} – ${format(new Date(today.getFullYear(), today.getMonth() + 1, 1), "dd MMM")}`;

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" innerSvgClass="stroke-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-xl font-bold">Uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">{billingPeriod}</p>
      </div>

      {/* Transacional */}
      <Section
        title="Transacional"
        description="E-mails enviados pela API ou SMTP, integrados ao seu app."
        action={
          currentTeam?.plan === "FREE" ? (
            <PlanUpgradeButton product="transactional" />
          ) : undefined
        }
      >
        <Row
          label="Limite mensal"
          used={data.transactional.monthly.used}
          limit={data.transactional.monthly.limit}
        />
        <Row
          label="Limite diário"
          used={data.transactional.daily.used}
          limit={data.transactional.daily.limit}
        />
      </Section>

      {/* Marketing */}
      <Section
        title="Marketing"
        description="Crie e envie campanhas usando Contatos e Broadcasts."
        action={
          currentTeam?.plan === "FREE" ? (
            <PlanUpgradeButton product="marketing" />
          ) : undefined
        }
      >
        <Row
          label="Contatos"
          used={data.marketing.contacts.used}
          limit={data.marketing.contacts.limit}
        />
        <Row
          label="Segmentos"
          used={data.marketing.segments.used}
          limit={data.marketing.segments.limit}
        />
        <Row
          label="Broadcasts"
          used={data.marketing.broadcasts.used}
          limit={data.marketing.broadcasts.limit}
        />
      </Section>

      {/* Time */}
      <Section
        title="Time"
        description="Cotas e limites do seu time."
      >
        <Row
          label="Créditos de IA"
          used={data.team.aiCredits.used}
          limit={data.team.aiCredits.limit}
        />
        <Row
          label="Automações"
          used={data.team.automations.used}
          limit={data.team.automations.limit}
        />
        <Row
          label="Domínios"
          used={data.team.domains.used}
          limit={data.team.domains.limit}
        />
        <Row label="Limite de requisições" valueText={`${data.team.rateLimit} req/s`} />
      </Section>

      {/* Extras — pay-as-you-go */}
      <Section
        title="Extras"
        description="Pay-as-you-go: continue usando além da sua cota. (Em breve)"
      >
        <div className="border-b py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Transacional · R$ {data.extras.transactionalOverage.pricePerThousandBRL.toFixed(2)} / 1.000 e-mails
              </div>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Quando ativo, você continua enviando além da cota. Cobrança
                automática por bloco adicional de 1.000 e-mails.
              </p>
            </div>
            <Switch disabled />
          </div>
        </div>
        <div className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                Automações · R$ {data.extras.automationsOverage.pricePerRunBRL.toFixed(4)} / execução
              </div>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Comece com execuções gratuitas e escale conforme a necessidade.
              </p>
            </div>
            <Switch disabled />
          </div>
        </div>
      </Section>

      {/* Add-ons */}
      <Section
        title="Add-ons"
        description="Recursos especiais para ir além."
      >
        <div className="py-3">
          <div className="text-sm font-medium">
            IP dedicado · R$ {data.addons.dedicatedIp.pricePerMonthBRL.toFixed(2)} / mês
          </div>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Provisionamos, aquecemos e monitoramos um IP dedicado para
            entregabilidade consistente.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.addons.dedicatedIp.available
              ? "Disponível no seu plano."
              : "Disponível a partir do plano Pro."}
          </p>
        </div>
      </Section>

    </div>
  );
}

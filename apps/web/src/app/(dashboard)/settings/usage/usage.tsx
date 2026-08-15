"use client";

import { api } from "~/trpc/react";
import Spinner from "@usesend/ui/src/spinner";
import { format } from "date-fns";
import { Switch } from "@usesend/ui/src/switch";
import { Button } from "@usesend/ui/src/button";
import { toast } from "@usesend/ui/src/toaster";
import { PlanUpgradeButton } from "~/components/payments/plan-upgrade-button";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const brl = (n: number, casas = 2) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

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

/**
 * Cabeçalho do plano vigente.
 *
 * O nome do plano tem que ser a primeira coisa legível da página: era a
 * pergunta que a tela de Uso não respondia — dava para ler cota, limite e
 * consumo sem descobrir em que plano a conta estava. E o botão de upgrade
 * fica aqui sempre, não só no Free: quem já é Pro é justamente quem tem para
 * onde subir.
 */
function PlanoVigente() {
  const { data } = api.payments.billingState.useQuery();
  if (!data) return null;

  const emAtraso = data.isOverdue || Boolean(data.blockedAt);

  return (
    <div className="mb-2 rounded-xl border bg-muted/20 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Seu plano
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              {data.planName}
            </h2>
            {emAtraso ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                Fatura em aberto
              </span>
            ) : data.isPaid ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                Ativo
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.planProduct === "marketing"
              ? "E-mails de marketing"
              : "E-mails transacionais"}
          </p>
        </div>

        <div className="flex gap-2">
          <PlanUpgradeButton
            product={data.planProduct}
            label={data.isPaid ? "Mudar de plano" : "Fazer upgrade"}
          />
        </div>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.limits.usageOverview.useQuery();
  const setExtras = api.limits.setExtras.useMutation({
    onSuccess: () => {
      utils.limits.usageOverview.invalidate();
      toast.success("Preferência salva.");
    },
    onError: (e) => toast.error(e.message),
  });

  const today = new Date();
  const billingPeriod = `${format(new Date(today.getFullYear(), today.getMonth(), 1), "dd MMM")} – ${format(new Date(today.getFullYear(), today.getMonth() + 1, 1), "dd MMM")}`;

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" innerSvgClass="stroke-primary" />
      </div>
    );
  }

  const extras = data.extras;
  const ip = data.addons.ipDedicado;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">Uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">{billingPeriod}</p>
      </div>

      <PlanoVigente />

      {/* Transacional */}
      <Section
        title="Transacional"
        description="E-mails enviados pela API ou SMTP, integrados ao seu app."
        action={<PlanUpgradeButton product="transactional" label="Ver planos" />}
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
        action={<PlanUpgradeButton product="marketing" label="Ver planos" />}
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

      {/* Workspace */}
      <Section
        title="Workspace"
        description="Cotas e limites deste workspace."
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
        description="Pay-as-you-go: continue usando além da sua cota, cobrado na próxima fatura."
        action={
          extras.elegivel ? undefined : (
            <PlanUpgradeButton label="Fazer upgrade para liberar" />
          )
        }
      >
        <div className="border-b py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">
                Transacional · {brl(extras.transacional.precoPorMilBRL)} / 1.000
                e-mails
              </div>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                {extras.elegivel
                  ? "Quando ativo, você continua enviando além da cota. Cobrança automática por bloco adicional de 1.000 e-mails."
                  : "Disponível a partir de um plano pago — no Free o caminho é o upgrade."}
              </p>
              {extras.transacional.cotaMensal ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cota do plano: {fmt(extras.transacional.cotaMensal)} e-mails ·
                  já excedidos neste ciclo:{" "}
                  <span className="font-medium text-foreground">
                    {fmt(extras.transacional.excedenteAtual)}
                  </span>
                </p>
              ) : null}
            </div>
            <Switch
              checked={extras.transacional.ativo}
              disabled={!extras.elegivel || setExtras.isPending}
              onCheckedChange={(v) => setExtras.mutate({ transacional: v })}
            />
          </div>
        </div>
        <div className="border-b py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">
                Automações · {brl(extras.automacoes.precoPorExecucaoBRL, 4)} /
                execução
              </div>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                As primeiras {fmt(extras.automacoes.execucoesInclusas)} execuções
                do mês são gratuitas; daí em diante você paga por execução.
              </p>
            </div>
            <Switch
              checked={extras.automacoes.ativo}
              disabled={!extras.elegivel || setExtras.isPending}
              onCheckedChange={(v) => setExtras.mutate({ automacoes: v })}
            />
          </div>
        </div>

        {/* O valor corrente fica visível o tempo todo: extra que só aparece na
            fatura é extra que vira reclamação. */}
        <div className="flex items-center justify-between py-3">
          <span className="text-sm">Extras deste ciclo</span>
          <span className="font-mono text-sm">
            {brl(extras.acumuladoCents / 100)}
          </span>
        </div>
        {extras.detalhe ? (
          <p className="-mt-2 pb-3 text-xs text-muted-foreground">
            {extras.detalhe}
          </p>
        ) : null}
      </Section>

      {/* Add-ons */}
      <Section title="Add-ons" description="Recursos especiais para ir além.">
        <div className="flex items-start justify-between gap-4 py-3">
          <div>
            <div className="text-sm font-medium">
              IP dedicado · {brl(ip.precoMensalBRL)} / mês
            </div>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Provisionamos, aquecemos e monitoramos um IP dedicado para
              entregabilidade consistente.
            </p>
            {/* Etapas em ordem de precedência: cancelado > operação >
                aquecimento > pedido. Cada uma diz onde o IP está e se já
                custa alguma coisa — "leva alguns dias" sozinho não responde
                nem uma coisa nem outra. */}
            <p className="mt-2 text-xs">
              {ip.canceladoEm ? (
                <span className="text-muted-foreground">
                  Cancelado em{" "}
                  {format(new Date(ip.canceladoEm), "dd MMM yyyy")} — a fatura
                  deste mês cobra só os dias em que o IP esteve em operação.
                </span>
              ) : ip.ativoDesde ? (
                <span className="text-emerald-600">
                  Em operação desde{" "}
                  {format(new Date(ip.ativoDesde), "dd MMM yyyy")}
                  {ip.endereco ? ` · IP ${ip.endereco}` : ""} — cobrado na
                  fatura mensal, proporcional aos dias em operação.
                </span>
              ) : ip.aquecendoDesde ? (
                <span className="text-amber-600">
                  Etapa 2 de 3 · em aquecimento desde{" "}
                  {format(new Date(ip.aquecendoDesde), "dd MMM yyyy")}
                  {ip.endereco ? ` · IP ${ip.endereco}` : ""}. Subimos o volume
                  aos poucos para o IP ganhar reputação. Ainda sem cobrança.
                </span>
              ) : ip.solicitadoEm ? (
                <span className="text-amber-600">
                  Etapa 1 de 3 · solicitado em{" "}
                  {format(new Date(ip.solicitadoEm), "dd MMM yyyy")}. Estamos
                  provisionando o IP; o aquecimento começa em seguida e leva
                  alguns dias. Ainda sem cobrança.
                </span>
              ) : ip.disponivel ? (
                <span className="text-muted-foreground">
                  Disponível no seu plano.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Disponível a partir do plano {ip.planoMinimo}.
                </span>
              )}
            </p>
          </div>

          {ip.canceladoEm ? (
            ip.disponivel ? (
              <Button
                size="sm"
                disabled={setExtras.isPending}
                onClick={() => setExtras.mutate({ ipDedicado: true })}
              >
                Reativar
              </Button>
            ) : null
          ) : ip.ativoDesde || ip.aquecendoDesde || ip.solicitadoEm ? (
            // Um add-on de R$ 150/mês precisa de saída na própria tela: antes,
            // depois de ativo, não havia botão nenhum aqui.
            <Button
              variant="outline"
              size="sm"
              disabled={setExtras.isPending}
              onClick={() => setExtras.mutate({ ipDedicado: false })}
            >
              {ip.ativoDesde ? "Cancelar add-on" : "Cancelar pedido"}
            </Button>
          ) : ip.disponivel ? (
            <Button
              size="sm"
              disabled={setExtras.isPending}
              onClick={() => setExtras.mutate({ ipDedicado: true })}
            >
              Solicitar
            </Button>
          ) : (
            <PlanUpgradeButton label="Fazer upgrade" />
          )}
        </div>
      </Section>
    </div>
  );
}

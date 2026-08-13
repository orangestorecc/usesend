# Ciclo de vida comercial da conta

Plano, inadimplência, downgrade e contas paradas. Complementa `PLANOS-SPEC.md`
(que descreve o catálogo) e `BOUNCE-CONTROL-SPEC.md` (bloqueio por reputação,
que é independente deste).

## 1. Qual é o plano de um time

A tabela de preços manda. O time guarda `planKey` + `planProduct`, que apontam
para `PlanCatalogEntry`; o enum `Plan` (FREE/BASIC) continua existindo só porque
os limites antigos leem dele, e é mantido como espelho.

- Fonte única de escrita: `aplicarPlano()` em `server/billing/plan-service.ts`.
  Ninguém escreve `team.plan` direto.
- `planKey === "free"` → `Plan.FREE`; qualquer outra chave → `Plan.BASIC`.
- Preço e nome vêm de `PlanCatalogEntry`; o catálogo do código
  (`lib/constants/plan-catalog.ts`) é só semente e plano B.

## 2. Inadimplência e trava (24h)

| Momento | O que acontece |
|---|---|
| Vencimento da fatura | Faixa de aviso no topo do painel, em todas as telas |
| +24h | `billingBlockedAt` preenchido, envio pausado, e-mail ao responsável |
| Pagamento confirmado | `destravarSePago` limpa a trava **se** não sobrou fatura vencida |

- Quem trava: `travarInadimplentes()`, chamado de hora em hora pelo
  `billing-lifecycle-job`. De hora em hora e não uma vez por dia porque a
  promessa é "24 horas", e um tique diário a transformaria em 24–48h.
- Trava = envio pausado, painel liberado. Quem não entra no painel não paga a
  fatura que o destravaria.
- Campo próprio (`billingBlockedAt`), separado de `isBlocked` (bloqueio manual
  do admin) e de `sendingBlockedAt` (reputação). São três motivos diferentes e
  não podem se desfazer um ao outro.

## 3. Downgrade para o gratuito

- Cliente: Configurações > Faturamento, com confirmação por digitação.
  Só o admin do time (`teamAdminProcedure`).
- Admin da plataforma: escolhendo o plano Free no formulário do time.
- Efeito imediato: assinatura recebe `status=canceled`, `canceledAt`, `endedAt`
  e `cancelReason`; o time volta para `planKey=free`; a trava sai.
- Não guardamos o acesso pago até o fim do período — quem pede downgrade quer
  parar de pagar agora.

## 4. Conta gratuita inativa

- Inatividade = 6 meses sem envio (`DailyEmailUsage`) e sem sessão de login.
- Aviso por e-mail 30 dias antes, gravando `inactivityWarnedAt` e
  `inactivityDeleteAt`.
- Qualquer atividade dentro da janela limpa os dois campos e cancela a exclusão.
- Nunca exclui sem aviso enviado, mesmo para conta parada há anos.
- Roda no mesmo job, uma vez por dia (04h BRT).

## 5. Indicadores (admin > clientes)

`server/billing/customer-insights.ts`, quatro consultas agregadas para a base
inteira — nada por cliente.

- **MRR**: preço mensal só de quem está em dia. O preço vem da última cobrança
  paga do plano vigente (reflete cupom e faixa); tabela de preços é o plano B.
- **MRR em risco**: mesmo cálculo, para atrasados e travados.
- **Conversão**: pagantes ÷ total, sobre todos os times (não sobre a página).
- **Churn 30d**: cancelamentos ÷ (pagantes de hoje + cancelamentos). Aproxima a
  base do início da janela sem exigir histórico diário de assinantes.
- **LTV**: ARPU ÷ churn mensal. Sem cancelamento não há divisor — mostra `—`.

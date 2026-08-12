# Spec — Planos e precificação (modal de planos + página de planos)

Modelo copiado do Resend (https://resend.com/pricing), com os preços em dólar
**multiplicados por 5** e expressos em reais. Decisão do produto, registrada
aqui para não se perder: `R$ = US$ × 5`.

Estado atual do código: os cards existem, o slider existe e o `tier` já é
estado do componente — mas **o slider não muda preço nenhum**. Os valores em
`plan-catalog.ts` são os números do Resend copiados como se fossem reais
(R$ 20, R$ 90, R$ 40). Isso é o que esta spec corrige.

---

## 1. Comportamento do slider

O slider é o controle principal da tela. Ele não filtra nem rola nada: ele
**reprecifica os cards** e decide qual card é o recomendado.

Regras, iguais às do Resend:

1. O slider tem passos discretos, com rótulo embaixo de cada marca. Não é
   contínuo — arrastar sempre encaixa num passo.
2. A cada passo, exatamente **um** card é o recomendado: fica em destaque
   (fundo levemente cinza, borda visível, badge "Recomendado" e botão preto).
3. **Todos os outros cards ficam esmaecidos** — texto em cinza claro, ícones
   de feature em cinza, botão cinza. Continuam clicáveis; é só hierarquia
   visual, não desabilitação.
4. O card recomendado é o **mais barato que atende o volume escolhido**.
5. Os cards de volume variável (Pro e Scale no transacional, Pro marketing no
   marketing) **trocam preço e volume** conforme o passo. Free e Enterprise
   nunca mudam.
6. Um card que já foi ultrapassado pelo slider **congela no seu teto** e fica
   esmaecido. Ex.: passando de 200.000 no transacional, o Pro fica parado em
   R$ 175 / 100.000 e não acompanha mais.
7. No primeiro passo (3.000 transacional / 1.000 marketing) **nenhum card leva
   o badge "Recomendado"** — o Free é o plano atual, e o botão dele diz "Plano
   atual". Esse é o estado inicial ao abrir a modal.
8. No último passo (3.000.000+ / 200.000+) o recomendado é o Enterprise.

### Caso especial: 100.000 no transacional

É o único passo em que **dois cards ficam acesos** ao mesmo tempo. Em 100.000
tanto o Pro (que sobe para R$ 175) quanto o Scale (R$ 450) atendem o volume;
os dois saem do cinza, e o badge "Recomendado" vai para o Pro, que é o mais
barato. O Scale fica aceso porque é ali que ele passa a fazer sentido — é o
que entrega suporte por Slack, 1.000 domínios e IP dedicado.

Não é um bug do Resend: é o ponto de virada entre os dois planos, e vale
copiar.

---

## 2. Transacional — matriz de preços

Passos do slider: `3.000 · 50.000 · 100.000 · 200.000 · 500.000 · 1.000.000 ·
1.500.000 · 2.500.000 · 3.000.000+`

| Passo | Free | Pro | Scale | Enterprise | Recomendado |
|---|---|---|---|---|---|
| 3.000 | R$ 0 / 3.000 | R$ 100 / 50.000 | R$ 450 / 100.000 | Personalizado | — (Free = plano atual) |
| 50.000 | R$ 0 | **R$ 100 / 50.000** | R$ 450 / 100.000 | Personalizado | Pro |
| 100.000 | R$ 0 | **R$ 175 / 100.000** | **R$ 450 / 100.000** | Personalizado | Pro (Scale também aceso) |
| 200.000 | R$ 0 | R$ 175 / 100.000 | **R$ 800 / 200.000** | Personalizado | Scale |
| 500.000 | R$ 0 | R$ 175 / 100.000 | **R$ 1.750 / 500.000** | Personalizado | Scale |
| 1.000.000 | R$ 0 | R$ 175 / 100.000 | **R$ 3.250 / 1.000.000** | Personalizado | Scale |
| 1.500.000 | R$ 0 | R$ 175 / 100.000 | **R$ 4.125 / 1.500.000** | Personalizado | Scale |
| 2.500.000 | R$ 0 | R$ 175 / 100.000 | **R$ 5.750 / 2.500.000** | Personalizado | Scale |
| 3.000.000+ | R$ 0 | R$ 175 / 100.000 | R$ 5.750 / 2.500.000 | **Personalizado** | Enterprise |

Conferência com o original: 20→100, 35→175, 90→450, 160→800, 350→1.750,
650→3.250, 825→4.125, 1.150→5.750.

### E-mails extras (excedente)

Linha pequena embaixo do volume: `E-mails extras: R$ X / 1.000`.

| Volume do card | Resend | Madmail |
|---|---|---|
| Pro (qualquer) | US$ 0,90 | **R$ 4,50 / 1.000** |
| Scale 100.000 | US$ 0,90 | R$ 4,50 / 1.000 |
| Scale 200.000 | US$ 0,80 | R$ 4,00 / 1.000 |
| Scale 500.000 | US$ 0,70 | R$ 3,50 / 1.000 |
| Scale 1.000.000 | US$ 0,65 | R$ 3,25 / 1.000 |
| Scale 1.500.000 | US$ 0,52 | R$ 2,60 / 1.000 |
| Scale 2.500.000 | US$ 0,46 | R$ 2,30 / 1.000 |

O Free não tem excedente — ele para no limite.

### Features por card (transacional)

Já estão corretas em `plan-catalog.ts` e **não mudam com o slider**:

- **Free** — Envio e recebimento · Suporte por ticket · 10.000 execuções de
  automação · Retenção de dados por 30 dias · 1 domínio · 5 créditos de IA/mês
  · ✗ 100 e-mails por dia · ✗ IPs dedicados
- **Pro** — igual ao Free, mas 10 domínios · 100 créditos de IA/mês · Sem
  limite diário · ✗ IPs dedicados
- **Scale** — Suporte via Slack e ticket · 1.000 domínios · 500 créditos de
  IA/mês · Sem limite diário · IP dedicado como add-on
- **Enterprise** — Suporte prioritário · tudo flexível · IPs dedicados como
  add-on

---

## 3. Marketing — matriz de preços

Aqui a unidade é **contato**, não disparo. O envio de broadcasts é ilimitado
em todos os planos — isso precisa estar visível no card, porque é o principal
diferencial de percepção contra Mailchimp e RD Station.

Passos do slider: `1.000 · 5.000 · 10.000 · 25.000 · 50.000 · 100.000 ·
150.000 · 200.000+`

São só **três** cards: Free, Pro marketing e Enterprise.

| Passo | Free | Pro marketing | Enterprise | Recomendado |
|---|---|---|---|---|
| 1.000 | R$ 0 / 1.000 contatos | R$ 200 / 5.000 | Personalizado | — (Free = plano atual) |
| 5.000 | R$ 0 | **R$ 200 / 5.000** | Personalizado | Pro marketing |
| 10.000 | R$ 0 | **R$ 400 / 10.000** | Personalizado | Pro marketing |
| 25.000 | R$ 0 | **R$ 900 / 25.000** | Personalizado | Pro marketing |
| 50.000 | R$ 0 | **R$ 1.250 / 50.000** | Personalizado | Pro marketing |
| 100.000 | R$ 0 | **R$ 2.250 / 100.000** | Personalizado | Pro marketing |
| 150.000 | R$ 0 | **R$ 3.250 / 150.000** | Personalizado | Pro marketing |
| 200.000+ | R$ 0 | R$ 3.250 / 150.000 | **Personalizado** | Enterprise |

Conferência: 40→200, 80→400, 180→900, 250→1.250, 450→2.250, 650→3.250.

### Features por card (marketing)

- **Free** — 1.000 contatos · Envio de broadcasts ilimitado · Suporte por
  ticket · 10.000 execuções de automação · 3 segmentos · 1 domínio · 5
  créditos de IA/mês · ✗ Analytics de marketing · ✗ IPs dedicados
- **Pro marketing** — Envio de broadcasts ilimitado · Suporte via Slack e
  ticket · 10.000 execuções · Segmentos ilimitados · Domínios ilimitados · 100
  créditos de IA/mês · Analytics de marketing · ✗ IP dedicado como add-on
- **Enterprise** — Suporte prioritário · tudo ilimitado/flexível · Analytics
  de marketing · IPs dedicados inclusos

Obs.: o `MCP` que hoje está na lista de features de marketing é nosso, não do
Resend. Manter.

---

## 4. O que muda no código

### 4.1 `plan-catalog.ts` — preço vira função do passo

Hoje `CatalogPlan.priceBRL` é um número fixo. Precisa virar uma **tabela por
passo**. Sugestão de forma, mantendo o resto da estrutura:

```ts
export type PlanTierPricing = {
  /** Índice do passo do slider a partir do qual este preço vale. */
  fromTier: number;
  priceBRL: number;
  volume: string;
  extra?: string;
};
```

E uma função pura, fácil de testar:

```ts
export function resolvePlanAtTier(plan: CatalogPlan, tier: number): {
  priceBRL: number | null;
  volume: string;
  extra?: string;
  recommended: boolean;
  dimmed: boolean;
};
```

Toda a matriz das seções 2 e 3 é dado de entrada dessa função. **Teste
unitário obrigatório**: percorrer os 9 passos do transacional e os 8 do
marketing e conferir preço, volume, excedente, quem é o recomendado e quem
está esmaecido. É dinheiro — e já pegamos um bug de dinheiro antes com o
parser de juros.

### 4.2 `PlanCatalogEntry` — schema

O modelo atual tem `@@unique([product, key])`: **uma linha por card**, o que
não consegue guardar preço por passo. Precisa de uma linha por (produto, card,
passo):

- adicionar `tier Int` (o índice do passo, ou o volume numérico)
- trocar a unique para `@@unique([product, key, tier])`

Isso é mudança de schema → **exige migration versionada**, pela regra do
projeto (produção roda `migrate deploy`, não `db push`). E exige reescrever o
seed a partir dos defaults.

Alternativa mais barata, se a ideia de editar preço pelo admin não for
prioridade agora: deixar a matriz só no código (`plan-catalog.ts`) e manter o
`PlanCatalogEntry` apenas para textos e features. Decidir antes de começar —
muda bastante o tamanho do trabalho.

### 4.3 `plans-modal.tsx` — ligar o slider

O estado `tier` já existe e já é passado para o slider. Falta:

- passar `tier` por `resolvePlanAtTier` para cada card;
- aplicar as classes de esmaecido/destaque conforme o retorno;
- mostrar o badge "Recomendado" só no card recomendado;
- no primeiro passo, botão do Free = "Plano atual", desabilitado, e nenhum
  badge na tela;
- trocar o texto do botão para o preço vigente ("Mudar para R$ 175 / mês"),
  como no Resend.

### 4.4 Checkout

`checkout/page.tsx` e `payment-service.ts` recebem hoje um plano com preço
fixo. Passam a precisar do **par (plano, passo)** para saber quanto cobrar. O
preço tem que ser recalculado **no servidor** a partir desse par — nunca
aceitar o valor que veio do navegador.

---

## 5. Dois pontos que valem uma decisão sua

**O câmbio de 5 está bem calibrado.** Pagar o Resend com cartão brasileiro
hoje custa o dólar do dia mais IOF de 3,5%: os US$ 20 do Pro saem por volta de
R$ 115. Cobrar R$ 100 deixa a Madmail um pouco mais barata que importar o
concorrente, com nota fiscal em real e suporte em português. É uma posição
defensável — e o dia em que o dólar subir, ela melhora sozinha.

**O degrau do marketing entre 5.000 e 10.000 contatos é duro.** R$ 200 → R$
400 dobra o preço na faixa onde está a maior parte das PMEs brasileiras.
Copiar o Resend aqui importa uma curva desenhada para o mercado americano. Se
o alvo for loja e agência, talvez valha um passo intermediário — algo como
7.500 contatos por R$ 300. Não mexi em nada: a spec está fiel ao ×5 que você
pediu. Só fica o registro.

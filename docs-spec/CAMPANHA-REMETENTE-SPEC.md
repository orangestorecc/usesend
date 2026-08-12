# Spec — Remetente da campanha e aviso de domínio

Problema observado: na tela "Criar nova campanha" o campo **De** é texto livre
com placeholder `Nome amigável <from@example.com>`. Quem não é técnico digita
qualquer coisa, clica em Criar e leva um toast seco — *"O e-mail de remetente
é inválido"* — sem entender o que era esperado. E se o time ainda não tem
domínio verificado, **não existe endereço válido possível**: a tela deixa a
pessoa tentar e falhar sem explicar o porquê.

São dois problemas distintos. Um é de informação (falta domínio), outro é de
entrada de dados (formato do endereço).

---

## 1. Aviso de domínio na tela de criar campanha

Buscar `api.domain.domains.useQuery()` ao abrir o diálogo e classificar:

| Situação | O que mostrar | Botão "Criar" |
|---|---|---|
| Nenhum domínio cadastrado | Bloco de alerta: "Para enviar campanhas você precisa de um domínio verificado. Nenhum domínio foi cadastrado ainda." + link **Adicionar domínio** (`/domains`) | desabilitado |
| Domínios existem, nenhum verificado | Alerta: "O domínio *x.com.br* ainda está em verificação. Enquanto ela não terminar, não é possível enviar." + link para o domínio | desabilitado |
| Ao menos um verificado | Nenhum alerta | habilitado |

O botão desabilitado precisa de `title` explicando o motivo — botão morto sem
explicação é pior que erro. Enquanto a query carrega, o botão fica em estado
de carregamento, não desabilitado com cara de bloqueio.

Só conta como pronto o domínio com `status === "SUCCESS"`, que é o mesmo
critério que o `validateDomainFromEmail` usa no servidor na hora de enviar.
Usar critério diferente aqui criaria uma tela que diz "pode" e um backend que
diz "não pode".

---

## 2. Campo "De" dividido

### Forma

Trocar o input único por três controles numa linha, com preview embaixo:

```
Nome de exibição (opcional)     Usuário            Domínio
[ Loja do João            ]     [ contato    ] @ [ loja.com.br ▾ ]

Vai chegar como: Loja do João <contato@loja.com.br>
```

- **Nome de exibição** — opcional. Vazio ⇒ manda só o endereço.
- **Usuário** — a parte antes do `@`. Texto livre, com validação.
- **Domínio** — `Select` populado **apenas com os domínios verificados**. Se
  só existe um, já vem selecionado e o campo não fica vazio esperando clique.

O valor enviado ao backend continua sendo **uma string só** — `Nome <user@dominio>`
ou `user@dominio`. Nada muda no schema, na API ou no `validateDomainFromEmail`.
A composição é toda de interface. Isso mantém a mudança barata e sem migration.

### Validação do usuário

Validar na hora da digitação, com mensagem em português:

- vazio ⇒ "Informe a parte antes do @"
- contém `@` ⇒ "Digite só o que vem antes do @ — o domínio é escolhido ao lado"
- caracteres fora de `a-z A-Z 0-9 . _ % + -` ⇒ "Use apenas letras, números e . _ + -"
- começa ou termina com `.` ⇒ "Não pode começar nem terminar com ponto"

Normalizar para minúsculas ao sair do campo.

### Compatibilidade com o que já existe

A tela de **edição** da campanha também tem o campo De, e as campanhas já
salvas têm `from` em texto livre. O componente precisa saber ler de volta:

1. Tentar casar `^\s*(.*?)\s*<([^@\s]+)@([^>\s]+)>\s*$` ou `^([^@\s]+)@([^>\s]+)$`.
2. Se casar **e** o domínio estiver na lista de verificados ⇒ preencher os três
   campos.
3. Se não casar, ou o domínio não estiver na lista (domínio removido, ou
   endereço herdado) ⇒ cair num **modo avançado**: mostra o input de texto
   livre de hoje com um aviso discreto ("Este remetente não segue o formato
   padrão") e um link "usar os campos guiados", que limpa e volta ao modo
   normal.

Sem o modo avançado, abrir uma campanha antiga poderia silenciosamente
reescrever ou apagar o remetente dela. Esse é o risco real da mudança e é
onde o teste tem que bater.

---

## 3. Onde aplicar

Criar um componente reutilizável — sugestão `~/components/from-address-field.tsx`
— e usar em:

1. `campaigns/create-campaign.tsx` (o caso do print)
2. `campaigns/[campaignId]/edit` (mesmo campo, mesma dor)
3. `contacts/[contactBookId]/double-opt-in` — o campo "De" ali tem exatamente
   o mesmo problema, com o agravante de que um erro só aparece na hora em que
   o contato é importado

Sugiro fazer 1 e 2 juntos, e 3 depois, para o diff não ficar grande demais.

---

## 4. Testes

Unitários da função pura de compor/decompor o endereço, que é onde mora o
risco:

- compor sem nome de exibição ⇒ `user@dominio`
- compor com nome ⇒ `Nome <user@dominio>`
- decompor `Loja <contato@loja.com.br>` ⇒ três partes
- decompor `contato@loja.com.br` ⇒ nome vazio
- decompor lixo (`rwerewrew`, o do print) ⇒ modo avançado, sem perder o texto
- decompor endereço com domínio que não está mais na lista ⇒ modo avançado
- nome de exibição com `<`, `>` ou aspas ⇒ escapado ou rejeitado, nunca
  gerando um header quebrado

E um teste de componente cobrindo os três estados de domínio da seção 1.

---

## 5. Fora de escopo (proposital)

- Não mexer no formato guardado no banco. `Campaign.from` continua string.
- Não criar cadastro de "remetentes salvos". Seria útil, mas é outra feature.
- Não validar se a caixa `user@dominio` existe de verdade — não dá para saber,
  e o domínio verificado já garante o que importa para entrega.

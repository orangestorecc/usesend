# Spec — Importação de contatos por arquivo

## O que já existe (e não vamos jogar fora)

Existe hoje `bulk-upload-contacts.tsx`, acessível pelo menu **Ações** da lista.
Ele já: aceita `.csv`/`.txt` por seleção ou arrastar, faz parse com aspas,
detecta cabeçalho, deduplica por e-mail, valida formato, mostra
pré-visualização de 20 linhas com Válido/Inválido, resume total/válidos/
inválidos e limita a 50.000 por envio.

Também já existe **auto-mapeamento** de colunas, mas **invisível**: ele casa
os cabeçalhos por nome (`email`, `e-mail`, `first name`, `subscribed`…) e joga
o resto em `properties`. Quem escreveu a planilha com "E-mail do cliente" não
tem como saber que aquela coluna não foi reconhecida, nem como corrigir.

E a infraestrutura de arquivo já está pronta: `storage-service.ts` com S3
compatível, configurado em produção (`S3_COMPATIBLE_BUCKET=madmail`).

## O que falta

1. Modal com **explicação** e **modelo para download** (CSV e XLSX).
2. **DE-PARA visível e editável** — a peça central do pedido.
3. **Progresso real** durante a importação.
4. **Log das importações**, com o arquivo preservado e link para baixar.

---

## Fluxo desenhado

### Passo 1 — Explicação e modelo
Modal explica em duas frases o que vai acontecer, quais colunas são
reconhecidas, e oferece **Baixar modelo (.csv)** e **Baixar modelo (.xlsx)**.
O modelo sai com cabeçalho em português e três linhas de exemplo.

Aqui também entra o aviso de **double opt-in**: se a lista tem double opt-in
ligado, avisar em bloco de alerta que cada contato importado vai receber
e-mail de confirmação — e, se não houver domínio verificado, avisar que
nenhum e-mail vai sair e os contatos ficarão pendentes. É o mesmo problema
que já mapeamos em `CAMPANHA-REMETENTE-SPEC.md`; aqui ele é ainda mais caro,
porque acontece em lote.

### Passo 2 — Arquivo
Aceitar `.csv`, `.txt` e `.xlsx`. O `.xlsx` é o formato que o cliente leigo
tem de fato — pedir "salve como CSV" é onde a maioria desiste. Ler com
`xlsx`/`sheetjs` no navegador.

Limite: 50.000 linhas (mantém o de hoje) e 10 MB.

### Passo 3 — DE-PARA
Tabela com uma linha por coluna do arquivo:

| Coluna no arquivo | Exemplo (1ª linha) | Importar como |
|---|---|---|
| `E-mail do cliente` | joao@x.com.br | **E-mail** ▾ |
| `Nome` | João | **Nome** ▾ |
| `Cidade` | Recife | **Propriedade: cidade** ▾ |
| `Saldo` | 12,30 | **Ignorar** ▾ |

- O select oferece: E-mail, Nome, Sobrenome, Inscrito, Propriedade
  personalizada (com nome livre), Ignorar.
- O auto-mapeamento de hoje vira o **valor inicial** dos selects, em vez de
  uma decisão escondida. Reaproveitar `getCanonicalContactVariableName`.
- Validação: exatamente uma coluna mapeada como E-mail. Sem isso, não avança.
- Mostrar o valor da primeira linha ao lado de cada coluna — é o que faz a
  pessoa perceber que mapeou errado.

### Passo 4 — Pré-lista e confirmação
Reaproveita a pré-visualização que já existe, agora alimentada pelo DE-PARA:
20 primeiras linhas, contagem de válidos/inválidos/duplicados, e um resumo
("1.240 contatos serão importados, 12 ignorados por e-mail inválido, 3
duplicados no arquivo").

### Passo 5 — Importação com progresso
Hoje é uma mutation única que devolve tudo no fim. Passa a:

1. Subir o arquivo original para o S3 (URL pré-assinada, já temos).
2. Criar um registro `ContactImport` com status `processing`.
3. Enfileirar os contatos em lotes na fila que já existe
   (`ContactQueueService.addBulkContactJobs`).
4. A tela faz *polling* do registro e mostra "Importando 340 de 1.240…".

O `ContactImport` é o mesmo objeto que vira o log — não são duas coisas.

### Passo 6 — Log
Nova aba/tela na lista de contatos: histórico de importações com data, quem
importou, arquivo (nome + link para baixar), total, criados, atualizados,
ignorados, status e o erro quando houver.

Download por **URL pré-assinada com expiração curta**, gerada sob demanda pelo
servidor — nunca link público do bucket. Retenção do arquivo: 90 dias.

---

## Modelo de dados

```prisma
model ContactImport {
  id            String    @id @default(cuid())
  teamId        Int
  contactBookId String
  userId        Int?
  fileName      String
  fileKey       String    // chave no S3
  fileSize      Int
  mapping       Json      // { "E-mail do cliente": "email", "Cidade": "prop:cidade" }
  status        String    // processing | done | error
  total         Int       @default(0)
  processed     Int       @default(0)
  created       Int       @default(0)
  updated       Int       @default(0)
  skipped       Int       @default(0)
  error         String?
  startedAt     DateTime  @default(now())
  finishedAt    DateTime?

  @@index([contactBookId, startedAt])
  @@index([teamId])
}
```

Mudança de schema ⇒ **migration versionada obrigatória** (produção roda
`migrate deploy`).

---

## Riscos e decisões

**O arquivo contém dados pessoais.** Guardar CSV de clientes num bucket é
responsabilidade nova: sem link público, com expiração curta no download, e
com prazo de retenção definido (90 dias) e limpeza automática. Vale registrar
isso na documentação, porque é LGPD.

**Não trocar a fila.** A importação já é assíncrona via BullMQ e o double
opt-in já é decidido dentro do `addOrUpdateContact`. Manter esse caminho é o
que garante que a importação por arquivo se comporte igual à importação por
plataforma — inclusive na regra de não mandar e-mail sem double opt-in.

**`processed` precisa ser incrementado pelo worker**, não estimado pela tela.
Um contador otimista na interface é pior que nenhum: dá a impressão de que
terminou quando a fila ainda está andando.

**Compatibilidade**: manter a aba "Entrada de texto" que já existe. É rápida
para quem só quer colar 5 endereços, e removê-la seria regressão.

---

## Fases sugeridas

1. Schema `ContactImport` + migration
2. Modelo para download (CSV/XLSX) + texto explicativo no passo 1
3. Leitura de `.xlsx`
4. Tela de DE-PARA + validação
5. Upload do arquivo para o S3 + criação do `ContactImport`
6. Worker atualizando o progresso + polling na tela
7. Tela de log + download por URL assinada
8. Limpeza dos arquivos com mais de 90 dias

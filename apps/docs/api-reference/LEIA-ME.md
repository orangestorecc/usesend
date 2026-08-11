# Referência da API — como manter

## ⚠️ Não edite `openapi.json` à mão

O arquivo `openapi.json` é **gerado** a partir do código do app. Qualquer
alteração feita direto nele é perdida na próxima regeração.

## Onde ficam os textos (fonte da verdade)

As descrições de endpoints, parâmetros e respostas vêm de:

```
apps/web/src/server/public-api/api/**/*.ts   (rotas, via createRoute)
apps/web/src/server/public-api/schemas/*.ts  (schemas compartilhados)
```

São os `description:` dentro de `.openapi({ ... })` nos campos Zod e dentro de
`createRoute({ ... })`. **Traduza ali.**

## Como regenerar

```bash
# 1. suba o app
pnpm --filter web dev

# 2. gere o spec
bash apps/docs/scripts/gerar-openapi.sh
```

O script busca `/api/v1/doc` do app e fixa `servers` em
`https://app.madmail.com.br/api` (sobrescreva com a env `PUBLIC_API_URL`).

## Títulos da navegação

Os arquivos `.mdx` desta pasta são stubs (`openapi: get /v1/...`). O que aparece
na barra lateral é o `title:` do frontmatter de cada um — está em português e
**não** é gerado, então sobrevive à regeração do JSON.

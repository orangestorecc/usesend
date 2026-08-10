# Deploy do site institucional (Madmail marketing)

Site estático (Next `output: export`) servido por nginx. Mesmo fluxo do MCP:
imagem no `ghcr.io` → `docker service update` no Swarm.

## Arquivos

- `docker/Dockerfile.marketing` — build do estático + nginx.
- `docker/marketing-nginx.conf` — config nginx (URLs limpas, cache, gzip).
- `.github/workflows/deploy-marketing.yml` — CI: build → push → deploy no Swarm.

## Build/teste local

```bash
# a partir da raiz do monorepo
docker build -f docker/Dockerfile.marketing -t madmail-marketing:test .
docker run --rm -p 8088:80 madmail-marketing:test
# abrir http://localhost:8088
```

## Publicar em produção (Swarm) — a fazer hoje

1. **Criar o serviço no Swarm** (uma vez), no manager:

   ```bash
   docker service create \
     --name madmail-marketing \
     --replicas 2 \
     --network <sua-rede-de-ingress> \
     ghcr.io/<owner>/usesend-marketing:latest
   ```

   Ajuste `--network` e labels de proxy (Traefik/nginx) conforme o restante da stack.
   Se usam Traefik, adicionar labels de router para `www.madmail.com.br`.

2. **Secrets do GitHub** (repo → Settings → Secrets → Actions) — reutiliza os do
   MCP + um novo nome de serviço:
   - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PRIVATE_KEY`, `DEPLOY_KNOWN_HOSTS`
   - `GHCR_USERNAME`, `GHCR_READ_TOKEN`
   - **`SWARM_MARKETING_SERVICE_NAME`** = `madmail-marketing` (novo)

3. **Disparar o deploy**: push em `apps/marketing/**` na `main`, ou rodar o
   workflow `Build marketing image and deploy to Swarm` manualmente
   (workflow_dispatch). Sem os secrets, ele só publica a imagem (não faz o
   `service update`).

## DNS (no provedor)

- `www.madmail.com.br` → IP/entrada do proxy do Swarm (onde este serviço fica).
- `app.madmail.com.br` → serviço do app (já existente).
- `docs.madmail.com.br` → Mintlify (docs), conforme hosting escolhido.

## Notas

- O site é 100% estático: sem env vars de runtime, sem banco. Escala fácil.
- Páginas `.md` (para IA/GEO), `sitemap.xml` e `robots.txt` já saem no build.
- Para atualizar o conteúdo: editar em `apps/marketing`, commit → o CI reconstrói.

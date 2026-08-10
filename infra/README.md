# Infra do Madmail — servidor próprio

Provisionamento completo em um servidor Ubuntu 24.04, sem UI: tudo por SSH e
arquivo versionado.

## O que roda onde

| Endereço | Serviço | Observação |
|---|---|---|
| `app.madmail.com.br` | `web` | aplicação (Next.js) |
| `www.madmail.com.br` | `marketing` | site institucional (estático + nginx) |
| `mcp.madmail.com.br` | `mcp` | servidor MCP para conectores de IA |
| `docs.madmail.com.br` | — | **Mintlify (SaaS)**, não roda aqui: só CNAME |

Também no servidor, sem porta exposta: **Postgres 16**, **Redis 7** e o
**Caddy** (proxy + SSL automático).

**Não roda aqui:** MinIO (usamos o storage da infra da Evel) e SES/S3 da AWS.

## Instalação

```bash
# 1. bootstrap (como root, na VM limpa)
scp infra/bootstrap.sh usuario@IP:/tmp/
ssh usuario@IP 'sudo bash /tmp/bootstrap.sh'

# 2. arquivos da stack
scp infra/compose.prod.yml infra/Caddyfile infra/deploy.sh infra/backup.sh \
    madmail@IP:/opt/madmail/
scp infra/env.example madmail@IP:/opt/madmail/.env

# 3. preencher os segredos
ssh madmail@IP 'chmod 600 /opt/madmail/.env && nano /opt/madmail/.env'

# 4. subir
ssh madmail@IP 'cd /opt/madmail && docker compose -f compose.prod.yml up -d'
```

As migrations do Prisma rodam sozinhas no boot do container (`docker/start.sh`),
então o banco nasce com o schema correto.

## DNS (Cloudflare)

Registros `A` apontando para o IP do servidor, **sem proxy** (nuvem cinza) —
o Caddy precisa responder o desafio do Let's Encrypt na porta 80:

```
A    app     <IP>    DNS only
A    www     <IP>    DNS only
A    mcp     <IP>    DNS only
A    @       <IP>    DNS only
```

`docs` continua CNAME para o Mintlify.

Depois que o SSL for emitido, `app`/`www` podem ir para proxy (nuvem laranja)
se quiser o CDN. **`mcp` deve continuar DNS only** — conectores de IA usam
streaming e o proxy costuma atrapalhar.

## Operação

```bash
/opt/madmail/deploy.sh                                   # atualizar
docker compose -f compose.prod.yml logs -f web           # logs do app
docker compose -f compose.prod.yml ps                    # estado
/opt/madmail/backup.sh                                   # backup manual
```

Agendar o backup diário (como usuário `madmail`):

```bash
crontab -e
# 0 3 * * * /opt/madmail/backup.sh >> /opt/madmail/backups/backup.log 2>&1
```

Restaurar um backup:

```bash
gunzip -c backups/madmail-AAAAMMDD-HHMMSS.sql.gz \
  | docker compose -f compose.prod.yml exec -T postgres \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Regras que não podem ser esquecidas

1. **Mudou `schema.prisma`?** Gere a migration no mesmo commit. Produção aplica
   `migrate deploy` — tabela sem migration simplesmente não existe lá.
2. **Variável de ambiente nova?** Declare em `compose.prod.yml` e documente em
   `env.example` no mesmo commit. Valor no `.env` sem a linha no compose não
   chega no container.
3. **`NEXTAUTH_SECRET` é irreversível.** Além da sessão, é a chave que cifra as
   credenciais dos gateways de pagamento. Trocar invalida o que já está salvo.
4. **`PAYMENTS_WEBHOOK_TOKEN` em produção.** Sem ele, `/api/webhook/inter` e
   `/api/webhook/rede` aceitam qualquer POST — dá para forjar confirmação de
   pagamento.

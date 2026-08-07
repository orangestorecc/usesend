# Deploy do MCP em produção (madmail)

O MCP roda como um serviço no mesmo stack Portainer do useSend, exposto pelo
Nginx Proxy Manager (NPM) em `mcp.madmail.com.br`.

## O que já está no repositório
- `mcp/Dockerfile` — imagem do servidor MCP.
- `.github/workflows/deploy-mcp.yml` — builda a imagem (`ghcr.io/orangestorecc/usesend-mcp:latest`) a cada push que mexe em `mcp/**` e aciona o Watchtower.
- Serviço `mcp` em `docker/portainer/compose.yml` (rede interna + `npm_public`, porta 8787, label do Watchtower).
- Variável no stack: apenas `MCP_IMAGE`. **Tokens/escopos/planos NÃO são env** — ficam no banco (`McpKey`), geridos na UI.

## Passos no servidor (uma vez)

### 1. DNS (Cloudflare) — feito pelo Rafael
Registro **A**: `mcp` → `213.199.34.103` (mesmo IP do `app`), **DNS only** (nuvem cinza).

### 2. Variável do stack (Portainer → Stack → Environment)
```
MCP_IMAGE=ghcr.io/orangestorecc/usesend-mcp:latest
```

### 3. Redeploy do stack (Portainer)
Atualizar o stack pra criar o container `mcp` (o Watchtower só troca imagem de container existente; a **primeira** criação é via redeploy do stack). "Update the stack" / "Re-pull and redeploy".

### 4. Proxy no NPM (Nginx Proxy Manager) — já feito pelo Fábio
- Domain: `mcp.madmail.com.br` → Forward `mcp:8787`, SSL Let's Encrypt + Force SSL.

## Verificar
```bash
curl https://mcp.madmail.com.br/health   # -> {"ok":true}
```

## Ativar um cliente (pela UI — sem env)
1. Em **app.madmail.com.br → Developer Settings → MCP → Nova integração MCP**.
2. Nome + escopos (contatos/listas/templates/segmentos/campanhas + relatórios + envio).
3. Copie a chave `msk_...` (aparece 1x) e a URL do connector.
4. No ChatGPT/Claude, adicione o connector HTTP:
   - URL: `https://mcp.madmail.com.br/mcp`
   - Header: `Authorization: Bearer msk_...`

Cada cliente novo = nova integração na UI. Nada de variável de ambiente.

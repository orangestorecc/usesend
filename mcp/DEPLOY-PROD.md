# Deploy do MCP em produção (madmail)

O MCP roda como um serviço no mesmo stack Portainer do useSend, exposto pelo
Nginx Proxy Manager (NPM) em `mcp.madmail.com.br`.

## O que já está no repositório
- `mcp/Dockerfile` — imagem do servidor MCP.
- `.github/workflows/deploy-mcp.yml` — builda a imagem (`ghcr.io/orangestorecc/usesend-mcp:latest`) a cada push que mexe em `mcp/**` e aciona o Watchtower.
- Serviço `mcp` em `docker/portainer/compose.yml` (rede interna + `npm_public`, porta 8787, label do Watchtower).
- Variáveis em `.env.selfhost.example`: `MCP_IMAGE`, `MCP_TOKEN_MAP`, `MCP_PLANS`.

## Passos no servidor (uma vez)

### 1. DNS (Cloudflare) — feito pelo Rafael
Registro **A**: `mcp` → `213.199.34.103` (mesmo IP do `app`), **DNS only** (nuvem cinza).

### 2. API key real de produção
Em **app.madmail.com.br → Developer settings → criar API key** (permissão FULL).
Copie a chave `us_..._...` (aparece uma vez só).

### 3. Variáveis do stack (Portainer → Stack → Environment)
```
MCP_IMAGE=ghcr.io/orangestorecc/usesend-mcp:latest
MCP_TOKEN_MAP=msk_dresseco=<a_api_key_do_passo_2>
MCP_PLANS=msk_dresseco=padrao:0.10:1000
```

### 4. Redeploy do stack (Portainer)
Atualizar o stack pra criar o container `mcp` (o Watchtower só troca imagem de container existente; a **primeira** criação é via redeploy do stack). "Update the stack" / "Re-pull and redeploy".

### 5. Proxy no NPM (Nginx Proxy Manager)
Novo **Proxy Host**:
- Domain: `mcp.madmail.com.br`
- Forward Hostname: `mcp` (nome do serviço na rede `npm_public`)
- Forward Port: `8787`
- SSL: **Request a new Let's Encrypt certificate** + Force SSL.

## Verificar
```bash
curl https://mcp.madmail.com.br/health   # -> {"ok":true,"clientes":1}
```

## Conectar o cliente (ChatGPT/Claude)
Connector HTTP:
- URL: `https://mcp.madmail.com.br/mcp`
- Header: `Authorization: Bearer msk_dresseco`

Cada novo cliente = nova entrada em `MCP_TOKEN_MAP` (+ `MCP_PLANS`) com a API key do time dele.

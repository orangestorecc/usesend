# Especificação do servidor — plataforma **madmail** (N49)

> Documento para provisionamento do servidor. Objetivo: um servidor Linux com **Docker** pronto,
> onde a N49 vai subir a plataforma (aplicação + banco + fila + proxy) via Docker Compose.
> **Você não precisa instalar a aplicação** — só entregar o servidor com Docker e o acesso.

---

## 1. Sistema operacional

- **Ubuntu Server 24.04 LTS** (preferido) ou 22.04 LTS.
- Arquitetura **x86_64 / amd64** (não ARM — algumas imagens Docker não têm build ARM).
- Instalação limpa (sem painel tipo cPanel).

## 2. Especificações de hardware

| Recurso | Mínimo | **Recomendado** | Observação |
|---|---|---|---|
| CPU | 2 vCPU | **2–4 vCPU** | app + workers de fila |
| RAM | 2 GB | **4 GB** (8 GB dá folga) | a app renderiza e-mail com Chromium; 4 GB é o número seguro |
| Disco | 20 GB SSD | **40 GB SSD/NVMe** | imagens Docker + banco crescendo |
| Swap | — | **4 GB** | evita o build da aplicação estourar memória |

Provedores que atendem bem por ~US$ 20/mês: **Hetzner** (CX22/CPX21), DigitalOcean (droplet 4 GB), AWS Lightsail (4 GB). Hetzner é o melhor custo-benefício.

## 3. Rede / portas (firewall)

Liberar **somente**:

| Porta | Uso |
|---|---|
| 22 | SSH (administração) |
| 80 | HTTP (redireciona pra HTTPS) |
| 443 | HTTPS (a aplicação) |

Banco de dados e fila **não** ficam expostos à internet — rodam só na rede interna do Docker.
O HTTPS é automático (Let's Encrypt, feito por um container de proxy) — **não precisa instalar nem renovar certificado**.

## 4. Software a instalar no servidor

Só o necessário — **todo o resto (banco, fila, Node, Chromium) roda dentro de containers**:

1. **Docker Engine** + plugin **Docker Compose** (v2)
2. **git**
3. **ufw** (firewall)
4. *(opcional, recomendado)* **fail2ban** (proteção do SSH)

## 5. Script de provisionamento (Ubuntu 24.04)

Rodar como um usuário com `sudo`. Deixa o servidor pronto de ponta a ponta:

```bash
#!/usr/bin/env bash
set -euo pipefail

# --- 1. Atualizar o sistema ---
sudo apt-get update && sudo apt-get upgrade -y

# --- 2. Swap de 4 GB (se ainda não existir) ---
if ! swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# --- 3. Dependências base ---
sudo apt-get install -y ca-certificates curl git ufw fail2ban

# --- 4. Docker Engine + Compose (repositório oficial) ---
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- 5. Usuário de deploy (roda Docker sem sudo) ---
sudo useradd -m -s /bin/bash deploy 2>/dev/null || true
sudo usermod -aG docker deploy
sudo mkdir -p /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh
# Cole aqui a chave pública SSH que a N49 vai te enviar:
# echo "ssh-ed25519 AAAA... n49" | sudo tee /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true

# --- 6. Firewall ---
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# --- 7. Verificação ---
echo "=== versões ==="
docker --version
docker compose version
echo "=== firewall ==="
sudo ufw status
```

## 6. O que precisamos de volta (checklist)

Depois de provisionar, nos enviar:

- [ ] **IP público** do servidor (e hostname, se houver)
- [ ] **Acesso SSH** ao usuário `deploy` — a N49 vai te mandar uma **chave pública SSH** pra você colar no `authorized_keys` (passo 5 do script). *Nunca precisamos da chave privada de vocês.*
- [ ] Confirmação de que **portas 80 e 443** estão abertas (e 22 pro SSH)
- [ ] Saída do passo 7 (versões do Docker/Compose) — só pra confirmar que ficou ok

## 7. DNS (informativo — a N49 configura no Cloudflare)

Vocês **não** precisam mexer em DNS. Só precisamos do **IP do servidor** pra apontar:

| Registro | Aponta para |
|---|---|
| `app.madmail.com.br` (A) | IP do servidor |
| `mcp.madmail.com.br` (A) | IP do servidor |

## 8. Observações

- **Não instalar** Postgres, Redis, Node.js ou Nginx/Apache na máquina — tudo isso sobe em container e evita conflito de porta.
- O provedor pode oferecer "Docker já instalado" numa imagem pronta; se sim, ainda vale rodar os passos 2, 5 e 6 (swap, usuário deploy, firewall).
- Backups: se o provedor tiver snapshot automático do disco, deixar ligado (o banco vive no disco).

---
*Contato técnico: equipe N49. Dúvidas sobre este documento, falar com o Rafael.*

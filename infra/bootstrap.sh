#!/usr/bin/env bash
#
# Prepara uma VM Ubuntu 24.04 limpa para rodar o Madmail.
# Idempotente: pode rodar de novo sem quebrar nada.
#
#   sudo bash bootstrap.sh
#
set -euo pipefail

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash bootstrap.sh" >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-madmail}"
SSH_PORT="${SSH_PORT:-2203}"

log "Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

log "Instalando utilitários"
apt-get install -y -qq \
  ca-certificates curl gnupg git ufw fail2ban unattended-upgrades \
  postgresql-client jq htop

log "Fuso horário: America/Sao_Paulo"
timedatectl set-timezone America/Sao_Paulo

log "Swap de 4G (evita OOM em build/campanha grande)"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "swap já existe, pulando"
fi

log "Docker Engine + Compose"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
else
  echo "docker já instalado, pulando"
fi
systemctl enable --now docker

log "Usuário de deploy: $DEPLOY_USER"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
# Reaproveita as chaves SSH já autorizadas para o usuário atual.
if [ -f /root/.ssh/authorized_keys ]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

# Detecta se o sshd JÁ está na porta desejada (VM entregue assim) ou se ainda
# está na 22 e precisa de transição.
if ss -tln | grep -qE ":$SSH_PORT\b"; then
  ALREADY_ON_PORT=1
else
  ALREADY_ON_PORT=0
fi

if [ "$ALREADY_ON_PORT" = "1" ]; then
  log "Firewall (UFW): libera $SSH_PORT, 80, 443"
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow "$SSH_PORT"/tcp >/dev/null
  ufw allow 80/tcp  >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ufw status verbose

  log "SSH já está na porta $SSH_PORT — só endurece a configuração"
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  sshd -t
  systemctl reload ssh || systemctl reload sshd
else
  log "Firewall (UFW): libera $SSH_PORT, 80, 443 (22 aberta na transição)"
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow "$SSH_PORT"/tcp >/dev/null
  ufw allow 22/tcp  >/dev/null   # removida por finalize-ssh.sh
  ufw allow 80/tcp  >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ufw status verbose

  log "SSH: migrando da 22 para a $SSH_PORT"
  # Escuta nas DUAS portas por ora. Trocar a porta e cortar a 22 de uma vez é
  # a maneira clássica de se trancar pra fora — o finalize-ssh.sh fecha a 22
  # depois que a nova porta estiver comprovadamente funcionando.
  sed -i 's/^#\?Port .*//' /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  printf '\nPort %s\nPort 22\n' "$SSH_PORT" >> /etc/ssh/sshd_config
  # Ubuntu 24.04 usa socket activation: sem isso a porta nova é ignorada.
  systemctl disable --now ssh.socket >/dev/null 2>&1 || true
  sshd -t   # aborta se a config ficou inválida — antes de reiniciar
  systemctl restart ssh || systemctl restart sshd
  sleep 1
fi
ss -tln | grep -E ":($SSH_PORT|22)\b" || true

log "fail2ban e atualizações de segurança automáticas"
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

log "Estrutura de diretórios"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
  /opt/madmail /opt/madmail/backups /opt/madmail/caddy

cat <<EOF

================================================================
 Bootstrap concluído.

 Usuário de deploy : $DEPLOY_USER
 Diretório         : /opt/madmail
 Docker            : $(docker --version)
 SSH               : $(if [ "$ALREADY_ON_PORT" = "1" ]; then echo "porta $SSH_PORT (já era, nada a migrar)"; else echo "portas $SSH_PORT e 22 (transição)"; fi)
$(if [ "$ALREADY_ON_PORT" != "1" ]; then cat <<'AVISO'

 ATENÇÃO — antes de fechar esta sessão:

   1. Abra um terminal NOVO e confirme que a porta nova funciona
   2. Só depois de conectar, feche a porta 22:
        sudo bash /opt/madmail/finalize-ssh.sh

 Se fechar esta sessão sem testar e a porta nova não funcionar, o
 acesso ao servidor se perde e só o console do provedor resolve.
AVISO
fi)
 Próximo passo: copiar compose.prod.yml, Caddyfile e .env para
 /opt/madmail e subir a stack.
================================================================
EOF

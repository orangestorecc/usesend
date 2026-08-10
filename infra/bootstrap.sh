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

log "Firewall (UFW): libera 22, 80, 443"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp  >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status verbose

log "SSH: desliga login por senha e login direto de root"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd

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

 Próximo passo: copiar infra/compose.prod.yml, infra/Caddyfile e o
 arquivo .env para /opt/madmail e subir a stack.
================================================================
EOF

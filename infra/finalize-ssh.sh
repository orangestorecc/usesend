#!/usr/bin/env bash
#
# Fecha a porta 22, deixando o SSH só na porta nova.
#
# RODE ISTO SÓ DEPOIS de ter conectado com sucesso em:
#   ssh -p 2203 usuario@IP
#
#   sudo bash finalize-ssh.sh
#
set -euo pipefail

SSH_PORT="${SSH_PORT:-2203}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash finalize-ssh.sh" >&2
  exit 1
fi

# Trava de segurança: se a sessão atual veio pela porta 22, fechar agora
# derruba o acesso. Exige a porta nova em uso antes de continuar.
CURRENT_PORT=$(ss -tnp 2>/dev/null | grep -w "$PPID" | awk '{print $4}' | awk -F: '{print $NF}' | head -1 || true)
if [ -z "${FORCE:-}" ] && [ "$CURRENT_PORT" = "22" ]; then
  cat >&2 <<EOF
ABORTADO: esta sessão está conectada pela porta 22.

Fechar a 22 agora derruba você e o servidor fica inacessível.
Conecte pela porta nova e rode de novo:

  ssh -p $SSH_PORT usuario@IP
  sudo bash finalize-ssh.sh

(Se tiver certeza do que está fazendo: FORCE=1 sudo -E bash finalize-ssh.sh)
EOF
  exit 1
fi

if ! ss -tln | grep -qE ":$SSH_PORT\b"; then
  echo "ABORTADO: o sshd não está escutando na porta $SSH_PORT." >&2
  exit 1
fi

echo "==> Removendo 'Port 22' do sshd_config"
sed -i '/^Port 22$/d' /etc/ssh/sshd_config
sshd -t
systemctl restart ssh || systemctl restart sshd

echo "==> Fechando a porta 22 no firewall"
ufw delete allow 22/tcp >/dev/null 2>&1 || true

echo
echo "Pronto. SSH agora responde apenas na porta $SSH_PORT."
ss -tln | grep -E ":($SSH_PORT|22)\b" || true
ufw status | grep -E "22|$SSH_PORT" || true

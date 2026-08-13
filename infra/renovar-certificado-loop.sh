#!/usr/bin/env bash
#
# Renovação do Let's Encrypt sob supervisord.
#
# O certbot normalmente se agenda por timer do systemd, que este container
# não tem (PID 1 é o supervisord). Mesmo padrão do backup-loop: um laço
# supervisionado, com a vantagem do restart automático.
#
# `certbot renew` só age quando faltam <30 dias — rodar duas vezes ao dia é
# barato e dá folga para falha transitória de rede ou do Cloudflare.
set -uo pipefail

INTERVALO="${CERTBOT_INTERVAL_SECONDS:-43200}"

while true; do
  if sudo certbot renew --quiet; then
    echo "[$(date '+%F %T')] verificação de renovação ok"
  else
    echo "[$(date '+%F %T')] certbot renew falhou; tento no próximo ciclo" >&2
  fi
  sleep "$INTERVALO"
done

#!/usr/bin/env bash
#
# Agendador do backup.
#
# O container não tem cron nem systemd — o PID 1 é o supervisord. Em vez de
# instalar um cron só para isso, este laço fica sob supervisão como qualquer
# outro processo: se morrer, o supervisord levanta de novo.
#
# Roda uma vez ao subir (para não ficar 24h sem backup depois de um restart) e
# depois uma vez por dia.
#
set -uo pipefail

INTERVALO="${BACKUP_INTERVAL_SECONDS:-86400}"
SCRIPT="${BACKUP_SCRIPT:-/opt/madmail/backup.sh}"

while true; do
  if ! "$SCRIPT"; then
    echo "[$(date '+%F %T')] backup falhou; tentando de novo no próximo ciclo" >&2
  fi
  sleep "$INTERVALO"
done

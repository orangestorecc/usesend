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

# Em caso de falha, tentar de novo já. Sem isto, um erro transitório — como
# o Postgres ainda subindo depois de um restart, que foi o que aconteceu em
# 12/08/2026 — deixava o sistema 24 horas sem backup, em silêncio.
RETENTATIVA="${BACKUP_RETRY_SECONDS:-900}"

while true; do
  if "$SCRIPT"; then
    sleep "$INTERVALO"
  else
    echo "[$(date '+%F %T')] backup falhou; nova tentativa em ${RETENTATIVA}s" >&2
    sleep "$RETENTATIVA"
  fi
done

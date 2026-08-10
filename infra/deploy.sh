#!/usr/bin/env bash
#
# Atualiza a stack para as imagens mais recentes do GHCR.
# As migrations do Prisma rodam sozinhas no boot do container (docker/start.sh).
#
#   /opt/madmail/deploy.sh
#
set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/madmail}"
cd "$STACK_DIR"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

log "Baixando imagens novas"
docker compose -f compose.prod.yml pull

log "Recriando os serviços"
docker compose -f compose.prod.yml up -d --remove-orphans

log "Aguardando o app responder"
for i in $(seq 1 60); do
  if docker compose -f compose.prod.yml exec -T web \
      node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
    echo "app respondendo (${i}s)"
    break
  fi
  [ "$i" -eq 60 ] && { echo "app não respondeu em 60s — veja os logs" >&2; exit 1; }
  sleep 1
done

log "Limpando imagens órfãs"
docker image prune -f >/dev/null

log "Estado atual"
docker compose -f compose.prod.yml ps

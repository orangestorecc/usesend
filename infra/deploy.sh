#!/usr/bin/env bash
#
# Deploy do Madmail no servidor.
#
# Roda por SSH (GitHub Actions) ou manualmente:
#   ssh -p 2203 deploy@IP '/opt/madmail/deploy.sh'
#
# Se o build falhar, restaura a versão anterior e sai com erro — o serviço
# no ar não é derrubado por um commit quebrado.
set -euo pipefail

APP=/opt/madmail/app
WEB=$APP/apps/web
LOGS=/opt/madmail

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

cd "$APP"

log "Atualizando o código"
git fetch --depth 1 origin main -q
BEFORE=$(git rev-parse --short HEAD)
git reset --hard origin/main -q
AFTER=$(git rev-parse --short HEAD)
echo "  $BEFORE -> $AFTER"

log "Dependências"
pnpm install --frozen-lockfile 2>&1 | tail -3

log "Prisma"
cd "$WEB"
npx prisma generate 2>&1 | tail -1
npx prisma migrate deploy 2>&1 | tail -3

log "Build"
# Guarda a versão atual: se o build falhar, ela volta.
rm -rf "$WEB/.next.bak"
[ -d "$WEB/.next" ] && cp -r "$WEB/.next" "$WEB/.next.bak"

export NEXT_PUBLIC_IS_CLOUD=true
export NODE_OPTIONS="--max-old-space-size=3072"

if npx next build > "$LOGS/build.log" 2>&1; then
  echo "  BUILD_ID: $(cat "$WEB/.next/BUILD_ID")"
  rm -rf "$WEB/.next.bak"
else
  echo "  BUILD FALHOU — restaurando a versão anterior:"
  tail -15 "$LOGS/build.log" | sed 's/^/    /'
  rm -rf "$WEB/.next"
  [ -d "$WEB/.next.bak" ] && mv "$WEB/.next.bak" "$WEB/.next"
  exit 1
fi

log "Site institucional"
cd "$APP"
if pnpm --filter=marketing build > "$LOGS/build-marketing.log" 2>&1; then
  echo "  export: $(du -sh "$APP/apps/marketing/out" | cut -f1)"
else
  echo "  build do site falhou (o app segue no ar):"
  tail -10 "$LOGS/build-marketing.log" | sed 's/^/    /'
fi

log "Reiniciando os serviços"
sudo supervisorctl restart madmail-web madmail-site

log "Verificando"
for i in $(seq 1 45); do
  if curl -sf --max-time 5 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "  app respondendo (${i}s)"
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "  app NAO respondeu em 45s — veja /opt/madmail/logs/web.log" >&2
    sudo supervisorctl status | sed 's/^/    /'
    exit 1
  fi
  sleep 1
done
curl -sf --max-time 5 http://127.0.0.1:3001/ >/dev/null 2>&1 \
  && echo "  site respondendo" || echo "  site NAO respondeu"

sudo supervisorctl status | sed 's/^/  /'
echo
echo "Deploy concluído: $AFTER"

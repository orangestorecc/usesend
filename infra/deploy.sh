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
# O workflow chama /opt/madmail/deploy.sh, que é uma cópia fora do repositório.
# Sem isto, mudanças em infra/deploy.sh nunca chegariam em produção — foi
# exatamente o que aconteceu com o build do relay SMTP. Atualiza a cópia para
# a PRÓXIMA execução; trocar o script em execução no meio dele é receita de
# comportamento imprevisível.
if ! cmp -s "$APP/infra/deploy.sh" /opt/madmail/deploy.sh; then
  cp "$APP/infra/deploy.sh" /opt/madmail/deploy.sh
  chmod +x /opt/madmail/deploy.sh
  echo "  deploy.sh atualizado — vale a partir do próximo deploy"
fi

pnpm install --frozen-lockfile 2>&1 | tail -3

log "Prisma"
cd "$WEB"
npx prisma generate 2>&1 | tail -1
npx prisma migrate deploy 2>&1 | tail -3

log "Build"
# Guarda a versão atual: se o build falhar, ela volta.
rm -rf "$WEB/.next.bak"
[ -d "$WEB/.next" ] && cp -r "$WEB/.next" "$WEB/.next.bak"

# Restaura também se o processo for interrompido (queda de SSH, timeout,
# kill). Sem isso, um build morto no meio deixava .next incompleto e o app
# servindo 404 — foi o que aconteceu em 11/08.
restaurar_se_interrompido() {
  if [ -d "$WEB/.next.bak" ]; then
    echo "  interrompido: restaurando a versão anterior" >&2
    rm -rf "$WEB/.next"
    mv "$WEB/.next.bak" "$WEB/.next"
    sudo supervisorctl restart madmail-web >/dev/null 2>&1 || true
  fi
}
trap restaurar_se_interrompido INT TERM HUP

export NEXT_PUBLIC_IS_CLOUD=true
export NODE_OPTIONS="--max-old-space-size=3072"

# Identifica a release pelo commit. É o que amarra o sourcemap ao erro: sem
# isso o Sentry não sabe a qual versão do bundle o stack trace pertence e
# devolve código minificado. Também é o que faz o "resolve in next release"
# funcionar — a issue fecha sozinha quando sobe o deploy com a correção.
export NEXT_PUBLIC_GIT_SHA="$AFTER"

if npx next build > "$LOGS/build.log" 2>&1; then
  echo "  BUILD_ID: $(cat "$WEB/.next/BUILD_ID")"
  trap - INT TERM HUP
  rm -rf "$WEB/.next.bak"
else
  trap - INT TERM HUP
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

log "Documentação"
# `mint export` gera um zip; descompactamos para servir como estático, do
# mesmo jeito que o site institucional.
cd "$APP/apps/docs"
if npx mint export > "$LOGS/build-docs.log" 2>&1 && [ -f export.zip ]; then
  rm -rf "$APP/apps/docs/site"
  mkdir -p "$APP/apps/docs/site"
  unzip -q -o export.zip -d "$APP/apps/docs/site"
  rm -f export.zip

  # Ajustes no HTML exportado, todos por injeção antes de </head>:
  #
  # 1. A busca depende de um serviço do Mintlify (app.mintlify.com) e não há
  #    índice local, então o botão nunca responderia. Botão morto é pior que
  #    ausência de busca.
  # 2. A fonte de código: o docs.json controla texto e títulos (Inter, como o
  #    site), mas não expõe a fonte de code/pre. Injetamos o JetBrains Mono,
  #    que é o que o site usa.
  #
  # A URL da fonte é escrita sem "&" de propósito: no sed, "&" do lado direito
  # significa "o trecho casado" e estragaria a substituição.
  INJECAO='<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500"><style>[aria-label="Open search"],[aria-label="Abrir busca"]{display:none !important}code,pre,kbd,samp{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace !important}</style>'

  find "$APP/apps/docs/site" -name '*.html' -print0 | xargs -0 -r sed -i     "s#</head>#${INJECAO}</head>#"

  echo "  export: $(du -sh "$APP/apps/docs/site" | cut -f1) (busca ocultada, fontes do site)"
else
  echo "  build da documentação falhou (o app segue no ar):"
  tail -10 "$LOGS/build-docs.log" | sed 's/^/    /'
fi
cd "$APP"

log "Servidor MCP"
# Fica fora do workspace pnpm e roda com tsx (sem etapa de build), por isso
# instala com npm e SEM --omit=dev: o tsx é uma devDependency.
cd "$APP/mcp"
if npm install --no-audit --no-fund > "$LOGS/build-mcp.log" 2>&1; then
  echo "  dependências ok"
else
  echo "  instalação do MCP falhou (os outros serviços seguem):"
  tail -8 "$LOGS/build-mcp.log" | sed 's/^/    /'
fi
cd "$APP"

log "Relay SMTP"
# Faz parte do workspace pnpm, então as dependências já vieram do install lá em
# cima; falta só compilar.
if pnpm --filter=smtp-server build > "$LOGS/build-smtp.log" 2>&1; then
  echo "  build ok"
else
  echo "  build do SMTP falhou (os outros serviços seguem):"
  tail -8 "$LOGS/build-smtp.log" | sed 's/^/    /'
fi

log "Configurações do supervisord"
# Ficam versionadas para sobreviverem à recriação do container: em 12/08/2026
# o container foi recriado, as configs viviam só em /etc/supervisor/conf.d e
# tudo caiu. Copiar a cada deploy torna a recuperação um `deploy`.
if sudo cp "$APP"/infra/supervisor/*.conf /etc/supervisor/conf.d/ 2>/dev/null; then
  sudo supervisorctl reread >/dev/null 2>&1
  sudo supervisorctl update >/dev/null 2>&1
  echo "  $(ls "$APP"/infra/supervisor/*.conf | wc -l) arquivos aplicados"
else
  echo "  não consegui copiar as configs (segue com as que já estão no ar)"
fi

log "Reiniciando os serviços"
sudo supervisorctl restart madmail-web madmail-site madmail-docs madmail-mcp
# O relay é opcional: só reinicia se estiver configurado no supervisord.
if sudo supervisorctl status madmail-smtp >/dev/null 2>&1; then
  sudo supervisorctl restart madmail-smtp
fi

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
curl -sf --max-time 5 http://127.0.0.1:3002/ >/dev/null 2>&1 \
  && echo "  documentação respondendo" || echo "  documentação NAO respondeu"
curl -sf --max-time 5 http://127.0.0.1:8787/health >/dev/null 2>&1 \
  && echo "  MCP respondendo" || echo "  MCP NAO respondeu"

sudo supervisorctl status | sed 's/^/  /'
echo
echo "Deploy concluído: $AFTER"

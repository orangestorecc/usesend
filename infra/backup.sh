#!/usr/bin/env bash
#
# Backup do Postgres do Madmail.
#
# Roda dentro do próprio container, onde o Postgres vive sob supervisord — por
# isso usa pg_dump direto pela DATABASE_URL, e não `docker compose exec`.
#
# O ponto principal: o dump **sai da máquina**. Guardar backup no mesmo disco
# do banco não protege do risco que importa aqui, que é o container ser
# recriado e levar tudo junto. A cópia local existe só como conveniência de
# restauração rápida.
#
# Agendado pelo supervisord (madmail-backup.conf), que chama este script uma
# vez por dia.
#
set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/madmail}"
ENV_FILE="${ENV_FILE:-$STACK_DIR/app/apps/web/.env}"
BACKUP_DIR="${BACKUP_DIR:-$STACK_DIR/backups}"
RETENCAO_LOCAL_DIAS="${BACKUP_RETENTION_DAYS:-7}"
RETENCAO_REMOTA_DIAS="${BACKUP_REMOTE_RETENTION_DAYS:-30}"

log() { echo "[$(date '+%F %T')] $*"; }

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERRO: DATABASE_URL não encontrada em $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
ARQUIVO="$BACKUP_DIR/madmail-$STAMP.sql.gz"

log "iniciando backup"
pg_dump "$DATABASE_URL" --no-owner --clean --if-exists | gzip > "$ARQUIVO"

# Um dump saudável não tem 1 KB. Se veio vazio, é falha silenciosa — e falha
# silenciosa de backup é pior que backup nenhum, porque dá falsa segurança.
TAMANHO=$(stat -c%s "$ARQUIVO")
if [ "$TAMANHO" -lt 1024 ]; then
  log "ERRO: dump com $TAMANHO bytes, backup suspeito: $ARQUIVO"
  rm -f "$ARQUIVO"
  exit 1
fi

# Confere que o gzip está íntegro antes de considerar o backup bom.
if ! gzip -t "$ARQUIVO"; then
  log "ERRO: gzip corrompido: $ARQUIVO"
  rm -f "$ARQUIVO"
  exit 1
fi

log "dump local ok: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"

# ---------------------------------------------------------------- cópia remota
CHAVE="backups/postgres/madmail-$STAMP.sql.gz"
if [ -n "${S3_COMPATIBLE_API_URL:-}" ] && [ -n "${S3_COMPATIBLE_BUCKET:-}" ]; then
  if node "$STACK_DIR/app/infra/backup-s3.mjs" "$ARQUIVO" "$CHAVE"; then
    log "cópia remota ok"
  else
    log "ERRO: falha ao enviar para o S3 — o backup existe só localmente"
    exit 1
  fi
else
  log "AVISO: S3 não configurado; o backup ficou só no disco do container"
fi

# ------------------------------------------------------------- segredos
# O dump sozinho não basta: as credenciais de terceiros ficam no banco
# cifradas com o NEXTAUTH_SECRET, que vive no .env. Em 12/08/2026 o banco
# sobreviveu à recriação do container e o .env não — e as credenciais de
# gateway viraram texto ilegível. Banco e segredo precisam ser salvos juntos.
#
# Cifrado porque o bucket guarda credencial de produção. A senha vem do
# ambiente e PRECISA estar guardada fora daqui (gerenciador de senhas): se ela
# se perder junto com a máquina, o arquivo é irrecuperável.
if [ -n "${BACKUP_ENV_PASSPHRASE:-}" ]; then
  ENV_CIFRADO="$BACKUP_DIR/env-$STAMP.enc"
  if openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt        -in "$ENV_FILE" -out "$ENV_CIFRADO"        -pass env:BACKUP_ENV_PASSPHRASE 2>/dev/null; then
    chmod 600 "$ENV_CIFRADO"
    if [ -n "${S3_COMPATIBLE_API_URL:-}" ] && [ -n "${S3_COMPATIBLE_BUCKET:-}" ]; then
      if node "$STACK_DIR/app/infra/backup-s3.mjs" "$ENV_CIFRADO"            "backups/env/env-$STAMP.enc" >/dev/null; then
        log "segredos cifrados enviados"
      else
        log "AVISO: falha ao enviar os segredos cifrados"
      fi
    fi
    find "$BACKUP_DIR" -name 'env-*.enc' -mtime "+$RETENCAO_LOCAL_DIAS" -delete
  else
    log "AVISO: não consegui cifrar o .env"
  fi
else
  log "AVISO: BACKUP_ENV_PASSPHRASE ausente; os segredos NÃO estão sendo salvos"
fi

# -------------------------------------------------------------------- limpeza
find "$BACKUP_DIR" -name 'madmail-*.sql.gz' -mtime "+$RETENCAO_LOCAL_DIAS" -delete
log "backups locais mantidos: $(find "$BACKUP_DIR" -name 'madmail-*.sql.gz' | wc -l)"

log "backup concluído"

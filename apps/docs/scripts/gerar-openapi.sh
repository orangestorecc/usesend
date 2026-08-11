#!/usr/bin/env bash
#
# Regenera apps/docs/api-reference/openapi.json a partir da fonte.
#
# O spec é gerado pelo próprio app (@hono/zod-openapi) e servido em
# /api/v1/doc. As descrições vêm de apps/web/src/server/public-api/**,
# então TRADUZA LÁ — nunca edite o openapi.json à mão, pois este script
# sobrescreve o arquivo.
#
# Uso:
#   1. Suba o app (ex.: pnpm --filter web dev, ou o build de produção)
#   2. bash apps/docs/scripts/gerar-openapi.sh [URL_DO_APP]
#
# Exemplos:
#   bash apps/docs/scripts/gerar-openapi.sh
#   bash apps/docs/scripts/gerar-openapi.sh http://localhost:3000

set -euo pipefail

APP_URL="${1:-http://localhost:3000}"
# Servidor que aparece nos exemplos da documentação (cURL etc.).
PUBLIC_API_URL="${PUBLIC_API_URL:-https://app.madmail.com.br/api}"

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/apps/docs/api-reference/openapi.json"

echo "Buscando spec em $APP_URL/api/v1/doc ..."
TMP="$(mktemp)"
if ! curl -fsS "$APP_URL/api/v1/doc" -o "$TMP"; then
  echo "ERRO: não consegui buscar o spec. O app está rodando em $APP_URL?" >&2
  rm -f "$TMP"
  exit 1
fi

# O app preenche `servers` com NEXTAUTH_URL (em dev, localhost). Fixamos a
# URL pública para a documentação não expor localhost.
node -e '
  const fs = require("fs");
  const [file, publicUrl, out] = process.argv.slice(1);
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  spec.servers = [{ url: publicUrl }];
  fs.writeFileSync(out, JSON.stringify(spec, null, 2) + "\n", "utf8");
  const n = Object.keys(spec.paths || {}).length;
  console.log(`openapi.json atualizado: ${n} caminhos, server ${publicUrl}`);
' "$TMP" "$PUBLIC_API_URL" "$OUT"

rm -f "$TMP"
echo "OK: $OUT"

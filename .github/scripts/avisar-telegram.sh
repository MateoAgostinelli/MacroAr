#!/usr/bin/env bash
# Manda un aviso al bot de Telegram cuando falla un workflow.
# Uso (desde un step con `if: failure()`):
#   bash .github/scripts/avisar-telegram.sh [archivo-con-detalle]
# Necesita los secrets TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID del repo
# (el mismo bot que usa Agente MacroAR).

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "::warning::Faltan los secrets TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID: no se manda el aviso."
  exit 0
fi

RUN_URL="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
TEXTO="❌ MacroAr — falló \"$GITHUB_WORKFLOW\""
if [ -n "$1" ] && [ -s "$1" ]; then
  TEXTO="$TEXTO

$(tail -n 25 "$1" | tail -c 3000)"
fi
TEXTO="$TEXTO

$RUN_URL"

curl -s -o /dev/null -w "Telegram HTTP %{http_code}\n" \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=$TEXTO" \
  -d "disable_web_page_preview=true"

#!/usr/bin/env bash
# Backup do banco do portal — o plano Free do Supabase NÃO faz backup
# automático, e o sistema já guarda contratos assinados.
#
# Uso:
#   export SUPABASE_DB_URL='postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres'
#   ./scripts/backup.sh [pasta-destino]
#
# A URL está em: Supabase → Project Settings → Database → Connection string
# (URI). NUNCA comite essa URL — ela contém a senha do banco.
#
# Para rodar todo dia às 3h no macOS:
#   crontab -e
#   0 3 * * * cd ~/portal-cliente-gabriela && SUPABASE_DB_URL='...' ./scripts/backup.sh ~/Backups/portal

set -euo pipefail

DESTINO="${1:-$HOME/Backups/portal}"
MANTER_DIAS=30

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "erro: defina SUPABASE_DB_URL antes de rodar (veja o cabeçalho deste arquivo)." >&2
  exit 1
fi

command -v pg_dump >/dev/null || {
  echo "erro: pg_dump não encontrado. No macOS: brew install libpq && brew link --force libpq" >&2
  exit 1
}

mkdir -p "$DESTINO"
ARQUIVO="$DESTINO/portal-$(date +%Y-%m-%d-%H%M).sql.gz"

echo "→ gerando $ARQUIVO"
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges | gzip > "$ARQUIVO"

TAMANHO=$(du -h "$ARQUIVO" | cut -f1)
echo "✓ backup concluído ($TAMANHO)"

# guarda os últimos MANTER_DIAS dias e descarta o resto
find "$DESTINO" -name 'portal-*.sql.gz' -type f -mtime "+$MANTER_DIAS" -delete
echo "✓ backups com mais de $MANTER_DIAS dias removidos"

echo
echo "Atenção: isto salva o BANCO (projetos, etapas, contratos, perfis)."
echo "Os ARQUIVOS (PDFs, imagens) vivem no Storage e não entram neste dump."
echo "Para baixá-los: Supabase → Storage → bucket 'documentos' → download."

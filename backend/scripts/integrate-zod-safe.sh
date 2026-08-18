#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "===== ZOD SAFE INTEGRATION ====="

# Ensure Zod is installed.
if ! npm ls zod >/dev/null 2>&1; then
  echo "Installing zod..."
  npm install zod
fi

# Files that have already been confirmed to contain Zod integration.
declare -A COMPLETE=(
  ["src/routes/auth.routes.ts"]=1
  ["src/routes/user.routes.ts"]=1
  ["src/bookings/booking.routes.ts"]=1
  ["src/admin/administrator.routes.ts"]=1
  ["src/admin/financial.routes.ts"]=1
  ["src/content/content.routes.ts"]=1
  ["src/messages/message.routes.ts"]=1
  ["src/support/support.routes.ts"]=1
  ["src/wallet/wallet.routes.ts"]=1
)

echo
echo "Scanning write endpoints..."

missing=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  if [[ "${COMPLETE[$file]:-0}" == "1" ]]; then
    continue
  fi

  awk '
    /router\.(post|patch|put)\(/ {
      print FILENAME ":" NR ":" $0
    }
  ' "$file" | while IFS= read -r route; do
    echo "MISSING REVIEW: $route"
    missing=$((missing + 1))
  done
done < <(find src -type f -name '*.routes.ts' | sort)

echo
echo "===== SAFE INTEGRATION RESULT ====="
echo
echo "Existing Zod integrations were left untouched."
echo "Endpoints requiring schema-specific integration were listed above."
echo
echo "No guessed schemas were inserted."
echo
echo "Next: integrate the listed endpoints using their actual request fields."

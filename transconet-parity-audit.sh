#!/data/data/com.termux/files/usr/bin/bash
# TransConet Parity Audit v1.0
# Run from the root of the TransConet repository:
#   chmod +x parity-audit.sh
#   ./parity-audit.sh
#
# Output:
#   parity-audit-YYYYMMDD-HHMMSS/
#     report.md
#     findings.json
#     frontend-api-calls.txt
#     backend-routes.txt
#     services.txt
#     auth-boundaries.txt
#     validation.txt
#     audit-logging.txt
#     database-behavior.txt
#     navigation.txt
#
# This is a static + runtime-evidence audit. It does NOT claim that a route
# works merely because source code contains it. The report separates
# "detected", "linked", and "verified" evidence.

set -u
set -o pipefail

ROOT="${1:-.}"
ROOT="$(cd "$ROOT" 2>/dev/null && pwd)" || {
  echo "ERROR: Cannot access repository: $1" >&2
  exit 1
}

TS="$(date '+%Y%m%d-%H%M%S')"
OUT="$ROOT/parity-audit-$TS"
mkdir -p "$OUT"

REPORT="$OUT/report.md"
JSON="$OUT/findings.json"

# Avoid scanning generated/vendor content.
EXCLUDES=(
  -g '!node_modules/**'
  -g '!dist/**'
  -g '!build/**'
  -g '!coverage/**'
  -g '!*.map'
  -g '!parity-audit-*/**'
)

have() { command -v "$1" >/dev/null 2>&1; }
RG="rg"
if ! have rg; then
  echo "ripgrep (rg) is required. Install with: pkg install ripgrep" >&2
  exit 2
fi

scan() {
  local pattern="$1"
  local file="$2"
  rg -n -i --hidden "${EXCLUDES[@]}" "$pattern" "$ROOT" 2>/dev/null \
    | sed "s#^$ROOT/##" > "$OUT/$file" || true
}

count_lines() {
  [ -f "$1" ] && wc -l < "$1" | tr -d ' ' || echo 0
}

# 1) Navigation modules
scan '(<Route|createBrowserRouter|createRoutesFromElements|RouterProvider|useRoutes|navigate\(|router\.(push|replace|navigate)|href=|to=|Link[^>]*to=|NavLink|menu|navigation|sidebar)' navigation.txt

# 2) Frontend API calls
scan '(fetch\(|axios\.(get|post|put|patch|delete)|axios\(|api\.(get|post|put|patch|delete)|\.request\(|/api/|NEXT_PUBLIC_API|VITE_.*API|baseURL)' frontend-api-calls.txt

# 3) Backend routes
scan '((app|router|server)\.(get|post|put|patch|delete|options|head|use)\(|Router\(\)|router\.route\(|@(Get|Post|Put|Patch|Delete|Use)\(|fastify\.(get|post|put|patch|delete)|app\.route\()' backend-routes.txt

# 4) Services / controllers / use-cases
scan '([/\\](services|service|controllers|controller|use-cases|usecases|repositories|repository|handlers|handler)[/\\]|(Service|Controller|Repository|UseCase|Handler)[[:space:]]*[({=]|from .*services|from .*controllers)' services.txt

# 5) Authorization boundaries
scan '(authenticate|authorization|authorize|isAuthenticated|requireAuth|requireRole|requirePermission|hasRole|hasPermission|rbac|role(s)?|permission(s)?|jwt|verifyToken|accessToken|csrf|session|adminOnly|SUPER_ADMIN|ADMIN|SUPPORT_ADMIN|DEVELOPER)' auth-boundaries.txt

# 6) Validation
scan '(zod|z\.object|z\.string|z\.number|z\.enum|z\.array|validate|validation|validator|joi|yup|class-validator|express-validator|parse\(|safeParse\(|schema|body\.(parse|safeParse))' validation.txt

# 7) Audit logging
scan '(audit(log|_log)?|auditTrail|auditEvent|activityLog|securityLog|logAudit|recordAudit|adminAction|actorId|performedBy|requestId|correlationId)' audit-logging.txt

# 8) Real database behavior
scan '(prisma|PrismaClient|supabase|createClient\(|postgres|pg\.|Pool\(|drizzle|drizzle-orm|knex|sequelize|mongoose|typeorm|repository\.(find|create|update|delete)|\.from\(|\.insert\(|\.select\(|\.update\(|\.delete\(|\.query\()' database-behavior.txt

# Helpful structural inventory
scan '^(import|export|const|function|class)[[:space:]].*(page|screen|layout|dashboard|module|route)' navigation.txt

# Exact route-ish extraction for a cleaner inventory.
rg -n --hidden "${EXCLUDES[@]}" \
  '(app|router|server)\.(get|post|put|patch|delete|options|head)\(' "$ROOT" 2>/dev/null \
  | sed "s#^$ROOT/##" > "$OUT/backend-route-definitions.txt" || true

# Package/runtime inventory
{
  echo "Repository: $ROOT"
  echo "Audit time: $(date -Iseconds)"
  echo
  echo "Node: $(node --version 2>/dev/null || echo unavailable)"
  echo "npm:  $(npm --version 2>/dev/null || echo unavailable)"
  echo "git:  $(git --version 2>/dev/null || echo unavailable)"
  echo "rg:   $(rg --version 2>/dev/null | head -1 || echo unavailable)"
  echo
  echo "Git branch: $(git -C "$ROOT" branch --show-current 2>/dev/null || echo unknown)"
  echo "Git commit: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo
  if [ -f "$ROOT/package.json" ]; then
    echo "Root package.json:"
    sed -n '1,220p' "$ROOT/package.json"
  fi
} > "$OUT/environment.txt"

# Detect likely frontend/backend directories.
{
  echo "Likely application directories:"
  find "$ROOT" -maxdepth 3 -type d \
    \( -name src -o -name app -o -name pages -o -name frontend -o -name backend -o -name server -o -name api \) \
    -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/build/*' 2>/dev/null \
    | sed "s#^$ROOT##" | sort -u
} > "$OUT/structure.txt"

# Runtime evidence: attempt safe, read-only checks if common endpoints are supplied.
BASE_URL="${PARITY_BASE_URL:-}"
if [ -n "$BASE_URL" ] && have curl; then
  {
    echo "Runtime base URL: $BASE_URL"
    echo
    echo "=== GET / ==="
    curl -k -sS -o /tmp/parity_body -D /tmp/parity_headers \
      --max-time 15 "$BASE_URL/" || true
    sed -n '1,40p' /tmp/parity_headers 2>/dev/null || true
    echo
    echo "=== GET /api/health ==="
    curl -k -sS -o /tmp/parity_body -D /tmp/parity_headers \
      --max-time 15 "$BASE_URL/api/health" || true
    sed -n '1,40p' /tmp/parity_headers 2>/dev/null || true
    echo
    echo "=== GET /api/csrf-token ==="
    curl -k -sS -o /tmp/parity_body -D /tmp/parity_headers \
      --max-time 15 "$BASE_URL/api/csrf-token" || true
    sed -n '1,40p' /tmp/parity_headers 2>/dev/null || true
  } > "$OUT/runtime-smoke.txt"
else
  echo "No PARITY_BASE_URL supplied; runtime smoke tests were skipped." > "$OUT/runtime-smoke.txt"
fi

# Build a machine-readable summary.
python3 - "$OUT" "$JSON" <<'PY'
import json, os, sys, re
out, dest = sys.argv[1:3]

def read(name):
    p=os.path.join(out,name)
    try:
        with open(p,encoding="utf-8",errors="replace") as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []

files = [
    ("navigation", "navigation.txt"),
    ("frontend_api_calls", "frontend-api-calls.txt"),
    ("backend_routes", "backend-routes.txt"),
    ("services", "services.txt"),
    ("authorization_boundaries", "auth-boundaries.txt"),
    ("validation", "validation.txt"),
    ("audit_logging", "audit-logging.txt"),
    ("database_behavior", "database-behavior.txt"),
]
data = {
    "audit_type": "static parity audit",
    "limitations": [
        "Source-code detection is not proof of runtime behavior.",
        "A frontend API call is not considered matched to a backend route without endpoint/method correlation.",
        "Authorization, validation, audit logging, and database behavior require code-path tracing or runtime verification.",
        "Secrets and environment variable values are intentionally not collected."
    ],
    "files": {}
}
for key, fn in files:
    lines=read(fn)
    data["files"][key]={"count":len(lines),"evidence":lines[:5000]}
with open(dest,"w",encoding="utf-8") as f:
    json.dump(data,f,indent=2)
PY

# Produce human-readable report with explicit verification states.
{
  echo "# TransConet Parity Audit"
  echo
  echo "**Generated:** $(date -Iseconds)"
  echo
  echo "## Audit objective"
  echo
  echo "Trace the chain: **navigation module → frontend API call → backend route → service → authorization boundary → validation → audit logging → real database behavior**."
  echo
  echo "## Important interpretation"
  echo
  echo "- **Detected** means a static source-code pattern was found."
  echo "- **Linked** means the evidence appears to connect two layers, but requires manual/path verification."
  echo "- **Verified** should only be assigned after confirming the actual execution path, authorization behavior, validation outcome, audit event, and database mutation/read against a real environment."
  echo "- This audit does **not** print secret values."
  echo
  echo "## Evidence counts"
  echo
  printf '| Layer | Evidence lines |\n|---|---:|\n'
  printf '| Navigation | %s |\n' "$(count_lines "$OUT/navigation.txt")"
  printf '| Frontend API calls | %s |\n' "$(count_lines "$OUT/frontend-api-calls.txt")"
  printf '| Backend routes | %s |\n' "$(count_lines "$OUT/backend-routes.txt")"
  printf '| Services | %s |\n' "$(count_lines "$OUT/services.txt")"
  printf '| Authorization | %s |\n' "$(count_lines "$OUT/auth-boundaries.txt")"
  printf '| Validation | %s |\n' "$(count_lines "$OUT/validation.txt")"
  printf '| Audit logging | %s |\n' "$(count_lines "$OUT/audit-logging.txt")"
  printf '| Database behavior | %s |\n' "$(count_lines "$OUT/database-behavior.txt")"
  echo
  echo "## Required parity chain"
  echo
  echo "For each user-facing navigation module, manually establish:"
  echo
  echo '1. Navigation component/page exists.'
  echo '2. Every API call made by that page is identified, including method, path, request body/query, headers, and response handling.'
  echo '3. Each API call maps to exactly one intended backend route (or documented gateway/proxy path).'
  echo '4. The route reaches the intended controller/handler/service.'
  echo '5. Authentication and authorization are enforced at the correct boundary.'
  echo '6. Request data is validated before business logic/database writes.'
  echo '7. Security-sensitive/admin actions create the expected audit event.'
  echo '8. The service performs the intended real database operation, not mock/demo/fallback behavior.'
  echo '9. Error handling preserves authorization, validation, transaction, and audit guarantees.'
  echo '10. Runtime behavior matches the source-code path.'
  echo
  echo "## Static evidence files"
  echo
  for f in navigation.txt frontend-api-calls.txt backend-routes.txt backend-route-definitions.txt services.txt auth-boundaries.txt validation.txt audit-logging.txt database-behavior.txt runtime-smoke.txt environment.txt structure.txt; do
    echo "- \`$f\`"
  done
  echo
  echo "## High-risk indicators to inspect"
  echo
  rg -n -i --hidden "${EXCLUDES[@]}" \
    '(TODO|FIXME|mock|mocked|dummy|fake|sample data|seed data|fallback|simulat|hardcoded|console\.log|allowAll|skipAuth|disableAuth|withoutAuth|unsafe|raw SQL|as any|@ts-ignore)' "$ROOT" 2>/dev/null \
    | sed "s#^$ROOT/##" | head -500 || true
  echo
  echo "## Runtime smoke-test output"
  echo
  sed -n '1,240p' "$OUT/runtime-smoke.txt"
  echo
  echo "## Next step"
  echo
  echo "Upload this entire audit directory (or its ZIP) for detailed verification. The most useful files are report.md, findings.json, frontend-api-calls.txt, backend-routes.txt, services.txt, auth-boundaries.txt, validation.txt, audit-logging.txt, database-behavior.txt, and runtime-smoke.txt."
} > "$REPORT"

# Optional runtime route probes from a user-supplied newline-separated list.
if [ -n "${PARITY_ROUTES_FILE:-}" ] && [ -f "$PARITY_ROUTES_FILE" ] && [ -n "$BASE_URL" ] && have curl; then
  {
    echo "Runtime route probes against: $BASE_URL"
    echo
    while IFS= read -r route; do
      route="${route%%#*}"
      route="$(echo "$route" | xargs)"
      [ -z "$route" ] && continue
      case "$route" in
        /*) ;;
        *) continue ;;
      esac
      echo "### GET $route"
      curl -k -sS -o /tmp/parity_probe_body -D /tmp/parity_probe_headers \
        --max-time 15 "$BASE_URL$route" || true
      head -40 /tmp/parity_probe_headers 2>/dev/null || true
      echo
    done < "$PARITY_ROUTES_FILE"
  } > "$OUT/route-probes.txt"
fi

# ZIP for easy upload.
ZIP="$ROOT/parity-audit-$TS.zip"
if have zip; then
  (cd "$ROOT" && zip -qr "$ZIP" "$(basename "$OUT")")
else
  echo "zip command unavailable; install with: pkg install zip" >> "$REPORT"
fi

echo
echo "============================================================"
echo "TransConet Parity Audit complete"
echo "============================================================"
echo "Audit directory: $OUT"
[ -f "$ZIP" ] && echo "ZIP for upload:   $ZIP"
echo
echo "Recommended:"
echo "  1) Upload the ZIP here."
echo "  2) If you have a deployed API, run:"
echo "       PARITY_BASE_URL='https://your-api.example.com' ./parity-audit.sh"
echo "  3) For route smoke probes:"
echo "       PARITY_BASE_URL='https://your-api.example.com' PARITY_ROUTES_FILE=routes.txt ./parity-audit.sh"
echo

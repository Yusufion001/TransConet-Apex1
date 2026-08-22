#!/data/data/com.termux/files/usr/bin/bash
set -uo pipefail

ROOT="${1:-$(pwd)}"
ADMIN="$ROOT/admin-app"
BACKEND="$ROOT/backend"
OUT="$ROOT/parity-audit-report.txt"

if [[ ! -d "$ADMIN/src" || ! -d "$BACKEND/src" ]]; then
  echo "ERROR: Run from ~/TransConet-Apex1 or pass its path."
  exit 1
fi

PYTHON="$(command -v python3 || command -v python || true)"
if [[ -z "$PYTHON" ]]; then
  echo "ERROR: Python is required. Install with: pkg install python"
  exit 1
fi

cat > "$OUT" <<REPORT
======================================================================
TRANSCONET-APEX1 ADMINISTRATION MANAGEMENT PLATFORM
FULL PARITY AUDIT
======================================================================
Generated: $(date -Iseconds)
Repository: $ROOT

AUDIT CHAIN

Navigation module
 -> frontend module/component
 -> every frontend API call
 -> HTTP method + endpoint
 -> backend route mount
 -> backend route handler
 -> service
 -> authentication
 -> authorization / module permission / ownership
 -> validation
 -> audit logging / AdminActivity
 -> Prisma/database operation
 -> runtime/test evidence

This is a READ-ONLY static/repository audit.
Static evidence does not prove runtime database behavior.
Those gaps are explicitly reported.
======================================================================
REPORT

section () {
  {
    echo
    echo "======================================================================"
    echo "$1"
    echo "======================================================================"
  } >> "$OUT"
}

section "1. NAVIGATION MODULES"

"$PYTHON" - "$ADMIN/src/App.tsx" >> "$OUT" <<'PY'
import re,sys

s=open(sys.argv[1],encoding="utf-8",errors="ignore").read()

labels=re.findall(r'label\s*:\s*"([^"]+)"',s)

print("Navigation labels:")
for i,x in enumerate(labels,1):
    print(f"{i:03d}. {x}")

print(f"Total navigation labels: {len(labels)}")

print("\nRender branches:")
for a,b in re.findall(
    r'active\s*===\s*"([^"]+)"\s*\?\s*\(\s*<([A-Za-z0-9_]+)',
    s
):
    print(f"{a} -> {b}")
PY

section "2. FRONTEND MODULE FILES"

find "$ADMIN/src/modules" -maxdepth 1 -type f \
  \( -name '*.tsx' -o -name '*.ts' \) \
  -printf '%f\n' 2>/dev/null | sort >> "$OUT"

section "3. EVERY FRONTEND API CALL"

"$PYTHON" - "$ADMIN/src" >> "$OUT" <<'PY'
import os,re,sys

root=sys.argv[1]

p=re.compile(
    r'\b(apiClient|axios)\s*\.\s*'
    r'(get|post|put|patch|delete)\s*'
    r'(?:<[^>]+>)?\s*\(\s*([`"\'])(.*?)\3',
    re.S
)

f=re.compile(
    r'\bfetch\s*\(\s*([`"\'])(.*?)\1',
    re.S
)

rows=[]

for dp,_,fs in os.walk(root):
    for fn in fs:
        if not fn.endswith((".ts",".tsx")):
            continue

        path=os.path.join(dp,fn)

        try:
            s=open(path,encoding="utf-8",errors="ignore").read()
        except:
            continue

        for m in p.finditer(s):
            rows.append((
                path,
                s.count("\n",0,m.start())+1,
                m.group(2).upper(),
                " ".join(m.group(4).split())
            ))

        for m in f.finditer(s):
            rows.append((
                path,
                s.count("\n",0,m.start())+1,
                "FETCH",
                " ".join(m.group(2).split())
            ))

for r in sorted(rows):
    print(f"{r[0]}:{r[1]} | {r[2]:<6} | {r[3]}")

print(f"\nTotal frontend HTTP calls found: {len(rows)}")
PY

section "4. BACKEND ADMIN ROUTE MOUNTS"

grep -nE 'app\.use\("/api/admin' \
  "$BACKEND/src/server.ts" 2>/dev/null >> "$OUT" || true

section "5. EVERY ADMIN BACKEND ROUTE"

for f in "$BACKEND"/src/admin/*.routes.ts; do
    [[ -f "$f" ]] || continue

    echo "===== ${f#$BACKEND/} =====" >> "$OUT"

    grep -nE \
      'router\.(get|post|put|patch|delete|use)\s*\(' \
      "$f" 2>/dev/null >> "$OUT" || true
done

section "6. AUTHENTICATION / AUTHORIZATION BOUNDARIES"

grep -RniE \
  'authenticate|requireAdmin|requireAdminModule|requireSuperAdmin|permission|ownership|ownerId|actorId' \
  "$BACKEND/src/admin" \
  --include='*.routes.ts' \
  --include='*.service.ts' \
  --include='*.middleware.ts' \
  2>/dev/null | head -1500 >> "$OUT" || true

section "7. VALIDATION"

echo "Zod / parse / validation references:" >> "$OUT"

grep -RniE \
  'from ["'\'']zod["'\'']|\.parse\(|\.safeParse\(|validate\(' \
  "$BACKEND/src/admin" \
  --include='*.routes.ts' \
  --include='*.validators.ts' \
  2>/dev/null | head -1500 >> "$OUT" || true

echo >> "$OUT"
echo "Exported schemas:" >> "$OUT"

grep -RniE \
  '^export const .*Schema\s*=' \
  "$BACKEND/src/admin" \
  --include='*.validators.ts' \
  2>/dev/null | sort >> "$OUT" || true

section "8. ROUTE -> SERVICE MAPPING"

"$PYTHON" - "$BACKEND/src/admin" >> "$OUT" <<'PY'
import glob,os,re,sys

root=sys.argv[1]

for p in sorted(glob.glob(os.path.join(root,"*.routes.ts"))):
    s=open(p,encoding="utf-8",errors="ignore").read()

    services=re.findall(
        r'from\s+["\']\.\/([^"\']*service)\.js["\']',
        s
    )

    print(
        os.path.basename(p)
        + " -> "
        + (
            ", ".join(sorted(set(services)))
            if services
            else "NO LOCAL SERVICE IMPORT DETECTED"
        )
    )
PY

section "9. SERVICE INVENTORY"

find "$BACKEND/src" \
  -type f \
  -name '*.service.ts' \
  -printf '%p\n' \
  2>/dev/null | sort >> "$OUT"

section "10. SERVICE -> REAL DATABASE BEHAVIOR"

grep -RniE \
  'prisma\.[A-Za-z0-9_]+\.(find|findMany|findUnique|findFirst|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy|transaction|queryRaw|executeRaw)' \
  "$BACKEND/src" \
  --include='*.service.ts' \
  --include='*.ts' \
  2>/dev/null | head -3000 >> "$OUT" || true

section "11. AUDIT LOGGING / ADMIN ACTIVITY"

grep -RniE \
  'adminActivity|AdminActivity|persistAdminActivity|recordAdminError|auditLog|audit' \
  "$BACKEND/src" \
  --include='*.ts' \
  2>/dev/null | head -2500 >> "$OUT" || true

section "12. REALTIME / EVENT BUS"

grep -RniE \
  'publishEvent|persistAdminActivity|event-bus|socket|realtime' \
  "$BACKEND/src" \
  --include='*.ts' \
  2>/dev/null | head -2000 >> "$OUT" || true

section "13. AUTOMATED TEST EVIDENCE"

echo "Backend tests:" >> "$OUT"

find "$BACKEND/tests" \
  -type f \
  \( -name '*.test.ts' -o -name '*.spec.ts' \) \
  -printf '%f\n' \
  2>/dev/null | sort >> "$OUT" || true

echo "Admin-app tests:" >> "$OUT"

find "$ADMIN" \
  -type f \
  \( -name '*.test.ts' -o -name '*.test.tsx' \
     -o -name '*.spec.ts' -o -name '*.spec.tsx' \) \
  -printf '%p\n' \
  2>/dev/null | sort >> "$OUT" || true

section "14. BUILD EVIDENCE"

echo "===== BACKEND npm run build =====" >> "$OUT"

(
    cd "$BACKEND" &&
    npm run build
) >> "$OUT" 2>&1

BACKEND_BUILD=$?

echo "===== ADMIN APP npm run build =====" >> "$OUT"

(
    cd "$ADMIN" &&
    npm run build
) >> "$OUT" 2>&1

ADMIN_BUILD=$?

section "15. STATIC FRONTEND ENDPOINT -> BACKEND MOUNT MATCH"

"$PYTHON" - "$ADMIN/src" "$BACKEND/src/server.ts" >> "$OUT" <<'PY'
import os,re,sys

root,server=sys.argv[1:]

p=re.compile(
    r'\bapiClient\s*\.\s*'
    r'(get|post|put|patch|delete)\s*'
    r'(?:<[^>]+>)?\s*\(\s*([`"\'])(.*?)\2',
    re.S
)

calls=[]

for dp,_,fs in os.walk(root):
    for fn in fs:
        if not fn.endswith((".ts",".tsx")):
            continue

        path=os.path.join(dp,fn)
        s=open(path,encoding="utf-8",errors="ignore").read()

        for m in p.finditer(s):
            calls.append((
                m.group(1).upper(),
                " ".join(m.group(3).split()),
                path
            ))

st=open(server,encoding="utf-8",errors="ignore").read()

mounts=re.findall(
    r'app\.use\(\s*["\'](/api/admin[^"\']*)["\']',
    st
)

print("Backend mounts:")

for x in mounts:
    print("  "+x)

print("\nFrontend calls:")

for method,url,path in sorted(calls):

    clean=re.sub(
        r'\$\{[^}]+\}',
        '{id}',
        url
    ).split("?")[0]

    matches=[
        m for m in mounts
        if clean.startswith(m) or m.startswith(clean)
    ]

    print(f"{method} {url}")
    print(f"  source: {path}")

    print(
        "  mount: "
        + (
            ", ".join(matches)
            if matches
            else "NO STATIC MATCH"
        )
    )
PY

section "16. POTENTIAL STATIC GAPS"

"$PYTHON" \
  "$ADMIN/src/App.tsx" \
  "$ADMIN/src/modules" \
  "$BACKEND/src/admin" >> "$OUT" <<'PY'
import os,re,sys

app,mods,adm=sys.argv[1:]

s=open(app,encoding="utf-8",errors="ignore").read()

labels=re.findall(
    r'label\s*:\s*"([^"]+)"',
    s
)

branches=dict(
    re.findall(
        r'active\s*===\s*"([^"]+)"\s*\?\s*'
        r'\(\s*<([A-Za-z0-9_]+)',
        s
    )
)

print("Navigation labels without obvious render branch:")

for x in labels:
    if x not in branches and x not in (
        "Command Center",
        "Settings"
    ):
        print("WARN:",x)

print("\nModule files not referenced by App.tsx:")

for fn in sorted(os.listdir(mods)):
    if fn.endswith(".tsx"):

        if re.search(
            r'\b' + re.escape(fn[:-4]) + r'\b',
            s
        ) is None:
            print("WARN:",fn)

print("\nAdmin route files without requireAdminModule/requireSuperAdmin:")

for fn in sorted(os.listdir(adm)):

    if fn.endswith(".routes.ts"):

        t=open(
            os.path.join(adm,fn),
            encoding="utf-8",
            errors="ignore"
        ).read()

        if (
            "requireAdminModule" not in t
            and
            "requireSuperAdmin" not in t
        ):
            print("WARN:",fn)
PY

section "17. RUNTIME / DATABASE VERIFICATION STILL REQUIRED"

cat >> "$OUT" <<'EOF'
Static source inspection cannot prove:

- real database records returned by every GET endpoint
- correct mutation persistence
- transaction/concurrency invariants
- role/permission rejection at runtime
- ownership/tenant isolation
- audit row creation on success and failure paths
- realtime event consistency with committed DB state
- frontend/runtime response-shape compatibility
- behavior against empty, missing, invalid, or conflicting DB states

NEXT VERIFICATION PHASE

For every mapped administration capability:

HTTP request
 -> authentication
 -> authorization
 -> validation
 -> service
 -> database transaction
 -> response
 -> AdminActivity/audit record
 -> realtime event where applicable

must be exercised against the intended development/test database.


#!/data/data/com.termux/files/usr/bin/bash

set -u

echo "============================================================"
echo " TRANSCONET-APEX1 ADMIN FRONTEND MODULE AUDIT"
echo "============================================================"
echo

MODULES=(
  "Platform Overview|PlatformOverview"
  "Platform Configuration|PlatformConfig"
  "Live Operations|LiveOperations"
  "Command Center|CommandCenter"
)

for entry in "${MODULES[@]}"; do
  NAME="${entry%%|*}"
  FILE="${entry##*|}"

  echo "------------------------------------------------------------"
  echo "MODULE: $NAME"
  echo "------------------------------------------------------------"

  MODULE_FILE=$(find src -type f \( \
    -iname "${FILE}.tsx" \
    -o -iname "${FILE}.ts" \
    -o -iname "${FILE}.jsx" \
    -o -iname "${FILE}.js" \
  \) | head -n 1)

  if [ -n "$MODULE_FILE" ]; then
    echo "Frontend file : FOUND -> $MODULE_FILE"
  else
    echo "Frontend file : NOT FOUND"
  fi

  ROUTE_MATCH=$(grep -R -n -E \
    "PlatformOverview|PlatformConfig|LiveOperations|CommandCenter|platform-overview|platform-config|live-operations|command-center" \
    src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js' \
    2>/dev/null | head -n 20)

  if [ -n "$ROUTE_MATCH" ]; then
    echo "Route/reference: FOUND"
    echo "$ROUTE_MATCH" | sed 's/^/  /'
  else
    echo "Route/reference: NOT FOUND"
  fi

  echo
done

echo "============================================================"
echo " NAVIGATION REFERENCES"
echo "============================================================"

grep -R -n -E \
  "Platform Overview|Platform Configuration|Live Operations|Command Center|PlatformOverview|PlatformConfig|LiveOperations|CommandCenter" \
  src --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js' \
  2>/dev/null | head -n 80 || true

echo
echo "============================================================"
echo " POSSIBLE ADMIN MODULE FILES"
echo "============================================================"

find src/modules -maxdepth 1 -type f \
  \( -name '*.tsx' -o -name '*.ts' \) \
  -printf '%f\n' 2>/dev/null | sort

echo
echo "============================================================"
echo " FRONTEND API FILES"
echo "============================================================"

find src/api -maxdepth 1 -type f \
  \( -name '*.tsx' -o -name '*.ts' \) \
  -printf '%f\n' 2>/dev/null | sort

echo
echo "============================================================"
echo " BUILD / TYPESCRIPT CHECK"
echo "============================================================"

if npm run build >/tmp/transconet-admin-build.log 2>&1; then
  echo "BUILD STATUS: PASS"
else
  echo "BUILD STATUS: FAIL"
  echo
  tail -n 40 /tmp/transconet-admin-build.log
fi

echo
echo "============================================================"
echo " AUDIT COMPLETE"
echo "============================================================"

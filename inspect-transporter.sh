#!/data/data/com.termux/files/usr/bin/bash

set +e

ROOT="$HOME/TransConet-Apex1"
APP="$ROOT/mobile-app"
MAX=55000
OUT="$(mktemp)"

section() {
  printf '\n\n============================================================\n' >> "$OUT"
  printf '%s\n' "$1" >> "$OUT"
  printf '============================================================\n' >> "$OUT"
}

run() {
  printf '\n$ %s\n' "$1" >> "$OUT"
  eval "$1" >> "$OUT" 2>&1
}

if [ ! -d "$APP" ]; then
  echo "ERROR: mobile-app directory not found: $APP"
  exit 1
fi

section "1. PROJECT IDENTITY"
run "pwd"
run "git -C '$ROOT' branch --show-current"
run "git -C '$ROOT' rev-parse --short HEAD"
run "git -C '$ROOT' status --short"

section "2. MOBILE APP FILE STRUCTURE"
run "find '$APP' -type f \
  ! -path '*/node_modules/*' \
  ! -path '*/.git/*' \
  ! -path '*/android/.gradle/*' \
  ! -path '*/android/build/*' \
  ! -path '*/android/app/build/*' \
  ! -path '*/.expo/*' \
  ! -path '*/dist/*' \
  ! -path '*/build/*' \
  | sed \"s#^$APP/##\" | sort | head -500"

section "3. PACKAGE / EXPO CONFIG"
run "cat '$APP/package.json'"
run "cat '$APP/app.json' 2>/dev/null"
run "cat '$APP/app.config.js' 2>/dev/null"
run "cat '$APP/app.config.ts' 2>/dev/null"
run "cat '$APP/tsconfig.json' 2>/dev/null"
run "cat '$APP/babel.config.js' 2>/dev/null"
run "cat '$APP/metro.config.js' 2>/dev/null"

section "4. EXPO CONFIG RESOLVED"
run "cd '$APP' && npx expo config --json 2>&1 | grep -E '\"name\"|\"slug\"|\"version\"|\"sdkVersion\"|\"platforms\"|\"package\"|\"scheme\"|\"newArchEnabled\"'"

section "5. ROUTING / SCREENS"
run "find '$APP/app' -type f 2>/dev/null \
  ! -path '*/node_modules/*' | sort"
run "find '$APP/src' -maxdepth 3 -type f 2>/dev/null \
  ! -path '*/node_modules/*' | sort | head -400"

section "6. API / AUTH / REALTIME / STORAGE FILES"
run "find '$APP' -type f \
  ! -path '*/node_modules/*' \
  ! -path '*/.git/*' \
  | grep -Ei '/(api|auth|realtime|socket|store|stores|context|contexts|hooks|services|storage|notifications|location|types)/' \
  | sed \"s#^$APP/##\" | sort | head -400"

section "7. IMPORTANT SOURCE REFERENCES"
run "grep -RniE \
  'EXPO_PUBLIC_API_URL|API_URL|axios|fetch\\(|socket\\.io|io\\(|SecureStore|AsyncStorage|create\\(|zustand|QueryClient|useQuery|useMutation|Notifications|Location|requestForegroundPermissions|requestBackgroundPermissions' \
  '$APP' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=android \
  --exclude-dir=.expo \
  --exclude='*.lock' \
  2>/dev/null | head -600"

section "8. TRANSPORTER FEATURE REFERENCES"
run "grep -RniE \
  'TRANSPORTER|transporter|vehicle|booking|trip|marketplace|bid|earning|wallet|subscription|document|verification|support|message|notification|location|tracking' \
  '$APP' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=android \
  --exclude-dir=.expo \
  --exclude='*.lock' \
  2>/dev/null | head -900"

section "9. ENVIRONMENT NAMES ONLY — VALUES HIDDEN"
run "find '$APP' -maxdepth 2 -type f \( -name '.env' -o -name '.env.*' \) -print -exec sh -c 'grep -E \"^[A-Za-z_][A-Za-z0-9_]*=\" \"\$1\" 2>/dev/null | sed -E \"s/=.*$/=<REDACTED>/\"' _ {} \\;"

section "10. TYPESCRIPT CHECK"
run "cd '$APP' && npx tsc --noEmit 2>&1"

section "11. EXPO DOCTOR"
run "cd '$APP' && npx expo-doctor 2>&1"

section "12. ANDROID CONFIG"
run "find '$APP/android' -maxdepth 3 -type f 2>/dev/null \
  ! -path '*/.gradle/*' \
  ! -path '*/build/*' \
  | sort | head -300"

section "13. RECENT MOBILE GIT HISTORY"
run "git -C '$ROOT' log --oneline --decorate -15 -- '$APP'"

section "14. IMPORTANT: POSSIBLE ERRORS IN SOURCE"
run "grep -RniE \
  'TODO|FIXME|throw new Error|console\\.error|Element type is invalid|arm64|DevTools|ERROR' \
  '$APP' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=android \
  --exclude-dir=.expo \
  2>/dev/null | head -500"

printf '\n\n============================================================\n' >> "$OUT"
printf 'INSPECTION COMPLETE\n' >> "$OUT"
printf 'Output is intentionally capped at %s characters.\n' "$MAX" >> "$OUT"
printf '============================================================\n' >> "$OUT"

SIZE=$(wc -c < "$OUT")

if [ "$SIZE" -gt "$MAX" ]; then
  {
    head -c "$MAX" "$OUT"
    printf '\n\n[OUTPUT TRUNCATED AT %s CHARACTERS]\n' "$MAX"
  } 
else
  cat "$OUT"
fi

rm -f "$OUT"

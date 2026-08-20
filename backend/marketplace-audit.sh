#!/data/data/com.termux/files/usr/bin/bash

set +e

ROOT="$HOME/TransConet-Apex1/backend"
REPORT="$ROOT/marketplace-audit-report.txt"

cd "$ROOT" || {
  echo "ERROR: Backend directory not found: $ROOT"
  exit 1
}

: > "$REPORT"

section() {
  printf '\n\n============================================================\n' | tee -a "$REPORT"
  printf '%s\n' "$1" | tee -a "$REPORT"
  printf '============================================================\n' | tee -a "$REPORT"
}

run() {
  echo -e "\n\$ $*" | tee -a "$REPORT"
  "$@" 2>&1 | tee -a "$REPORT"
  echo "EXIT_CODE=${PIPESTATUS[0]}" | tee -a "$REPORT"
}

grep_section() {
  local title="$1"
  local pattern="$2"
  local path="$3"

  section "$title"

  if [ -e "$path" ]; then
    grep -RniE "$pattern" "$path" 2>/dev/null | tee -a "$REPORT"
  else
    echo "PATH NOT FOUND: $path" | tee -a "$REPORT"
  fi
}

echo "TransConet-Apex1 Marketplace / Bidding READ-ONLY AUDIT" | tee -a "$REPORT"
echo "Started: $(date)" | tee -a "$REPORT"
echo "Backend: $ROOT" | tee -a "$REPORT"

# ------------------------------------------------------------
# 1. Repository state
# ------------------------------------------------------------

section "1. GIT / REPOSITORY STATE"

run git status -sb
run git log -5 --oneline --decorate

# ------------------------------------------------------------
# 2. Marketplace file inventory
# ------------------------------------------------------------

section "2. MARKETPLACE FILE INVENTORY"

find src/marketplace -maxdepth 2 -type f -print 2>/dev/null | sort | tee -a "$REPORT"

section "2B. RELATED MARKETPLACE FILES"

find src -type f \( \
  -iname '*marketplace*' -o \
  -iname '*bid*' -o \
  -iname '*visibility*' \
\) -print 2>/dev/null | sort | tee -a "$REPORT"

# ------------------------------------------------------------
# 3. Full Marketplace service
# ------------------------------------------------------------

section "3. FULL marketplace.service.ts"

if [ -f src/marketplace/marketplace.service.ts ]; then
  nl -ba src/marketplace/marketplace.service.ts | tee -a "$REPORT"
else
  echo "MISSING: src/marketplace/marketplace.service.ts" | tee -a "$REPORT"
fi

# ------------------------------------------------------------
# 4. Visibility implementation
# ------------------------------------------------------------

section "4. FULL visibility.service.ts"

if [ -f src/marketplace/visibility.service.ts ]; then
  nl -ba src/marketplace/visibility.service.ts | tee -a "$REPORT"
else
  echo "MISSING: src/marketplace/visibility.service.ts" | tee -a "$REPORT"
fi

section "4B. visibility.policy.ts"

if [ -f src/marketplace/visibility.policy.ts ]; then
  nl -ba src/marketplace/visibility.policy.ts | tee -a "$REPORT"
else
  echo "MISSING: src/marketplace/visibility.policy.ts" | tee -a "$REPORT"
fi

# ------------------------------------------------------------
# 5. Marketplace routes / DTOs / schemas
# ------------------------------------------------------------

section "5. MARKETPLACE ROUTES"

find src -type f \( \
  -name '*marketplace*.routes.ts' -o \
  -name '*marketplace*.route.ts' -o \
  -name '*bid*.routes.ts' -o \
  -name '*bid*.route.ts' \
\) -print 2>/dev/null | while read -r file; do
  echo
  echo "----- $file -----"
  nl -ba "$file"
done | tee -a "$REPORT"

section "5B. MARKETPLACE DTO / VALIDATION FILES"

find src -type f \( \
  -name '*marketplace*.dto.ts' -o \
  -name '*marketplace*.schema.ts' -o \
  -name '*bid*.dto.ts' -o \
  -name '*bid*.schema.ts' \
\) -print 2>/dev/null | while read -r file; do
  echo
  echo "----- $file -----"
  nl -ba "$file"
done | tee -a "$REPORT"

# ------------------------------------------------------------
# 6. Search API wiring
# ------------------------------------------------------------

grep_section \
  "6. MARKETPLACE ROUTER WIRING" \
  'marketplace|Marketplace|MARKETPLACE|marketplaceRoutes|marketplaceRouter' \
  src

# ------------------------------------------------------------
# 7. Prisma schema
# ------------------------------------------------------------

section "7. MARKETPLACE / BOOKING / VEHICLE / USER PRISMA SCHEMA"

if [ -f prisma/schema.prisma ]; then

  echo "----- ENUMS -----"
  grep -n -A25 -B5 \
    -E '^enum (Marketplace|TruckCategory|Booking|Vehicle|User|Cargo)' \
    prisma/schema.prisma | tee -a "$REPORT"

  echo "----- USER -----"
  grep -n -A75 -B5 '^model User' prisma/schema.prisma | tee -a "$REPORT"

  echo "----- VEHICLE -----"
  grep -n -A55 -B5 '^model Vehicle' prisma/schema.prisma | tee -a "$REPORT"

  echo "----- BOOKING -----"
  grep -n -A75 -B5 '^model Booking' prisma/schema.prisma | tee -a "$REPORT"

  echo "----- MARKETPLACE REQUEST -----"
  grep -n -A70 -B5 '^model MarketplaceRequest' prisma/schema.prisma | tee -a "$REPORT"

  echo "----- MARKETPLACE BID -----"
  grep -n -A55 -B5 '^model MarketplaceBid' prisma/schema.prisma | tee -a "$REPORT"

else
  echo "MISSING: prisma/schema.prisma" | tee -a "$REPORT"
fi

# ------------------------------------------------------------
# 8. Marketplace database constraints
# ------------------------------------------------------------

section "8. MARKETPLACE DATABASE CONSTRAINTS / INDEXES"

grep -nE \
  'MarketplaceRequest|MarketplaceBid|@@unique|@@index|agreedBidId|bookingId|requestId|transporterId|vehicleId' \
  prisma/schema.prisma 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 9. Booking integration
# ------------------------------------------------------------

section "9. BOOKING SERVICE INTEGRATION"

find src -type f \( \
  -name '*booking*.service.ts' -o \
  -name '*booking*.routes.ts' \
\) -print 2>/dev/null | while read -r file; do
  echo
  echo "----- $file -----"
  grep -n -E \
    'createBooking|status|vehicleId|transporterId|marketplace|ASSIGNED|ON_TRIP|AVAILABLE|paymentStatus|fare' \
    "$file" 2>/dev/null
done | tee -a "$REPORT"

# ------------------------------------------------------------
# 10. Vehicle availability integration
# ------------------------------------------------------------

grep_section \
  "10. VEHICLE AVAILABILITY STATE TRANSITIONS" \
  'availabilityStatus|AVAILABLE|ON_TRIP|UNAVAILABLE|vehicle\.update|vehicle\.updateMany' \
  src

# ------------------------------------------------------------
# 11. Marketplace event / realtime integration
# ------------------------------------------------------------

section "11. MARKETPLACE EVENTS / REALTIME"

grep -RniE \
  'LOAD_POSTED|BID_SUBMITTED|BID_WITHDRAWN|BID_SELECTED|BID_REJECTED|BID_EXPIRED|MARKETPLACE|marketplace' \
  src/realtime src/events src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 12. Subscription / visibility integration
# ------------------------------------------------------------

section "12. SUBSCRIPTION / VISIBILITY INTEGRATION"

grep -RniE \
  'subscription|subscriptions|subscriptionBoost|tierScore|transporterTier|visibility|radiusKm|defaultRadius|maxRadius' \
  src/marketplace src/subscriptions src 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 13. Authorization checks
# ------------------------------------------------------------

section "13. MARKETPLACE AUTHORIZATION CHECKS"

grep -RniE \
  'authenticate|requireAdmin|requireRole|role|customerId|transporterId|Access denied|ownership|OWNER|TRANSPORTER|CUSTOMER' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 14. Validation checks
# ------------------------------------------------------------

section "14. MARKETPLACE VALIDATION / ZOD CHECKS"

grep -RniE \
  'z\.object|z\.string|z\.number|z\.enum|safeParse|parse\(|validate|validation|schema' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 15. Numeric / financial validation
# ------------------------------------------------------------

section "15. BID AMOUNT / FINANCIAL VALIDATION"

grep -RniE \
  'amount|estimatedFare|fare|Decimal|minimum|max|positive|nonnegative|finite|NaN|Infinity' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 16. Lifecycle / expiration
# ------------------------------------------------------------

section "16. MARKETPLACE LIFECYCLE / EXPIRATION"

grep -RniE \
  'expireMarketplaceLifecycle|expiresAt|scheduledDate|BIDDING_CLOSED|AGREED|CANCELLED|EXPIRED|OPEN|PENDING|SELECTED|REJECTED|WITHDRAWN' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 17. Transaction / concurrency protection
# ------------------------------------------------------------

section "17. TRANSACTION / CONCURRENCY AUDIT"

grep -RniE \
  '\$transaction|updateMany|status: "OPEN"|status: "AVAILABLE"|count !== 1|count === 1|FOR UPDATE|Serializable|isolation' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 18. Duplicate / race-condition indicators
# ------------------------------------------------------------

section "18. RACE-CONDITION / DUPLICATION INDICATORS"

grep -RniE \
  'findUnique.*create|findFirst.*create|findUnique.*update|findFirst.*update|create\(|update\(|updateMany\(' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 19. Sensitive-data exposure
# ------------------------------------------------------------

section "19. MARKETPLACE RESPONSE DATA AUDIT"

grep -RniE \
  'select:|include:|return |return \{|password|passwordHash|refreshToken|token|email|phone|documents|profilePhoto|resetPassword' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 20. Audit logging
# ------------------------------------------------------------

section "20. MARKETPLACE AUDIT LOGGING"

grep -RniE \
  'audit|AuditLog|auditLog|logAdmin|recordAudit|adminActivity' \
  src/marketplace src/audit src/admin 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 21. Tests
# ------------------------------------------------------------

section "21. MARKETPLACE TEST FILES"

find . -type f \( \
  -path './node_modules' -o \
  -path './dist' \
\) -prune -o \
  -type f \( \
    -iname '*marketplace*.test.*' -o \
    -iname '*marketplace*.spec.*' -o \
    -iname '*bid*.test.*' -o \
    -iname '*bid*.spec.*' \
  \) -print \
  2>/dev/null | sort | tee -a "$REPORT"

section "21B. ALL TEST REFERENCES TO MARKETPLACE"

grep -RniE \
  'marketplace|MarketplaceBid|MarketplaceRequest|selectMarketplaceBid|createMarketplaceBid|visibility' \
  tests src 2>/dev/null | head -n 1000 | tee -a "$REPORT"

# ------------------------------------------------------------
# 22. TODO / FIXME / suspicious gaps
# ------------------------------------------------------------

section "22. TODO / FIXME / NOT IMPLEMENTED REFERENCES"

grep -RniE \
  'TODO|FIXME|XXX|HACK|NOT IMPLEMENTED|not implemented|throw new Error\(".*not implemented' \
  src/marketplace src 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 23. Package scripts
# ------------------------------------------------------------

section "23. PACKAGE SCRIPTS"

if [ -f package.json ]; then
  node -e '
    const p=require("./package.json");
    console.log(JSON.stringify(p.scripts ?? {}, null, 2));
  ' 2>&1 | tee -a "$REPORT"
fi

# ------------------------------------------------------------
# 24. Prisma validation
# ------------------------------------------------------------

section "24. PRISMA VALIDATION"

run npx prisma validate

# ------------------------------------------------------------
# 25. TypeScript audit
# ------------------------------------------------------------

section "25. TYPESCRIPT TYPECHECK"

if npm run typecheck --if-present >/dev/null 2>&1; then
  run npm run typecheck
else
  echo "No typecheck script detected; running tsc directly if available." | tee -a "$REPORT"
  if [ -x "./node_modules/.bin/tsc" ]; then
    run ./node_modules/.bin/tsc --noEmit
  else
    echo "TypeScript compiler not found." | tee -a "$REPORT"
  fi
fi

# ------------------------------------------------------------
# 26. Build audit
# ------------------------------------------------------------

section "26. BACKEND BUILD"

if npm run build --if-present >/dev/null 2>&1; then
  run npm run build
else
  echo "No build script detected." | tee -a "$REPORT"
fi

# ------------------------------------------------------------
# 27. Route summary
# ------------------------------------------------------------

section "27. ROUTE ENDPOINT SUMMARY"

grep -RniE \
  'router\.(get|post|put|patch|delete)|router\.(use)' \
  src/marketplace src/routes 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 28. Function export summary
# ------------------------------------------------------------

section "28. MARKETPLACE EXPORTED FUNCTIONS"

grep -RniE \
  '^export (async )?function|^export const|^export default' \
  src/marketplace 2>/dev/null | tee -a "$REPORT"

# ------------------------------------------------------------
# 29. Event names
# ------------------------------------------------------------

section "29. MARKETPLACE EVENT TYPES"

grep -RhoE \
  'eventType:\s*"[^"]+"' \
  src/marketplace 2>/dev/null | sort -u | tee -a "$REPORT"

# ------------------------------------------------------------
# 30. Final machine-readable quick checks
# ------------------------------------------------------------

section "30. QUICK AUDIT FLAGS"

echo "Marketplace service exists:"
[ -f src/marketplace/marketplace.service.ts ] && echo "YES" || echo "NO"

echo "Visibility service exists:"
[ -f src/marketplace/visibility.service.ts ] && echo "YES" || echo "NO"

echo "Visibility policy exists:"
[ -f src/marketplace/visibility.policy.ts ] && echo "YES" || echo "NO"

echo "MarketplaceRequest model exists:"
grep -q '^model MarketplaceRequest' prisma/schema.prisma \
  && echo "YES" || echo "NO"

echo "MarketplaceBid model exists:"
grep -q '^model MarketplaceBid' prisma/schema.prisma \
  && echo "YES" || echo "NO"

echo "Marketplace transaction exists:"
grep -q '\$transaction' src/marketplace/marketplace.service.ts \
  && echo "YES" || echo "NO"

echo "Bid uniqueness constraint exists:"
grep -q '@@unique(\[requestId, transporterId\])' prisma/schema.prisma \
  && echo "YES" || echo "NO"

echo "Vehicle reservation transition exists:"
grep -q 'availabilityStatus: "ON_TRIP"' \
  src/marketplace/marketplace.service.ts \
  && echo "YES" || echo "NO"

echo "Competing bid rejection exists:"
grep -q 'status: "REJECTED"' \
  src/marketplace/marketplace.service.ts \
  && echo "YES" || echo "NO"

echo "Marketplace booking creation exists:"
grep -q 'tx.booking.create' \
  src/marketplace/marketplace.service.ts \
  && echo "YES" || echo "NO"

# ------------------------------------------------------------
# Finish
# ------------------------------------------------------------

section "AUDIT COMPLETE"

echo "Report saved to:" | tee -a "$REPORT"
echo "$REPORT" | tee -a "$REPORT"
echo "Finished: $(date)" | tee -a "$REPORT"

echo
echo "READ-ONLY AUDIT COMPLETE."
echo "No source files, Prisma schema, database, or Git state were intentionally modified."

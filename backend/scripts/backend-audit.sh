#!/data/data/com.termux/files/usr/bin/bash

REPORT="audits/summary-$(date +%Y%m%d-%H%M%S).txt"

count() {
    grep -R "$1" src --include="*.ts" 2>/dev/null | wc -l
}

echo "=================================" >"$REPORT"
echo "TransConet-Apex1 Backend Summary" >>"$REPORT"
echo "=================================" >>"$REPORT"

echo "" >>"$REPORT"
echo "AUTHENTICATION" >>"$REPORT"
echo "JWT references: $(count jwt)" >>"$REPORT"
echo "Refresh tokens: $(count refresh)" >>"$REPORT"
echo "Password reset: $(count resetPassword)" >>"$REPORT"

echo "" >>"$REPORT"
echo "AUTHORIZATION" >>"$REPORT"
echo "authenticate(): $(count authenticate)" >>"$REPORT"
echo "authorize(): $(count authorize)" >>"$REPORT"
echo "requireAdmin(): $(count requireAdmin)" >>"$REPORT"

echo "" >>"$REPORT"
echo "ZOD VALIDATION" >>"$REPORT"
echo "z.object(): $(count 'z.object')" >>"$REPORT"
echo "parse(): $(count 'parse(')" >>"$REPORT"

echo "" >>"$REPORT"
echo "DTO EXPOSURE" >>"$REPORT"
echo "password fields: $(count password)" >>"$REPORT"
echo "refreshToken fields: $(count refreshToken)" >>"$REPORT"

echo "" >>"$REPORT"
echo "AUDIT LOGGING" >>"$REPORT"
echo "AuditLog references: $(count AuditLog)" >>"$REPORT"

echo "" >>"$REPORT"
echo "FINANCIAL CONCURRENCY" >>"$REPORT"
echo "\$transaction usage: $(count '\$transaction')" >>"$REPORT"
echo "idempotency references: $(count idempotency)" >>"$REPORT"

echo "" >>"$REPORT"
echo "WEBHOOKS" >>"$REPORT"
echo "Webhook references: $(count webhook)" >>"$REPORT"
echo "Signature verification: $(count verifyWebhookSignature)" >>"$REPORT"

echo "" >>"$REPORT"
echo "REALTIME" >>"$REPORT"
echo "publishEvent(): $(count publishEvent)" >>"$REPORT"

echo "" >>"$REPORT"
echo "TESTS" >>"$REPORT"
echo "Test files: $(find tests -name '*.ts' 2>/dev/null | wc -l)" >>"$REPORT"

echo "" >>"$REPORT"
echo "PRISMA" >>"$REPORT"
echo "Models: $(grep '^model ' prisma/schema.prisma | wc -l)" >>"$REPORT"
echo "Enums: $(grep '^enum ' prisma/schema.prisma | wc -l)" >>"$REPORT"

echo "" >>"$REPORT"
echo "GIT" >>"$REPORT"
echo "Modified files: $(git status --short | wc -l)" >>"$REPORT"

cat "$REPORT"

# TransConet-Apex1 — Zod Integration Report

Generated: 2026-08-18T07:59:27.775105

## Existing validator files
- `src/admin/admin.validators.ts`
- `src/bookings/booking.validators.ts`
- `src/messages/message.validators.ts`
- `src/support/support.validators.ts`
- `src/users/user.validators.ts`
- `src/verification/youverify/youverify.validators.ts`
- `src/wallet/wallet.validators.ts`

## Automatic integration policy

- Existing validators are never overwritten.
- Existing `.parse()` / `.safeParse()` usage is preserved.
- Provider-specific webhook routes are skipped.
- Verification start is skipped until its exact domain schema is defined.
- Generic `req.body` spreads are not automatically rewritten.
- Every automatic change is backed up before modification.

### `src/admin/administrator.routes.ts` — `POST /`
- Line: `68`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/admin/administrator.routes.ts` — `PATCH /:userId`
- Line: `152`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/admin/administrator.routes.ts` — `POST /:userId/suspend`
- Line: `188`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/administrator.routes.ts` — `POST /:userId/activate`
- Line: `212`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/administrator.routes.ts` — `POST /:userId/disable`
- Line: `236`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/ai-automation.routes.ts` — `POST /run`
- Line: `36`
- Body: `False`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: no request body/params/query detected; no automatic Zod change made.

### `src/admin/backup-recovery.routes.ts` — `POST /snapshot`
- Line: `36`
- Body: `False`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: no request body/params/query detected; no automatic Zod change made.

### `src/admin/financial.routes.ts` — `POST /settlements/:id/submit`
- Line: `194`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/financial.routes.ts` — `POST /settlements/:id/approve`
- Line: `219`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/admin/financial.routes.ts` — `POST /settlements/:id/reject`
- Line: `252`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/financial.routes.ts` — `POST /settlements/:id/resubmit`
- Line: `288`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/financial.routes.ts` — `POST /settlements/:id/release`
- Line: `312`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/financial.routes.ts` — `POST /webhooks/:id/retry`
- Line: `362`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/financial.routes.ts` — `PATCH /withdrawals/:id/status`
- Line: `396`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/fleet.routes.ts` — `PATCH /:id`
- Line: `56`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/marketing.routes.ts` — `POST /`
- Line: `76`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/marketing.routes.ts` — `PATCH /:id`
- Line: `98`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/marketing.routes.ts` — `PATCH /:id/status`
- Line: `121`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/notification.routes.ts` — `PATCH /:id/read`
- Line: `59`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/partner.routes.ts` — `PATCH /:id`
- Line: `57`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/platform-config.routes.ts` — `PUT /:key`
- Line: `55`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/platform-config.routes.ts` — `DELETE /:key`
- Line: `80`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/reports.routes.ts` — `POST /generate`
- Line: `36`
- Body: `False`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: no request body/params/query detected; no automatic Zod change made.

### `src/admin/risk-fraud.routes.ts` — `POST /alerts`
- Line: `36`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/role-permission.routes.ts` — `PATCH /:id/permissions`
- Line: `49`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/security.routes.ts` — `PATCH /administrators/:id/unlock`
- Line: `94`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/security.routes.ts` — `PATCH /administrators/:id/2fa`
- Line: `118`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/support.routes.ts` — `PATCH /:id/assign`
- Line: `45`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/support.routes.ts` — `PATCH /:id/status`
- Line: `67`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/admin/verification.routes.ts` — `PATCH /:id/approve`
- Line: `42`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/admin/verification.routes.ts` — `PATCH /:id/reject`
- Line: `57`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/bookings/booking.routes.ts` — `POST /`
- Line: `101`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/bookings/booking.routes.ts` — `PATCH /:id/assign`
- Line: `197`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/bookings/booking.routes.ts` — `PATCH /:id/status`
- Line: `230`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/bookings/booking.routes.ts` — `PATCH /:id/proof-of-delivery`
- Line: `254`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/bookings/booking.routes.ts` — `PATCH /:id/confirm-delivery`
- Line: `283`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/content/content.routes.ts` — `POST /`
- Line: `20`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/content/content.routes.ts` — `PATCH /:id`
- Line: `72`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/content/content.routes.ts` — `PATCH /:id/publish`
- Line: `91`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/disputes/dispute.routes.ts` — `POST /`
- Line: `18`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/disputes/dispute.routes.ts` — `PATCH /:id/status`
- Line: `93`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/documents/document.routes.ts` — `POST /`
- Line: `23`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/documents/document.routes.ts` — `PATCH /:id/approve`
- Line: `100`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/documents/document.routes.ts` — `PATCH /:id/reject`
- Line: `120`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/events/event.routes.ts` — `POST /`
- Line: `17`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/messages/message.routes.ts` — `POST /`
- Line: `21`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/notifications/notification.routes.ts` — `POST /`
- Line: `18`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/notifications/notification.routes.ts` — `PATCH /:id/read`
- Line: `60`
- Body: `False`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: params detected; UUID/schema validation requires domain-specific confirmation.

### `src/payments/payment.routes.ts` — `POST /webhook`
- Line: `18`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- **ACTION: MANUAL REVIEW REQUIRED**

### `src/payments/payment.routes.ts` — `POST /`
- Line: `104`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/routes/auth.routes.ts` — `POST /register`
- Line: `59`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/routes/auth.routes.ts` — `POST /login`
- Line: `94`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/routes/auth.routes.ts` — `POST /refresh`
- Line: `122`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/routes/auth.routes.ts` — `POST /logout`
- Line: `132`
- Body: `False`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: no request body/params/query detected; no automatic Zod change made.

### `src/routes/auth.routes.ts` — `POST /forgot-password`
- Line: `141`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/routes/auth.routes.ts` — `POST /reset-password`
- Line: `164`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/routes/user.routes.ts` — `PATCH /:id`
- Line: `51`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/subscriptions/subscription.routes.ts` — `POST /`
- Line: `56`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/subscriptions/subscription.routes.ts` — `POST /cancel`
- Line: `81`
- Body: `False`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: no request body/params/query detected; no automatic Zod change made.

### `src/support/support.routes.ts` — `POST /`
- Line: `24`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/support/support.routes.ts` — `PATCH /:id/status`
- Line: `89`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/transporters/transporter.routes.ts` — `POST /`
- Line: `17`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/transporters/transporter.routes.ts` — `PATCH /:id/verification`
- Line: `82`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/vehicles/vehicle.routes.ts` — `POST /`
- Line: `17`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/vehicles/vehicle.routes.ts` — `PATCH /:id`
- Line: `65`
- Body: `True`
- Params: `True`
- Query: `False`
- Zod already present: `False`
- ACTION: body detected but no safe automatic schema mapping; requires domain-specific validator.

### `src/verification/verification.routes.ts` — `POST /start`
- Line: `11`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- **ACTION: MANUAL REVIEW REQUIRED**

### `src/verification/youverify/youverify.webhook.routes.ts` — `POST /webhook`
- Line: `8`
- Body: `False`
- Params: `False`
- Query: `False`
- Zod already present: `False`
- **ACTION: MANUAL REVIEW REQUIRED**

### `src/wallet/wallet.routes.ts` — `POST /`
- Line: `16`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

### `src/wallet/wallet.routes.ts` — `POST /withdraw`
- Line: `85`
- Body: `True`
- Params: `False`
- Query: `False`
- Zod already present: `True`
- ACTION: already validated / middleware detected

## Summary

- Routes inspected: 2
- Existing validator files: 7
- Skipped/already validated/manual: 19
- Routes requiring domain-specific integration: 45
- Files automatically changed: 0

## Important

This master audit intentionally does NOT invent validation rules. Routes whose input shape cannot be safely inferred are reported for domain-specific schema creation instead.

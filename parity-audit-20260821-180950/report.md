# TransConet Parity Audit

**Generated:** 2026-08-21T18:09:52+01:00

## Audit objective

Trace the chain: **navigation module → frontend API call → backend route → service → authorization boundary → validation → audit logging → real database behavior**.

## Important interpretation

- **Detected** means a static source-code pattern was found.
- **Linked** means the evidence appears to connect two layers, but requires manual/path verification.
- **Verified** should only be assigned after confirming the actual execution path, authorization behavior, validation outcome, audit event, and database mutation/read against a real environment.
- This audit does **not** print secret values.

## Evidence counts

| Layer | Evidence lines |
|---|---:|
| Navigation | 571 |
| Frontend API calls | 442 |
| Backend routes | 2319 |
| Services | 241 |
| Authorization | 9914 |
| Validation | 3087 |
| Audit logging | 971 |
| Database behavior | 4593 |

## Required parity chain

For each user-facing navigation module, manually establish:

1. Navigation component/page exists.
2. Every API call made by that page is identified, including method, path, request body/query, headers, and response handling.
3. Each API call maps to exactly one intended backend route (or documented gateway/proxy path).
4. The route reaches the intended controller/handler/service.
5. Authentication and authorization are enforced at the correct boundary.
6. Request data is validated before business logic/database writes.
7. Security-sensitive/admin actions create the expected audit event.
8. The service performs the intended real database operation, not mock/demo/fallback behavior.
9. Error handling preserves authorization, validation, transaction, and audit guarantees.
10. Runtime behavior matches the source-code path.

## Static evidence files

- `navigation.txt`
- `frontend-api-calls.txt`
- `backend-routes.txt`
- `backend-route-definitions.txt`
- `services.txt`
- `auth-boundaries.txt`
- `validation.txt`
- `audit-logging.txt`
- `database-behavior.txt`
- `runtime-smoke.txt`
- `environment.txt`
- `structure.txt`

## High-risk indicators to inspect

transconet-parity-audit.sh:233:  echo '8. The service performs the intended real database operation, not mock/demo/fallback behavior.'
transconet-parity-audit.sh:246:    '(TODO|FIXME|mock|mocked|dummy|fake|sample data|seed data|fallback|simulat|hardcoded|console\.log|allowAll|skipAuth|disableAuth|withoutAuth|unsafe|raw SQL|as any|@ts-ignore)' "$ROOT" 2>/dev/null \
parity-audit-report.txt:1242:/data/data/com.termux/files/home/TransConet-Apex1/backend/src/server.ts:219:  console.log(`Realtime client connected: ${socket.id}`);
parity-audit-report.txt:1363:/data/data/com.termux/files/home/TransConet-Apex1/admin-app/node_modules/zod/src/v3/tests/mocker.test.ts
marketplace-report-chunks/context-05.txt:1496:    "test": "node --experimental-test-module-mocks --import tsx --test tests/**/*.test.ts",
marketplace-report-chunks/context-04.txt:5:    prismaMock.marketplaceBid.create.mock.calls.length,
marketplace-report-chunks/context-04.txt:10:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-04.txt:16:  prismaMock.marketplaceBid.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:25:  prismaMock.marketplaceBid.update.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:43:    prismaMock.marketplaceBid.update.mock.calls.length,
marketplace-report-chunks/context-04.txt:48:    prismaMock.marketplaceBid.update.mock.calls[0]?.arguments[0];
marketplace-report-chunks/context-04.txt:54:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-04.txt:59:    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
marketplace-report-chunks/context-04.txt:65:  prismaMock.marketplaceBid.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:85:    prismaMock.marketplaceBid.update.mock.calls.length,
marketplace-report-chunks/context-04.txt:90:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-04.txt:96:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:130:    prismaMock.marketplaceBid.findFirst.mock.calls.length,
marketplace-report-chunks/context-04.txt:135:    prismaMock.booking.create.mock.calls.length,
marketplace-report-chunks/context-04.txt:140:    prismaMock.marketplaceRequest.updateMany.mock.calls.length,
marketplace-report-chunks/context-04.txt:145:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-04.txt:220:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:224:  prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:228:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:232:  prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:236:  prismaMock.marketplaceRequest.updateMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:242:  prismaMock.vehicle.updateMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:248:  prismaMock.marketplaceBid.updateMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:264:  prismaMock.booking.create.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:268:  prismaMock.marketplaceRequest.update.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:285:    prismaMock.marketplaceRequest.updateMany.mock.calls.length,
marketplace-report-chunks/context-04.txt:290:    prismaMock.vehicle.updateMany.mock.calls.length,
marketplace-report-chunks/context-04.txt:295:    prismaMock.booking.create.mock.calls.length,
marketplace-report-chunks/context-04.txt:300:    prismaMock.booking.create.mock.calls[0]?.arguments[0];
marketplace-report-chunks/context-04.txt:328:    prismaMock.marketplaceRequest.update.mock.calls.length,
marketplace-report-chunks/context-04.txt:333:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-04.txt:337:  const eventTypes = publishEventMock.mock.calls.map(
marketplace-report-chunks/context-04.txt:353:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:375:  prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:388:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:400:  prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:411:  prismaMock.marketplaceRequest.updateMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:417:  prismaMock.vehicle.updateMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:435:    prismaMock.booking.create.mock.calls.length,
marketplace-report-chunks/context-04.txt:440:    prismaMock.marketplaceRequest.update.mock.calls.length,
marketplace-report-chunks/context-04.txt:445:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-04.txt:453:    prismaMock.marketplaceBid.findMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:463:    prismaMock.marketplaceBid.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:483:      prismaMock.marketplaceBid.updateMany.mock.calls.length,
marketplace-report-chunks/context-04.txt:488:      prismaMock.marketplaceBid.updateMany.mock.calls[0]?.arguments[0];
marketplace-report-chunks/context-04.txt:507:    prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:529:    prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:554:      prismaMock.booking.create.mock.calls.length,
marketplace-report-chunks/context-04.txt:559:      prismaMock.vehicle.updateMany.mock.calls.length,
marketplace-report-chunks/context-04.txt:568:    prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:590:    prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:603:    prismaMock.user.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:615:    prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:626:    prismaMock.marketplaceRequest.updateMany.mock.mockImplementation(
marketplace-report-chunks/context-04.txt:645:      prismaMock.booking.create.mock.calls.length,
marketplace-report-chunks/context-04.txt:652:import test, { mock } from "node:test";
marketplace-report-chunks/context-04.txt:655:const prismaMock = {
marketplace-report-chunks/context-04.txt:657:    create: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-04.txt:658:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-04.txt:659:    update: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-04.txt:663:const publishAdminEventMock = mock.fn<(...args: any[]) => any>();
marketplace-report-chunks/context-04.txt:665:mock.module("../src/config/prisma.js", {
marketplace-report-chunks/context-04.txt:667:    default: prismaMock,
marketplace-report-chunks/context-04.txt:668:    prisma: prismaMock,
marketplace-report-chunks/context-04.txt:672:mock.module("../src/realtime/realtime.service.js", {
marketplace-report-chunks/context-04.txt:674:    publishAdminEvent: publishAdminEventMock,
marketplace-report-chunks/context-04.txt:685:function resetMocks() {
marketplace-report-chunks/context-04.txt:687:    prismaMock.vehicle.create,
marketplace-report-chunks/context-04.txt:688:    prismaMock.vehicle.findUnique,
marketplace-report-chunks/context-04.txt:689:    prismaMock.vehicle.update,
marketplace-report-chunks/context-04.txt:690:    publishAdminEventMock,
marketplace-report-chunks/context-04.txt:692:    fn.mock.resetCalls();
marketplace-report-chunks/context-04.txt:697:  resetMocks();
marketplace-report-chunks/context-04.txt:706:  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => vehicle);
marketplace-report-chunks/context-04.txt:715:  assert.equal(prismaMock.vehicle.findUnique.mock.calls.length, 1);
marketplace-report-chunks/context-04.txt:719:  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
marketplace-report-chunks/context-04.txt:740:  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => vehicle);
marketplace-report-chunks/context-04.txt:752:  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => null);
marketplace-report-chunks/context-04.txt:773:  prismaMock.vehicle.create.mock.mockImplementation(async () => vehicle);
marketplace-report-chunks/context-04.txt:779:    vehicleClass: "HEAVY" as any,
marketplace-report-chunks/context-04.txt:783:  assert.equal(prismaMock.vehicle.create.mock.calls.length, 1);
marketplace-report-chunks/context-04.txt:784:  assert.equal(publishAdminEventMock.mock.calls.length, 1);
marketplace-report-chunks/context-04.txt:787:    publishAdminEventMock.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-04.txt:805:  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => vehicle);
marketplace-report-chunks/context-04.txt:823:  prismaMock.vehicle.update.mock.mockImplementation(async () => vehicle);
marketplace-report-chunks/context-04.txt:834:  assert.equal(prismaMock.vehicle.update.mock.calls.length, 1);
marketplace-report-chunks/context-04.txt:835:  assert.equal(publishAdminEventMock.mock.calls.length, 1);
marketplace-report-chunks/context-04.txt:838:    publishAdminEventMock.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:241:       * fallback.
marketplace-part-01.txt:551:  console.log(`Realtime client connected: ${socket.id}`);
marketplace-part-01.txt:576:    console.log(
marketplace-part-01.txt:593:    console.log(
marketplace-part-01.txt:632:      console.log(
marketplace-part-01.txt:643:      console.log(
marketplace-part-01.txt:652:    console.log(
marketplace-part-01.txt:733:  console.log(
marketplace-part-01.txt:2522:import test, { mock } from "node:test";
marketplace-part-01.txt:2525:const routerUseMock = mock.fn();
marketplace-part-01.txt:2526:const routerGetMock = mock.fn();
marketplace-part-01.txt:2527:const routerPostMock = mock.fn();
marketplace-part-01.txt:2529:const RouterMock = () => ({
marketplace-part-01.txt:2530:  use: routerUseMock,
marketplace-part-01.txt:2531:  get: routerGetMock,
marketplace-part-01.txt:2532:  post: routerPostMock,
marketplace-part-01.txt:2535:mock.module("express", {
marketplace-part-01.txt:2537:    Router: RouterMock,
marketplace-part-01.txt:2541:const authenticateMock = mock.fn();
marketplace-part-01.txt:2545:  ReturnType<typeof mock.fn>
marketplace-part-01.txt:2548:const authorizeMock = mock.fn((role: string) => {
marketplace-part-01.txt:2555:  const middleware = mock.fn();
marketplace-part-01.txt:2560:const createMarketplaceRequestMock = mock.fn();
marketplace-part-01.txt:2561:const getMarketplaceRequestMock = mock.fn();
marketplace-part-01.txt:2562:const createMarketplaceBidMock = mock.fn();
marketplace-part-01.txt:2563:const withdrawMarketplaceBidMock = mock.fn();
marketplace-part-01.txt:2564:const selectMarketplaceBidMock = mock.fn();
marketplace-part-01.txt:2565:const getVisibleMarketplaceLoadsMock = mock.fn();
marketplace-part-01.txt:2567:mock.module("../src/middleware/auth.middleware.js", {
marketplace-part-01.txt:2569:    authenticate: authenticateMock,
marketplace-part-01.txt:2570:    authorize: authorizeMock,
marketplace-part-01.txt:2574:mock.module("../src/marketplace/marketplace.service.js", {
marketplace-part-01.txt:2576:    createMarketplaceRequest: createMarketplaceRequestMock,
marketplace-part-01.txt:2577:    getMarketplaceRequest: getMarketplaceRequestMock,
marketplace-part-01.txt:2578:    createMarketplaceBid: createMarketplaceBidMock,
marketplace-part-01.txt:2579:    withdrawMarketplaceBid: withdrawMarketplaceBidMock,
marketplace-part-01.txt:2580:    selectMarketplaceBid: selectMarketplaceBidMock,
marketplace-part-01.txt:2584:mock.module("../src/marketplace/visibility.service.js", {
marketplace-part-01.txt:2586:    getVisibleMarketplaceLoads: getVisibleMarketplaceLoadsMock,
marketplace-part-01.txt:2595:  res.status = mock.fn(() => res);
marketplace-part-01.txt:2596:  res.json = mock.fn(() => res);
marketplace-part-01.txt:2607:      ? routerGetMock.mock.calls
marketplace-part-01.txt:2608:      : routerPostMock.mock.calls;
marketplace-part-01.txt:2620:  createMarketplaceRequestMock.mock.resetCalls();
marketplace-part-01.txt:2621:  getMarketplaceRequestMock.mock.resetCalls();
marketplace-part-01.txt:2622:  createMarketplaceBidMock.mock.resetCalls();
marketplace-part-01.txt:2623:  withdrawMarketplaceBidMock.mock.resetCalls();
marketplace-part-01.txt:2624:  selectMarketplaceBidMock.mock.resetCalls();
marketplace-part-01.txt:2625:  getVisibleMarketplaceLoadsMock.mock.resetCalls();
marketplace-part-01.txt:2629:  assert.equal(routerUseMock.mock.calls.length, 1);
marketplace-part-01.txt:2631:    routerUseMock.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2632:    authenticateMock,
marketplace-part-01.txt:2638:    routerGetMock.mock.calls.map(
marketplace-part-01.txt:2645:    routerPostMock.mock.calls.map(
marketplace-part-01.txt:2724:  createMarketplaceRequestMock.mock.mockImplementation(
marketplace-part-01.txt:2740:    createMarketplaceRequestMock.mock.calls.length,
marketplace-part-01.txt:2745:    createMarketplaceRequestMock.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2752:  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);
marketplace-part-01.txt:2755:    res.json.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2781:  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
marketplace-part-01.txt:2784:    res.json.mock.calls[0]?.arguments[0].success,
marketplace-part-01.txt:2789:    res.json.mock.calls[0]?.arguments[0].error,
marketplace-part-01.txt:2794:    createMarketplaceRequestMock.mock.calls.length,
marketplace-part-01.txt:2821:  createMarketplaceBidMock.mock.mockImplementation(
marketplace-part-01.txt:2840:    createMarketplaceBidMock.mock.calls.length,
marketplace-part-01.txt:2845:    createMarketplaceBidMock.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2853:  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);
marketplace-part-01.txt:2856:    res.json.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2872:  createMarketplaceBidMock.mock.mockImplementation(
marketplace-part-01.txt:2897:  assert.equal(res.status.mock.calls[0]?.arguments[0], 409);
marketplace-part-01.txt:2900:    res.json.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2931:  selectMarketplaceBidMock.mock.mockImplementation(
marketplace-part-01.txt:2951:    selectMarketplaceBidMock.mock.calls.length,
marketplace-part-01.txt:2956:    selectMarketplaceBidMock.mock.calls[0]?.arguments,
marketplace-part-01.txt:2964:  assert.equal(res.status.mock.calls[0]?.arguments[0], 200);
marketplace-part-01.txt:2967:    res.json.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:2983:  selectMarketplaceBidMock.mock.mockImplementation(
marketplace-part-01.txt:3004:  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
marketplace-part-01.txt:3007:    res.json.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:3028:  withdrawMarketplaceBidMock.mock.mockImplementation(
marketplace-part-01.txt:3047:    withdrawMarketplaceBidMock.mock.calls.length,
marketplace-part-01.txt:3052:    withdrawMarketplaceBidMock.mock.calls[0]?.arguments,
marketplace-part-01.txt:3060:    res.json.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:3085:  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
marketplace-part-01.txt:3088:    res.json.mock.calls[0]?.arguments[0].success,
marketplace-part-01.txt:3093:    res.json.mock.calls[0]?.arguments[0].error,
marketplace-part-01.txt:3098:    getVisibleMarketplaceLoadsMock.mock.calls.length,
marketplace-part-01.txt:3104:import test, { mock } from "node:test";
marketplace-part-01.txt:3107:const routerUseMock = mock.fn();
marketplace-part-01.txt:3108:const routerGetMock = mock.fn();
marketplace-part-01.txt:3109:const routerPostMock = mock.fn();
marketplace-part-01.txt:3111:const RouterMock = () => ({
marketplace-part-01.txt:3112:  use: routerUseMock,
marketplace-part-01.txt:3113:  get: routerGetMock,
marketplace-part-01.txt:3114:  post: routerPostMock,
marketplace-part-01.txt:3117:mock.module("express", {
marketplace-part-01.txt:3119:    Router: RouterMock,
marketplace-part-01.txt:3123:const authenticateMock = mock.fn();
marketplace-part-01.txt:3127:  ReturnType<typeof mock.fn>
marketplace-part-01.txt:3130:const authorizeMock = mock.fn((role: string) => {
marketplace-part-01.txt:3137:  const middleware = mock.fn();
marketplace-part-01.txt:3142:mock.module("../src/middleware/auth.middleware.js", {
marketplace-part-01.txt:3144:    authenticate: authenticateMock,
marketplace-part-01.txt:3145:    authorize: authorizeMock,
marketplace-part-01.txt:3149:mock.module("../src/marketplace/marketplace.service.js", {
marketplace-part-01.txt:3151:    createMarketplaceRequest: mock.fn(),
marketplace-part-01.txt:3152:    getMarketplaceRequest: mock.fn(),
marketplace-part-01.txt:3153:    createMarketplaceBid: mock.fn(),
marketplace-part-01.txt:3154:    withdrawMarketplaceBid: mock.fn(),
marketplace-part-01.txt:3155:    selectMarketplaceBid: mock.fn(),
marketplace-part-01.txt:3159:mock.module("../src/marketplace/visibility.service.js", {
marketplace-part-01.txt:3161:    getVisibleMarketplaceLoads: mock.fn(),
marketplace-part-01.txt:3168:  assert.equal(routerUseMock.mock.calls.length, 1);
marketplace-part-01.txt:3170:    routerUseMock.mock.calls[0]?.arguments[0],
marketplace-part-01.txt:3171:    authenticateMock,
marketplace-part-01.txt:3177:    routerGetMock.mock.calls.map(
marketplace-part-01.txt:3184:    routerPostMock.mock.calls.map(
marketplace-part-01.txt:3197:  const loadRoute = routerGetMock.mock.calls.find(
marketplace-part-01.txt:3201:  const requestRoute = routerPostMock.mock.calls.find(
marketplace-part-01.txt:3205:  const bidRoute = routerPostMock.mock.calls.find(
marketplace-part-01.txt:3209:  const selectRoute = routerPostMock.mock.calls.find(
marketplace-part-01.txt:3215:  const withdrawRoute = routerPostMock.mock.calls.find(
marketplace-part-01.txt:3253:import test, { mock } from "node:test";
marketplace-part-01.txt:3256:const prismaMock = {
marketplace-part-01.txt:3258:    create: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3259:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3260:    findFirst: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3261:    findMany: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3262:    update: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3263:    updateMany: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3267:    create: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3268:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3269:    findFirst: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3270:    findMany: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3271:    update: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3272:    updateMany: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3276:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3280:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3281:    update: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3282:    updateMany: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3286:    create: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3289:  $transaction: mock.fn<(...args: any[]) => any>(),
marketplace-part-01.txt:3292:const publishEventMock =
marketplace-part-01.txt:3293:  mock.fn<(...args: any[]) => any>();
marketplace-part-01.txt:3295:const estimateFareMock =
marketplace-part-01.txt:3296:  mock.fn<(...args: any[]) => any>();
marketplace-part-01.txt:3298:mock.module("../src/config/prisma.js", {
marketplace-part-01.txt:3300:    default: prismaMock,
marketplace-part-01.txt:3301:    prisma: prismaMock,
marketplace-part-01.txt:3305:mock.module("../src/realtime/event-bus.js", {
marketplace-part-01.txt:3307:    publishEvent: publishEventMock,
marketplace-part-01.txt:3311:mock.module("../src/pricing/pricing.service.js", {
marketplace-part-01.txt:3313:    estimateFare: estimateFareMock,
marketplace-part-01.txt:3324:function resetMocks() {
marketplace-part-01.txt:3326:    prismaMock.marketplaceRequest.create,
marketplace-part-01.txt:3327:    prismaMock.marketplaceRequest.findUnique,
marketplace-part-01.txt:3328:    prismaMock.marketplaceRequest.findFirst,
marketplace-part-01.txt:3329:    prismaMock.marketplaceRequest.findMany,
marketplace-part-01.txt:3330:    prismaMock.marketplaceRequest.update,
marketplace-part-01.txt:3331:    prismaMock.marketplaceRequest.updateMany,
marketplace-part-01.txt:3333:    prismaMock.marketplaceBid.create,
marketplace-part-01.txt:3334:    prismaMock.marketplaceBid.findUnique,
marketplace-part-01.txt:3335:    prismaMock.marketplaceBid.findFirst,
marketplace-part-01.txt:3336:    prismaMock.marketplaceBid.findMany,
marketplace-part-01.txt:3337:    prismaMock.marketplaceBid.update,
marketplace-part-01.txt:3338:    prismaMock.marketplaceBid.updateMany,
marketplace-part-01.txt:3340:    prismaMock.user.findUnique,
marketplace-part-01.txt:3342:    prismaMock.vehicle.findUnique,
marketplace-part-01.txt:3343:    prismaMock.vehicle.update,
marketplace-part-01.txt:3344:    prismaMock.vehicle.updateMany,
marketplace-part-01.txt:3346:    prismaMock.booking.create,
marketplace-part-01.txt:3348:    prismaMock.$transaction,
marketplace-part-01.txt:3350:    publishEventMock,
marketplace-part-01.txt:3351:    estimateFareMock,
marketplace-part-01.txt:3353:    fn.mock.resetCalls();
marketplace-part-01.txt:3358:  resetMocks();
marketplace-part-01.txt:3360:  prismaMock.$transaction.mock.mockImplementation(
marketplace-part-01.txt:3361:    async (callback: any) => callback(prismaMock),
marketplace-part-01.txt:3364:  estimateFareMock.mock.mockImplementation(
marketplace-part-01.txt:3370:  prismaMock.marketplaceBid.findMany.mock.mockImplementation(
marketplace-part-01.txt:3374:  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
marketplace-part-01.txt:3405:  prismaMock.marketplaceRequest.create.mock.mockImplementation(
marketplace-part-01.txt:3428:    estimateFareMock.mock.calls.length,
marketplace-part-01.txt:3433:    prismaMock.marketplaceRequest.create.mock.calls.length,
marketplace-part-01.txt:3438:    publishEventMock.mock.calls.length,
marketplace-part-01.txt:3443:    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
marketplace-part-01.txt:3449:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3459:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3481:    prismaMock.marketplaceBid.create.mock.calls.length,
marketplace-part-01.txt:3487:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3497:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3508:  prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3537:  prismaMock.marketplaceBid.create.mock.mockImplementation(
marketplace-part-01.txt:3555:    prismaMock.marketplaceBid.create.mock.calls.length,
marketplace-part-01.txt:3560:    prismaMock.marketplaceBid.create.mock.calls[0]?.arguments[0];
marketplace-part-01.txt:3569:    publishEventMock.mock.calls.length,
marketplace-part-01.txt:3574:    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
marketplace-part-01.txt:3580:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3590:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3601:  prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-part-01.txt:3612:  prismaMock.marketplaceBid.create.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:442:import test, { mock } from "node:test";
marketplace-report-chunks/context-03.txt:445:const routerUseMock = mock.fn();
marketplace-report-chunks/context-03.txt:446:const routerGetMock = mock.fn();
marketplace-report-chunks/context-03.txt:447:const routerPostMock = mock.fn();
marketplace-report-chunks/context-03.txt:449:const RouterMock = () => ({
marketplace-report-chunks/context-03.txt:450:  use: routerUseMock,
marketplace-report-chunks/context-03.txt:451:  get: routerGetMock,
marketplace-report-chunks/context-03.txt:452:  post: routerPostMock,
marketplace-report-chunks/context-03.txt:455:mock.module("express", {
marketplace-report-chunks/context-03.txt:457:    Router: RouterMock,
marketplace-report-chunks/context-03.txt:461:const authenticateMock = mock.fn();
marketplace-report-chunks/context-03.txt:465:  ReturnType<typeof mock.fn>
marketplace-report-chunks/context-03.txt:468:const authorizeMock = mock.fn((role: string) => {
marketplace-report-chunks/context-03.txt:475:  const middleware = mock.fn();
marketplace-report-chunks/context-03.txt:480:const createMarketplaceRequestMock = mock.fn();
marketplace-report-chunks/context-03.txt:481:const getMarketplaceRequestMock = mock.fn();
marketplace-report-chunks/context-03.txt:482:const createMarketplaceBidMock = mock.fn();
marketplace-report-chunks/context-03.txt:483:const withdrawMarketplaceBidMock = mock.fn();
marketplace-report-chunks/context-03.txt:484:const selectMarketplaceBidMock = mock.fn();
marketplace-report-chunks/context-03.txt:485:const getVisibleMarketplaceLoadsMock = mock.fn();
marketplace-report-chunks/context-03.txt:487:mock.module("../src/middleware/auth.middleware.js", {
marketplace-report-chunks/context-03.txt:489:    authenticate: authenticateMock,
marketplace-report-chunks/context-03.txt:490:    authorize: authorizeMock,
marketplace-report-chunks/context-03.txt:494:mock.module("../src/marketplace/marketplace.service.js", {
marketplace-report-chunks/context-03.txt:496:    createMarketplaceRequest: createMarketplaceRequestMock,
marketplace-report-chunks/context-03.txt:497:    getMarketplaceRequest: getMarketplaceRequestMock,
marketplace-report-chunks/context-03.txt:498:    createMarketplaceBid: createMarketplaceBidMock,
marketplace-report-chunks/context-03.txt:499:    withdrawMarketplaceBid: withdrawMarketplaceBidMock,
marketplace-report-chunks/context-03.txt:500:    selectMarketplaceBid: selectMarketplaceBidMock,
marketplace-report-chunks/context-03.txt:504:mock.module("../src/marketplace/visibility.service.js", {
marketplace-report-chunks/context-03.txt:506:    getVisibleMarketplaceLoads: getVisibleMarketplaceLoadsMock,
marketplace-report-chunks/context-03.txt:515:  res.status = mock.fn(() => res);
marketplace-report-chunks/context-03.txt:516:  res.json = mock.fn(() => res);
marketplace-report-chunks/context-03.txt:527:      ? routerGetMock.mock.calls
marketplace-report-chunks/context-03.txt:528:      : routerPostMock.mock.calls;
marketplace-report-chunks/context-03.txt:540:  createMarketplaceRequestMock.mock.resetCalls();
marketplace-report-chunks/context-03.txt:541:  getMarketplaceRequestMock.mock.resetCalls();
marketplace-report-chunks/context-03.txt:542:  createMarketplaceBidMock.mock.resetCalls();
marketplace-report-chunks/context-03.txt:543:  withdrawMarketplaceBidMock.mock.resetCalls();
marketplace-report-chunks/context-03.txt:544:  selectMarketplaceBidMock.mock.resetCalls();
marketplace-report-chunks/context-03.txt:545:  getVisibleMarketplaceLoadsMock.mock.resetCalls();
marketplace-report-chunks/context-03.txt:549:  assert.equal(routerUseMock.mock.calls.length, 1);
marketplace-report-chunks/context-03.txt:551:    routerUseMock.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:552:    authenticateMock,
marketplace-report-chunks/context-03.txt:558:    routerGetMock.mock.calls.map(
marketplace-report-chunks/context-03.txt:565:    routerPostMock.mock.calls.map(
marketplace-report-chunks/context-03.txt:644:  createMarketplaceRequestMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:660:    createMarketplaceRequestMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:665:    createMarketplaceRequestMock.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:672:  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);
marketplace-report-chunks/context-03.txt:675:    res.json.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:701:  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
marketplace-report-chunks/context-03.txt:704:    res.json.mock.calls[0]?.arguments[0].success,
marketplace-report-chunks/context-03.txt:709:    res.json.mock.calls[0]?.arguments[0].error,
marketplace-report-chunks/context-03.txt:714:    createMarketplaceRequestMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:741:  createMarketplaceBidMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:760:    createMarketplaceBidMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:765:    createMarketplaceBidMock.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:773:  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);
marketplace-report-chunks/context-03.txt:776:    res.json.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:792:  createMarketplaceBidMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:817:  assert.equal(res.status.mock.calls[0]?.arguments[0], 409);
marketplace-report-chunks/context-03.txt:820:    res.json.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:851:  selectMarketplaceBidMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:871:    selectMarketplaceBidMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:876:    selectMarketplaceBidMock.mock.calls[0]?.arguments,
marketplace-report-chunks/context-03.txt:884:  assert.equal(res.status.mock.calls[0]?.arguments[0], 200);
marketplace-report-chunks/context-03.txt:887:    res.json.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:903:  selectMarketplaceBidMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:924:  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
marketplace-report-chunks/context-03.txt:927:    res.json.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:948:  withdrawMarketplaceBidMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:967:    withdrawMarketplaceBidMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:972:    withdrawMarketplaceBidMock.mock.calls[0]?.arguments,
marketplace-report-chunks/context-03.txt:980:    res.json.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:1005:  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
marketplace-report-chunks/context-03.txt:1008:    res.json.mock.calls[0]?.arguments[0].success,
marketplace-report-chunks/context-03.txt:1013:    res.json.mock.calls[0]?.arguments[0].error,
marketplace-report-chunks/context-03.txt:1018:    getVisibleMarketplaceLoadsMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:1024:import test, { mock } from "node:test";
marketplace-report-chunks/context-03.txt:1027:const routerUseMock = mock.fn();
marketplace-report-chunks/context-03.txt:1028:const routerGetMock = mock.fn();
marketplace-report-chunks/context-03.txt:1029:const routerPostMock = mock.fn();
marketplace-report-chunks/context-03.txt:1031:const RouterMock = () => ({
marketplace-report-chunks/context-03.txt:1032:  use: routerUseMock,
marketplace-report-chunks/context-03.txt:1033:  get: routerGetMock,
marketplace-report-chunks/context-03.txt:1034:  post: routerPostMock,
marketplace-report-chunks/context-03.txt:1037:mock.module("express", {
marketplace-report-chunks/context-03.txt:1039:    Router: RouterMock,
marketplace-report-chunks/context-03.txt:1043:const authenticateMock = mock.fn();
marketplace-report-chunks/context-03.txt:1047:  ReturnType<typeof mock.fn>
marketplace-report-chunks/context-03.txt:1050:const authorizeMock = mock.fn((role: string) => {
marketplace-report-chunks/context-03.txt:1057:  const middleware = mock.fn();
marketplace-report-chunks/context-03.txt:1062:mock.module("../src/middleware/auth.middleware.js", {
marketplace-report-chunks/context-03.txt:1064:    authenticate: authenticateMock,
marketplace-report-chunks/context-03.txt:1065:    authorize: authorizeMock,
marketplace-report-chunks/context-03.txt:1069:mock.module("../src/marketplace/marketplace.service.js", {
marketplace-report-chunks/context-03.txt:1071:    createMarketplaceRequest: mock.fn(),
marketplace-report-chunks/context-03.txt:1072:    getMarketplaceRequest: mock.fn(),
marketplace-report-chunks/context-03.txt:1073:    createMarketplaceBid: mock.fn(),
marketplace-report-chunks/context-03.txt:1074:    withdrawMarketplaceBid: mock.fn(),
marketplace-report-chunks/context-03.txt:1075:    selectMarketplaceBid: mock.fn(),
marketplace-report-chunks/context-03.txt:1079:mock.module("../src/marketplace/visibility.service.js", {
marketplace-report-chunks/context-03.txt:1081:    getVisibleMarketplaceLoads: mock.fn(),
marketplace-report-chunks/context-03.txt:1088:  assert.equal(routerUseMock.mock.calls.length, 1);
marketplace-report-chunks/context-03.txt:1090:    routerUseMock.mock.calls[0]?.arguments[0],
marketplace-report-chunks/context-03.txt:1091:    authenticateMock,
marketplace-report-chunks/context-03.txt:1097:    routerGetMock.mock.calls.map(
marketplace-report-chunks/context-03.txt:1104:    routerPostMock.mock.calls.map(
marketplace-report-chunks/context-03.txt:1117:  const loadRoute = routerGetMock.mock.calls.find(
marketplace-report-chunks/context-03.txt:1121:  const requestRoute = routerPostMock.mock.calls.find(
marketplace-report-chunks/context-03.txt:1125:  const bidRoute = routerPostMock.mock.calls.find(
marketplace-report-chunks/context-03.txt:1129:  const selectRoute = routerPostMock.mock.calls.find(
marketplace-report-chunks/context-03.txt:1135:  const withdrawRoute = routerPostMock.mock.calls.find(
marketplace-report-chunks/context-03.txt:1173:import test, { mock } from "node:test";
marketplace-report-chunks/context-03.txt:1176:const prismaMock = {
marketplace-report-chunks/context-03.txt:1178:    create: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1179:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1180:    findFirst: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1181:    findMany: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1182:    update: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1183:    updateMany: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1187:    create: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1188:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1189:    findFirst: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1190:    findMany: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1191:    update: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1192:    updateMany: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1196:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1200:    findUnique: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1201:    update: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1202:    updateMany: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1206:    create: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1209:  $transaction: mock.fn<(...args: any[]) => any>(),
marketplace-report-chunks/context-03.txt:1212:const publishEventMock =
marketplace-report-chunks/context-03.txt:1213:  mock.fn<(...args: any[]) => any>();
marketplace-report-chunks/context-03.txt:1215:const estimateFareMock =
marketplace-report-chunks/context-03.txt:1216:  mock.fn<(...args: any[]) => any>();
marketplace-report-chunks/context-03.txt:1218:mock.module("../src/config/prisma.js", {
marketplace-report-chunks/context-03.txt:1220:    default: prismaMock,
marketplace-report-chunks/context-03.txt:1221:    prisma: prismaMock,
marketplace-report-chunks/context-03.txt:1225:mock.module("../src/realtime/event-bus.js", {
marketplace-report-chunks/context-03.txt:1227:    publishEvent: publishEventMock,
marketplace-report-chunks/context-03.txt:1231:mock.module("../src/pricing/pricing.service.js", {
marketplace-report-chunks/context-03.txt:1233:    estimateFare: estimateFareMock,
marketplace-report-chunks/context-03.txt:1244:function resetMocks() {
marketplace-report-chunks/context-03.txt:1246:    prismaMock.marketplaceRequest.create,
marketplace-report-chunks/context-03.txt:1247:    prismaMock.marketplaceRequest.findUnique,
marketplace-report-chunks/context-03.txt:1248:    prismaMock.marketplaceRequest.findFirst,
marketplace-report-chunks/context-03.txt:1249:    prismaMock.marketplaceRequest.findMany,
marketplace-report-chunks/context-03.txt:1250:    prismaMock.marketplaceRequest.update,
marketplace-report-chunks/context-03.txt:1251:    prismaMock.marketplaceRequest.updateMany,
marketplace-report-chunks/context-03.txt:1253:    prismaMock.marketplaceBid.create,
marketplace-report-chunks/context-03.txt:1254:    prismaMock.marketplaceBid.findUnique,
marketplace-report-chunks/context-03.txt:1255:    prismaMock.marketplaceBid.findFirst,
marketplace-report-chunks/context-03.txt:1256:    prismaMock.marketplaceBid.findMany,
marketplace-report-chunks/context-03.txt:1257:    prismaMock.marketplaceBid.update,
marketplace-report-chunks/context-03.txt:1258:    prismaMock.marketplaceBid.updateMany,
marketplace-report-chunks/context-03.txt:1260:    prismaMock.user.findUnique,
marketplace-report-chunks/context-03.txt:1262:    prismaMock.vehicle.findUnique,
marketplace-report-chunks/context-03.txt:1263:    prismaMock.vehicle.update,
marketplace-report-chunks/context-03.txt:1264:    prismaMock.vehicle.updateMany,
marketplace-report-chunks/context-03.txt:1266:    prismaMock.booking.create,
marketplace-report-chunks/context-03.txt:1268:    prismaMock.$transaction,
marketplace-report-chunks/context-03.txt:1270:    publishEventMock,
marketplace-report-chunks/context-03.txt:1271:    estimateFareMock,
marketplace-report-chunks/context-03.txt:1273:    fn.mock.resetCalls();
marketplace-report-chunks/context-03.txt:1278:  resetMocks();
marketplace-report-chunks/context-03.txt:1280:  prismaMock.$transaction.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1281:    async (callback: any) => callback(prismaMock),
marketplace-report-chunks/context-03.txt:1284:  estimateFareMock.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1290:  prismaMock.marketplaceBid.findMany.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1294:  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1325:  prismaMock.marketplaceRequest.create.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1348:    estimateFareMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:1353:    prismaMock.marketplaceRequest.create.mock.calls.length,
marketplace-report-chunks/context-03.txt:1358:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:1363:    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
marketplace-report-chunks/context-03.txt:1369:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1379:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1401:    prismaMock.marketplaceBid.create.mock.calls.length,
marketplace-report-chunks/context-03.txt:1407:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1417:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1428:  prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1457:  prismaMock.marketplaceBid.create.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1475:    prismaMock.marketplaceBid.create.mock.calls.length,
marketplace-report-chunks/context-03.txt:1480:    prismaMock.marketplaceBid.create.mock.calls[0]?.arguments[0];
marketplace-report-chunks/context-03.txt:1489:    publishEventMock.mock.calls.length,
marketplace-report-chunks/context-03.txt:1494:    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
marketplace-report-chunks/context-03.txt:1500:  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1510:  prismaMock.user.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1521:  prismaMock.vehicle.findUnique.mock.mockImplementation(
marketplace-report-chunks/context-03.txt:1532:  prismaMock.marketplaceBid.create.mock.mockImplementation(
marketplace-report-chunks/context-00.txt:1947:       * fallback.
marketplace-report-chunks/context-02.txt:241:       * fallback.
marketplace-report-chunks/context-02.txt:551:  console.log(`Realtime client connected: ${socket.id}`);
marketplace-report-chunks/context-02.txt:576:    console.log(
marketplace-report-chunks/context-02.txt:593:    console.log(
marketplace-report-chunks/context-02.txt:632:      console.log(
marketplace-report-chunks/context-02.txt:643:      console.log(
marketplace-report-chunks/context-02.txt:652:    console.log(
marketplace-report-chunks/context-02.txt:733:  console.log(
marketplace-part-00.txt:1947:       * fallback.
.git/hooks/sendemail-validate.sample:22:# Replace the TODO placeholders with appropriate checks according to your
.git/hooks/sendemail-validate.sample:27:	# TODO: Replace with appropriate checks (e.g. spell checking).
.git/hooks/sendemail-validate.sample:35:	# TODO: Replace with appropriate checks for this patch

## Runtime smoke-test output

No PARITY_BASE_URL supplied; runtime smoke tests were skipped.

## Next step

Upload this entire audit directory (or its ZIP) for detailed verification. The most useful files are report.md, findings.json, frontend-api-calls.txt, backend-routes.txt, services.txt, auth-boundaries.txt, validation.txt, audit-logging.txt, database-behavior.txt, and runtime-smoke.txt.
zip command unavailable; install with: pkg install zip

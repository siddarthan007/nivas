import { Elysia } from "elysia";
import { staticPlugin } from '@elysiajs/static';
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { config, validateConfig } from "./config/env";
import { superAdminController } from "./modules/super-admin/super-admin.controller";
import { errorMiddleware } from "./middlewares/error.middleware";
import { iamController } from "./modules/iam/iam.controller";
import { operationsController } from "./modules/tenants/operations.controller";
import { guestAuthController } from "./modules/iam/guest-auth.controller";
import { bookingsController } from "./modules/bookings/bookings.controller";
import { ordersController } from "./modules/orders/orders.controller";
import { menuController } from "./modules/menu/menu.controller";
import { housekeepingController } from "./modules/housekeeping/housekeeping.controller";
import { hrController } from "./modules/hr/hr.controller";
import { inventoryController } from "./modules/inventory/inventory.controller";
import { maintenanceController } from "./modules/maintenance/maintenance.controller";
// import { syncController } from "./modules/sync/sync.controller"; // offline sync disabled for now
import { rolesController } from "./modules/iam/roles.controller";
import { procurementController } from "./modules/procurement/procurement.controller";
import { couponsController } from "./modules/coupons/coupons.controller";
import { amenitiesController } from "./modules/finance/amenities.controller";
import { marketingController } from "./modules/marketing/marketing.controller";
import { publicMenuController } from "./modules/menu/public-menu.controller";
import { engineController } from "./modules/engine/engine.controller";
import { onboardingController } from "./modules/system/onboarding.controller";
import { bulkImportController } from "./modules/system/bulk-import.controller";
import { reviewsController } from "./modules/reviews/reviews.controller";
import { aiController } from "./modules/analytics/ai.controller";
import { apiKeyController } from "./modules/engine/api-key.controller";
import { usersController } from "./modules/iam/users.controller";
import { roomsController } from "./modules/rooms/rooms.controller";
import { roomTypesController } from "./modules/rooms/room-types.controller";
import { paymentsController } from "./modules/finance/payments.controller";
import { messagesController } from "./modules/communications/messages.controller";
import { facilitiesController } from "./modules/operations/facilities.controller";
import { billingController } from "./modules/finance/billing.controller";
import { fonepayController } from "./modules/finance/fonepay.controller";
import { analyticsController } from "./modules/analytics/analytics.controller";
import { layoutController } from "./modules/operations/layout.controller";
import { auditController } from "./modules/system/audit.controller";
import { tablesController } from "./modules/operations/tables.controller";
import { guestsController } from "./modules/crm/guests.controller";
import { wsController, initWsFanout } from "./modules/notifications/ws.service";
import { accountingController } from "./modules/finance/accounting.controller";
import { shiftsController } from "./modules/finance/shifts.controller";
import { initScheduler } from "./modules/scheduler";
import { invoicesController } from "./modules/finance/invoices.controller";
import { notificationsController } from "./modules/notifications/notifications.controller";
import { uploadController } from "./modules/storage/upload.controller";
import { settingsController } from "./modules/tenants/settings.controller";
import { creditNotesController } from "./modules/finance/credit-notes.controller";
import { folioController } from "./modules/finance/folio.controller";
import { nightAuditController } from "./modules/system/night-audit.controller";
import { attendanceController } from "./modules/iam/attendance.controller";
import { guestActionsController } from "./modules/iam/guest-actions.controller";
import { guestController } from "./modules/guests/guest.controller";
import { outletsController } from "./modules/settings/outlets.controller";
import { pricingController } from "./modules/revenue/pricing.controller";
import { reportsController } from "./modules/reports/reports.controller";
import { corporateController } from "./modules/corporate/corporate.controller";
import { discountsController } from "./modules/revenue/discounts.controller";
import { losDiscountsController } from "./modules/revenue/los-discounts.controller";
import { kotController } from "./modules/orders/kot.controller";
import { upsellController } from "./modules/bookings/upsells.controller";
import { banquetsController } from "./modules/events/banquets.controller";
import { saasSettingsController } from "./modules/saas/saas-settings.controller";
import { channelManagerController } from "./modules/saas/channel-manager.controller";
import { revenueController } from "./modules/revenue/revenue.controller";
import { saasAdminController } from "./modules/saas/saas-admin.controller";
import { saasBillingController } from "./modules/saas/saas-billing.controller";
import { glController } from "./modules/finance/gl.controller";
import { taxRatesController } from "./modules/finance/tax-rates.controller";

import { HttpError } from "./utils/errors";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { securityMiddleware } from "./middlewares/security.middleware";
import { idempotencyMiddleware } from "./middlewares/idempotency.middleware";
import { logger, logRequest } from "./shared/logger";
import { db, closeDb } from "./db";
import { sql } from "drizzle-orm";
import { getRedis } from "./shared/redis";
import { registerNotificationHandlers } from "./modules/notifications/event-handlers";
import { registerAuditEventHandlers } from "./modules/system/audit-event-handlers";
import { runMigrations } from "./db/migrations";

validateConfig();
runMigrations();

// Boot-safety: a failure here must not crash startup (the API can still serve).
try { initScheduler(); } catch (err) { logger.error({ err }, '[boot] scheduler init failed'); }
try { initWsFanout(); } catch (err) { logger.error({ err }, '[boot] ws fanout init failed'); } // cross-replica WS fan-out
registerNotificationHandlers();
registerAuditEventHandlers();

// BigInt serialization fix for Drizzle/Postgres
(BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function () {
    return this.toString();
};

const app = new Elysia()
    .use(staticPlugin({
        assets: 'public',
        prefix: '/',
        alwaysStatic: false,
        maxAge: 31536000, // cache static assets (images, etc.) for a year
    }))
    .use(cors({
        origin: config.cors.origins,
        credentials: true
    }))
    .use(errorMiddleware)
    .use(swagger({
        path: '/docs',
        documentation: {
            info: {
                title: "Nivas PMS API",
                version: "1.0.0",
                description: [
                    "Multi-tenant Hotel Operating System backend.",
                    "",
                    "## Base URL",
                    "All endpoints are served under `/api/v1`.",
                    "",
                    "## Authentication",
                    "Most endpoints require a Bearer JWT: `Authorization: Bearer <token>` (or the `auth` cookie).",
                    "Obtain a token from `POST /iam/login` (then `POST /iam/refresh` to rotate it).",
                    "Each request is scoped to the caller's hotel; cross-tenant access is denied.",
                    "",
                    "## Booking Engine",
                    "Public partner endpoints under `/engine/*` authenticate with an API key header `x-api-key` instead of a JWT.",
                    "",
                    "## Conventions",
                    "Responses follow `{ status, message, data }`. Errors return a `code` and an HTTP status.",
                ].join('\n'),
                contact: { name: 'Nivas PMS', email: 'support@nivaspms.com' },
            },
            components: {
                securitySchemes: {
                    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Staff/admin JWT from /iam/login' },
                    apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Booking-engine API key' },
                },
            },
            security: [{ bearerAuth: [] }],
            tags: [
                { name: 'Super Admin', description: 'SaaS platform management (cross-tenant, super-admin only)' },
                { name: 'Auth', description: 'Authentication, profile, password, refresh tokens' },
                { name: 'IAM', description: 'Staff, roles & permissions (RBAC, hierarchy-guarded)' },
                { name: 'Operations', description: 'Rooms, floors, tables & front-of-house operations' },
                { name: 'Bookings', description: 'Reservations, check-in/out, group bookings, folio' },
                { name: 'Orders', description: 'Service & F&B orders, item void, merge, comp' },
                { name: 'KOT', description: 'Kitchen Order Tickets — printers & routing' },
                { name: 'Menu', description: 'Menu items & categories' },
                { name: 'Housekeeping', description: 'Housekeeping & room-cleaning tasks' },
                { name: 'Inventory', description: 'Stock, requests, warehouses' },
                { name: 'Finance', description: 'Checkout, invoices, credit notes, payments, GL, CBMS' },
                { name: 'Analytics', description: 'Dashboards, business insights & audit logs' },
                { name: 'Guests', description: 'Guest CRM, profiles & financials' },
                { name: 'Communications', description: 'Messages & chat' },
                { name: 'Notifications', description: 'System & guest notifications' },
                { name: 'Storage', description: 'File / image uploads' },
                { name: 'Settings', description: 'Hotel configuration, payment & messaging providers' },
                { name: 'Bulk Import', description: 'Strict CSV import for menu items & rooms' },
                { name: 'Revenue', description: 'Dynamic pricing & yield management' },
                { name: 'Events', description: 'Banquets & event management' },
                { name: 'Public', description: 'Unauthenticated — digital menu & invoice view' },
                { name: 'SaaS', description: 'Subscription, billing & tenant settings' },
            ]
        }
    }))
    .use(rateLimitMiddleware)
    .use(securityMiddleware)
    .use(idempotencyMiddleware)
    .onRequest((ctx) => {
        logRequest(ctx.request);
    })
    .use(wsController)
    .group('/api/v1', (app) => app
        .use(superAdminController)
        .use(iamController)
        .use(operationsController)
        .use(guestAuthController)
        .use(bookingsController)
        .use(ordersController)
        .use(menuController)
        .use(housekeepingController)
        .use(inventoryController)
        .use(rolesController)
        .use(usersController)
        .use(roomsController)
        .use(roomTypesController)
        .use(paymentsController)
        .use(messagesController)
        .use(facilitiesController)
        .use(billingController)
        .use(fonepayController)
        .use(analyticsController)
        .use(layoutController)
        .use(tablesController)
        .use(auditController)
        .use(guestsController)
        .use(accountingController)
        .use(shiftsController)
        .use(invoicesController)
        .use(notificationsController)
        .use(uploadController)
        .use(settingsController)
        .use(creditNotesController)
        .use(folioController)
        .use(nightAuditController)
        .use(attendanceController)
        .use(guestActionsController)
        .use(guestController)
        .use(outletsController)
        .use(pricingController)
        .use(reportsController)
        .use(corporateController)
        .use(maintenanceController)
        // Offline sync disabled for now (Flutter offline mode deferred).
        // .use(syncController)
        .use(hrController)
        .use(procurementController)
        .use(couponsController)
        .use(amenitiesController)
        .use(marketingController)
        .use(publicMenuController)
        .use(engineController)
        .use(apiKeyController)
        .use(onboardingController)
        .use(bulkImportController)
        .use(reviewsController)
        .use(aiController)
        .use(discountsController)
        .use(losDiscountsController)
        .use(kotController)
        .use(upsellController)
        .use(banquetsController)
        .use(saasSettingsController)
        .use(channelManagerController)
        .use(revenueController)
        .use(saasAdminController)
        .use(saasBillingController)
        .use(glController)
        .use(taxRatesController))
    .get('/', () => ({ status: 'success', message: 'Welcome to Nivas PMS API', timestamp: new Date().toISOString() }))
    // Liveness/readiness probe for the load balancer & orchestrator. Reports DB
    // (hard dependency) and Redis (soft). 503 if the DB is unreachable so the LB
    // pulls this instance out of rotation.
    .get('/health', async ({ set }) => {
        let dbOk = false;
        try { await db.execute(sql`SELECT 1`); dbOk = true; } catch { dbOk = false; }

        const redis = getRedis();
        const redisStatus = !redis ? 'disabled' : (redis.status === 'ready' ? 'up' : 'down');

        if (!dbOk) set.status = 503;
        return {
            status: dbOk ? 'ok' : 'degraded',
            db: dbOk ? 'up' : 'down',
            redis: redisStatus,
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        };
    })
    // Cap request body at 15MB (covers 5MB images + CSV imports) so a huge/malicious
    // upload can't balloon memory and OOM the box. Bun defaults to 128MB.
    .listen({ port: 3000, maxRequestBodySize: 15 * 1024 * 1024 });

logger.info(
    `Nivas Backend is running at ${app.server?.hostname}:${app.server?.port}`
);

// Graceful shutdown: stop accepting, let in-flight requests drain, close the
// HTTP server + Redis, then exit. Prevents dropped requests on deploy/restart.
let shuttingDown = false;
async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[shutdown] ${signal} received — draining…`);
    // Hard safety net: if drain hangs (slow query / stuck socket), force-exit so an
    // orchestrator (k8s/compose) deploy isn't blocked past its grace period.
    const force = setTimeout(() => { logger.error('[shutdown] drain timed out — forcing exit'); process.exit(1); }, 15000);
    force.unref?.();
    try {
        await app.stop();           // stop accepting new connections
        const redis = getRedis();
        if (redis) await redis.quit().catch(() => { /* already closed */ });
        await closeDb().catch((err) => logger.error({ err }, '[shutdown] db close error'));
    } catch (err) {
        logger.error({ err }, '[shutdown] error during drain');
    } finally {
        clearTimeout(force);
        logger.info('[shutdown] done');
        process.exit(0);
    }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Don't let a single unhandled rejection crash the process.
process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[process] unhandledRejection');
});
// Log uncaught exceptions then exit cleanly so the orchestrator restarts a fresh,
// known-good process (an exception leaves global state undefined — safer to cycle).
process.on('uncaughtException', (err) => {
    logger.error({ err }, '[process] uncaughtException — exiting for restart');
    shutdown('uncaughtException');
});

export type App = typeof app;
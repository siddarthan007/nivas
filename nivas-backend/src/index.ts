import { Elysia } from "elysia";
import { staticPlugin } from '@elysiajs/static';
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { config } from "./config/env";
import { superAdminController } from "./modules/super-admin/super-admin.controller";
import { errorMiddleware } from "./middlewares/error.middleware";
import { iamController } from "./modules/iam/iam.controller";
import { operationsController } from "./modules/tenants/operations.controller";
import { guestAuthController } from "./modules/iam/guest-auth.controller";
import { bookingsController } from "./modules/bookings/bookings.controller";
import { ordersController } from "./modules/orders/orders.controller";
import { menuController } from "./modules/menu/menu.controller";
import { housekeepingController } from "./modules/housekeeping/housekeeping.controller";
import { inventoryController } from "./modules/inventory/inventory.controller";
import { rolesController } from "./modules/iam/roles.controller";
import { usersController } from "./modules/iam/users.controller";
import { roomsController } from "./modules/rooms/rooms.controller";
import { roomTypesController } from "./modules/rooms/room-types.controller";
import { paymentsController } from "./modules/finance/payments.controller";
import { messagesController } from "./modules/communications/messages.controller";
import { facilitiesController } from "./modules/operations/facilities.controller";
import { billingController } from "./modules/finance/billing.controller";
import { analyticsController } from "./modules/analytics/analytics.controller";
import { layoutController } from "./modules/operations/layout.controller";
import { auditController } from "./modules/system/audit.controller";
import { tablesController } from "./modules/operations/tables.controller";
import { guestsController } from "./modules/crm/guests.controller";
import { procurementController } from "./modules/inventory/procurement.controller";
import { wsController } from "./modules/notifications/ws.service";
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

import { HttpError } from "./utils/errors";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { securityMiddleware } from "./middlewares/security.middleware";
import { logger, logRequest } from "./shared/logger";

initScheduler();

// BigInt serialization fix for Drizzle/Postgres
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const app = new Elysia()
    .use(staticPlugin({
        assets: 'public',
        prefix: '/'
    }))
    .use(cors({
        origin: config.cors.origins,
        credentials: true
    }))
    .use(errorMiddleware)
    .use(swagger({
        documentation: {
            info: {
                title: "Nivas PMS API",
                version: "1.0.0",
                description: "Multi-tenant Hotel Operating System Backend"
            },
            tags: [
                { name: 'Super Admin', description: 'SaaS Platform Management' },
                { name: 'Auth', description: 'Authentication & Profile' },
                { name: 'IAM', description: 'Staff & Role Management' },
                { name: 'Operations', description: 'Rooms, Floors & Operations' },
                { name: 'Bookings', description: 'Reservations & Front Desk' },
                { name: 'Orders', description: 'Service & F&B Orders' },
                { name: 'Menu', description: 'Menu & Product Management' },
                { name: 'Housekeeping', description: 'Housekeeping Tasks' },
                { name: 'Inventory', description: 'Inventory & Procurement' },
                { name: 'Finance', description: 'Accounting, Payments & Invoices' },
                { name: 'Analytics', description: 'Business Intelligence & Audit Logs' },
                { name: 'Guests', description: 'Guest CRM & Profiles' },
                { name: 'Communications', description: 'Messages & Chat' },
                { name: 'Notifications', description: 'System Notifications' },
                { name: 'Storage', description: 'File Management' },
                { name: 'Settings', description: 'Hotel Configuration' },
                { name: 'Revenue', description: 'Pricing & Yield Management' },
                { name: 'Events', description: 'Banquets & Event Management' },
                { name: 'SaaS', description: 'SaaS Subscription & Tenant Settings' }
            ]
        }
    }))
    .use(rateLimitMiddleware)
    .use(securityMiddleware)
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
        .use(analyticsController)
        .use(layoutController)
        .use(tablesController)
        .use(auditController)
        .use(guestsController)
        .use(procurementController)
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
        .use(outletsController)
        .use(pricingController)
        .use(reportsController)
        .use(corporateController)
        .use(discountsController)
        .use(losDiscountsController)
        .use(kotController)
        .use(upsellController)
        .use(banquetsController)
        .use(saasSettingsController)
        .use(channelManagerController)
        .use(revenueController)
        .use(saasAdminController)
        .use(saasBillingController))
    .get('/', () => ({ status: 'success', message: 'Welcome to Nivas PMS API', timestamp: new Date().toISOString() }))
    .listen(3000);

logger.info(
    `Nivas Backend is running at ${app.server?.hostname}:${app.server?.port}`
);

// --- Background Job Worker ---
import { Cron } from 'croner';
import { JobService } from './modules/system/job.service';

new Cron('* * * * *', async () => {
    try {
        await JobService.processPendingJobs();
    } catch (err) {
        console.error('[JobWorker] Error processing jobs:', err);
    }
});

export type App = typeof app;
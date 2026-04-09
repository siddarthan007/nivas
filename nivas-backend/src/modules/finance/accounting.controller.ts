import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { invoices, guestProfiles, rooms } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AccountingService } from './accounting.service';
import { TallyService } from './tally.service';
import { CbmsService } from './cbms.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { NepaliDate } from '../../utils/nepali-date.ts';
import { ReportsService } from './reports.service';

export const accountingController = new Elysia({ prefix: '/finance/accounting' })
    .use(authMiddleware)
    /**
     * Export Tally XML for sales data
     */
    .get('/export-tally', async ({ user, query, set }) => {
        let dateStr: string = new Date().toISOString().split('T')[0] ?? '';
        if (query.date) {
            dateStr = query.date;
        }
        const xml = await TallyService.generateSalesXml(user!.hotelId!, dateStr);

        set.headers['Content-Type'] = 'application/xml';
        set.headers['Content-Disposition'] = `attachment; filename="tally-sales-${dateStr}.xml"`;

        return xml;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Download Tally XML', tags: ['Finance'] }
    })
    /**
     * Export Tally XML for purchase data
     */
    .get('/export-tally-purchase', async ({ user, query, set }) => {
        let dateStr: string = new Date().toISOString().split('T')[0] ?? '';
        if (query.date) {
            dateStr = query.date;
        }
        const xml = await TallyService.generatePurchaseXml(user!.hotelId!, dateStr);

        set.headers['Content-Type'] = 'application/xml';
        set.headers['Content-Disposition'] = `attachment; filename="tally-purchase-${dateStr}.xml"`;

        return xml;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Download Tally Purchase XML', tags: ['Finance'] }
    })
    /**
     * Export Tally XML for receipt data
     */
    .get('/export-tally-receipt', async ({ user, query, set }) => {
        let dateStr: string = new Date().toISOString().split('T')[0] ?? '';
        if (query.date) {
            dateStr = query.date;
        }
        const xml = await TallyService.generateReceiptXml(user!.hotelId!, dateStr);

        set.headers['Content-Type'] = 'application/xml';
        set.headers['Content-Disposition'] = `attachment; filename="tally-receipt-${dateStr}.xml"`;

        return xml;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Download Tally Receipt XML', tags: ['Finance'] }
    })
    /**
     * IRD Annex 5 Sales Register
     */
    .get('/export-annex5-sales', async ({ user, query, set }) => {
        const csv = await ReportsService.generateAnnex5Sales(user!.hotelId!, query.date);

        set.headers['Content-Type'] = 'text/csv';
        set.headers['Content-Disposition'] = `attachment; filename="annex5-sales-${query.date || 'report'}.csv"`;

        return csv;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Download IRD Annex 5 Sales Register', tags: ['Finance'] }
    })
    /**
     * IRD Annex 5 Purchase Register
     */
    .get('/export-annex5-purchase', async ({ user, query, set }) => {
        const csv = await ReportsService.generateAnnex5Purchase(user!.hotelId!, query.date);

        set.headers['Content-Type'] = 'text/csv';
        set.headers['Content-Disposition'] = `attachment; filename="annex5-purchase-${query.date || 'report'}.csv"`;

        return csv;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Download IRD Annex 5 Purchase Register', tags: ['Finance'] }
    })
    /**
     * Manually sync invoice to CBMS
     */
    .post('/cbms/sync/:invoiceId', async ({ params, user }) => {
        const result = await CbmsService.syncInvoice(params.invoiceId, user!.hotelId!);
        return createResponse(result, 'CBMS sync completed');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        detail: { summary: 'Sync invoice to CBMS', tags: ['Finance'] }
    })
    /**
     * Retry all failed CBMS syncs
     */
    .post('/cbms/retry-failed', async ({ user }) => {
        const results = await CbmsService.retryFailedSyncs(user!.hotelId!);
        return createResponse(results, 'Failed CBMS syncs retried');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        detail: { summary: 'Retry failed CBMS syncs', tags: ['Finance'] }
    })
    /**
     * Record invoice print and track reprints
     * Returns print metadata including whether this is a reprint (COPY OF ORIGINAL)
     */
    .post('/invoice/:id/print', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const result = await AccountingService.recordInvoicePrint(user.hotelId, params.id);
        return createResponse(result, 'Invoice print recorded');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        detail: { summary: 'Record invoice print (tracks reprints)', tags: ['Finance'] }
    })
    /**
     * Get BS/AD date conversion utility
     */
    .get('/date/convert', async ({ query }) => {
        if (query.ad) {
            const adDate = new Date(query.ad);
            const bsDate = new NepaliDate(adDate);
            return createResponse({
                ad: query.ad,
                bs: bsDate.format('YYYY-MM-DD'),
                bsFull: bsDate.format('DD MMMM YYYY', 'np')
            }, 'Date converted');
        } else if (query.bs) {
            const parts = query.bs.split('-').map(Number);
            const year = parts[0] ?? 2081;
            const month = parts[1] ?? 1;
            const day = parts[2] ?? 1;
            const bsDate = new NepaliDate(year, month - 1, day);
            const adDate = bsDate.toJsDate();
            return createResponse({
                bs: query.bs,
                ad: adDate.toISOString().split('T')[0],
                adFull: adDate.toLocaleDateString('en-US', { dateStyle: 'long' })
            }, 'Date converted');
        }
        throw new ValidationError('Provide either ad or bs date parameter');
    }, {
        isSignedIn: true,
        query: t.Object({
            ad: t.Optional(t.String()),
            bs: t.Optional(t.String())
        }),
        detail: { summary: 'Convert between AD and BS dates', tags: ['Finance'] }
    });
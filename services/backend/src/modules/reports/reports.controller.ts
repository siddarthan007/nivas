import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ExportService } from '../../utils/export.service';
import { ReportsService } from './reports.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { PdfService } from '../../utils/pdf.service';
import { db } from '../../db';
import { hotels } from '../../db/schema';
import { eq } from 'drizzle-orm';

const reportRange = (q: any) => ({
    from: (q.from || `${new Date().getFullYear()}-01-01`) as string,
    to: (q.to || new Date().toISOString().split('T')[0]!) as string,
});

export const reportsController = new Elysia({ prefix: '/reports' })
    .use(authMiddleware)

    // Tabular reports (sales / payments / purchases)
    .get('/data', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const { from, to } = reportRange(query);
        const data = await ReportsService.getReportData(user.hotelId, query.type || 'sales', from, to);
        return createResponse(data, 'Report data fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.REPORTS.VIEW_SALES,
        query: t.Object({ type: t.Optional(t.String()), from: t.Optional(t.String()), to: t.Optional(t.String()) }),
        detail: { summary: 'Tabular report data', tags: ['Reports'] }
    })
    // Server-rendered PDF of the same report.
    .get('/pdf', async ({ user, query, set }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const { from, to } = reportRange(query);
        const data = await ReportsService.getReportData(user.hotelId, query.type || 'sales', from, to);
        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, user.hotelId), columns: { name: true } });
        const def = PdfService.generateReportDefinition({ hotelName: hotel?.name || 'Hotel', ...data });
        const buffer = await PdfService.generatePdf(def);
        set.headers['content-type'] = 'application/pdf';
        set.headers['content-disposition'] = `attachment; filename="${data.type}-${from}_${to}.pdf"`;
        return buffer;
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.REPORTS.VIEW_SALES,
        query: t.Object({ type: t.Optional(t.String()), from: t.Optional(t.String()), to: t.Optional(t.String()) }),
        detail: { summary: 'Report PDF', tags: ['Reports'] }
    })

    // ===================================
    // WAITER KOT REPORT
    // ===================================
    .get('/waiter-kot', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await ReportsService.getWaiterKotReport(user.hotelId, {
            waiterId: query.waiterId,
            status: query.status,
            date: query.date,
        });
        return createResponse(data, 'Waiter KOT report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        query: t.Object({
            waiterId: t.Optional(t.String()),
            status: t.Optional(t.String()),
            date: t.Optional(t.String()),
        }),
        detail: { summary: 'Waiter KOT report', tags: ['Analytics'] }
    })

    // ===================================
    // ARRIVALS REPORT
    // ===================================
    .get('/arrivals', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const dateStr = (query.date || new Date().toISOString().split('T')[0]) as string;
        const data = await ReportsService.getArrivalsReport(user.hotelId, dateStr);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`arrivals-${dateStr}.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'Arrivals')]), {
                headers: ExportService.excelHeaders(`arrivals-${dateStr}.xlsx`)
            });
        }

        return createResponse(data, 'Arrivals report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        query: t.Object({
            date: t.Optional(t.String()),
            format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv'), t.Literal('excel')]))
        }),
        detail: { summary: 'Arrivals report', tags: ['Analytics'] }
    })

    // ===================================
    // DEPARTURES REPORT
    // ===================================
    .get('/departures', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const dateStr = (query.date || new Date().toISOString().split('T')[0]) as string;
        const data = await ReportsService.getDeparturesReport(user.hotelId, dateStr);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`departures-${dateStr}.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'Departures')]), {
                headers: ExportService.excelHeaders(`departures-${dateStr}.xlsx`)
            });
        }

        return createResponse(data, 'Departures report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        query: t.Object({
            date: t.Optional(t.String()),
            format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv'), t.Literal('excel')]))
        }),
        detail: { summary: 'Departures report', tags: ['Analytics'] }
    })

    // ===================================
    // IN-HOUSE GUESTS
    // ===================================
    .get('/in-house', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await ReportsService.getInHouseGuests(user.hotelId);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`in-house-guests.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'In-House Guests')]), {
                headers: ExportService.excelHeaders(`in-house-guests.xlsx`)
            });
        }

        return createResponse(data, 'In-house guests report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        query: t.Object({
            format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv'), t.Literal('excel')]))
        }),
        detail: { summary: 'Current in-house guests', tags: ['Analytics'] }
    });
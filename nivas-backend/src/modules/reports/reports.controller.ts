import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ExportService } from '../../utils/export.service';
import { ReportsService } from './reports.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const reportsController = new Elysia({ prefix: '/reports' })
    .use(authMiddleware)

    // ===================================
    // DAILY SALES REPORT
    // ===================================
    .get('/dsr', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const today = new Date().toISOString().split('T')[0];
        const dateStr = (query.date || today)!;
        const data = await ReportsService.getDailySalesReport(user.hotelId, dateStr);
        return createResponse(data, 'Daily Sales Report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_FINANCIALS,
        query: t.Object({ date: t.Optional(t.String()) }),
        detail: { summary: 'Daily Sales Report', tags: ['Analytics'] }
    })

    // ===================================
    // HOUSEKEEPING EFFICIENCY
    // ===================================
    .get('/housekeeping-efficiency', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const days = parseInt(query.days || '7');
        const data = await ReportsService.getHousekeepingEfficiency(user.hotelId, days);
        return createResponse(data, 'Housekeeping efficiency report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.HOUSEKEEPING.VIEW,
        query: t.Object({ days: t.Optional(t.String()) }),
        detail: { summary: 'Housekeeping efficiency report', tags: ['Analytics'] }
    })

    // ===================================
    // ARRIVALS REPORT
    // ===================================
    .get('/arrivals', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const dateStr = query.date || new Date().toISOString().split('T')[0];
        const data = await ReportsService.getArrivalsReport(user.hotelId, dateStr);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`arrivals-${dateStr}.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'Arrivals') as any]), {
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
    .get('/departures', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const dateStr = query.date || new Date().toISOString().split('T')[0];
        const data = await ReportsService.getDeparturesReport(user.hotelId, dateStr);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`departures-${dateStr}.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'Departures') as any]), {
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
    // CANCELLATIONS & NO-SHOWS
    // ===================================
    .get('/cancellations', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const days = parseInt(query.days || '30');
        const { cancellationData, noShowData } = await ReportsService.getCancellationsAndNoShows(user.hotelId, days);
        const allData = [...cancellationData, ...noShowData];
        const totalLostRevenue = allData.reduce((sum, b) => sum + parseFloat(b.lostRevenue || '0'), 0);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(allData), {
                headers: ExportService.csvHeaders(`cancellations-noshows.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcelMultiSheet([
                { name: 'Cancellations', data: cancellationData },
                { name: 'No-Shows', data: noShowData }
            ]) as any]), {
                headers: ExportService.excelHeaders(`cancellations-noshows.xlsx`)
            });
        }

        return createResponse({
            cancellations: cancellationData,
            noShows: noShowData,
            summary: {
                totalCancellations: cancellationData.length,
                totalNoShows: noShowData.length,
                totalLostRevenue
            }
        }, 'Cancellations and no-shows report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.BOOKINGS.READ,
        query: t.Object({
            days: t.Optional(t.String()),
            format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv'), t.Literal('excel')]))
        }),
        detail: { summary: 'Cancellations and no-shows report', tags: ['Analytics'] }
    })

    // ===================================
    // NATIONALITIES REPORT
    // ===================================
    .get('/nationalities', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const days = parseInt(query.days || '30');
        const { data, totalGuests, startDate } = await ReportsService.getNationalitiesReport(user.hotelId, days);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`nationalities.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'Nationalities') as any]), {
                headers: ExportService.excelHeaders(`nationalities.xlsx`)
            });
        }

        return createResponse({
            data,
            totalGuests,
            period: { days, startDate }
        }, 'Nationalities report fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.VIEW_GUESTS,
        query: t.Object({
            days: t.Optional(t.String()),
            format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv'), t.Literal('excel')]))
        }),
        detail: { summary: 'Guest nationalities report', tags: ['Analytics'] }
    })

    // ===================================
    // IN-HOUSE GUESTS
    // ===================================
    .get('/in-house', async ({ user, query }: { user: any, query: any }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await ReportsService.getInHouseGuests(user.hotelId);

        if (query.format === 'csv') {
            return new Response(ExportService.toCSV(data), {
                headers: ExportService.csvHeaders(`in-house-guests.csv`)
            });
        }

        if (query.format === 'excel') {
            return new Response(new Blob([ExportService.toExcel(data, 'In-House Guests') as any]), {
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
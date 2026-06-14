import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { AttendanceService } from './attendance.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const attendanceController = new Elysia({ prefix: '/attendance' })
    .use(authMiddleware)
    .get('/me', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('User identification failed');
        const data = await AttendanceService.getMyStatus(user.hotelId, user.id);
        return createResponse(data, 'Attendance status');
    }, {
        isSignedIn: true,
        detail: { summary: 'My clock status', tags: ['IAM'] }
    })
    .get('/my-history', async ({ query, user }) => {
        if (!user?.hotelId) throw new ValidationError('User identification failed');
        const data = await AttendanceService.getAttendanceHistory(
            user.hotelId,
            query.startDate || undefined,
            query.endDate || undefined,
            user.id,
        );
        return createResponse(data, 'My attendance history');
    }, {
        isSignedIn: true,
        query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
        }),
        detail: { summary: 'My attendance history', tags: ['IAM'] }
    })
    .get('/pending', async ({ query, user }) => {
        if (!user?.hotelId) throw new ValidationError('User identification failed');
        const data = await AttendanceService.getPendingApprovals(user.hotelId, query.date || undefined);
        return createResponse(data, 'Pending attendance approvals');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        query: t.Object({ date: t.Optional(t.String()) }),
        detail: { summary: 'Pending attendance for approval', tags: ['IAM'] }
    })
    .post('/:id/approve', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('User identification failed');
        const entry = await AttendanceService.approveEntry(user.hotelId, params.id, user.id);
        return createResponse(entry, 'Attendance approved');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Approve attendance entry', tags: ['IAM'] }
    })
    .post('/:id/reject', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('User identification failed');
        const entry = await AttendanceService.rejectEntry(user.hotelId, params.id, user.id, body.notes);
        return createResponse(entry, 'Attendance rejected');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        params: t.Object({ id: t.String() }),
        body: t.Object({ notes: t.Optional(t.String()) }),
        detail: { summary: 'Reject attendance entry', tags: ['IAM'] }
    })
    .post('/clock-in', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const entry = await AttendanceService.clockIn(user.hotelId, user.id, body?.notes);
        return createResponse(entry, 'Clocked in successfully');
    }, {
        isSignedIn: true,
        body: t.Optional(t.Object({
            notes: t.Optional(t.String())
        })),
        detail: { summary: 'Staff Clock In', tags: ['IAM'] }
    })
    .post('/clock-out', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const entry = await AttendanceService.clockOut(user.hotelId, user.id, body.notes || undefined);
        return createResponse(entry, 'Clocked out successfully');
    }, {
        isSignedIn: true,
        body: t.Object({
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Staff Clock Out', tags: ['IAM'] }
    })
    .get('/', async ({ query, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const date = query.date || new Date().toISOString().split('T')[0];
        const data = await AttendanceService.getDailyAttendance(user.hotelId, date!);
        return createResponse(data, 'Attendance fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_STAFF_PERFORMANCE,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Get Attendance', tags: ['IAM'] }
    })
    .get('/history', async ({ query, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const data = await AttendanceService.getAttendanceHistory(
            user.hotelId,
            query.startDate || undefined,
            query.endDate || undefined,
            query.userId || undefined
        );
        return createResponse(data, 'Attendance history fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_STAFF_PERFORMANCE,
        query: t.Object({
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            userId: t.Optional(t.String())
        }),
        detail: { summary: 'Get attendance history with filters', tags: ['IAM'] }
    })
    .get('/staff/:userId/summary', async ({ params, query, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const now = new Date();
        const year = query.year ? parseInt(query.year) : now.getFullYear();
        const month = query.month ? parseInt(query.month) : now.getMonth() + 1;
        const data = await AttendanceService.getStaffMonthlySummary(user.hotelId, params.userId, year, month);
        return createResponse(data, 'Staff monthly summary fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ANALYTICS.VIEW_STAFF_PERFORMANCE,
        query: t.Object({
            year: t.Optional(t.String()),
            month: t.Optional(t.String())
        }),
        detail: { summary: 'Get staff monthly attendance summary', tags: ['IAM'] }
    })
    .post('/mark', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const entry = await AttendanceService.markAttendance(
            user.hotelId,
            body.userId,
            body.date,
            body.status,
            body.notes || undefined
        );
        return createResponse(entry, 'Attendance marked successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.USERS.UPDATE,
        body: t.Object({
            userId: t.String(),
            date: t.String(),
            status: t.Union([t.Literal('PRESENT'), t.Literal('ABSENT'), t.Literal('LATE')]),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Manually mark attendance for a staff member', tags: ['IAM'] }
    });

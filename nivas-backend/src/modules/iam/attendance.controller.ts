import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { AttendanceService } from './attendance.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const attendanceController = new Elysia({ prefix: '/attendance' })
    .use(authMiddleware)
    .post('/clock-in', async ({ body, user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User identification failed');
        const entry = await AttendanceService.clockIn(user.hotelId, user.id);
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
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Get Attendance', tags: ['IAM'] }
    });

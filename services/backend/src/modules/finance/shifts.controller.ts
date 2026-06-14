import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ShiftService } from './shift.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const shiftsController = new Elysia({ prefix: '/finance/shifts' })
    .use(authMiddleware)
    .get('/current', async ({ user }) => {
        const currentShift = await ShiftService.getCurrent(user!.id);
        return createResponse(currentShift, 'Current shift fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SHIFTS.VIEW,
        detail: { summary: 'Check active shift', tags: ['Finance'] }
    })
    .post('/start', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const newShift = await ShiftService.open(user.hotelId, user.id, body.startFloat, ipAddress);
        return createResponse(newShift, 'Shift started successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SHIFTS.START,
        body: t.Object({
            startFloat: t.Number()
        }),
        detail: { summary: 'Start a cashier shift', tags: ['Finance'] }
    })
    .post('/end', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const result = await ShiftService.close(user.hotelId, user.id, body.endCashCount, body.notes, ipAddress);
        return createResponse(result, 'Shift closed successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SHIFTS.END,
        body: t.Object({
            endCashCount: t.Number(),
            notes: t.Optional(t.String())
        }),
        detail: { summary: 'Close shift & count cash', tags: ['Finance'] }
    });
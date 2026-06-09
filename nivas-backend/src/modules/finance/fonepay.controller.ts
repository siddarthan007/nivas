import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { FonepayService } from './fonepay.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const fonepayController = new Elysia({ prefix: '/finance/fonepay' })
    .use(authMiddleware)
    // Generate a dynamic QR for an amount. Plan-gated inside the service.
    .post('/qr', async ({ user, body }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const qr = await FonepayService.generateQr(user.hotelId, body);
        return createResponse(qr, 'Fonepay QR generated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CREATE,
        body: t.Object({
            amount: t.Number(),
            remarks1: t.Optional(t.String()),
            remarks2: t.Optional(t.String()),
            prn: t.Optional(t.String()),
        }),
        detail: { summary: 'Generate Fonepay dynamic QR', tags: ['Fonepay'] }
    })
    // Poll payment status for a PRN. On SUCCESS the client records the payment
    // via the normal /payments endpoint (method FONEPAY, transactionId = prn).
    .get('/status', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const status = await FonepayService.checkStatus(user.hotelId, query.prn);
        return createResponse(status, 'Fonepay status');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CREATE,
        query: t.Object({ prn: t.String() }),
        detail: { summary: 'Check Fonepay payment status', tags: ['Fonepay'] }
    });

import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { CreditNoteService } from './credit-note.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';
import { requirePassword } from '../../utils/password.guard';

export const creditNotesController = new Elysia({ prefix: '/credit-notes' })
    .use(authMiddleware)
    .post('/', async ({ body, user, request }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await requirePassword(user.id, body.confirmPassword);
        const ipAddress = request.headers.get('x-forwarded-for') || undefined;
        const result = await CreditNoteService.create(user.hotelId, user.id, body, ipAddress);
        return createResponse(result, 'Credit note created and invoice voided.');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.CREATE_CREDIT_NOTE,
        body: t.Object({
            invoiceId: t.String(),
            reason: t.String(),
            confirmPassword: t.String(),
        }),
        detail: { summary: 'Void invoice via Credit Note', tags: ['Finance'] }
    })
    .get('/', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await CreditNoteService.list(user.hotelId, query.limit ? parseInt(query.limit) : 50);
        return createResponse(list, 'Credit notes fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_INVOICES,
        query: t.Object({
            limit: t.Optional(t.String())
        }),
        detail: { summary: 'List Credit Notes', tags: ['Finance'] }
    });
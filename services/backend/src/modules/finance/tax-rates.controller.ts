import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { taxRates } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { createResponse } from '../../utils/response.helper';

export const taxRatesController = new Elysia({ prefix: '/finance/taxes' })
    .use(authMiddleware)
    
    .get('/', async ({ user }) => {
        const rates = await db.query.taxRates.findMany({
            where: eq(taxRates.hotelId, user!.hotelId!),
            with: {
                account: { columns: { code: true, name: true } }
            }
        });
        return createResponse(rates, 'Tax rates fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        detail: { summary: 'List Tax Rates', tags: ['GL'] }
    })
    
    .post('/', async ({ body, user }) => {
        const [rate] = await db.insert(taxRates).values({
            hotelId: user!.hotelId!,
            name: body.name,
            rate: body.rate.toString(),
            isDefault: body.isDefault,
            accountId: body.accountId
        }).returning();
        return createResponse(rate, 'Tax rate created');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            name: t.String(),
            rate: t.Number(),
            isDefault: t.Optional(t.Boolean()),
            accountId: t.Optional(t.Number())
        }),
        detail: { summary: 'Create Tax Rate', tags: ['GL'] }
    })
    
    .patch('/:id', async ({ params, body, user }) => {
        const [updated] = await db.update(taxRates)
            .set({
                name: body.name,
                rate: body.rate?.toString(),
                isDefault: body.isDefault,
                accountId: body.accountId,
                isActive: body.isActive
            })
            .where(eq(taxRates.id, parseInt(params.id)))
            .returning();
        return createResponse(updated, 'Tax rate updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        body: t.Object({
            name: t.Optional(t.String()),
            rate: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            accountId: t.Optional(t.Number()),
            isActive: t.Optional(t.Boolean())
        }),
        detail: { summary: 'Update Tax Rate', tags: ['GL'] }
    });

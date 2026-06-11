import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { CorporateService } from './corporate.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

export const corporateController = new Elysia({ prefix: '/crm' })
    .use(authMiddleware)
    .get('/companies', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await CorporateService.getCompanies(user.hotelId);
        return createResponse(list, 'Corporate accounts fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'List corporate accounts', tags: ['CRM'] }
    })
    .post('/companies', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const company = await CorporateService.createCompany(user.hotelId, body);
        return createResponse(company, 'Corporate account created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        body: t.Object({
            companyName: t.String(),
            contactPerson: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            contractRate: t.Optional(t.Number()),
            discountPercentage: t.Optional(t.Number()),
            creditLimit: t.Optional(t.Number())
        }),
        detail: { summary: 'Add corporate account', tags: ['CRM'] }
    })
    .get('/agents', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const list = await CorporateService.getTravelAgents(user.hotelId);
        return createResponse(list, 'Travel agents fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'List travel agents', tags: ['CRM'] }
    })
    .post('/agents', async ({ body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const agent = await CorporateService.createTravelAgent(user.hotelId, body);
        return createResponse(agent, 'Travel agent created successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        body: t.Object({
            name: t.String(),
            agencyName: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            commissionRate: t.Number({ default: 0.10 })
        }),
        detail: { summary: 'Add travel agent', tags: ['CRM'] }
    })
    .get('/companies/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const company = await CorporateService.getCompanyById(user.hotelId, parseInt(params.id));
        return createResponse(company, 'Company fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'Get single corporate account', tags: ['CRM'] }
    })
    .patch('/companies/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await CorporateService.updateCompany(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Company updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        body: t.Partial(t.Object({
            companyName: t.String(),
            contactPerson: t.String(),
            email: t.String(),
            phone: t.String(),
            contractRate: t.Number(),
            discountPercentage: t.Number(),
            creditLimit: t.Number()
        })),
        detail: { summary: 'Update corporate account', tags: ['CRM'] }
    })
    .delete('/companies/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await CorporateService.deleteCompany(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Company deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'Delete corporate account', tags: ['CRM'] }
    })
    .get('/companies/:id/ledger', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await CorporateService.getLedger(user.hotelId, parseInt(params.id));
        return createResponse(data, 'Corporate ledger fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'Get corporate ledger', tags: ['CRM'] }
    })
    .post('/companies/:id/ledger', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const entry = await CorporateService.addLedgerEntry(user.hotelId, parseInt(params.id), body, user.id);
        return createResponse(entry, 'Ledger entry added successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        body: t.Object({
            entryType: t.Union([t.Literal('ROOM_BOOKING'), t.Literal('F_B_ORDER'), t.Literal('BANQUET'), t.Literal('PAYMENT'), t.Literal('ADJUSTMENT')]),
            description: t.String(),
            debit: t.Optional(t.Number()),
            credit: t.Optional(t.Number()),
            referenceId: t.Optional(t.String()),
            referenceType: t.Optional(t.String())
        }),
        detail: { summary: 'Add ledger entry', tags: ['CRM'] }
    })
    .get('/companies/:id/balance', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const data = await CorporateService.getCompanyWithBalance(user.hotelId, parseInt(params.id));
        return createResponse(data, 'Company balance fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'Get company with balance', tags: ['CRM'] }
    })
    .get('/agents/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const agent = await CorporateService.getAgentById(user.hotelId, parseInt(params.id));
        return createResponse(agent, 'Agent fetched successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'Get single travel agent', tags: ['CRM'] }
    })
    .patch('/agents/:id', async ({ params, body, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const updated = await CorporateService.updateAgent(user.hotelId, parseInt(params.id), body);
        return createResponse(updated, 'Agent updated successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        body: t.Partial(t.Object({
            name: t.String(),
            agencyName: t.String(),
            email: t.String(),
            phone: t.String(),
            commissionRate: t.Number()
        })),
        detail: { summary: 'Update travel agent', tags: ['CRM'] }
    })
    .delete('/agents/:id', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        await CorporateService.deleteAgent(user.hotelId, parseInt(params.id));
        return createResponse(null, 'Agent deleted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.CRM.MANAGE_GUESTS,
        detail: { summary: 'Delete travel agent', tags: ['CRM'] }
    });
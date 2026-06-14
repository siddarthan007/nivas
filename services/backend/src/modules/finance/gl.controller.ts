import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { accounts, journalEntries } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { GLService } from './gl.service';
import { createResponse } from '../../utils/response.helper';

export const glController = new Elysia({ prefix: '/finance/gl' })
    .use(authMiddleware)
    
    /**
     * Get Chart of Accounts
     */
    .get('/accounts', async ({ user }) => {
        const list = await db.query.accounts.findMany({
            where: eq(accounts.hotelId, user!.hotelId!),
            orderBy: (accounts, { asc }) => [asc(accounts.code)]
        });
        return createResponse(list, 'Accounts fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        detail: { summary: 'List Chart of Accounts', tags: ['GL'] }
    })
    
    /**
     * Initialize standard CoA (setup)
     */
    .post('/accounts/init', async ({ user }) => {
        await GLService.initializeChartOfAccounts(user!.hotelId!);
        return createResponse(null, 'Standard Chart of Accounts initialized');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Init standard Chart of Accounts', tags: ['GL'] }
    })
    
    /**
     * Post manual journal entry
     */
    .post('/journal', async ({ body, user }) => {
        const entry = await GLService.postJournalEntry(
            user!.hotelId!,
            user!.id,
            body.date,
            body.description,
            body.reference ?? 'MANUAL',
            body.lines
        );
        return createResponse(entry, 'Journal entry posted successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE, // TODO: add specific GL permissions later
        body: t.Object({
            date: t.String(),
            description: t.String(),
            reference: t.Optional(t.String()),
            lines: t.Array(t.Object({
                accountId: t.Number(),
                debit: t.Number(),
                credit: t.Number(),
                description: t.Optional(t.String())
            }))
        }),
        detail: { summary: 'Post Journal Entry', tags: ['GL'] }
    })
    
    /**
     * Get Journal Entries List
     */
    .get('/journal', async ({ user }) => {
        const entries = await db.query.journalEntries.findMany({
            where: eq(journalEntries.hotelId, user!.hotelId!),
            with: {
                lines: {
                    with: {
                        account: { columns: { code: true, name: true } }
                    }
                }
            },
            orderBy: [desc(journalEntries.createdAt)],
            limit: 100
        });
        return createResponse(entries, 'Journal entries fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        detail: { summary: 'List Journal Entries', tags: ['GL'] }
    })
    
    /**
     * Reverse Journal Entry
     */
    .post('/journal/:id/reverse', async ({ params, body, user }) => {
        const reversed = await GLService.reverseJournalEntry(
            user!.hotelId!,
            user!.id,
            params.id,
            body.reason
        );
        return createResponse(reversed, 'Journal entry reversed successfully');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.GENERATE_INVOICE,
        params: t.Object({ id: t.String() }),
        body: t.Object({ reason: t.String() }),
        detail: { summary: 'Reverse Journal Entry', tags: ['GL'] }
    })
    
    /**
     * Get Trial Balance
     */
    .get('/trial-balance', async ({ query, user }) => {
        const asOfDate = query.date || new Date().toISOString().split('T')[0]!;
        const tb = await GLService.getTrialBalance(user!.hotelId!, asOfDate);
        return createResponse(tb, `Trial Balance as of ${asOfDate}`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            date: t.Optional(t.String())
        }),
        detail: { summary: 'Get Trial Balance', tags: ['GL'] }
    })
    .get('/profit-loss', async ({ query, user }) => {
        const to = query.to || new Date().toISOString().split('T')[0]!;
        const from = query.from || `${new Date().getFullYear()}-01-01`;
        const pl = await GLService.getProfitAndLoss(user!.hotelId!, from, to);
        return createResponse(pl, 'Profit & Loss statement');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }),
        detail: { summary: 'Get Profit & Loss', tags: ['GL'] }
    })
    .get('/balance-sheet', async ({ query, user }) => {
        const asOfDate = query.date || new Date().toISOString().split('T')[0]!;
        const bs = await GLService.getBalanceSheet(user!.hotelId!, asOfDate);
        return createResponse(bs, `Balance Sheet as of ${asOfDate}`);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({ date: t.Optional(t.String()) }),
        detail: { summary: 'Get Balance Sheet', tags: ['GL'] }
    })
    .get('/account-ledger', async ({ query, user }) => {
        const to = query.to || new Date().toISOString().split('T')[0]!;
        const from = query.from || `${new Date().getFullYear()}-01-01`;
        const ledger = await GLService.getAccountLedger(user!.hotelId!, parseInt(query.accountId), from, to);
        return createResponse(ledger, 'Account ledger');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({ accountId: t.String(), from: t.Optional(t.String()), to: t.Optional(t.String()) }),
        detail: { summary: 'Get Account Ledger', tags: ['GL'] }
    })
    .get('/cash-flow', async ({ query, user }) => {
        const to = query.to || new Date().toISOString().split('T')[0]!;
        const from = query.from || `${new Date().getFullYear()}-01-01`;
        const cf = await GLService.getCashFlow(user!.hotelId!, from, to);
        return createResponse(cf, 'Cash flow');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }),
        detail: { summary: 'Get Cash Flow', tags: ['GL'] }
    })
    .get('/cash-transactions', async ({ query, user }) => {
        const to = query.to || new Date().toISOString().split('T')[0]!;
        const from = query.from || `${new Date().getFullYear()}-01-01`;
        const txns = await GLService.getCashTransactions(user!.hotelId!, from, to);
        return createResponse(txns, 'Cash transactions');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }),
        detail: { summary: 'All cash/bank transactions (in + out)', tags: ['GL'] }
    })
    .get('/ar-aging', async ({ query, user }) => {
        const asOfDate = query.date || new Date().toISOString().split('T')[0]!;
        const aging = await GLService.getArAging(user!.hotelId!, asOfDate);
        return createResponse(aging, 'AR aging');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({ date: t.Optional(t.String()) }),
        detail: { summary: 'Get AR Aging', tags: ['GL'] }
    });

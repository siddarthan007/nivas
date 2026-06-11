import { db } from '../../db';
import { accounts, journalEntries, journalLines, taxRates, invoices } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';

export type JournalLineInput = {
    accountId: number;
    debit: number;
    credit: number;
    description?: string;
};

export const GLService = {
    /**
     * Get or create a default control account (e.g., Accounts Receivable)
     */
    async getOrCreateControlAccount(hotelId: number, code: string, name: string, type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE', dbTx?: any, isControl: boolean = true) {
        const runner = dbTx || db;
        let account = await runner.query.accounts.findFirst({
            where: and(eq(accounts.hotelId, hotelId), eq(accounts.code, code))
        });

        if (!account) {
            const [newAccount] = await runner.insert(accounts).values({
                hotelId,
                code,
                name,
                type,
                isControlAccount: isControl
            }).returning();
            account = newAccount;
        }

        return account;
    },

    /**
     * Initialize standard Chart of Accounts for a new hotel
     */
    async initializeChartOfAccounts(hotelId: number) {
        const standardAccounts = [
            { code: '1000', name: 'Cash', type: 'ASSET' },
            { code: '1100', name: 'Accounts Receivable', type: 'ASSET', isControl: true },
            { code: '1200', name: 'Inventory', type: 'ASSET', isControl: true },
            { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', isControl: true },
            { code: '2100', name: 'Sales Tax Payable', type: 'LIABILITY', isControl: true },
            { code: '3000', name: 'Owner Equity', type: 'EQUITY' },
            { code: '4000', name: 'Room Revenue', type: 'REVENUE' },
            { code: '4100', name: 'F&B Revenue', type: 'REVENUE' },
            { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
            { code: '5100', name: 'Payroll Expense', type: 'EXPENSE' },
            { code: '5200', name: 'Maintenance Expense', type: 'EXPENSE' }
        ];

        for (const acc of standardAccounts) {
            await this.getOrCreateControlAccount(hotelId, acc.code, acc.name, acc.type as any, undefined, (acc as any).isControl ?? false);
        }
    },

    /**
     * Post a balanced journal entry
     */
    async postJournalEntry(hotelId: number, userId: string | null, date: string, description: string, reference: string, lines: JournalLineInput[], dbTx?: any) {
        // Each line must be a clean single-sided posting with non-negative amounts.
        for (const line of lines) {
            if (line.debit < 0 || line.credit < 0) throw new BusinessLogicError('Journal line amounts cannot be negative');
            if (line.debit > 0 && line.credit > 0) throw new BusinessLogicError('A journal line cannot be both a debit and a credit');
        }
        const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

        // Standard accounting check: Debits must equal Credits
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new BusinessLogicError(`Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
        }

        if (Math.abs(totalDebit) < 0.001) {
            throw new BusinessLogicError('Journal entry must have a non-zero amount');
        }

        const runner = dbTx || db;

        const [entry] = await runner.insert(journalEntries).values({
            hotelId,
            date,
            description,
            reference,
            createdById: userId,
            status: 'POSTED'
        }).returning();

        const insertLines = lines.map(line => ({
            journalEntryId: entry.id,
            accountId: line.accountId,
            debit: line.debit.toString(),
            credit: line.credit.toString(),
            description: line.description
        }));

        await runner.insert(journalLines).values(insertLines);

        return entry;
    },

    /**
     * Reverse a posted journal entry
     */
    async reverseJournalEntry(hotelId: number, userId: string, entryId: string, reason: string) {
        return db.transaction(async (tx) => {
            const entry = await tx.query.journalEntries.findFirst({
                where: and(eq(journalEntries.id, entryId), eq(journalEntries.hotelId, hotelId)),
                with: {
                    lines: true
                }
            });

            if (!entry) throw new NotFoundError('Journal entry');
            if (entry.status === 'REVERSED') throw new BusinessLogicError('Journal entry is already reversed');

            // 1. Mark original as reversed
            await tx.update(journalEntries).set({
                status: 'REVERSED',
                reversedById: userId
            }).where(eq(journalEntries.id, entryId));

            // 2. Create reversing entry (swap debits and credits)
            const r2 = (v: any) => Math.round((parseFloat(v) || 0) * 100) / 100;
            const reversingLines = ((entry as any).lines || []).map((line: any) => ({
                accountId: line.accountId,
                debit: r2(line.credit),   // swap + clean 2dp (no float artifact)
                credit: r2(line.debit),
                description: `Reversal of: ${line.description || entry.description}`
            }));

            const reversedEntry = await this.postJournalEntry(
                hotelId,
                userId,
                new Date().toISOString().split('T')[0]!,
                `REVERSAL: ${entry.description} - ${reason}`,
                `REV-${entry.reference}`,
                reversingLines,
                tx
            );

            return reversedEntry;
        });
    },

    /**
     * Get Trial Balance (sum of debits and credits grouped by account)
     */
    async getTrialBalance(hotelId: number, asOfDate: string) {
        // Query groups by account, sums debits and credits
        const query = sql`
            SELECT 
                a.code, 
                a.name, 
                a.type,
                SUM(jl.debit) as total_debit,
                SUM(jl.credit) as total_credit,
                (SUM(jl.debit) - SUM(jl.credit)) as balance
            FROM accounts a
            JOIN journal_lines jl ON a.id = jl.account_id
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE a.hotel_id = ${hotelId} 
              AND je.hotel_id = ${hotelId}
              AND je.status = 'POSTED'
              AND je.date <= ${asOfDate}
            GROUP BY a.id, a.code, a.name, a.type
            ORDER BY a.code ASC
        `;
        
        const res: any = await db.execute(query);
        const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
        return rows;
    },

    /**
     * Profit & Loss (income statement) for a period. Revenue = credits − debits,
     * Expense = debits − credits. Net profit = total revenue − total expense.
     */
    async getProfitAndLoss(hotelId: number, fromDate: string, toDate: string) {
        const result: any = await db.execute(sql`
            SELECT a.code, a.name, a.type,
                   COALESCE(SUM(jl.debit), 0) AS total_debit,
                   COALESCE(SUM(jl.credit), 0) AS total_credit
            FROM accounts a
            JOIN journal_lines jl ON a.id = jl.account_id
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE a.hotel_id = ${hotelId}
              AND je.hotel_id = ${hotelId}
              AND je.status = 'POSTED'
              AND je.date >= ${fromDate}
              AND je.date <= ${toDate}
              AND a.type IN ('REVENUE', 'EXPENSE')
            GROUP BY a.id, a.code, a.name, a.type
            ORDER BY a.code ASC
        `);

        const list: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        const revenue: any[] = [];
        const expense: any[] = [];
        for (const r of list) {
            const debit = Number(r.total_debit || 0);
            const credit = Number(r.total_credit || 0);
            if (r.type === 'REVENUE') revenue.push({ code: r.code, name: r.name, amount: credit - debit });
            else expense.push({ code: r.code, name: r.name, amount: debit - credit });
        }
        const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
        const totalExpense = expense.reduce((s, r) => s + r.amount, 0);
        return {
            fromDate, toDate,
            revenue, expense,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalExpense: Math.round(totalExpense * 100) / 100,
            netProfit: Math.round((totalRevenue - totalExpense) * 100) / 100,
        };
    },

    /**
     * Balance Sheet as of a date. Asset = debits − credits; Liability/Equity =
     * credits − debits. Net income to date is folded into equity (retained
     * earnings) so the sheet balances.
     */
    async getBalanceSheet(hotelId: number, asOfDate: string) {
        const result: any = await db.execute(sql`
            SELECT a.code, a.name, a.type,
                   COALESCE(SUM(jl.debit), 0) AS total_debit,
                   COALESCE(SUM(jl.credit), 0) AS total_credit
            FROM accounts a
            JOIN journal_lines jl ON a.id = jl.account_id
            JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE a.hotel_id = ${hotelId}
              AND je.hotel_id = ${hotelId}
              AND je.status = 'POSTED'
              AND je.date <= ${asOfDate}
            GROUP BY a.id, a.code, a.name, a.type
            ORDER BY a.code ASC
        `);

        const list: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        const assets: any[] = [];
        const liabilities: any[] = [];
        const equity: any[] = [];
        let revenueTotal = 0;
        let expenseTotal = 0;
        for (const r of list) {
            const debit = Number(r.total_debit || 0);
            const credit = Number(r.total_credit || 0);
            if (r.type === 'ASSET') assets.push({ code: r.code, name: r.name, amount: debit - credit });
            else if (r.type === 'LIABILITY') liabilities.push({ code: r.code, name: r.name, amount: credit - debit });
            else if (r.type === 'EQUITY') equity.push({ code: r.code, name: r.name, amount: credit - debit });
            else if (r.type === 'REVENUE') revenueTotal += credit - debit;
            else if (r.type === 'EXPENSE') expenseTotal += debit - credit;
        }
        const retainedEarnings = Math.round((revenueTotal - expenseTotal) * 100) / 100;
        if (retainedEarnings !== 0) equity.push({ code: '3900', name: 'Retained Earnings (current)', amount: retainedEarnings });

        const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
        const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
        const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
        return {
            asOfDate,
            assets, liabilities, equity,
            totalAssets: Math.round(totalAssets * 100) / 100,
            totalLiabilities: Math.round(totalLiabilities * 100) / 100,
            totalEquity: Math.round(totalEquity * 100) / 100,
            balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
        };
    },

    /**
     * Account ledger drilldown: every posted journal line touching an account
     * over a period, with opening balance and a running balance (debit − credit
     * cumulative).
     */
    async getAccountLedger(hotelId: number, accountId: number, fromDate: string, toDate: string) {
        const account = await db.query.accounts.findFirst({
            where: and(eq(accounts.id, accountId), eq(accounts.hotelId, hotelId)),
            columns: { id: true, code: true, name: true, type: true },
        });
        if (!account) throw new NotFoundError('Account');

        const openRes: any = await db.execute(sql`
            SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS bal
            FROM journal_lines jl JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE jl.account_id = ${accountId} AND je.hotel_id = ${hotelId}
              AND je.status = 'POSTED' AND je.date < ${fromDate}
        `);
        const openRows: any[] = Array.isArray(openRes) ? openRes : (openRes?.rows ?? []);
        const opening = Number(openRows[0]?.bal ?? 0);
        let running = opening;

        const linesRes: any = await db.execute(sql`
            SELECT je.date AS date, je.description AS entry_desc, je.reference AS reference,
                   jl.debit AS debit, jl.credit AS credit, jl.description AS line_desc
            FROM journal_lines jl JOIN journal_entries je ON jl.journal_entry_id = je.id
            WHERE jl.account_id = ${accountId} AND je.hotel_id = ${hotelId}
              AND je.status = 'POSTED' AND je.date >= ${fromDate} AND je.date <= ${toDate}
            ORDER BY je.date ASC, je.created_at ASC
        `);
        const list: any[] = Array.isArray(linesRes) ? linesRes : (linesRes?.rows ?? []);

        const lines = list.map(r => {
            const debit = Number(r.debit || 0);
            const credit = Number(r.credit || 0);
            running += debit - credit;
            return {
                date: r.date,
                description: r.line_desc || r.entry_desc || '',
                reference: r.reference || '',
                debit, credit,
                balance: Math.round(running * 100) / 100,
            };
        });

        return {
            account,
            fromDate, toDate,
            openingBalance: Math.round(opening * 100) / 100,
            closingBalance: Math.round(running * 100) / 100,
            lines,
        };
    },

    /**
     * Cash-flow summary over a period from cash/bank GL accounts: opening cash,
     * inflows (debits), outflows (credits), net change, closing cash, plus a
     * daily net series.
     */
    async getCashFlow(hotelId: number, fromDate: string, toDate: string) {
        const cashFilter = sql`a.hotel_id = ${hotelId} AND a.type = 'ASSET' AND (a.code = '1000' OR a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')`;

        const openRes: any = await db.execute(sql`
            SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS bal
            FROM journal_lines jl
            JOIN accounts a ON a.id = jl.account_id
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            WHERE ${cashFilter} AND je.status = 'POSTED' AND je.date < ${fromDate}
        `);
        const opening = Number((Array.isArray(openRes) ? openRes : openRes?.rows ?? [])[0]?.bal ?? 0);

        const dailyRes: any = await db.execute(sql`
            SELECT je.date AS date,
                   COALESCE(SUM(jl.debit), 0) AS inflow,
                   COALESCE(SUM(jl.credit), 0) AS outflow
            FROM journal_lines jl
            JOIN accounts a ON a.id = jl.account_id
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            WHERE ${cashFilter} AND je.status = 'POSTED' AND je.date >= ${fromDate} AND je.date <= ${toDate}
            GROUP BY je.date ORDER BY je.date ASC
        `);
        const daily: any[] = Array.isArray(dailyRes) ? dailyRes : (dailyRes?.rows ?? []);

        let totalIn = 0, totalOut = 0;
        const series = daily.map(d => {
            const inflow = Number(d.inflow || 0), outflow = Number(d.outflow || 0);
            totalIn += inflow; totalOut += outflow;
            return { date: d.date, inflow, outflow, net: Math.round((inflow - outflow) * 100) / 100 };
        });
        const r = (n: number) => Math.round(n * 100) / 100;
        return {
            fromDate, toDate,
            openingCash: r(opening),
            totalInflow: r(totalIn),
            totalOutflow: r(totalOut),
            netChange: r(totalIn - totalOut),
            closingCash: r(opening + totalIn - totalOut),
            series,
        };
    },

    /**
     * EVERY cash/bank movement as a line item — the single source of truth for the
     * Transactions view. Because everything (guest payments, F&B orders, supplier
     * payments, expenses, refunds) posts to the GL, this captures all in + out flow.
     */
    async getCashTransactions(hotelId: number, fromDate: string, toDate: string, limit = 300) {
        const cashFilter = sql`a.hotel_id = ${hotelId} AND a.type = 'ASSET' AND (a.code = '1000' OR a.name ILIKE '%cash%' OR a.name ILIKE '%bank%')`;
        const res: any = await db.execute(sql`
            SELECT je.id AS id, je.date AS date, je.description AS description, je.reference AS reference,
                   COALESCE(SUM(jl.debit), 0) AS inflow,
                   COALESCE(SUM(jl.credit), 0) AS outflow
            FROM journal_lines jl
            JOIN accounts a ON a.id = jl.account_id
            JOIN journal_entries je ON je.id = jl.journal_entry_id
            WHERE ${cashFilter} AND je.status = 'POSTED' AND je.date >= ${fromDate} AND je.date <= ${toDate}
            GROUP BY je.id, je.date, je.description, je.reference, je.created_at
            ORDER BY je.date DESC, je.created_at DESC
            LIMIT ${limit}
        `);
        const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
        return rows.map(r => {
            const inflow = Number(r.inflow || 0), outflow = Number(r.outflow || 0);
            const net = inflow - outflow;
            return {
                id: r.id, date: r.date, description: r.description || 'Transaction', reference: r.reference,
                direction: net >= 0 ? 'in' : 'out',
                amount: Math.round(Math.abs(net) * 100) / 100,
            };
        });
    },

    /**
     * Accounts-receivable aging: unpaid (CREDIT) invoices bucketed by age from
     * invoice date. Buckets: current(0-30), 31-60, 61-90, 90+.
     */
    async getArAging(hotelId: number, asOfDate: string) {
        const rows = await db.query.invoices.findMany({
            where: and(
                eq(invoices.hotelId, hotelId),
                eq(invoices.paymentStatus, 'CREDIT'),
                eq(invoices.isVoided, false),
            ),
            columns: { id: true, invoiceNumber: true, guestName: true, grandTotal: true, createdAt: true },
        });

        const asOf = new Date(asOfDate).getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const buckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
        const byCustomer = new Map<string, { customer: string; current: number; d31_60: number; d61_90: number; d90plus: number; total: number }>();

        for (const inv of rows) {
            const amt = parseFloat(inv.grandTotal || '0');
            const age = Math.max(0, Math.floor((asOf - new Date(inv.createdAt as any).getTime()) / dayMs));
            const bucket = age <= 30 ? 'current' : age <= 60 ? 'd31_60' : age <= 90 ? 'd61_90' : 'd90plus';
            buckets[bucket] += amt;
            const key = inv.guestName || 'Unknown';
            const row = byCustomer.get(key) || { customer: key, current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
            (row as any)[bucket] += amt;
            row.total += amt;
            byCustomer.set(key, row);
        }
        const rnd = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v]));
        const customers = Array.from(byCustomer.values()).map(rnd).sort((a: any, b: any) => b.total - a.total);
        const totalOutstanding = (buckets.current + buckets.d31_60 + buckets.d61_90 + buckets.d90plus);
        return {
            asOfDate,
            buckets: rnd(buckets),
            totalOutstanding: Math.round(totalOutstanding * 100) / 100,
            customers,
        };
    }
};

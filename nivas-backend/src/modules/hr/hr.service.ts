import { db } from '../../db';
import { payrollSummaries, users } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError, ValidationError } from '../../utils/errors';
import { GLService } from '../finance/gl.service';

export const HRService = {
    async getPayrollSummaries(hotelId: number) {
        // Manual join — payrollSummaries has no `employee` relation declared, so a
        // relational `with: { employee }` throws (500). Join users on userId.
        const rows = await db.select({
            payroll: payrollSummaries,
            employee: { id: users.id, fullName: users.fullName, email: users.email },
        })
            .from(payrollSummaries)
            .leftJoin(users, eq(payrollSummaries.userId, users.id))
            .where(eq(payrollSummaries.hotelId, hotelId))
            .orderBy(desc(payrollSummaries.createdAt));
        return rows.map(r => ({ ...r.payroll, employee: r.employee }));
    },

    async generatePayroll(hotelId: number, userId: string, data: { employeeId: string; periodStart: string; periodEnd: string; baseSalary: number; deductions?: number; bonuses?: number }) {
        return db.transaction(async (tx) => {
            const employee = await tx.query.users.findFirst({
                where: and(
                    eq(users.id, data.employeeId),
                    eq(users.hotelId, hotelId) // Users table uses hotelId for tenant
                )
            });

            if (!employee) throw new NotFoundError('Employee');

            // Prevent double-posting the same employee/period (would duplicate GL).
            const dup = await tx.query.payrollSummaries.findFirst({
                where: and(
                    eq(payrollSummaries.hotelId, hotelId),
                    eq(payrollSummaries.userId, employee.id),
                    eq(payrollSummaries.periodStart, data.periodStart),
                    eq(payrollSummaries.periodEnd, data.periodEnd),
                ),
            });
            if (dup) throw new BusinessLogicError('Payroll already generated for this employee and period');

            const deductions = data.deductions || 0;
            const bonuses = data.bonuses || 0;
            const netPay = data.baseSalary + bonuses - deductions;
            if (netPay < 0) throw new ValidationError('Net pay cannot be negative — deductions exceed salary plus bonuses');

            const [payroll] = await tx.insert(payrollSummaries).values({
                hotelId: hotelId,
                userId: employee.id,
                periodStart: data.periodStart,
                periodEnd: data.periodEnd,
                baseSalary: data.baseSalary.toString(),
                overtimePay: bonuses.toString(),
                deductions: deductions.toString(),
                netPay: netPay.toString(),
                status: 'DRAFT'
            }).returning();

            // Auto-post GL (Debit Salary Expense, Credit Salary Payable)
            const expenseAccount = await GLService.getOrCreateControlAccount(hotelId, '6000', 'Salary Expense', 'EXPENSE');
            const payableAccount = await GLService.getOrCreateControlAccount(hotelId, '2100', 'Salary Payable', 'LIABILITY');

            if (expenseAccount && payableAccount) {
                const glEntry = await GLService.postJournalEntry(
                    hotelId,
                    userId,
                    new Date().toISOString().split('T')[0] as string,
                    `Payroll generated for ${employee.fullName}`,
                    payroll!.id.toString(),
                    [
                        { accountId: expenseAccount.id, debit: netPay, credit: 0, description: 'Salary Expense' },
                        { accountId: payableAccount.id, debit: 0, credit: netPay, description: 'Salary Payable' }
                    ],
                    tx
                );

                await tx.update(payrollSummaries).set({ journalEntryId: glEntry.id }).where(eq(payrollSummaries.id, payroll!.id));
            }

            return payroll;
        });
    },
    
    async processPayment(hotelId: number, payrollId: number, userId: string) {
        return db.transaction(async (tx) => {
            const payroll = await tx.query.payrollSummaries.findFirst({
                where: and(
                    eq(payrollSummaries.id, payrollId),
                    eq(payrollSummaries.hotelId, hotelId)
                )
            });

            if (!payroll) throw new NotFoundError('Payroll Summary');
            // Idempotency: never pay the same payroll twice (would double the cash GL).
            if (payroll.status === 'paid' || payroll.status === 'PAID') {
                throw new BusinessLogicError('This payroll has already been paid');
            }

            // Settle the payable: Debit Salary Payable, Credit Cash/Bank.
            const payableAccount = await GLService.getOrCreateControlAccount(hotelId, '2100', 'Salary Payable', 'LIABILITY');
            const bankAccount = await GLService.getOrCreateControlAccount(hotelId, '1000', 'Cash/Bank', 'ASSET');
            
            if (payableAccount && bankAccount) {
                await GLService.postJournalEntry(
                    hotelId,
                    userId,
                    new Date().toISOString().split('T')[0] as string,
                    `Payroll paid for summary ${payroll.id}`,
                    payroll!.id.toString(),
                    [
                        { accountId: payableAccount.id, debit: Number(payroll.netPay), credit: 0, description: 'Clear Salary Payable' },
                        { accountId: bankAccount.id, debit: 0, credit: Number(payroll.netPay), description: 'Cash Outflow' }
                    ],
                    tx
                );
            }

            return tx.update(payrollSummaries)
                .set({ status: 'paid' })
                .where(eq(payrollSummaries.id, payrollId))
                .returning();
        });
    }
};

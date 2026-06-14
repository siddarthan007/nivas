import { db } from '../../db';
import { payrollSummaries, users } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError, ValidationError } from '../../utils/errors';
import { GLService } from '../finance/gl.service';
import { EventBus } from '../../shared/event-bus';
import { NotificationsService } from '../notifications/notifications.service';

import { AttendanceService } from '../iam/attendance.service';

const STANDARD_WORK_HOURS = 8;

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

    async previewPayrollFromAttendance(
        hotelId: number,
        data: {
            employeeId: string;
            periodStart: string;
            periodEnd: string;
            monthlyBaseSalary: number;
            hourlyRate?: number;
            deductions?: number;
        },
    ) {
        const hours = await AttendanceService.getApprovedHoursForPeriod(
            hotelId,
            data.employeeId,
            data.periodStart,
            data.periodEnd,
        );
        const standardMonthlyHours = 22 * STANDARD_WORK_HOURS;
        const hourly = data.hourlyRate ?? (data.monthlyBaseSalary / standardMonthlyHours);
        const regularPay = Math.min(hours.totalHours, standardMonthlyHours) * hourly;
        const overtimePay = hours.overtimeHours * hourly * 1.5;
        const deductions = data.deductions || 0;
        return {
            ...hours,
            hourlyRate: Math.round(hourly * 100) / 100,
            regularPay: Math.round(regularPay * 100) / 100,
            overtimePay: Math.round(overtimePay * 100) / 100,
            deductions,
            netPay: Math.round((regularPay + overtimePay - deductions) * 100) / 100,
        };
    },

    async generatePayrollFromAttendance(
        hotelId: number,
        userId: string,
        data: {
            employeeId: string;
            periodStart: string;
            periodEnd: string;
            monthlyBaseSalary: number;
            deductions?: number;
            hourlyRate?: number;
        }
    ) {
        const hours = await AttendanceService.getApprovedHoursForPeriod(
            hotelId,
            data.employeeId,
            data.periodStart,
            data.periodEnd,
        );
        const standardMonthlyHours = 22 * STANDARD_WORK_HOURS;
        const hourly = data.hourlyRate ?? (data.monthlyBaseSalary / standardMonthlyHours);
        const regularPay = Math.min(hours.totalHours, standardMonthlyHours) * hourly;
        const overtimePay = hours.overtimeHours * hourly * 1.5;
        const deductions = data.deductions || 0;
        const netPay = regularPay + overtimePay - deductions;

        return this.generatePayroll(hotelId, userId, {
            employeeId: data.employeeId,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            baseSalary: Math.round(regularPay * 100) / 100,
            bonuses: Math.round(overtimePay * 100) / 100,
            deductions,
        });
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
            if (payroll.status === 'PAID') {
                throw new BusinessLogicError('This payroll has already been paid');
            }

            const netPay = Number(payroll.netPay);

            const expenseAccount = await GLService.getOrCreateControlAccount(hotelId, '5100', 'Payroll Expense', 'EXPENSE', tx);
            const payableAccount = await GLService.getOrCreateControlAccount(hotelId, '2110', 'Salary Payable', 'LIABILITY', tx);
            const cashAccount = await GLService.getOrCreateControlAccount(hotelId, '1000', 'Cash', 'ASSET', tx);

            if (!expenseAccount || !payableAccount || !cashAccount) {
                throw new BusinessLogicError('Payroll GL accounts could not be resolved — payment aborted');
            }

            if (!payroll.journalEntryId) {
                const glEntry = await GLService.postJournalEntry(
                    hotelId,
                    userId,
                    new Date().toISOString().split('T')[0] as string,
                    `Payroll accrued for employee ${payroll.userId}`,
                    payroll.id.toString(),
                    [
                        { accountId: expenseAccount.id, debit: netPay, credit: 0, description: 'Payroll Expense' },
                        { accountId: payableAccount.id, debit: 0, credit: netPay, description: 'Salary Payable' },
                    ],
                    tx,
                );
                await tx.update(payrollSummaries).set({ journalEntryId: glEntry.id }).where(eq(payrollSummaries.id, payrollId));
            }

            await GLService.postJournalEntry(
                hotelId,
                userId,
                new Date().toISOString().split('T')[0] as string,
                `Payroll paid for summary ${payroll.id}`,
                payroll.id.toString(),
                [
                    { accountId: payableAccount.id, debit: netPay, credit: 0, description: 'Clear Salary Payable' },
                    { accountId: cashAccount.id, debit: 0, credit: netPay, description: 'Cash Outflow' },
                ],
                tx,
            );

            const [updated] = await tx.update(payrollSummaries)
                .set({ status: 'PAID' })
                .where(eq(payrollSummaries.id, payrollId))
                .returning();

            if (!updated) throw new NotFoundError('Payroll Summary');

            // Send notification to the employee and finance roles
            await NotificationsService.send(hotelId, 'PAYROLL_PAID', {
                payrollId: updated.id,
                employeeId: updated.userId,
                netPay: updated.netPay,
                periodStart: updated.periodStart,
                periodEnd: updated.periodEnd,
                dedupeKey: `payroll-paid-${updated.id}`,
                title: 'Payroll payment processed',
                message: `Your payroll payment of NPR ${updated.netPay} has been processed`,
            }, { userId: updated.userId }).catch(err => console.error('Failed to send payroll notification:', err));

            await NotificationsService.send(hotelId, 'PAYROLL_PAID_ADMIN', {
                payrollId: updated.id,
                employeeId: updated.userId,
                netPay: updated.netPay,
                periodStart: updated.periodStart,
                periodEnd: updated.periodEnd,
                dedupeKey: `payroll-paid-admin-${updated.id}`,
                title: 'Payroll payment completed',
                message: `Payroll payment of NPR ${updated.netPay} processed for employee ${updated.userId}`,
            }, { roles: ['Manager', 'Accountant', 'Owner'] }).catch(err => console.error('Failed to send payroll admin notification:', err));

            return updated;
        });
    }
};

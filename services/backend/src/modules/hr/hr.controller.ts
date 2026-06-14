import { Elysia, t } from 'elysia';
import { HRService } from './hr.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ValidationError } from '../../utils/errors';
import { requirePassword } from '../../utils/password.guard';
import { createResponse } from '../../utils/response.helper';

// Payroll is sensitive finance data — restricted to finance-capable roles
// (Manager / Accountant / Owner hold FINANCE.VIEW_RECORDS; Front Desk, Waiter,
// Housekeeping do not).
export const hrController = new Elysia({ prefix: '/hr' })
    .use(authMiddleware)
    .get('/payroll/attendance-preview', async ({ user, query }) => {
        if (!user?.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(
            await HRService.previewPayrollFromAttendance(user.hotelId, {
            employeeId: query.employeeId,
            periodStart: query.periodStart,
            periodEnd: query.periodEnd,
            monthlyBaseSalary: Number(query.monthlyBaseSalary),
            hourlyRate: query.hourlyRate ? Number(query.hourlyRate) : undefined,
            deductions: query.deductions ? Number(query.deductions) : undefined,
        }),
        'Payroll attendance preview',
    );
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        query: t.Object({
            employeeId: t.String(),
            periodStart: t.String(),
            periodEnd: t.String(),
            monthlyBaseSalary: t.String(),
            hourlyRate: t.Optional(t.String()),
            deductions: t.Optional(t.String()),
        }),
    })
    .get('/payroll', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await HRService.getPayrollSummaries(user.hotelId), 'Payroll summaries');
    }, { isSignedIn: true, hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS })
    .post('/payroll/from-attendance', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(
            await HRService.generatePayrollFromAttendance(user.hotelId, user.id, body),
            'Payroll generated from attendance',
        );
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        body: t.Object({
            employeeId: t.String(),
            periodStart: t.String(),
            periodEnd: t.String(),
            monthlyBaseSalary: t.Number({ minimum: 0 }),
            hourlyRate: t.Optional(t.Number({ minimum: 0 })),
            deductions: t.Optional(t.Number({ minimum: 0 })),
        })
    })
    .post('/payroll', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return createResponse(await HRService.generatePayroll(user.hotelId, user.id, body), 'Payroll generated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        body: t.Object({
            employeeId: t.String(),
            periodStart: t.String(),
            periodEnd: t.String(),
            baseSalary: t.Number({ minimum: 0 }),
            deductions: t.Optional(t.Number({ minimum: 0 })),
            bonuses: t.Optional(t.Number({ minimum: 0 }))
        })
    })
    .post('/payroll/:id/pay', async ({ user, body, params: { id } }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        await requirePassword(user.id, body.confirmPassword);
        return createResponse(
            await HRService.processPayment(user.hotelId, parseInt(id, 10), user.id),
            'Payroll paid',
        );
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        body: t.Object({ confirmPassword: t.String() }),
    });

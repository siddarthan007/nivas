import { Elysia, t } from 'elysia';
import { HRService } from './hr.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { ValidationError } from '../../utils/errors';
import { requirePassword } from '../../utils/password.guard';

// Payroll is sensitive finance data — restricted to finance-capable roles
// (Manager / Accountant / Owner hold FINANCE.VIEW_RECORDS; Front Desk, Waiter,
// Housekeeping do not).
export const hrController = new Elysia({ prefix: '/hr' })
    .use(authMiddleware)
    .get('/payroll', async ({ user }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return HRService.getPayrollSummaries(user.hotelId);
    }, { isSignedIn: true, hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS })
    .post('/payroll', async ({ user, body }) => {
        if (!user || !user.hotelId) throw new ValidationError('User must be associated with a hotel');
        return HRService.generatePayroll(user.hotelId, user.id, body);
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
        return HRService.processPayment(user.hotelId, parseInt(id, 10), user.id);
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.FINANCE.VIEW_RECORDS,
        body: t.Object({ confirmPassword: t.String() }),
    });

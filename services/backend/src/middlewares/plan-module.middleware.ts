import { Elysia } from 'elysia';
import { PlanLimitsService } from '../modules/saas/plan-limits.service';
import type { User } from './auth.middleware';

const EXEMPT_PREFIXES = [
    '/auth',
    '/guest',
    '/saas-billing',
    '/settings',
    '/notifications/push',
    '/profile',
    '/health',
];

/**
 * Enforce subscription package modules on API routes (backend mirror of web ModuleGuard).
 */
export const planModuleMiddleware = new Elysia({ name: 'plan-module' })
    .onBeforeHandle(async (ctx) => {
        const { user, path, set } = ctx as typeof ctx & { user?: User | null };
        if (!user?.hotelId || user.type === 'SUPER_ADMIN') return;
        if (EXEMPT_PREFIXES.some(p => path.startsWith(p))) return;

        try {
            const apiPath = path.replace(/^\/api\/v1/, '') || path;
            await PlanLimitsService.assertModuleForPath(user.hotelId, apiPath);
        } catch (e: any) {
            set.status = 403;
            return {
                status: 'error',
                code: 'MODULE_NOT_IN_PLAN',
                message: e?.message || 'Module not in plan',
            };
        }
    });

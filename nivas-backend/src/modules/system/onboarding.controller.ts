import { Elysia } from 'elysia';
import { db } from '../../db';
import { hotels, rooms, menuItems, users, kotPrinters } from '../../db/schema';
import { eq, and, ne, count } from 'drizzle-orm';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { createResponse } from '../../utils/response.helper';
import { ValidationError } from '../../utils/errors';

/**
 * Setup checklist for a new hotel — drives the dashboard onboarding widget so
 * owners know what to configure first. Computed live from existing data.
 */
export const onboardingController = new Elysia({ prefix: '/onboarding' })
    .use(authMiddleware)
    .get('/checklist', async ({ user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const hid = user.hotelId;

        const [hotel, [roomCount], [menuCount], [staffCount], [printerCount]] = await Promise.all([
            db.query.hotels.findFirst({ where: eq(hotels.id, hid), columns: { name: true, address: true, phone: true, paymentConfig: true, logoUrl: true } }),
            db.select({ c: count() }).from(rooms).where(eq(rooms.hotelId, hid)),
            db.select({ c: count() }).from(menuItems).where(eq(menuItems.hotelId, hid)),
            db.select({ c: count() }).from(users).where(and(eq(users.hotelId, hid), ne(users.userType, 'GUEST'))),
            db.select({ c: count() }).from(kotPrinters).where(eq(kotPrinters.hotelId, hid)),
        ]);

        const paymentCfg = (hotel?.paymentConfig as any) || {};
        const steps = [
            { id: 'profile', label: 'Complete hotel profile', done: !!(hotel?.name && hotel?.address && hotel?.phone), href: '/hotel/settings' },
            { id: 'rooms', label: 'Add your rooms', done: (roomCount?.c ?? 0) > 0, href: '/hotel/rooms' },
            { id: 'menu', label: 'Add menu items', done: (menuCount?.c ?? 0) > 0, href: '/hotel/menu' },
            { id: 'staff', label: 'Invite staff', done: (staffCount?.c ?? 0) > 1, href: '/hotel/staff' },
            { id: 'payment', label: 'Configure payment methods', done: Array.isArray(paymentCfg.enabledMethods) && paymentCfg.enabledMethods.length > 0, href: '/hotel/settings' },
            { id: 'printer', label: 'Set up a KOT printer (optional)', done: (printerCount?.c ?? 0) > 0, href: '/hotel/settings', optional: true },
        ];

        const required = steps.filter(s => !s.optional);
        const completed = required.filter(s => s.done).length;
        return createResponse({
            steps,
            completed,
            total: required.length,
            isComplete: completed === required.length,
        }, 'Onboarding checklist');
    }, { isSignedIn: true, detail: { summary: 'Onboarding checklist', tags: ['System'] } });

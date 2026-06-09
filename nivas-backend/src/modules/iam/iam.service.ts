import { db } from '../../db';
import { users, roles } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../../utils/errors';
import { logAction } from '../system/audit.service';
import { assertRoleBelongsToHotel } from '../../utils/tenant.guard';
import { cache, getRedis } from '../../shared/redis';

// Rate-limit state lives in Redis so it works across instances; falls back to an
// in-memory map only when Redis is unavailable (single-instance dev).
const attemptStore = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function checkRateLimit(key: string) {
    const r = getRedis();
    if (r?.status === 'ready') {
        const n = parseInt((await r.get(`rl:${key}`)) || '0');
        if (n >= MAX_ATTEMPTS) throw new ForbiddenError('Too many failed attempts. Please try again after 15 minutes.');
        return;
    }
    const record = attemptStore.get(key);
    if (record && Date.now() - record.lastAttempt <= ATTEMPT_WINDOW_MS && record.count >= MAX_ATTEMPTS) {
        throw new ForbiddenError('Too many failed attempts. Please try again after 15 minutes.');
    }
}

async function recordFailure(key: string) {
    const r = getRedis();
    if (r?.status === 'ready') {
        const n = await r.incr(`rl:${key}`);
        if (n === 1) await r.expire(`rl:${key}`, Math.ceil(ATTEMPT_WINDOW_MS / 1000));
        return;
    }
    const now = Date.now();
    const record = attemptStore.get(key);
    if (record && now - record.lastAttempt <= ATTEMPT_WINDOW_MS) {
        record.count += 1; record.lastAttempt = now;
    } else {
        attemptStore.set(key, { count: 1, lastAttempt: now });
    }
}

async function clearAttempts(key: string) {
    const r = getRedis();
    if (r?.status === 'ready') { await r.del(`rl:${key}`); return; }
    attemptStore.delete(key);
}

export class IamService {
    private static otpStore = new Map<string, { code: string; expires: number }>();

    /** Re-validate a user for a refresh-token exchange. Throws if gone/inactive. */
    static async refreshSession(userId: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            with: { role: true },
        });
        if (!user || !user.isActive) {
            throw new UnauthorizedError('Account is no longer active');
        }
        return {
            user: { id: user.id, hotelId: user.hotelId, userType: user.userType, fullName: user.fullName, role: user.role, tokenVersion: user.tokenVersion },
            permissions: (user.role?.permissions as string[]) || [],
        };
    }

    /** Invalidate every existing token for a user (log out all devices). */
    static async logoutAllDevices(userId: string) {
        await db.update(users)
            .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
            .where(eq(users.id, userId));
        await cache.del(`authuser:${userId}`);
    }

    static async login(email: string, password: string, ipAddress?: string) {
        const rateKey = ipAddress ? `${email}:${ipAddress}` : email;
        await checkRateLimit(rateKey);

        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
            with: { role: true }
        });

        if (!user || !user.passwordHash) {
            await recordFailure(rateKey);
            throw new UnauthorizedError('Invalid credentials');
        }

        let isMatch = false;
        try {
            isMatch = await Bun.password.verify(password, user.passwordHash);
        } catch {
            await recordFailure(rateKey);
            throw new UnauthorizedError('Invalid credentials');
        }
        if (!isMatch) {
            await recordFailure(rateKey);
            throw new UnauthorizedError('Invalid credentials');
        }

        await clearAttempts(rateKey);

        if (user.userType === 'SUPER_ADMIN') {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 5 * 60 * 1000;

            // Store in Redis (cross-instance) with the in-memory map as fallback.
            const rec = { code: otp, expires };
            await cache.setJSON(`su-otp:${user.id}`, rec, 300);
            IamService.otpStore.set(user.id, rec);

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[SECURITY] Super Admin OTP for ${email}: ${otp}`);
            }

            return {
                require2FA: true,
                userId: user.id,
                message: '2FA verification required. Check your email/logs for OTP.'
            };
        }

        const permissions = user.role?.permissions || [];

        if (user.hotelId) {
            await logAction(
                user.hotelId,
                user.id,
                'USER_LOGIN',
                'USER',
                user.id,
                { email: user.email },
                ipAddress
            );
        }

        return { user, permissions, require2FA: false };
    }

    static async verifyOTP(userId: string, otp: string, ipAddress?: string) {
        // Brute-force guard: a 6-digit OTP must not be guessable in the window.
        const rlKey = `otp:${userId}`;
        await checkRateLimit(rlKey);

        const record = (await cache.getJSON<{ code: string; expires: number }>(`su-otp:${userId}`)) || IamService.otpStore.get(userId);

        if (!record) throw new UnauthorizedError('OTP expired or invalid');
        if (Date.now() > record.expires) {
            await cache.del(`su-otp:${userId}`);
            IamService.otpStore.delete(userId);
            throw new UnauthorizedError('OTP expired');
        }
        if (record.code !== otp) {
            await recordFailure(rlKey);
            throw new UnauthorizedError('Invalid OTP');
        }

        await clearAttempts(rlKey);
        await cache.del(`su-otp:${userId}`);
        IamService.otpStore.delete(userId);

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            with: { role: true }
        });

        if (!user) throw new UnauthorizedError('User not found');

        const permissions = user.role?.permissions || [];

        if (user.hotelId) {
            await logAction(
                user.hotelId,
                user.id,
                'USER_LOGIN',
                'USER',
                user.id,
                { method: '2FA' },
                ipAddress
            );
        }

        return { user, permissions };
    }

    static async register(hotelId: number, data: {
        fullName: string;
        email: string;
        phone: string;
        password: string;
        roleId: number;
    }, requesterId: string, ipAddress?: string) {
        await assertRoleBelongsToHotel(data.roleId, hotelId);

        // HIERARCHY ENFORCEMENT: Creator must have role level <= target role level
        const requester = await db.query.users.findFirst({
            where: eq(users.id, requesterId),
            with: { role: true }
        });
        const targetRole = await db.query.roles.findFirst({
            where: and(eq(roles.id, data.roleId), eq(roles.hotelId, hotelId))
        });
        if (!targetRole) throw new ValidationError('Invalid role selected');
        // Missing requester role → treat as lowest privilege (deny escalation),
        // not a bypass. Optional-chaining must NOT short-circuit the whole guard.
        if ((requester as any)?.userType !== 'SUPER_ADMIN') {
            const reqLevel = (requester as any)?.role?.level ?? Infinity;
            if (targetRole.level < reqLevel) {
                throw new ForbiddenError('You cannot assign a role higher than your own');
            }
        }

        const hashedPassword = await Bun.password.hash(data.password);

        const [newUser] = await db.insert(users).values({
            hotelId,
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            passwordHash: hashedPassword,
            userType: 'HOTEL_STAFF',
            roleId: data.roleId,
            createdBy: requesterId,
            isActive: true
        }).returning();

        if (newUser) {
            await logAction(
                hotelId,
                requesterId,
                'CREATE_USER',
                'USER',
                newUser.id,
                { fullName: data.fullName, email: data.email, roleId: data.roleId },
                ipAddress
            );
        }

        return newUser;
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user || !user.passwordHash) throw new UnauthorizedError();

        const isMatch = await Bun.password.verify(currentPassword, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedError('Incorrect current password');
        }

        const hashedPassword = await Bun.password.hash(newPassword);

        // Bump tokenVersion so other sessions (incl. an attacker's) are evicted.
        const [updated] = await db.update(users)
            .set({
                passwordHash: hashedPassword,
                tokenVersion: sql`${users.tokenVersion} + 1`,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId))
            .returning();

        await cache.del(`authuser:${userId}`);
        return updated;
    }

    static async verifyPassword(userId: string, password: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user || !user.passwordHash) throw new UnauthorizedError();

        const isMatch = await Bun.password.verify(password, user.passwordHash);
        if (!isMatch) throw new UnauthorizedError('Invalid password');

        return true;
    }

    /** Portal guest JWT uses synthetic ids (guest-{roomId}); no users row exists */
    static buildGuestProfile(input: {
        id: string;
        hotelId: number | null;
        roomId?: number;
        permissions: string[];
    }) {
        const roomLabel = input.roomId != null ? `Room ${input.roomId}` : 'Guest';
        return {
            id: input.id,
            hotelId: input.hotelId,
            fullName: `Guest (${roomLabel})`,
            email: '',
            phone: '',
            pin: null as string | null,
            userType: 'GUEST' as const,
            roleId: null as number | null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            role: {
                id: 0,
                hotelId: input.hotelId,
                name: 'Guest',
                permissions: input.permissions,
                createdAt: null as Date | null,
                updatedAt: null as Date | null,
            },
        };
    }

    static async getProfile(userId: string) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            throw new UnauthorizedError();
        }
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            with: { role: true }
        });

        if (!user) throw new UnauthorizedError();
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }

    static async updateProfile(userId: string, data: { fullName: string; phone: string }) {
        const [updatedUser] = await db.update(users)
            .set({
                fullName: data.fullName,
                phone: data.phone,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) throw new UnauthorizedError();

        const { passwordHash, ...safeUser } = updatedUser;
        return safeUser;
    }
}
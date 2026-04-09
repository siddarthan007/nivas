import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '../../utils/errors';
import { logAction } from '../system/audit.service';
import { assertRoleBelongsToHotel } from '../../utils/tenant.guard';

export class IamService {
    private static otpStore = new Map<string, { code: string, expires: number }>();

    static async login(email: string, password: string, ipAddress?: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
            with: { role: true }
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedError('Invalid credentials');
        }

        let isMatch = false;
        try {
            isMatch = await Bun.password.verify(password, user.passwordHash);
        } catch {
            throw new UnauthorizedError('Invalid credentials');
        }
        if (!isMatch) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (user.userType === 'SUPER_ADMIN') {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 5 * 60 * 1000;

            IamService.otpStore.set(user.id, { code: otp, expires });

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
        const record = IamService.otpStore.get(userId);

        if (!record) throw new UnauthorizedError('OTP expired or invalid');
        if (Date.now() > record.expires) {
            IamService.otpStore.delete(userId);
            throw new UnauthorizedError('OTP expired');
        }
        if (record.code !== otp) throw new UnauthorizedError('Invalid OTP');

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

        const hashedPassword = await Bun.password.hash(data.password);

        const [newUser] = await db.insert(users).values({
            hotelId,
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            passwordHash: hashedPassword,
            userType: 'HOTEL_STAFF',
            roleId: data.roleId,
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

        const [updated] = await db.update(users)
            .set({
                passwordHash: hashedPassword,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId))
            .returning();

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
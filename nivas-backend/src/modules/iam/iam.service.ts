import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '../../utils/errors';
import { logAction } from '../system/audit.service';

export class IamService {
    // In-memory OTP store (In production, use Redis)
    private static otpStore = new Map<string, { code: string, expires: number }>();

    static async login(email: string, password: string, ipAddress?: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
            with: { role: true }
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const isMatch = await Bun.password.verify(password, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedError('Invalid credentials');
        }

        // 2FA Challenge for Super Admin
        if (user.userType === 'SUPER_ADMIN') {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 5 * 60 * 1000; // 5 mins

            IamService.otpStore.set(user.id, { code: otp, expires });

            // In a real app, send via Email/SMS. Logging for dev.
            console.log(`[SECURITY] Super Admin OTP for ${email}: ${otp}`);

            return {
                require2FA: true,
                userId: user.id, // minimal info
                message: '2FA verification required. Check your email/logs for OTP.',
                debugOtp: otp
            };
        }

        const permissions = user.role?.permissions || [];

        // Log successful login for non-2FA users
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

        // Consume OTP
        IamService.otpStore.delete(userId);

        // Fetch user to return full login session
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            with: { role: true }
        });

        if (!user) throw new UnauthorizedError('User not found');

        const permissions = user.role?.permissions || [];

        // Log successful login for 2FA users
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

    static async getProfile(userId: string) {
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

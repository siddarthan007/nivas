import { db } from '../../db';
import { users } from '../../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

export class UsersService {
    static async getStaff(hotelId: number) {
        const staffList = await db.query.users.findMany({
            where: and(
                eq(users.hotelId, hotelId),
                ne(users.userType, 'GUEST')
            ),
            with: {
                role: true
            }
        });

        return staffList.map(({ passwordHash, ...u }) => u);
    }

    static async updateRole(hotelId: number, userId: string, roleId: number) {
        const [updatedUser] = await db.update(users)
            .set({
                roleId,
                updatedAt: new Date()
            })
            .where(and(
                eq(users.id, userId),
                eq(users.hotelId, hotelId)
            ))
            .returning();

        if (!updatedUser) throw new NotFoundError('User');
        const { passwordHash, ...safeUser } = updatedUser;
        return safeUser;
    }

    static async updateStatus(hotelId: number, userId: string, isActive: boolean) {
        const [updatedUser] = await db.update(users)
            .set({
                isActive,
                updatedAt: new Date()
            })
            .where(and(
                eq(users.id, userId),
                eq(users.hotelId, hotelId)
            ))
            .returning();

        if (!updatedUser) throw new NotFoundError('User');
        return updatedUser;
    }

    static async resetPassword(hotelId: number, userId: string, newPassword: string) {
        const hashedPassword = await Bun.password.hash(newPassword);

        const [updatedUser] = await db.update(users)
            .set({
                passwordHash: hashedPassword,
                updatedAt: new Date()
            })
            .where(and(
                eq(users.id, userId),
                eq(users.hotelId, hotelId)
            ))
            .returning();

        if (!updatedUser) throw new NotFoundError('User');
        return updatedUser;
    }

    static async updateDetails(hotelId: number, userId: string, data: { fullName: string; phone: string }) {
        const [updatedUser] = await db.update(users)
            .set({
                fullName: data.fullName,
                phone: data.phone,
                updatedAt: new Date()
            })
            .where(and(
                eq(users.id, userId),
                eq(users.hotelId, hotelId)
            ))
            .returning();

        if (!updatedUser) throw new NotFoundError('User');
        const { passwordHash, ...safeUser } = updatedUser;
        return safeUser;
    }
}

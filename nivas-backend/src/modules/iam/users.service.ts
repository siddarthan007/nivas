import { db } from '../../db';
import { users, roles } from '../../db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { assertRoleBelongsToHotel } from '../../utils/tenant.guard';
import { cache } from '../../shared/redis';

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

    static async updateRole(hotelId: number, requesterId: string, userId: string, roleId: number) {
        await assertRoleBelongsToHotel(roleId, hotelId);

        // Role-hierarchy guard (lower level = higher privilege; Owner = 0):
        //  - cannot change your own role,
        //  - cannot grant a role higher than your own,
        //  - cannot modify a user who already outranks you.
        const [requester, target, newRole] = await Promise.all([
            db.query.users.findFirst({ where: and(eq(users.id, requesterId), eq(users.hotelId, hotelId)), with: { role: true } }),
            db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.hotelId, hotelId)), with: { role: true } }),
            db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.hotelId, hotelId)) }),
        ]);
        if (!target) throw new NotFoundError('User');
        if (!newRole) throw new ValidationError('Invalid role selected');
        if (requesterId === userId) throw new ForbiddenError('You cannot change your own role');

        const isSuperAdmin = (requester as any)?.userType === 'SUPER_ADMIN';
        if (!isSuperAdmin) {
            const reqLevel = (requester as any)?.role?.level ?? Infinity;
            if (newRole.level < reqLevel) throw new ForbiddenError('You cannot assign a role higher than your own');
            if (((target as any)?.role?.level ?? Infinity) < reqLevel) throw new ForbiddenError('You cannot modify a user above your level');
        }

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
        await cache.del(`authuser:${userId}`); // role changed → drop cached perms
        const { passwordHash, ...safeUser } = updatedUser;
        return safeUser;
    }

    static async updateStatus(hotelId: number, requesterId: string, userId: string, isActive: boolean) {
        if (!isActive) {
            if (requesterId === userId) throw new ForbiddenError('You cannot deactivate your own account');
            // Last-owner guard: never let the hotel lose its only active owner.
            const active = await db.query.users.findMany({
                where: and(eq(users.hotelId, hotelId), eq(users.isActive, true)),
                with: { role: true }, columns: { id: true },
            });
            const owners = active.filter(u => (u as any).role?.level === 0);
            const targetIsOwner = owners.some(u => u.id === userId);
            if (targetIsOwner && owners.length <= 1) throw new ForbiddenError('Cannot deactivate the last active owner');
        }

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
        await cache.del(`authuser:${userId}`); // active flag changed → drop cache (instant deactivate)
        return updatedUser;
    }

    static async resetPassword(hotelId: number, requesterId: string, userId: string, newPassword: string) {
        // Hierarchy: cannot reset the password of someone who outranks you.
        if (requesterId !== userId) {
            const [requester, target] = await Promise.all([
                db.query.users.findFirst({ where: and(eq(users.id, requesterId), eq(users.hotelId, hotelId)), with: { role: true } }),
                db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.hotelId, hotelId)), with: { role: true } }),
            ]);
            if (!target) throw new NotFoundError('User');
            if ((requester as any)?.userType !== 'SUPER_ADMIN') {
                const reqLevel = (requester as any)?.role?.level ?? Infinity;
                if (((target as any)?.role?.level ?? Infinity) < reqLevel) throw new ForbiddenError('You cannot reset the password of a user above your level');
            }
        }

        const hashedPassword = await Bun.password.hash(newPassword);

        // Bump tokenVersion → invalidates the victim's existing sessions (a reset
        // must log them out everywhere).
        const [updatedUser] = await db.update(users)
            .set({
                passwordHash: hashedPassword,
                tokenVersion: sql`${users.tokenVersion} + 1`,
                updatedAt: new Date()
            })
            .where(and(
                eq(users.id, userId),
                eq(users.hotelId, hotelId)
            ))
            .returning();

        if (!updatedUser) throw new NotFoundError('User');
        await cache.del(`authuser:${userId}`);
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

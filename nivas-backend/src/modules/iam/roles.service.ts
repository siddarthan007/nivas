import { db } from '../../db';
import { roles, users } from '../../db/schema';
import { eq, and, count } from 'drizzle-orm';
import { ConflictError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';

export const RolesService = {
    async getRoles(hotelId: number) {
        return await db.query.roles.findMany({
            where: eq(roles.hotelId, hotelId)
        });
    },

    async createRole(hotelId: number, data: { name: string; permissions: string[] }) {
        const [newRole] = await db.insert(roles).values({
            hotelId,
            name: data.name,
            permissions: data.permissions
        }).returning();
        return newRole;
    },

    async updateRole(hotelId: number, roleId: number, data: { name?: string; permissions?: string[] }) {
        const [updatedRole] = await db.update(roles)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(and(
                eq(roles.id, roleId),
                eq(roles.hotelId, hotelId)
            ))
            .returning();
        return updatedRole;
    },

    async deleteRole(hotelId: number, roleId: number) {
        // Check if role is assigned to any users
        const [assignment] = await db.select({ count: count() })
            .from(users)
            .where(eq(users.roleId, roleId));

        if (assignment && assignment.count > 0) {
            throw new ConflictError('Cannot delete role because it is assigned to users');
        }

        await db.delete(roles)
            .where(and(
                eq(roles.id, roleId),
                eq(roles.hotelId, hotelId)
            ));
    },

    getPermissions() {
        return PERMISSIONS;
    }
};

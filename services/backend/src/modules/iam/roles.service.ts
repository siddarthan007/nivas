import { db } from '../../db';
import { roles, users } from '../../db/schema';
import { eq, and, count } from 'drizzle-orm';
import { ConflictError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { PERMISSIONS } from '../../config/permissions';
import { validatePermissionStrings } from '../../utils/tenant.guard';
import { cache } from '../../shared/redis';

export const RolesService = {
    async getRoles(hotelId: number) {
        return await db.query.roles.findMany({
            where: eq(roles.hotelId, hotelId)
        });
    },

    /** Guard against minting/elevating roles above the requester's own authority. */
    async assertRoleAuthority(hotelId: number, requesterId: string, newLevel?: number, newPermissions?: string[], existingLevel?: number) {
        const requester = await db.query.users.findFirst({
            where: and(eq(users.id, requesterId), eq(users.hotelId, hotelId)),
            with: { role: true },
        });
        if ((requester as any)?.userType === 'SUPER_ADMIN') return;
        const reqRole: any = (requester as any)?.role;
        const reqLevel = reqRole?.level ?? Infinity;
        const reqPerms: string[] = reqRole?.permissions || [];
        const wildcard = reqPerms.includes('*');

        if (newLevel !== undefined && newLevel < reqLevel) throw new ForbiddenError('You cannot create a role higher than your own');
        if (existingLevel !== undefined && existingLevel < reqLevel) throw new ForbiddenError('You cannot edit a role higher than your own');
        if (newPermissions && !wildcard) {
            const missing = newPermissions.filter(p => !reqPerms.includes(p));
            if (missing.length) throw new ForbiddenError(`You cannot grant permissions you don't hold: ${missing.slice(0, 3).join(', ')}`);
        }
    },

    async createRole(hotelId: number, requesterId: string, data: { name: string; level?: number; permissions: string[] }) {
        validatePermissionStrings(data.permissions);
        const level = data.level ?? 99;
        await this.assertRoleAuthority(hotelId, requesterId, level, data.permissions);

        const [newRole] = await db.insert(roles).values({
            hotelId,
            name: data.name,
            level,
            permissions: data.permissions
        }).returning();
        return newRole;
    },

    async updateRole(hotelId: number, requesterId: string, roleId: number, data: { name?: string; level?: number; permissions?: string[] }) {
        if (data.permissions) {
            validatePermissionStrings(data.permissions);
        }
        const existing = await db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.hotelId, hotelId)) });
        if (!existing) throw new NotFoundError('Role');
        await this.assertRoleAuthority(hotelId, requesterId, data.level, data.permissions, existing.level ?? undefined);

        const updateData: Record<string, any> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.level !== undefined) updateData.level = data.level;
        if (data.permissions !== undefined) updateData.permissions = data.permissions;
        updateData.updatedAt = new Date();

        const [updatedRole] = await db.update(roles)
            .set(updateData)
            .where(and(
                eq(roles.id, roleId),
                eq(roles.hotelId, hotelId)
            ))
            .returning();
        // Permissions changed → drop cached auth for all users (roles change rarely).
        if (data.permissions !== undefined) await cache.delByPrefix('authuser:');
        return updatedRole;
    },

    async deleteRole(hotelId: number, roleId: number) {
        // Verify role belongs to this hotel before checking assignments
        const role = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), eq(roles.hotelId, hotelId))
        });
        if (!role) throw new NotFoundError('Role');

        // Check if role is assigned to any users in this hotel
        const [assignment] = await db.select({ count: count() })
            .from(users)
            .where(and(eq(users.roleId, roleId), eq(users.hotelId, hotelId)));

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

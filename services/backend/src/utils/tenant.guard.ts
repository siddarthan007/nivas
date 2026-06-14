import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { ForbiddenError, NotFoundError } from './errors';
import { roles } from '../db/schema';
import { PERMISSIONS } from '../config/permissions';

/**
 * Fetch a record by ID and verify it belongs to the given hotel.
 * Throws NotFoundError if the record doesn't exist,
 * ForbiddenError if it belongs to a different tenant.
 */
export async function assertTenantOwnership<T extends { hotelId: number | null }>(
    queryFn: () => Promise<T | undefined>,
    hotelId: number,
    resource: string
): Promise<T> {
    const record = await queryFn();
    if (!record) throw new NotFoundError(resource);
    if (record.hotelId !== hotelId) {
        throw new ForbiddenError('Access denied: resource belongs to a different tenant');
    }
    return record;
}

/**
 * Validate that a role belongs to the specified hotel before assignment.
 */
export async function assertRoleBelongsToHotel(roleId: number, hotelId: number): Promise<void> {
    const role = await db.query.roles.findFirst({
        where: and(eq(roles.id, roleId), eq(roles.hotelId, hotelId))
    });
    if (!role) {
        throw new ForbiddenError('Role does not belong to this hotel');
    }
}

const PLATFORM_PERMISSION_PREFIXES = ['system:', 'saas:'];

/**
 * Collect all valid hotel-scoped permission strings from the PERMISSIONS config.
 * Excludes SYSTEM and SAAS_ADMIN groups which are platform-level only.
 */
function getValidHotelPermissions(): Set<string> {
    const valid = new Set<string>();
    for (const [groupKey, group] of Object.entries(PERMISSIONS)) {
        if (groupKey === 'SYSTEM' || groupKey === 'SAAS_ADMIN') continue;
        for (const value of Object.values(group)) {
            valid.add(value);
        }
    }
    return valid;
}

const VALID_HOTEL_PERMISSIONS = getValidHotelPermissions();

/**
 * Validate that a set of permission strings are all legitimate hotel-scoped permissions.
 * Rejects wildcards, platform-level permissions, and unknown strings.
 */
export function validatePermissionStrings(permissions: string[]): void {
    for (const perm of permissions) {
        if (perm === '*') {
            throw new ForbiddenError('Wildcard permission cannot be assigned via API');
        }
        if (PLATFORM_PERMISSION_PREFIXES.some(prefix => perm.startsWith(prefix))) {
            throw new ForbiddenError(`Platform permission "${perm}" cannot be assigned to hotel roles`);
        }
        if (!VALID_HOTEL_PERMISSIONS.has(perm)) {
            throw new ForbiddenError(`Unknown permission: "${perm}"`);
        }
    }
}

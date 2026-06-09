import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ForbiddenError, ValidationError } from './errors';

/**
 * Step-up re-authentication for important / destructive actions.
 *
 * The acting user must re-enter their current password. Applies to EVERYONE
 * including super-admins (all are rows in `users`). Throws on missing/incorrect
 * password so the controller can simply `await requirePassword(...)` before the op.
 */
export async function requirePassword(userId: string, password?: string): Promise<void> {
    if (!password || !password.trim()) {
        throw new ValidationError('Password confirmation is required for this action');
    }
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { passwordHash: true },
    });
    if (!user?.passwordHash) {
        throw new ForbiddenError('Password verification is unavailable for this account');
    }
    const ok = await Bun.password.verify(password, user.passwordHash);
    if (!ok) {
        throw new ForbiddenError('Incorrect password');
    }
}

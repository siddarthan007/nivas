import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
const EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@nivaspms.com';
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'Siddartha@007#';
async function reset() {
    console.log(`Resetting password for: ${EMAIL}`);
    const hash = await Bun.password.hash(NEW_PASSWORD);
    const [updated] = await db.update(users)
        .set({ passwordHash: hash })
        .where(eq(users.email, EMAIL))
        .returning();
    if (updated) {
        console.log(`Password reset successfully for: ${updated.email}`);
        console.log(`New password: ${NEW_PASSWORD}`);
    } else {
        console.log('User not found!');
    }
    process.exit(0);
}
reset().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
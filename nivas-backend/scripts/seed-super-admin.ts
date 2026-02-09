/**
 * Seed Initial Super Admin User
 * 
 * Usage: bun run scripts/seed-super-admin.ts
 * 
 * Environment variables (from .env):
 *   SUPER_ADMIN_EMAIL - Admin email (default: admin@nivaspms.com)
 *   DATABASE_URL      - PostgreSQL connection string
 * 
 * This script is idempotent — it will not create a duplicate
 * if a super admin with the same email already exists.
 */

import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@nivaspms.com';
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';
const ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';
const ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE || '9800000000';

async function seed() {
    console.log('=== Nivas PMS — Seed Super Admin ===');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log('');

    // Check if already exists
    const existing = await db.query.users.findFirst({
        where: eq(users.email, ADMIN_EMAIL)
    });

    if (existing) {
        console.log(`Super Admin already exists (id: ${existing.id})`);
        if (existing.userType !== 'SUPER_ADMIN') {
            console.log('Updating user type to SUPER_ADMIN...');
            await db.update(users)
                .set({ userType: 'SUPER_ADMIN', isActive: true })
                .where(eq(users.id, existing.id));
            console.log('Updated successfully.');
        } else {
            console.log('No changes needed.');
        }
        process.exit(0);
    }

    // Hash password
    const passwordHash = await Bun.password.hash(ADMIN_PASSWORD);

    // Create super admin
    const [admin] = await db.insert(users).values({
        fullName: ADMIN_NAME,
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        passwordHash,
        userType: 'SUPER_ADMIN',
        isActive: true,
    }).returning();

    console.log('');
    console.log('Super Admin created successfully!');
    console.log(`  ID:    ${admin?.id}`);
    console.log(`  Email: ${admin?.email}`);
    console.log(`  Phone: ${admin?.phone}`);
    console.log('');
    console.log(`Login with: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log('(Change the password after first login)');

    process.exit(0);
}

seed().catch(err => {
    console.error('Failed to seed super admin:', err);
    process.exit(1);
});

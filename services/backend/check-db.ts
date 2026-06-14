import { db } from './src/db/index.js';
import { orders } from './src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function check() {
    try {
        const allOrders = await db.select().from(orders);
        console.log(`Total orders in DB: ${allOrders.length}`);
        
        const active = await db.select().from(orders).where(inArray(orders.status, ['PENDING', 'PREPARING', 'READY']));
        console.log(`Active orders in DB: ${active.length}`);
        
        const specific = await db.select().from(orders).where(eq(orders.id, '18a8c6a1-6422-44f0-9286-001618e2375f'));
        console.log(`Specific order found: ${specific.length > 0}`);
        if (specific.length > 0) {
            console.log('Status of specific:', specific[0].status);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();

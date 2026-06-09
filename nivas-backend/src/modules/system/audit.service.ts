import { db } from '../../db';
import { auditLogs } from '../../db/schema';
import { eq, desc, lt } from 'drizzle-orm';

export class AuditService {
    static async log(
        hotelId: number,
        userId: string | null,
        action: string,
        entity: string,
        entityId: string | undefined,
        details: any,
        ipAddress?: string
    ) {
        try {
            await db.insert(auditLogs).values({
                hotelId,
                userId,
                action,
                entity,
                entityId,
                details: JSON.stringify(details),
                ipAddress
            });
        } catch (e) {
            console.error('Failed to create audit log', e);
        }
    }

    static async getLogs(hotelId: number | undefined, limit: number = 100) {
        // If hotelId is undefined (Super Admin), return all logs
        const whereClause = hotelId !== undefined ? eq(auditLogs.hotelId, hotelId) : undefined;

        return await db.query.auditLogs.findMany({
            where: whereClause,
            with: {
                user: {
                    columns: { fullName: true, roleId: true }
                }
            },
            orderBy: [desc(auditLogs.createdAt)],
            limit
        });
    }

    /** Delete audit rows older than the retention window (bounds unbounded growth + PII). */
    static async pruneOldLogs(retentionDays: number = 180) {
        const cutoff = new Date(Date.now() - retentionDays * 86400000);
        await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff));
    }
}

// Backward compatibility helper
export const logAction = AuditService.log;
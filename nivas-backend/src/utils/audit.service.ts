import { db } from '../db';
import { auditLogs } from '../db/schema';

/**
 * Centralized Audit Service
 * Logs all critical operations with before/after change tracking
 */
export const AuditService = {
    /**
     * Log an action
     */
    async log(params: {
        hotelId: number;
        userId?: string;
        action: string;
        entity: string;
        entityId?: string;
        details?: Record<string, unknown>;
        ipAddress?: string;
    }) {
        try {
            await db.insert(auditLogs).values({
                hotelId: params.hotelId,
                userId: params.userId,
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                details: params.details,
                ipAddress: params.ipAddress
            });
        } catch (error) {
            console.error('[Audit] Failed to log:', error);
        }
    },

    /**
     * Log entity creation
     */
    async logCreate(params: {
        hotelId: number;
        userId?: string;
        entity: string;
        entityId: string;
        data?: Record<string, unknown>;
        ipAddress?: string;
    }) {
        await this.log({
            hotelId: params.hotelId,
            userId: params.userId,
            action: 'CREATE',
            entity: params.entity,
            entityId: params.entityId,
            details: params.data, // Store data in details if needed, or just omit
            ipAddress: params.ipAddress
        });
    },

    /**
     * Log entity update (simplified)
     */
    async logUpdate(params: {
        hotelId: number;
        userId?: string;
        entity: string;
        entityId: string;
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        ipAddress?: string;
    }) {
        const changedFields = params.before && params.after
            ? Object.keys(this.computeDiff(params.before, params.after))
            : [];

        if (changedFields.length === 0 && params.before && params.after) return; // Skip if no changes detected and we checked

        await this.log({
            hotelId: params.hotelId,
            userId: params.userId,
            action: 'UPDATE',
            entity: params.entity,
            entityId: params.entityId,
            details: { changedFields: changedFields.length > 0 ? changedFields : undefined },
            ipAddress: params.ipAddress
        });
    },

    /**
     * Log entity deletion
     */
    async logDelete(params: {
        hotelId: number;
        userId?: string;
        entity: string;
        entityId: string;
        data?: Record<string, unknown>;
        ipAddress?: string;
    }) {
        await this.log({
            hotelId: params.hotelId,
            userId: params.userId,
            action: 'DELETE',
            entity: params.entity,
            entityId: params.entityId,
            details: { deletedData: params.data }, // specific key for deleted data context
            ipAddress: params.ipAddress
        });
    },

    /**
     * Compute keys that changed (lighter version)
     */
    computeDiff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, boolean> {
        const diff: Record<string, boolean> = {};

        for (const key of Object.keys(after)) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
                diff[key] = true;
            }
        }

        return diff;
    }
};

/** Validate merge sources before hitting the database. */
export function validateMergeSources(
    targetId: string,
    sourceIds: string[],
): { ok: true } | { ok: false; reason: string } {
    if (!sourceIds.length) return { ok: false, reason: 'Provide at least one order to merge' };
    const unique = [...new Set(sourceIds.map(String))];
    if (unique.includes(String(targetId))) {
        return { ok: false, reason: 'Cannot merge an order into itself' };
    }
    if (unique.length !== sourceIds.length) {
        return { ok: false, reason: 'Duplicate source orders in merge request' };
    }
    return { ok: true };
}

export const OPEN_ORDER_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY']);

export function canMergeOrderStatus(status: string): boolean {
    return OPEN_ORDER_STATUSES.has(status);
}

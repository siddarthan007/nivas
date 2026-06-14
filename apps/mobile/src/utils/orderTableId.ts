/** API orders use restaurantTableId; some clients expect tableId. */
export function getOrderTableId(order: { restaurantTableId?: number | null; tableId?: number | null }): number | null {
    const id = order.restaurantTableId ?? order.tableId;
    return id != null ? Number(id) : null;
}

export function orderMatchesTable(
    order: { restaurantTableId?: number | null; tableId?: number | null },
    tableId: string | number,
): boolean {
    const oid = getOrderTableId(order);
    return oid != null && String(oid) === String(tableId);
}

export function tableQrPayload(tableId: number | string): string {
    return `nivas://table/${tableId}`;
}

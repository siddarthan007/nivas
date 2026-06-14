import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

/**
 * Generic client-side table sorting. Pass the row array and an optional initial
 * sort field; get back the sorted rows plus a `toggleSort(field)` handler for
 * clickable headers. Numbers sort numerically, strings use locale+numeric
 * comparison, nullish values sort last. Field can be a key or a custom accessor
 * keyed by an arbitrary string via `accessors`.
 */
export function useTableSort<T>(
    data: T[],
    initialField?: string,
    initialDir: SortDir = 'asc',
    accessors?: Record<string, (row: T) => unknown>
) {
    const [sortField, setSortField] = useState<string | null>(initialField ?? null);
    const [sortDir, setSortDir] = useState<SortDir>(initialDir);

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const sorted = useMemo(() => {
        if (!sortField) return data;
        const getVal = (row: T): unknown =>
            accessors?.[sortField] ? accessors[sortField]!(row) : (row as Record<string, unknown>)[sortField];
        const arr = [...data];
        arr.sort((a, b) => {
            const av = getVal(a);
            const bv = getVal(b);
            let cmp: number;
            if (av == null && bv == null) cmp = 0;
            else if (av == null) cmp = 1;
            else if (bv == null) cmp = -1;
            else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
            else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return arr;
    }, [data, sortField, sortDir, accessors]);

    return { sorted, sortField, sortDir, toggleSort };
}

'use client';

import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import type { SortDir } from '@/lib/hooks/useTableSort';

/**
 * Clickable sortable table header cell. Pairs with useTableSort: pass the
 * column's `field`, the current `sortField`/`sortDir`, and the `onSort` toggle.
 */
export default function SortableTh({
    field,
    label,
    sortField,
    sortDir,
    onSort,
    align = 'left',
    style,
}: {
    field: string;
    label: string;
    sortField: string | null;
    sortDir: SortDir;
    onSort: (field: string) => void;
    align?: 'left' | 'right' | 'center';
    style?: React.CSSProperties;
}) {
    const active = sortField === field;
    return (
        <th
            onClick={() => onSort(field)}
            style={{ padding: '12px 16px', textAlign: align, fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
        >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
                {label}
                {active
                    ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                    : <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />}
            </span>
        </th>
    );
}

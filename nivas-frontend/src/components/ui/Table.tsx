'use client';

import { useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
    key: keyof T | string;
    header: string;
    sortable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render?: (value: any, row: T, index: number) => ReactNode;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
}

function getNestedValue<T>(obj: T, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (acc && typeof acc === 'object' && key in acc) return (acc as any)[key];
        return undefined;
    }, obj);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Table<T>({ columns, data }: TableProps<T>) {
    // Notion tables are very clean, minimal borders, hover row effects

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
                textAlign: 'left'
            }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                        {columns.map((col) => (
                            <th
                                key={String(col.key)}
                                style={{
                                    padding: '10px 12px',
                                    color: 'var(--notion-text-secondary)',
                                    fontWeight: '500',
                                    fontSize: '12px',
                                    width: col.width,
                                    textAlign: col.align
                                }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr
                            key={i}
                            className="hover-bg"
                            style={{ borderBottom: '1px solid var(--notion-divider)' }}
                        >
                            {columns.map((col) => {
                                const val = getNestedValue(row, String(col.key));
                                return (
                                    <td
                                        key={String(col.key)}
                                        style={{
                                            padding: '8px 12px',
                                            color: 'var(--notion-text)',
                                            textAlign: col.align
                                        }}
                                    >
                                        {col.render ? col.render(val, row, i) : String(val ?? '')}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Table;
export type { Column, TableProps };
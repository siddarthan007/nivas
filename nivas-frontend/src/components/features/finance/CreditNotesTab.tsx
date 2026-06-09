'use client';

import { useState, useMemo } from 'react';
import { XCircle, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { CreditNote } from '@/lib/hooks/useFinance';

type SortField = 'date' | 'amount' | 'number';
type SortDir = 'asc' | 'desc';

interface CreditNotesTabProps {
    creditNotes: CreditNote[];
    isLoading: boolean;
}

export default function CreditNotesTab({ creditNotes, isLoading }: CreditNotesTabProps) {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const filtered = useMemo(() => {
        let data = [...creditNotes];

        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(cn =>
                cn.creditNoteNumber.toLowerCase().includes(q) ||
                (cn.reason || '').toLowerCase().includes(q) ||
                (cn.originalInvoice?.invoiceNumber || '').toLowerCase().includes(q)
            );
        }

        data.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            else if (sortField === 'amount') cmp = (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
            else if (sortField === 'number') cmp = a.creditNoteNumber.localeCompare(b.creditNoteNumber);
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return data;
    }, [creditNotes, search, sortField, sortDir]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
        return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    if (isLoading) return <SkeletonList items={6} />;

    if (creditNotes.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                <XCircle size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: 'var(--space-2)' }}>No credit notes</p>
                <p style={{ fontSize: '13px' }}>Credit notes are created when invoices are voided. Go to the Invoices tab to void an invoice.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search credit notes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '7px 10px 7px 32px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)', fontSize: '13px', outline: 'none',
                        }}
                    />
                </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                {filtered.length} of {creditNotes.length} credit notes
                {filtered.length > 0 && (
                    <span style={{ marginLeft: '12px', fontWeight: 600 }}>
                        Total: NPR {filtered.reduce((s, cn) => s + (parseFloat(cn.amount) || 0), 0).toLocaleString()}
                    </span>
                )}
            </div>

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                    No credit notes match your search
                </div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('number')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        CN # <SortIcon field="number" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Original Invoice</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('amount')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 'auto' }}>
                                        Amount <SortIcon field="amount" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('date')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Date <SortIcon field="date" />
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(cn => (
                                <tr key={cn.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--notion-text)' }}>{cn.creditNoteNumber}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>{cn.originalInvoice?.invoiceNumber || '—'}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text)', fontSize: '13px' }}>{cn.reason}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-red)' }}>
                                        -NPR {(parseFloat(cn.amount) || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                        {new Date(cn.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

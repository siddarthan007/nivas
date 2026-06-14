'use client';

import { useState, useMemo } from 'react';
import { FileX, Search } from 'lucide-react';
import { SkeletonList } from '@/components/ui/Skeleton';
import DatePicker from '@/components/ui/DatePicker';
import type { CreditNote } from '@/lib/hooks/useFinance';

interface CreditNotesTabProps {
    creditNotes: CreditNote[];
    isLoading: boolean;
}

export default function CreditNotesTab({ creditNotes, isLoading }: CreditNotesTabProps) {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filtered = useMemo(() => {
        let data = [...creditNotes];
        const q = search.trim().toLowerCase();
        if (q) {
            data = data.filter(cn =>
                cn.creditNoteNumber?.toLowerCase().includes(q) ||
                cn.reason?.toLowerCase().includes(q) ||
                cn.originalInvoice?.invoiceNumber?.toLowerCase().includes(q) ||
                cn.originalInvoice?.guestName?.toLowerCase().includes(q)
            );
        }
        if (dateFrom) data = data.filter(cn => cn.createdAt >= dateFrom);
        if (dateTo) data = data.filter(cn => cn.createdAt <= dateTo + 'T23:59:59');
        return data;
    }, [creditNotes, search, dateFrom, dateTo]);

    if (isLoading) return <SkeletonList items={5} />;

    return (
        <div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search credit notes..."
                        style={{
                            width: '100%', padding: '8px 12px 8px 34px',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                            backgroundColor: 'var(--notion-bg-secondary)', fontSize: '13px',
                        }}
                    />
                </div>
                <DatePicker
                    selected={dateFrom ? new Date(dateFrom) : null}
                    onChange={(date) => setDateFrom(date ? date.toISOString().split('T')[0] || '' : '')}
                    placeholder="From"
                    dateFormat="yyyy-MM-dd"
                    fullWidth={false}
                />
                <DatePicker
                    selected={dateTo ? new Date(dateTo) : null}
                    onChange={(date) => setDateTo(date ? date.toISOString().split('T')[0] || '' : '')}
                    placeholder="To"
                    dateFormat="yyyy-MM-dd"
                    fullWidth={false}
                />
                {(dateFrom || dateTo) && (
                    <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', cursor: 'pointer', color: 'var(--notion-text-secondary)' }}>Clear dates</button>
                )}
            </div>

            {filtered.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--notion-text-secondary)', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
                    <FileX size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
                    <p>No credit notes found</p>
                </div>
            ) : (
                <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Credit Note</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Invoice</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Guest</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Reason</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>Amount</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(cn => (
                                <tr key={cn.id} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{cn.creditNoteNumber}</td>
                                    <td style={{ padding: '10px 16px' }}>{cn.originalInvoice?.invoiceNumber || '—'}</td>
                                    <td style={{ padding: '10px 16px' }}>{cn.originalInvoice?.guestName || '—'}</td>
                                    <td style={{ padding: '10px 16px', color: 'var(--notion-text-secondary)' }}>{cn.reason}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-red)' }}>
                                        NPR {(parseFloat(cn.amount) || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
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

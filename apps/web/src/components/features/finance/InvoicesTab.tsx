'use client';

import { useState, useMemo } from 'react';
import { FileText, Search, Eye, ArrowUpDown, ArrowUp, ArrowDown, XCircle, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SkeletonList } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import DatePicker from '@/components/ui/DatePicker';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { Invoice } from '@/lib/hooks/useFinance';

type SortField = 'date' | 'amount' | 'invoiceNumber';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'paid' | 'unpaid' | 'voided';

function InvoiceDetailModal({ invoice, onClose, onVoid }: {
    invoice: Invoice;
    onClose: () => void;
    onVoid: (inv: Invoice) => void;
}) {
    const { can } = usePermissions();
    const subTotal = parseFloat(invoice.subTotal) || 0;
    const serviceCharge = parseFloat(invoice.serviceCharge) || 0;
    const discount = parseFloat(invoice.discountAmount) || 0;
    const vat = parseFloat(invoice.vatAmount) || 0;
    const grandTotal = parseFloat(invoice.grandTotal) || 0;

    const lineItems = [
        { label: 'Room Charges', value: subTotal - (invoice.lineItems?.reduce((s, li) => s + (li.description?.toLowerCase().includes('order') || li.description?.toLowerCase().includes('f&b') ? li.amount : 0), 0) || 0) },
        ...(serviceCharge > 0 ? [{ label: 'Service Charge', value: serviceCharge }] : []),
    ].filter(i => i.value > 0);
    // Append F&B line items from invoice detail if available
    const fbItems = invoice.lineItems?.filter(li =>
        li.description?.toLowerCase().includes('order') ||
        li.description?.toLowerCase().includes('f&b')
    ) || [];
    fbItems.forEach(fb => lineItems.push({ label: fb.description, value: fb.amount }));

    return (
        <Modal isOpen={!!invoice} onClose={onClose} title={`Invoice ${invoice.invoiceNumber}`} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                            {invoice.booking?.guestName || invoice.guestName}
                        </div>
                        {invoice.booking?.room?.number && (
                            <div style={{ fontSize: '13px', color: 'var(--notion-text)', marginTop: '2px', fontWeight: 500 }}>
                                Room: {invoice.booking.room.number}
                            </div>
                        )}
                        <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)', marginTop: '2px' }}>
                            {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                            &nbsp;&middot;&nbsp; FY {invoice.fiscalYear}
                        </div>
                        {(invoice.guestPan || invoice.guestPhone || invoice.guestEmail || invoice.checkIn || invoice.checkOut) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--notion-text-muted)', marginTop: '4px' }}>
                                {invoice.guestPan && <span>PAN: {invoice.guestPan}</span>}
                                {invoice.guestPhone && <span>Phone: {invoice.guestPhone}</span>}
                                {invoice.guestEmail && <span>Email: {invoice.guestEmail}</span>}
                                {invoice.checkIn && <span>Check-in: {new Date(invoice.checkIn).toLocaleDateString()}</span>}
                                {invoice.checkOut && <span>Check-out: {new Date(invoice.checkOut).toLocaleDateString()}</span>}
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        {invoice.isVoided ? (
                            <span style={{
                                fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--notion-red-bg)', color: 'var(--notion-red)', fontWeight: 600,
                            }}>VOIDED</span>
                        ) : invoice.paymentStatus === 'PAID' ? (
                            <span style={{
                                fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--notion-green-bg)', color: 'var(--notion-green)', fontWeight: 600,
                            }}>PAID</span>
                        ) : (
                            <span style={{
                                fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                backgroundColor: 'var(--notion-blue-bg)', color: 'var(--notion-blue)', fontWeight: 600,
                            }}>UNPAID</span>
                        )}
                    </div>
                </div>

                {/* Line Items */}
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>Description</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map(item => (
                                <tr key={item.label} style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>{item.label}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {item.value.toLocaleString()}</td>
                                </tr>
                            ))}
                            {discount > 0 && (
                                <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>Discount</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-green)' }}>-NPR {discount.toLocaleString()}</td>
                                </tr>
                            )}
                            {vat > 0 && (
                                <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>VAT</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {vat.toLocaleString()}</td>
                                </tr>
                            )}
                            <tr style={{ backgroundColor: 'var(--notion-bg-secondary)' }}>
                                <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--notion-text)' }}>Grand Total</td>
                                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '16px', color: 'var(--notion-text)' }}>
                                    NPR {grandTotal.toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="sm" onClick={() => window.open(`/api/v1/invoices/${invoice.id}/pdf`, '_blank')}>
                        <Download size={14} style={{ marginRight: '4px' }} /> Download PDF
                    </Button>
                    {!invoice.isVoided && can('finance:generate_invoice') && (
                        <Button size="sm" variant="ghost" onClick={() => { onClose(); onVoid(invoice); }} style={{ color: 'var(--notion-red)' }}>
                            <XCircle size={14} style={{ marginRight: '4px' }} /> Void Invoice
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

interface InvoicesTabProps {
    invoices: Invoice[];
    isLoading: boolean;
    onVoid: (invoice: Invoice) => void;
}

export default function InvoicesTab({ invoices, isLoading, onVoid }: InvoicesTabProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const filtered = useMemo(() => {
        let data = [...invoices];

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(inv =>
                inv.invoiceNumber.toLowerCase().includes(q) ||
                (inv.guestName || '').toLowerCase().includes(q) ||
                (inv.booking?.guestName || '').toLowerCase().includes(q)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            data = data.filter(inv => {
                if (statusFilter === 'voided') return inv.isVoided;
                if (statusFilter === 'paid') return !inv.isVoided && inv.paymentStatus === 'PAID';
                if (statusFilter === 'unpaid') return !inv.isVoided && inv.paymentStatus !== 'PAID';
                return true;
            });
        }

        if (dateFrom) data = data.filter(inv => inv.createdAt >= dateFrom);
        if (dateTo) data = data.filter(inv => inv.createdAt <= dateTo + 'T23:59:59');

        // Sort
        data.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            else if (sortField === 'amount') cmp = (parseFloat(a.grandTotal) || 0) - (parseFloat(b.grandTotal) || 0);
            else if (sortField === 'invoiceNumber') cmp = a.invoiceNumber.localeCompare(b.invoiceNumber);
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return data;
    }, [invoices, search, statusFilter, sortField, sortDir, dateFrom, dateTo]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
        return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    if (isLoading) return <SkeletonList items={6} />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '7px 10px 7px 32px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)', fontSize: '13px', outline: 'none',
                        }}
                    />
                </div>
                {/* Status filter */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {(['all', 'paid', 'unpaid', 'voided'] as StatusFilter[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            style={{
                                padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                backgroundColor: statusFilter === s ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                                color: statusFilter === s ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                cursor: 'pointer', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize',
                            }}
                        >
                            {s}
                        </button>
                    ))}
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

            {/* Count */}
            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                {filtered.length} of {invoices.length} invoices
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <FileText size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                    <p>No invoices match your filters</p>
                </div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--notion-bg-secondary)', borderBottom: '1px solid var(--notion-border)' }}>
                                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('invoiceNumber')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Invoice # <SortIcon field="invoiceNumber" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Guest</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact / PAN</th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('amount')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 'auto' }}>
                                        Amount <SortIcon field="amount" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--notion-text-secondary)' }}>
                                    <button onClick={() => toggleSort('date')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Date <SortIcon field="date" />
                                    </button>
                                </th>
                                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--notion-text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(inv => (
                                <tr key={inv.id} style={{ borderBottom: '1px solid var(--notion-border)', opacity: inv.isVoided ? 0.55 : 1 }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--notion-text)' }}>{inv.invoiceNumber}</td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text)' }}>
                                        <div>{inv.booking?.guestName || inv.guestName}</div>
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text-secondary)', fontSize: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {inv.guestPhone && <span>{inv.guestPhone}</span>}
                                            {inv.guestPan && <span style={{ fontFamily: 'monospace' }}>PAN: {inv.guestPan}</span>}
                                            {inv.guestEmail && <span>{inv.guestEmail}</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-text)' }}>
                                        NPR {(parseFloat(inv.grandTotal) || 0).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {inv.isVoided ? (
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--notion-red-bg)', color: 'var(--notion-red)', fontWeight: 600 }}>Voided</span>
                                        ) : inv.paymentStatus === 'PAID' ? (
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--notion-green-bg)', color: 'var(--notion-green)', fontWeight: 600 }}>Paid</span>
                                        ) : (
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--notion-blue-bg)', color: 'var(--notion-blue)', fontWeight: 600 }}>Unpaid</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                        {new Date(inv.createdAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setDetailInvoice(inv)}
                                            title="View details"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center' }}
                                            className="hover-bg"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {detailInvoice && (
                <InvoiceDetailModal
                    invoice={detailInvoice}
                    onClose={() => setDetailInvoice(null)}
                    onVoid={onVoid}
                />
            )}
        </div>
    );
}

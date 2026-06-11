'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useProcurement, type PurchaseOrder, type CreatePOPayload, type PurchaseOrderStatus, type Vendor } from '@/lib/hooks/useProcurement';
import { useInventory } from '@/lib/hooks/useInventory';
import type { InventoryItem } from '@/lib/types/api.types';
import {
    ShoppingCart,
    Plus,
    Search,
    Filter,
    Package,
    Truck,
    CheckCircle2,
    Clock,
    XCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    DollarSign,
    AlertCircle,
    Loader2,
    Trash2,
    ThumbsUp,
    ThumbsDown,
    Download,
} from 'lucide-react';
import { exportObjectsToCsv } from '@/lib/utils/export';

import DateField from "@/components/ui/DateField";
const formatCurrency = (amount: number | null | undefined) => `NPR ${(amount || 0).toLocaleString()}`;
const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STATUS_OPTIONS: PurchaseOrderStatus[] = ['DRAFT', 'APPROVED', 'RECEIVED', 'REJECTED', 'CANCELLED'];

const getStatusStyle = (status: PurchaseOrderStatus) => {
    switch (status) {
        case 'DRAFT':
            return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: Clock, label: 'Draft' };
        case 'APPROVED':
            return { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', icon: CheckCircle2, label: 'Approved' };
        case 'RECEIVED':
            return { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', icon: Truck, label: 'Received' };
        case 'REJECTED':
            return { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: ThumbsDown, label: 'Rejected' };
        case 'CANCELLED':
            return { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: XCircle, label: 'Cancelled' };
        default:
            return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: Clock, label: status };
    }
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
    return (
        <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={color} />
            </div>
            <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{value}</div>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{label}</div>
            </div>
        </div>
    );
}

function PORow({ po, onReceive, onCancel, onApprove, onReject, isExpanded, onToggle }: {
    po: PurchaseOrder;
    onReceive: () => void;
    onCancel: () => void;
    onApprove: () => void;
    onReject: () => void;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const statusStyle = getStatusStyle(po.status);
    const StatusIcon = statusStyle.icon;

    return (
        <>
            <tr style={{ cursor: 'pointer', borderTop: '1px solid var(--notion-divider)' }} onClick={onToggle}>
                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {po.poNumber}
                    </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{po.supplier}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500' }}>{formatCurrency(po.totalAmount)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{formatDate(po.createdAt)}</td>
                <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: '600', borderRadius: 'var(--radius-full)', backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                        <StatusIcon size={12} />
                        {statusStyle.label}
                    </span>
                </td>
                <td style={{ padding: '12px 16px' }} onClick={event => event.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {po.status === 'DRAFT' && (
                            <>
                                <Button variant="primary" size="sm" onClick={onApprove}>
                                    <ThumbsUp size={12} style={{ marginRight: '4px' }} />
                                    Approve
                                </Button>
                                <Button variant="ghost" size="sm" onClick={onReject} style={{ color: 'var(--notion-red)' }}>
                                    <ThumbsDown size={12} style={{ marginRight: '4px' }} />
                                    Reject
                                </Button>
                                <Button variant="ghost" size="sm" onClick={onCancel} style={{ color: 'var(--notion-red)' }}>
                                    <Trash2 size={12} style={{ marginRight: '4px' }} />
                                    Cancel
                                </Button>
                            </>
                        )}
                        {po.status === 'APPROVED' && <Button variant="primary" size="sm" onClick={onReceive}>Receive</Button>}
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr>
                    <td colSpan={6} style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Order Items</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Item</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Qty</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Unit Price</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Received</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {po.items.map(item => (
                                    <tr key={item.id} style={{ fontSize: '13px', borderTop: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '8px' }}>{item.itemName}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.quantity}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.receivedQuantity ?? 0}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(item.quantity * item.unitPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {po.notes && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}><strong>Notes:</strong> {po.notes}</div>}
                    </td>
                </tr>
            )}
        </>
    );
}

function TableSkeleton() {
    return (
        <div style={{ padding: '16px' }}>
            {[1, 2, 3, 4].map(index => (
                <div key={index} style={{ height: '52px', backgroundColor: 'var(--notion-bg-secondary)', marginBottom: '8px', borderRadius: 'var(--radius-sm)', animation: 'pulse 2s infinite' }} />
            ))}
        </div>
    );
}

interface POLineItem {
    itemId: number | '';
    itemName?: string;
    quantity: number | undefined;
    unitCost: number | undefined;
}

function SearchableItemSelect({ items, selectedId, onSelect, placeholder }: {
    items: InventoryItem[];
    selectedId: number | '';
    onSelect: (id: number, item: InventoryItem) => void;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const selected = items.find(i => i.id === selectedId);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = useMemo(() => {
        if (!query.trim()) return items.slice(0, 50);
        const q = query.toLowerCase();
        return items.filter(i => i.name.toLowerCase().includes(q)).slice(0, 50);
    }, [items, query]);

    return (
        <div ref={containerRef} style={{ position: 'relative', flex: 2 }}>
            <div
                onClick={() => setOpen(!open)}
                style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    color: selected ? 'var(--notion-text)' : 'var(--notion-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <span>{selected ? selected.name : (placeholder || 'Select item')}</span>
                <ChevronDown size={14} style={{ color: 'var(--notion-text-secondary)' }} />
            </div>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    maxHeight: '260px',
                    overflowY: 'auto',
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--notion-border)' }}>
                        <Input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search items..."
                            icon={<Search size={14} />}
                        />
                    </div>
                    {filtered.length === 0 && (
                        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>No items found</div>
                    )}
                    {filtered.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => { onSelect(item.id, item); setOpen(false); setQuery(''); }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                background: selectedId === item.id ? 'var(--notion-blue-bg)' : 'none',
                                border: 'none',
                                borderBottom: '1px solid var(--notion-border)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: 'var(--notion-text)',
                            }}
                        >
                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Stock: {item.currentStock ?? 0} | Cost: NPR {item.costPrice ?? 0}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Vendor picker: select a registered vendor, reuse the typed text as an ad-hoc
// supplier, or create a new vendor inline — so POs link to consistent suppliers.
function VendorCombobox({ vendors, value, selectedVendorId, onChange, onCreateVendor }: {
    vendors: Vendor[];
    value: string;
    selectedVendorId?: number;
    onChange: (name: string, vendorId?: number) => void;
    onCreateVendor: (name: string) => Promise<Vendor | null>;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const q = query.trim().toLowerCase();
    const filtered = useMemo(
        () => (!q ? vendors.slice(0, 50) : vendors.filter(v => v.name.toLowerCase().includes(q)).slice(0, 50)),
        [vendors, q]
    );
    const exactMatch = vendors.some(v => v.name.trim().toLowerCase() === q);

    const handleCreate = async () => {
        const name = query.trim();
        if (!name) return;
        setCreating(true);
        const vendor = await onCreateVendor(name);
        setCreating(false);
        if (vendor) {
            onChange(vendor.name, vendor.id);
            setOpen(false);
            setQuery('');
        }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                onClick={() => setOpen(!open)}
                style={{
                    padding: '8px 12px', backgroundColor: 'var(--notion-bg)',
                    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-sm)',
                    fontSize: '14px', color: value ? 'var(--notion-text)' : 'var(--notion-text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
            >
                <span>{value || 'Select or add a vendor'}{selectedVendorId ? '' : value ? ' (ad-hoc)' : ''}</span>
                <ChevronDown size={14} style={{ color: 'var(--notion-text-secondary)' }} />
            </div>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 1000,
                    maxHeight: '280px', overflowY: 'auto',
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--notion-border)' }}>
                        <Input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search or type a vendor name..." icon={<Search size={14} />} />
                    </div>
                    {filtered.map(v => (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => { onChange(v.name, v.id); setOpen(false); setQuery(''); }}
                            style={{
                                width: '100%', textAlign: 'left', padding: '8px 12px',
                                background: selectedVendorId === v.id ? 'var(--notion-blue-bg)' : 'none',
                                border: 'none', borderBottom: '1px solid var(--notion-border)',
                                cursor: 'pointer', fontSize: '13px', color: 'var(--notion-text)',
                            }}
                        >
                            <div style={{ fontWeight: 500 }}>{v.name}</div>
                            {v.paymentTerms && <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Terms: {v.paymentTerms}</div>}
                        </button>
                    ))}
                    {query.trim() && !exactMatch && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <button
                                type="button"
                                onClick={() => { onChange(query.trim(), undefined); setOpen(false); }}
                                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--notion-border)', cursor: 'pointer', fontSize: '13px', color: 'var(--notion-text)' }}
                            >
                                Use “{query.trim()}” as supplier
                            </button>
                            <button
                                type="button"
                                disabled={creating}
                                onClick={handleCreate}
                                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--notion-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Plus size={13} /> {creating ? 'Adding…' : `Add new vendor “${query.trim()}”`}
                            </button>
                        </div>
                    )}
                    {filtered.length === 0 && !query.trim() && (
                        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--notion-text-secondary)', textAlign: 'center' }}>No vendors yet — type a name to add one</div>
                    )}
                </div>
            )}
        </div>
    );
}

function CreatePOModal({ isOpen, onClose, onSubmit, inventoryItems, vendors, onCreateVendor }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: CreatePOPayload) => Promise<boolean>;
    inventoryItems: InventoryItem[];
    vendors: Vendor[];
    onCreateVendor: (name: string) => Promise<Vendor | null>;
}) {
    const [supplier, setSupplier] = useState('');
    const [vendorId, setVendorId] = useState<number | undefined>(undefined);
    const [notes, setNotes] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [items, setItems] = useState<POLineItem[]>([{ itemId: '', quantity: 1, unitCost: 0 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddItem = () => setItems(current => [...current, { itemId: '', quantity: 1, unitCost: 0 }]);

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const handleSelectItem = (index: number, itemId: number, item: InventoryItem) => {
        setItems(current => current.map((it, i) => (
            i === index ? { ...it, itemId, itemName: item.name, unitCost: item.costPrice || it.unitCost } : it
        )));
    };

    const handleUpdateItem = (index: number, field: 'quantity' | 'unitCost', value: number | undefined) => {
        setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((sum, item) => sum + ((item.quantity ?? 0) * (item.unitCost ?? 0)), 0);
    const isValid = supplier.trim() && items.every(item => item.itemId !== '' && (item.quantity ?? 0) > 0 && (item.unitCost ?? 0) >= 0);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!isValid) return;
        setIsSubmitting(true);
        const success = await onSubmit({
            supplierName: supplier.trim(),
            vendorId,
            items: items.map(item => ({
                itemId: Number(item.itemId),
                quantity: item.quantity ?? 0,
                unitCost: item.unitCost ?? 0,
            })),
            notes: notes.trim() || undefined,
            expectedDelivery: expectedDate || undefined,
        });
        setIsSubmitting(false);
        if (success) {
            setSupplier('');
            setVendorId(undefined);
            setNotes('');
            setExpectedDate('');
            setItems([{ itemId: '', quantity: 1, unitCost: 0 }]);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Purchase Order" size="lg">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Supplier / Vendor *</label>
                    <VendorCombobox
                        vendors={vendors}
                        value={supplier}
                        selectedVendorId={vendorId}
                        onChange={(name, id) => { setSupplier(name); setVendorId(id); }}
                        onCreateVendor={onCreateVendor}
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Expected Delivery</label>
                        <DateField value={expectedDate} onChange={setExpectedDate} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Notes</label>
                        <Input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional notes" />
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text)' }}>Order Items</label>
                        <Button type="button" variant="ghost" size="sm" onClick={handleAddItem}><Plus size={12} style={{ marginRight: '4px' }} />Add Item</Button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {items.map((item, index) => (
                            <div key={index} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-2)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)' }}>
                                <SearchableItemSelect
                                    items={inventoryItems}
                                    selectedId={item.itemId}
                                    onSelect={(id, itm) => handleSelectItem(index, id, itm)}
                                    placeholder="Select inventory item"
                                />
                                <Input type="number" min={1} value={item.quantity ?? ''} onChange={event => handleUpdateItem(index, 'quantity', event.target.value === '' ? undefined : parseInt(event.target.value, 10))} placeholder="Qty" style={{ flex: 0.7 }} required />
                                <Input type="number" min={0} step="0.01" value={item.unitCost ?? ''} onChange={event => handleUpdateItem(index, 'unitCost', event.target.value === '' ? undefined : parseFloat(event.target.value))} placeholder="Unit cost" style={{ flex: 1 }} required />
                                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)', minWidth: '90px', textAlign: 'right' }}>{formatCurrency((item.quantity ?? 0) * (item.unitCost ?? 0))}</div>
                                {items.length > 1 && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} style={{ color: 'var(--notion-red)', padding: '4px' }}>
                                        <XCircle size={14} />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ textAlign: 'right', marginTop: 'var(--space-3)', fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>Total: {formatCurrency(totalAmount)}</div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !isValid} style={{ flex: 1 }}>{isSubmitting ? 'Creating...' : 'Create PO'}</Button>
                </div>
            </form>
        </Modal>
    );
}

export default function ProcurementPage() {
    const { purchaseOrders, vendors, stats, isLoading, error, refresh, createPO, createVendor, approvePO, rejectPO, receivePO, cancelPO } = useProcurement();
    const { items: inventoryItems } = useInventory();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | PurchaseOrderStatus>('ALL');
    const [sortField, setSortField] = useState<'poNumber' | 'supplier' | 'totalAmount' | 'createdAt' | 'status'>('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const filteredPOs = useMemo(() => {
        let data = purchaseOrders.filter(po => {
            const matchesSearch = po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) || po.supplier.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'ALL' || po.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
        data.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'poNumber') cmp = a.poNumber.localeCompare(b.poNumber);
            else if (sortField === 'supplier') cmp = a.supplier.localeCompare(b.supplier);
            else if (sortField === 'totalAmount') cmp = a.totalAmount - b.totalAmount;
            else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
            else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [purchaseOrders, searchQuery, filterStatus, sortField, sortDir]);

    const runAction = async (poId: number, action: (id: number) => Promise<boolean>) => {
        setProcessingId(poId);
        await action(poId);
        setProcessingId(null);
    };

    const handleExport = () => {
        if (filteredPOs.length === 0) return;
        exportObjectsToCsv('purchase-orders.csv', [
            { header: 'PO Number', value: po => po.poNumber },
            { header: 'Supplier', value: po => po.supplier },
            { header: 'Status', value: po => po.status },
            { header: 'Items', value: po => po.items.length },
            { header: 'Total', value: po => po.totalAmount.toFixed(2) },
            { header: 'Created', value: po => new Date(po.createdAt).toLocaleDateString() },
        ], filteredPOs);
    };

    return (
        <>
                <div style={{ padding: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <ShoppingCart size={24} />
                                Procurement
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>Manage purchase orders and stock receipts</p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button variant="secondary" onClick={refresh} disabled={isLoading} icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}>Refresh</Button>
                            <Button variant="secondary" onClick={handleExport} disabled={filteredPOs.length === 0} icon={<Download size={16} />}>Export</Button>
                            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setIsCreateModalOpen(true)} disabled={inventoryItems.length === 0}>New PO</Button>
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-red-bg)', borderRadius: 'var(--radius-md)', color: 'var(--notion-red)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <StatCard label="Total Orders" value={stats.total} icon={Package} color="var(--notion-blue)" />
                        <StatCard label="Drafts" value={stats.drafts} icon={Clock} color="var(--notion-yellow)" />
                        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} color="var(--notion-blue)" />
                        <StatCard label="Received" value={stats.received} icon={Truck} color="var(--notion-green)" />
                        <StatCard label="Total Value" value={formatCurrency(stats.totalValue)} icon={DollarSign} color="var(--notion-text)" />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                            <Input
                                type="text"
                                placeholder="Search PO# or supplier..."
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                icon={<Search size={16} />}
                            />
                        </div>

                        <div style={{ position: 'relative' }}>
                            <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                            <Select
                                value={filterStatus}
                                onChange={event => setFilterStatus(event.target.value as 'ALL' | PurchaseOrderStatus)}
                                options={[
                                    { value: 'ALL', label: 'All Status' },
                                    ...STATUS_OPTIONS.map(status => ({ value: status, label: status })),
                                ]}
                            />
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--notion-bg-secondary)' }}>
                                    {([
                                        { key: 'poNumber', label: 'PO #' },
                                        { key: 'supplier', label: 'Supplier' },
                                        { key: 'totalAmount', label: 'Total' },
                                        { key: 'createdAt', label: 'Created' },
                                        { key: 'status', label: 'Status' },
                                    ] as { key: typeof sortField; label: string }[]).map(col => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                color: 'var(--notion-text-secondary)',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {col.label}
                                                {sortField === col.key && (
                                                    sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={6}><TableSkeleton /></td></tr>
                                ) : filteredPOs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                            <Package size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                            <div>No purchase orders found</div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPOs.map(po => (
                                        <PORow
                                            key={po.id}
                                            po={po}
                                            isExpanded={expandedId === po.id}
                                            onToggle={() => setExpandedId(expandedId === po.id ? null : po.id)}
                                            onApprove={() => runAction(po.id, approvePO)}
                                            onReject={() => runAction(po.id, rejectPO)}
                                            onReceive={() => runAction(po.id, receivePO)}
                                            onCancel={() => runAction(po.id, cancelPO)}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {processingId !== null && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Processing PO #{processingId}...</div>}
                    {inventoryItems.length === 0 && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Add inventory items before creating a purchase order.</div>}
                </div>
            <CreatePOModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={createPO} inventoryItems={inventoryItems} vendors={vendors} onCreateVendor={createVendor} />
        </>
    );
}

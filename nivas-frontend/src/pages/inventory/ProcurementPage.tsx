'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useProcurement, type PurchaseOrder } from '@/lib/hooks/useProcurement';
import type { CreatePOPayload } from '@/lib/hooks/useProcurement';
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
} from 'lucide-react';

// Status helpers
const getStatusStyle = (status: string) => {
    switch (status) {
        case 'DRAFT': return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: Clock };
        case 'PENDING': return { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-yellow)', icon: Clock };
        case 'APPROVED': return { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', icon: CheckCircle2 };
        case 'ORDERED': return { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', icon: ShoppingCart };
        case 'IN_TRANSIT': return { bg: 'var(--notion-purple-bg)', text: 'var(--notion-purple)', icon: Truck };
        case 'RECEIVED': return { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', icon: CheckCircle2 };
        case 'CANCELLED': return { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: XCircle };
        default: return { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: Clock };
    }
};

const formatCurrency = (amount: number | null | undefined) => `₹${(amount || 0).toLocaleString()}`;
const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Stat card
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: `${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={20} color={color} />
            </div>
            <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{value}</div>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{label}</div>
            </div>
        </div>
    );
}

// PO Row
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
            <tr
                style={{ cursor: 'pointer', borderTop: '1px solid var(--notion-divider)' }}
                onClick={onToggle}
            >
                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {po.poNumber}
                    </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{po.supplier}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{po.items?.length || 0} items</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500' }}>{formatCurrency(po.totalAmount)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                    {po.expectedDate ? formatDate(po.expectedDate) : '-'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text
                    }}>
                        <StatusIcon size={12} />
                        {po.status}
                    </span>
                </td>
                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {po.status === 'PENDING' && (
                            <>
                                <Button variant="primary" size="sm" onClick={onApprove}>
                                    <ThumbsUp size={12} style={{ marginRight: '4px' }} />
                                    Approve
                                </Button>
                                <Button variant="ghost" size="sm" onClick={onReject} style={{ color: 'var(--notion-red)' }}>
                                    <ThumbsDown size={12} style={{ marginRight: '4px' }} />
                                    Reject
                                </Button>
                            </>
                        )}
                        {(po.status === 'IN_TRANSIT' || po.status === 'APPROVED' || po.status === 'ORDERED') && (
                            <Button variant="primary" size="sm" onClick={onReceive}>Receive</Button>
                        )}
                        {['DRAFT', 'PENDING', 'APPROVED'].includes(po.status) && (
                            <Button variant="ghost" size="sm" onClick={onCancel} style={{ color: 'var(--notion-red)' }}>
                                <Trash2 size={12} style={{ marginRight: '4px' }} />
                                Cancel
                            </Button>
                        )}
                    </div>
                </td>
            </tr>
            {isExpanded && po.items && po.items.length > 0 && (
                <tr>
                    <td colSpan={7} style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Order Items</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 8px' }}>Item</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Qty</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Unit Price</th>
                                    <th style={{ textAlign: 'right', padding: '4px 8px' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {po.items.map(item => (
                                    <tr key={item.id} style={{ fontSize: '13px', borderTop: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '8px' }}>{item.itemName}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.quantity}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '500' }}>{formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {po.notes && (
                            <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                <strong>Notes:</strong> {po.notes}
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

// Loading skeleton
function TableSkeleton() {
    return (
        <div style={{ padding: '16px' }}>
            {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                    height: '52px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    marginBottom: '8px',
                    borderRadius: 'var(--radius-sm)',
                    animation: 'pulse 2s infinite'
                }} />
            ))}
        </div>
    );
}

// Create PO Modal
interface POLineItem {
    itemName: string;
    quantity: number;
    unitPrice: number;
}

function CreatePOModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: CreatePOPayload) => Promise<boolean>;
}) {
    const [supplier, setSupplier] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<POLineItem[]>([{ itemName: '', quantity: 1, unitPrice: 0 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddItem = () => {
        setItems([...items, { itemName: '', quantity: 1, unitPrice: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: keyof POLineItem, value: string | number) => {
        setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const isValid = supplier.trim() && items.every(item => item.itemName.trim() && item.quantity > 0 && item.unitPrice > 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit({
            supplier: supplier.trim(),
            items: items.map((item, i) => ({
                itemId: i + 1,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                itemName: item.itemName,
            } as any)),
            expectedDate: expectedDate || undefined,
            notes: notes || undefined,
        });
        setIsSubmitting(false);
        if (success) {
            setSupplier('');
            setExpectedDate('');
            setNotes('');
            setItems([{ itemName: '', quantity: 1, unitPrice: 0 }]);
            onClose();
        }
    };

    const selectStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid var(--notion-border)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--notion-bg-secondary)',
        color: 'var(--notion-text)',
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Purchase Order" size="lg">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Supplier Name *
                    </label>
                    <Input
                        value={supplier}
                        onChange={e => setSupplier(e.target.value)}
                        placeholder="Enter supplier name"
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Expected Delivery Date
                        </label>
                        <Input
                            type="date"
                            value={expectedDate}
                            onChange={e => setExpectedDate(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                            Notes
                        </label>
                        <Input
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Optional notes"
                        />
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            Order Items
                        </label>
                        <Button type="button" variant="ghost" size="sm" onClick={handleAddItem}>
                            <Plus size={12} style={{ marginRight: '4px' }} />
                            Add Item
                        </Button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {items.map((item, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                gap: 'var(--space-2)',
                                alignItems: 'center',
                                padding: 'var(--space-2)',
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--notion-border)',
                            }}>
                                <Input
                                    value={item.itemName}
                                    onChange={e => handleUpdateItem(index, 'itemName', e.target.value)}
                                    placeholder="Item name"
                                    style={{ flex: 2 }}
                                    required
                                />
                                <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                    placeholder="Qty"
                                    style={{ flex: 0.7 }}
                                    required
                                />
                                <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.unitPrice || ''}
                                    onChange={e => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    placeholder="Unit cost"
                                    style={{ flex: 1 }}
                                    required
                                />
                                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)', minWidth: '70px', textAlign: 'right' }}>
                                    ₹{(item.quantity * item.unitPrice).toLocaleString()}
                                </div>
                                {items.length > 1 && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} style={{ color: 'var(--notion-red)', padding: '4px' }}>
                                        <XCircle size={14} />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ textAlign: 'right', marginTop: 'var(--space-3)', fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        Total: ₹{totalAmount.toLocaleString()}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !isValid} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create PO'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function ProcurementPage() {
    const { purchaseOrders, stats, isLoading, error, refresh, createPO, approvePO, rejectPO, receivePO, cancelPO } = useProcurement();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Filtered POs
    const filteredPOs = useMemo(() => {
        return purchaseOrders.filter(po => {
            const matchesSearch = (po.poNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (po.supplier || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'ALL' || po.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [purchaseOrders, searchQuery, filterStatus]);

    const handleApprove = async (poId: number) => {
        setProcessingId(poId);
        await approvePO(poId);
        setProcessingId(null);
    };

    const handleReject = async (poId: number) => {
        if (confirm('Are you sure you want to reject this purchase order?')) {
            setProcessingId(poId);
            await rejectPO(poId);
            setProcessingId(null);
        }
    };

    const handleReceive = async (poId: number) => {
        setProcessingId(poId);
        await receivePO(poId);
        setProcessingId(null);
    };

    const handleCancel = async (poId: number) => {
        if (confirm('Are you sure you want to cancel this purchase order?')) {
            setProcessingId(poId);
            await cancelPO(poId);
            setProcessingId(null);
        }
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)'
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '24px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)'
                            }}>
                                <ShoppingCart size={24} />
                                Procurement
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage purchase orders and supplier deliveries
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button
                                variant="secondary"
                                onClick={refresh}
                                disabled={isLoading}
                                icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            >
                                Refresh
                            </Button>
                            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
                                New PO
                            </Button>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--notion-red)',
                            marginBottom: 'var(--space-4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)'
                    }}>
                        <StatCard label="Total Orders" value={stats.total} icon={Package} color="var(--notion-blue)" />
                        <StatCard label="Pending" value={stats.pending} icon={Clock} color="var(--notion-yellow)" />
                        <StatCard label="In Transit" value={stats.inTransit} icon={Truck} color="var(--notion-purple)" />
                        <StatCard label="Received" value={stats.received} icon={CheckCircle2} color="var(--notion-green)" />
                        <StatCard label="Total Value" value={formatCurrency(stats.totalValue)} icon={DollarSign} color="var(--notion-text)" />
                    </div>

                    {/* Filters */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-4)',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                            <Search size={16} style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--notion-text-secondary)'
                            }} />
                            <input
                                type="text"
                                placeholder="Search PO# or supplier..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 36px',
                                    fontSize: '14px',
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--notion-bg)',
                                    color: 'var(--notion-text)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ position: 'relative' }}>
                            <Filter size={16} style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--notion-text-secondary)'
                            }} />
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                style={{
                                    padding: '8px 12px 8px 36px',
                                    fontSize: '14px',
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--notion-bg)',
                                    color: 'var(--notion-text)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    paddingRight: '32px'
                                }}
                            >
                                <option value="ALL">All Status</option>
                                <option value="DRAFT">Draft</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="ORDERED">Ordered</option>
                                <option value="IN_TRANSIT">In Transit</option>
                                <option value="RECEIVED">Received</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--notion-bg-secondary)' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>PO #</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Supplier</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Items</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Total</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Expected</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <TableSkeleton />
                                        </td>
                                    </tr>
                                ) : filteredPOs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
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
                                            onApprove={() => handleApprove(po.id)}
                                            onReject={() => handleReject(po.id)}
                                            onReceive={() => handleReceive(po.id)}
                                            onCancel={() => handleCancel(po.id)}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </PageContainer>

            <CreatePOModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={createPO}
            />
        </DashboardLayout>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/lib/hooks/useOrders';
import { usePermissions } from '@/lib/hooks/usePermissions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { usePasswordConfirm } from '@/components/ui/usePasswordConfirm';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
    UtensilsCrossed,
    RefreshCw,
    Plus,
    Clock,
    ChefHat,
    CheckCircle,
    XCircle,
    ArrowRight,
    Trash2,
    Minus,
    Users,
    CreditCard,
    Search,
    Filter,
    Receipt,
    FileText,
    Printer,
    Gift,
    X,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    Edit3,
    Move,
} from 'lucide-react';
import { api } from '@/lib/api';
import DualDate from '@/components/ui/DualDate';
import type { Order, OrderStatus, OrderType, CreateOrderPayload } from '@/lib/types/api.types';
import { toast } from 'sonner';
import RecordPaymentModal from '@/components/features/finance/RecordPaymentModal';
import { GuestSearchInput } from '@/components/features/guests/GuestSearchInput';
import { Skeleton } from '@/components/ui';

// Status configuration
const STATUS_CONFIG: Record<OrderStatus, {
    bg: string;
    text: string;
    label: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    nextStatus?: OrderStatus;
    nextLabel?: string;
}> = {
    PENDING: {
        bg: 'var(--notion-yellow-bg)',
        text: 'var(--notion-orange)',
        label: 'Pending',
        icon: Clock,
        nextStatus: 'PREPARING',
        nextLabel: 'Start Preparing'
    },
    CONFIRMED: {
        bg: 'var(--notion-blue-bg)',
        text: 'var(--notion-blue)',
        label: 'Confirmed',
        icon: CheckCircle,
        nextStatus: 'PREPARING',
        nextLabel: 'Start Preparing'
    },
    PREPARING: {
        bg: 'var(--notion-purple-bg, rgba(154,109,215,0.2))',
        text: 'var(--notion-purple)',
        label: 'Preparing',
        icon: ChefHat,
        nextStatus: 'READY',
        nextLabel: 'Mark Ready'
    },
    READY: {
        bg: 'var(--notion-green-bg)',
        text: 'var(--notion-green)',
        label: 'Ready',
        icon: CheckCircle,
        nextStatus: 'SERVED',
        nextLabel: 'Mark Served'
    },
    SERVED: {
        bg: 'var(--notion-bg-hover)',
        text: 'var(--notion-text-secondary)',
        label: 'Served',
        icon: CheckCircle
    },
    CANCELLED: {
        bg: 'var(--notion-red-bg)',
        text: 'var(--notion-red)',
        label: 'Cancelled',
        icon: XCircle
    },
};

// Order Card Component
function OrderCard({
    order,
    onStatusChange,
    onCancel,
    onRecordPayment,
    onView
}: {
    order: Order;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onCancel?: (orderId: string) => void;
    onRecordPayment?: (order: Order) => void;
    onView?: (order: Order) => void;
}) {
    const { can } = usePermissions();
    const config = STATUS_CONFIG[order.status];
    const StatusIcon = config.icon;
    const createdAt = new Date(order.createdAt);
    const timeAgo = getTimeAgo(createdAt);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            borderLeft: `4px solid ${config.text}`,
            transition: 'transform 150ms ease, box-shadow 150ms ease',
            cursor: onView ? 'pointer' : 'default',
        }}
            onClick={() => onView?.(order)}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-3)'
            }}>
                <div>
                    <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                    }}>
                        #{order.orderNumber.includes('-') && order.orderNumber.length > 15 ? order.orderNumber.split('-').pop() : order.orderNumber}
                    </div>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-secondary)',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}>
                        <Clock size={12} />
                        {timeAgo || <DualDate date={order.createdAt} format="compact" />}
                    </div>
                </div>

                {/* Status Badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    backgroundColor: config.bg,
                    borderRadius: '10px',
                }}>
                    <StatusIcon size={12} style={{ color: config.text }} />
                    <span style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        color: config.text,
                    }}>
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Order Info */}
            <div style={{
                fontSize: '13px',
                color: 'var(--notion-text-secondary)',
                marginBottom: 'var(--space-3)',
            }}>
                {order.roomId ? (
                    <span>Room <strong style={{ color: 'var(--notion-text)' }}>{order.room?.number || order.roomId}</strong></span>
                ) : (
                    <span>{order.customerName || 'Walk-in'}</span>
                )}
                <span style={{ margin: '0 8px' }}>•</span>
                <span>{order.orderType.replace('_', ' ')}</span>
            </div>

            {/* Items */}
            <div style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-3)',
            }}>
                {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        padding: '4px 0',
                        borderBottom: idx < Math.min(order.items.length - 1, 2) ? '1px solid var(--notion-divider)' : 'none',
                    }}>
                        <span style={{ color: 'var(--notion-text)' }}>
                            {item.quantity}× {item.menuItem?.name || `Item #${item.menuItemId}`}
                        </span>
                        <span style={{ color: 'var(--notion-text-secondary)' }}>
                            NPR {(item.price * item.quantity).toLocaleString()}
                        </span>
                    </div>
                ))}
                {order.items.length > 3 && (
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-secondary)',
                        marginTop: 'var(--space-2)',
                    }}>
                        +{order.items.length - 3} more items
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
            }}>
                <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                }}>
                    NPR {(Number(order.totalAmount) || 0).toLocaleString()}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                    {config.nextStatus && (
                        <Button
                            size="sm"
                            onClick={(e: any) => { e.stopPropagation(); onStatusChange(order.id, config.nextStatus!); }}
                        >
                            {config.nextLabel}
                            <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                        </Button>
                    )}
                    {/* Room orders settle on the room folio at checkout — paying here
                        would double-charge. Show a badge instead of a Pay button. */}
                    {order.status === 'SERVED' && (order.roomId || order.bookingId) && (
                        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'var(--notion-blue-bg)', color: 'var(--notion-blue)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Receipt size={12} /> On room bill
                        </span>
                    )}
                    {order.status === 'SERVED' && !order.roomId && !order.bookingId && order.paymentStatus === 'PAID' && (
                        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'var(--notion-green-bg)', color: 'var(--notion-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} /> Paid
                        </span>
                    )}
                    {order.status === 'SERVED' && !order.roomId && !order.bookingId && order.paymentStatus !== 'PAID' && onRecordPayment && can('finance:record_payment') && (
                        <Button
                            size="sm"
                            onClick={(e: any) => { e.stopPropagation(); onRecordPayment(order); }}
                            title="Record Payment"
                        >
                            <CreditCard size={14} style={{ marginRight: '4px' }} />
                            Pay
                        </Button>
                    )}
                    {order.status !== 'SERVED' && order.status !== 'CANCELLED' && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e: any) => { e.stopPropagation(); window.open(`/hotel/pos?editOrderId=${order.id}`, '_blank'); }}
                            title="Edit in POS"
                        >
                            <ChefHat size={14} />
                        </Button>
                    )}
                    {order.status !== 'SERVED' && order.status !== 'CANCELLED' && onCancel && can('orders:cancel') && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e: any) => { e.stopPropagation(); onCancel(order.id); }}
                            title="Cancel Order"
                            style={{ color: 'var(--notion-red)' }}
                        >
                            <XCircle size={14} />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Order Detail Modal
function OrderDetailModal({ order, isOpen, onClose, onStatusChange, onCancel, onRefresh, openOrders = [], onAddItems, onUpdateItem }: {
    order: Order | null;
    isOpen: boolean;
    onClose: () => void;
    onStatusChange: (id: string, status: OrderStatus) => void;
    onCancel: (id: string) => void;
    onRefresh?: () => void;
    openOrders?: Order[];
    onAddItems?: (id: string, items: { menuItemId: number; quantity: number; price: number; notes?: string }[]) => Promise<any>;
    onUpdateItem?: (orderId: string, itemId: number, data: { quantity?: number; notes?: string }) => Promise<boolean>;
}) {
    const { can } = usePermissions();
    const [tables, setTables] = useState<{ id: number; tableNumber: string }[]>([]);
    const [moveTo, setMoveTo] = useState('');
    const [mergeFrom, setMergeFrom] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const { confirm: pwConfirm, modal: pwModal } = usePasswordConfirm();
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [menuSearch, setMenuSearch] = useState('');
    const [showAddItems, setShowAddItems] = useState(false);
    const [pendingAddItems, setPendingAddItems] = useState<{ menuItemId: number; name: string; price: number; quantity: number }[]>([]);

    useEffect(() => {
        if (isOpen) {
            api.get<any[]>('/menu').then(r => setMenuItems(r.data || [])).catch(() => { });
            setShowAddItems(false);
            setPendingAddItems([]);
            setMenuSearch('');
        }
        if (isOpen && order?.orderType === 'DINE_IN') {
            api.get<{ id: number; tableNumber: string }[]>('/operations/tables')
                .then(r => setTables(r.data || [])).catch(() => setTables([]));
        }
        setMoveTo(''); setMergeFrom('');
    }, [isOpen, order?.id, order?.orderType]);

    if (!order) return null;
    const config = STATUS_CONFIG[order.status];
    const StatusIcon = config.icon;
    const isOpenOrder = order.status !== 'SERVED' && order.status !== 'CANCELLED';
    const mergeCandidates = openOrders.filter(o => o.id !== order.id && o.orderType === order.orderType && o.status !== 'SERVED' && o.status !== 'CANCELLED');

    const doComp = async () => {
        const pw = await pwConfirm('Make order complimentary', 'Comping zeroes the bill. Re-enter your password to confirm.');
        if (!pw) return;
        setActionBusy(true);
        try { await api.post(`/orders/${order.id}/comp`, { confirmPassword: pw }); toast.success('Order made complimentary'); onRefresh?.(); onClose(); }
        catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setActionBusy(false); }
    };
    const doMove = async () => {
        if (!moveTo) return;
        setActionBusy(true);
        try { await api.patch(`/orders/${order.id}/table`, { tableId: Number(moveTo) }); toast.success('Order moved'); onRefresh?.(); onClose(); }
        catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setActionBusy(false); }
    };
    const doMerge = async () => {
        if (!mergeFrom) return;
        setActionBusy(true);
        try { await api.post(`/orders/${order.id}/merge`, { sourceOrderIds: [mergeFrom] }); toast.success('Orders merged'); onRefresh?.(); onClose(); }
        catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setActionBusy(false); }
    };

    return (
        <>
        {pwModal}
        <Modal isOpen={isOpen} onClose={onClose} title={`Order #${order.orderNumber}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Status & Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        backgroundColor: config.bg, color: config.text, fontSize: '12px', fontWeight: '500'
                    }}>
                        <StatusIcon size={12} />
                        {config.label}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                        <DualDate date={order.createdAt} format="compact" />
                    </span>
                </div>

                {/* Source */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {order.room ? (
                        <div style={{ flex: 1, padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>Room Service — Room {order.room.number}</div>
                            {order.customerName && <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{order.customerName}</div>}
                        </div>
                    ) : order.orderType === 'DINE_IN' ? (
                        <div style={{ flex: 1, padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>Dine-In</div>
                            {order.customerName && <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{order.customerName}</div>}
                        </div>
                    ) : (
                        <div style={{ flex: 1, padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>Takeaway</div>
                            {order.customerName && <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{order.customerName}</div>}
                        </div>
                    )}
                </div>

                {/* Items */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block' }}>Order Items</label>
                        {isOpenOrder && (
                            <button
                                onClick={() => setShowAddItems(v => !v)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-blue)', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Plus size={14} /> {showAddItems ? 'Hide' : 'Add Items'}
                            </button>
                        )}
                    </div>
                    <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        {order.items.map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 12px',
                                borderBottom: idx < order.items.length - 1 ? '1px solid var(--notion-divider)' : 'none',
                                backgroundColor: 'var(--notion-bg-tertiary)'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)', fontWeight: '500' }}>{item.quantity}× {item.menuItem?.name || `Item #${item.menuItemId}`}</span>
                                    {item.notes && <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', display: 'block' }}>{item.notes}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {isOpenOrder && (item as any).id && onUpdateItem && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <button
                                                title="Decrease quantity"
                                                onClick={async () => {
                                                    if (item.quantity <= 1) return;
                                                    setActionBusy(true);
                                                    try {
                                                        await onUpdateItem(order.id, (item as any).id, { quantity: item.quantity - 1 });
                                                        toast.success('Quantity updated');
                                                        onRefresh?.();
                                                    } catch (e: any) { toast.error(e?.message || 'Failed'); }
                                                    finally { setActionBusy(false); }
                                                }}
                                                disabled={actionBusy}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '2px' }}
                                            ><Minus size={14} /></button>
                                            <span style={{ fontSize: '13px', fontWeight: '500', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                            <button
                                                title="Increase quantity"
                                                onClick={async () => {
                                                    setActionBusy(true);
                                                    try {
                                                        await onUpdateItem(order.id, (item as any).id, { quantity: item.quantity + 1 });
                                                        toast.success('Quantity updated');
                                                        onRefresh?.();
                                                    } catch (e: any) { toast.error(e?.message || 'Failed'); }
                                                    finally { setActionBusy(false); }
                                                }}
                                                disabled={actionBusy}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '2px' }}
                                            ><Plus size={14} /></button>
                                        </div>
                                    )}
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>NPR {(item.price * item.quantity).toLocaleString()}</span>
                                    {isOpenOrder && (item as any).id && (
                                        <button
                                            title="Void item"
                                            onClick={async () => {
                                                const reason = window.prompt('Reason for voiding this item? (required)')?.trim();
                                                if (reason == null) return;
                                                if (!reason) { toast.error('A reason is required to void an item'); return; }
                                                try {
                                                    await api.post(`/orders/${order.id}/items/${(item as any).id}/void`, { reason });
                                                    toast.success('Item voided');
                                                    onRefresh?.(); onClose();
                                                } catch (e: any) { toast.error(e?.message || 'Failed to void'); }
                                            }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', display: 'flex', padding: 2 }}
                                        ><X size={14} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Items Panel */}
                    {showAddItems && isOpenOrder && (
                        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                                <input
                                    type="text"
                                    value={menuSearch}
                                    onChange={e => setMenuSearch(e.target.value)}
                                    placeholder="Search menu items..."
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px 8px 32px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--notion-border)',
                                        backgroundColor: 'var(--notion-bg)',
                                        color: 'var(--notion-text)',
                                        fontSize: '13px',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: 'var(--space-2)' }}>
                                {menuItems
                                    .filter((mi: any) => mi.isAvailable !== false)
                                    .filter((mi: any) => !menuSearch || mi.name?.toLowerCase().includes(menuSearch.toLowerCase()))
                                    .map((mi: any) => (
                                        <button key={mi.id} type="button" onClick={() => {
                                            setPendingAddItems(prev => {
                                                const existing = prev.find(p => p.menuItemId === mi.id);
                                                if (existing) return prev.map(p => p.menuItemId === mi.id ? { ...p, quantity: p.quantity + 1 } : p);
                                                return [...prev, { menuItemId: mi.id, name: mi.name, price: Number(mi.price || 0), quantity: 1 }];
                                            });
                                        }} style={{
                                            display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 10px',
                                            background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                                            color: 'var(--notion-text)', fontSize: '13px', textAlign: 'left',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <span>{mi.name}</span>
                                            <span style={{ color: 'var(--notion-text-secondary)' }}>NPR {Number(mi.price || 0).toLocaleString()}</span>
                                        </button>
                                    ))}
                                {menuItems.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No menu items available.</div>}
                            </div>
                            {pendingAddItems.length > 0 && (
                                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                                    {pendingAddItems.map(item => (
                                        <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--notion-divider)' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--notion-text)' }}>{item.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <button type="button" onClick={() => setPendingAddItems(prev => prev.map(p => p.menuItemId === item.menuItemId ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '2px' }}><Minus size={14} /></button>
                                                <span style={{ fontSize: '13px', fontWeight: '500', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                                <button type="button" onClick={() => setPendingAddItems(prev => prev.map(p => p.menuItemId === item.menuItemId ? { ...p, quantity: p.quantity + 1 } : p))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '2px' }}><Plus size={14} /></button>
                                                <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', minWidth: '60px', textAlign: 'right' }}>NPR {(item.price * item.quantity).toLocaleString()}</span>
                                                <button type="button" onClick={() => setPendingAddItems(prev => prev.filter(p => p.menuItemId !== item.menuItemId))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', padding: '2px' }}><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {pendingAddItems.length > 0 && (
                                <Button
                                    size="sm"
                                    onClick={async () => {
                                        setActionBusy(true);
                                        try {
                                            await onAddItems?.(order.id, pendingAddItems.map(p => ({ menuItemId: p.menuItemId, quantity: p.quantity, price: p.price })));
                                            toast.success('Items added');
                                            setPendingAddItems([]);
                                            setShowAddItems(false);
                                            onRefresh?.();
                                            // Auto-print KOT for the new items
                                            try { await api.post(`/orders/kot/print/${order.id}`); } catch { /* silent */ }
                                        } catch (e: any) { toast.error(e?.message || 'Failed to add items'); }
                                        finally { setActionBusy(false); }
                                    }}
                                    disabled={actionBusy}
                                    style={{ width: '100%' }}
                                >
                                    <Plus size={14} style={{ marginRight: '4px' }} />
                                    Add {pendingAddItems.reduce((s, p) => s + p.quantity, 0)} item(s) & Print KOT
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Totals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        <span>Subtotal</span>
                        <span>NPR {(Number(order.subTotal) || 0).toLocaleString()}</span>
                    </div>
                    {(Number(order.serviceChargeAmount) || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            <span>Service Charge ({((Number(order.serviceChargeRate) || 0.10) * 100).toFixed(0)}%)</span>
                            <span>NPR {(Number(order.serviceChargeAmount) || 0).toLocaleString()}</span>
                        </div>
                    )}
                    {(Number(order.vatAmount) || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            <span>VAT ({((Number(order.vatRate) || 0.13) * 100).toFixed(0)}%)</span>
                            <span>NPR {(Number(order.vatAmount) || 0).toLocaleString()}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', borderTop: '1px solid var(--notion-divider)', paddingTop: '6px' }}>
                        <span>Total</span>
                        <span>NPR {(Number(order.totalAmount) || 0).toLocaleString()}</span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {/* Primary Action */}
                    {config.nextStatus && (
                        <Button 
                            onClick={() => { onStatusChange(order.id, config.nextStatus!); onClose(); }} 
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            <ArrowRight size={16} style={{ marginRight: '8px' }} />
                            {config.nextLabel}
                        </Button>
                    )}

                    {/* Secondary Actions Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={async () => {
                                try {
                                    const res = await api.post<{ printer: string; status: string; error?: string }[]>(`/orders/kot/print/${order.id}`);
                                    const results = res.data || [];
                                    if (results.every(r => r.status === 'SKIPPED')) {
                                        toast.info('No KOT printers configured — add one in Settings → Printers');
                                    } else if (results.some(r => r.status === 'PRINTED')) {
                                        toast.success('KOT sent to printer');
                                    } else {
                                        toast.error('KOT print failed — check printer connection');
                                    }
                                } catch {
                                    toast.error('KOT print failed');
                                }
                            }}
                        >
                            <Printer size={14} style={{ marginRight: '6px' }} />
                            Print KOT
                        </Button>
                        {isOpenOrder && (
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => window.open(`/hotel/pos?editOrderId=${order.id}`, '_blank')}
                            >
                                <Edit3 size={14} style={{ marginRight: '6px' }} />
                                Edit Order
                            </Button>
                        )}
                        {isOpenOrder && can('finance:generate_invoice') && (
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={doComp} 
                                disabled={actionBusy}
                                style={{ color: 'var(--notion-orange)' }}
                            >
                                <Gift size={14} style={{ marginRight: '6px' }} />
                                Comp Item
                            </Button>
                        )}
                        {order.status !== 'SERVED' && order.status !== 'CANCELLED' && can('orders:cancel') && (
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => { onCancel(order.id); onClose(); }} 
                                style={{ color: 'var(--notion-red)' }}
                            >
                                <XCircle size={14} style={{ marginRight: '6px' }} />
                                Cancel
                            </Button>
                        )}
                    </div>

                    {/* Table Operations for Dine-In */}
                    {isOpenOrder && (order.orderType === 'DINE_IN') && (
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 'var(--space-2)', 
                            borderTop: '1px solid var(--notion-divider)', 
                            paddingTop: 'var(--space-3)' 
                        }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <select 
                                    value={moveTo} 
                                    onChange={e => setMoveTo(e.target.value)} 
                                    style={{ 
                                        flex: 1, 
                                        padding: '8px 10px', 
                                        fontSize: '13px', 
                                        border: '1px solid var(--notion-border)', 
                                        borderRadius: 'var(--radius-md)', 
                                        background: 'var(--notion-bg)', 
                                        color: 'var(--notion-text)' 
                                    }}
                                >
                                    <option value="">Move to table…</option>
                                    {tables.filter(t => t.id !== order.restaurantTableId).map(t => 
                                        <option key={t.id} value={t.id}>Table {t.tableNumber}</option>
                                    )}
                                </select>
                                <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={doMove} 
                                    disabled={actionBusy || !moveTo}
                                >
                                    <Move size={14} style={{ marginRight: '4px' }} />
                                    Move
                                </Button>
                            </div>
                            {mergeCandidates.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <select 
                                        value={mergeFrom} 
                                        onChange={e => setMergeFrom(e.target.value)} 
                                        style={{ 
                                            flex: 1, 
                                            padding: '8px 10px', 
                                            fontSize: '13px', 
                                            border: '1px solid var(--notion-border)', 
                                            borderRadius: 'var(--radius-md)', 
                                            background: 'var(--notion-bg)', 
                                            color: 'var(--notion-text)' 
                                        }}
                                    >
                                        <option value="">Merge another order…</option>
                                        {mergeCandidates.map(o => 
                                            <option key={o.id} value={o.id}>#{o.orderNumber} ({o.customerName || 'order'})</option>
                                        )}
                                    </select>
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        onClick={doMerge} 
                                        disabled={actionBusy || !mergeFrom}
                                    >
                                        Merge
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
        </>
    );
}

// Date bucket helper
function getDateBucket(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);
    if (d >= startOfToday) return 'Today';
    if (d >= startOfYesterday) return 'Yesterday';
    if (d >= startOfWeek) return 'This Week';
    return 'Older';
}

// Kanban Column
function KanbanColumn({
    title,
    orders,
    color,
    onStatusChange,
    onCancel,
    onRecordPayment,
    onView,
    collapsible = false,
}: {
    title: string;
    orders: Order[];
    color: string;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onCancel?: (orderId: string) => void;
    onRecordPayment?: (order: Order) => void;
    onView?: (order: Order) => void;
    collapsible?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const VISIBLE = collapsible && !expanded ? 0 : 3;

    const filtered = expanded && search.trim()
        ? orders.filter(o =>
            o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
            (o.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
            (o.room?.number?.toString() || '').includes(search) ||
            o.items.some(it => (it.menuItem?.name || '').toLowerCase().includes(search.toLowerCase()))
        )
        : orders;

    const stackMode = collapsible && !expanded && orders.length > 0;
    const visible = stackMode ? [] : filtered;
    const stackedCount = orders.length;

    // Group by date bucket when expanded
    const grouped = expanded && !stackMode
        ? visible.reduce<Record<string, Order[]>>((acc, o) => {
            const bucket = getDateBucket(o.createdAt);
            (acc[bucket] = acc[bucket] || []).push(o);
            return acc;
        }, {})
        : null;
    const bucketOrder = ['Today', 'Yesterday', 'This Week', 'Older'];

    return (
        <div style={{
            flex: 1,
            minWidth: '300px',
            backgroundColor: 'var(--notion-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
        }}>
            {/* Column Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--notion-divider)',
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: color,
                }} />
                <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                }}>
                    {title}
                </span>
                <span style={{
                    fontSize: '12px',
                    color: 'var(--notion-text-secondary)',
                    backgroundColor: 'var(--notion-bg)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                }}>
                    {orders.length}
                </span>
                {collapsible && (
                    <button
                        onClick={() => setExpanded(v => !v)}
                        title={expanded ? 'Collapse' : 'Expand'}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', display: 'flex', padding: 2 }}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                )}
            </div>

            {/* Cards */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
            }}>
                {orders.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-6)',
                        color: 'var(--notion-text-secondary)',
                        fontSize: '13px',
                    }}>
                        No orders
                    </div>
                ) : (
                    <>
                        {/* Search bar inside expanded completed column */}
                        {expanded && collapsible && (
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search completed orders..."
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px 8px 32px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--notion-border)',
                                        backgroundColor: 'var(--notion-bg)',
                                        color: 'var(--notion-text)',
                                        fontSize: '13px',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        )}

                        {grouped
                            ? bucketOrder.map(bucket => {
                                const bucketOrders = grouped[bucket];
                                if (!bucketOrders?.length) return null;
                                return (
                                    <div key={bucket}>
                                        <div style={{
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: 'var(--notion-text-secondary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            marginBottom: 'var(--space-2)',
                                            marginTop: 'var(--space-2)',
                                        }}>
                                            {bucket} ({bucketOrders.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                            {bucketOrders.map(order => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    onStatusChange={onStatusChange}
                                                    onCancel={onCancel}
                                                    onRecordPayment={onRecordPayment}
                                                    onView={onView}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                            : visible.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    onStatusChange={onStatusChange}
                                    onCancel={onCancel}
                                    onRecordPayment={onRecordPayment}
                                    onView={onView}
                                />
                            ))
                        }

                        {/* Stacked "book" pile for all completed items when collapsed. */}
                        {stackMode && orders.length > 0 && (
                            <button
                                onClick={() => setExpanded(true)}
                                title="Show all completed"
                                style={{ position: 'relative', height: 180, marginTop: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, width: '100%', outline: 'none' }}
                                onMouseEnter={e => { const s = e.currentTarget.querySelectorAll('.stack-card'); s.forEach((el, i) => ((el as HTMLElement).style.transform = `translateY(${i * -12}px) rotate(${(i - 1) * 2}deg)`)); }}
                                onMouseLeave={e => { const s = e.currentTarget.querySelectorAll('.stack-card'); s.forEach((el, i) => ((el as HTMLElement).style.transform = `translateY(${i * 6}px) scale(${1 - i * 0.05})`)); }}
                            >
                                {[0, 1, 2].map(i => {
                                    // Make the top card (i=0) actually show some preview data of the most recent completed order
                                    const topOrder = orders[0];
                                    const isTop = i === 0;
                                    return (
                                        <div key={i} className="stack-card" style={{
                                            position: 'absolute', left: 0, right: 0, top: 0, height: 140,
                                            background: 'var(--notion-bg)', border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${color}`,
                                            transform: `translateY(${i * 6}px) scale(${1 - i * 0.05})`,
                                            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 3 - i,
                                            boxShadow: i === 0 ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.05)',
                                            padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                            overflow: 'hidden'
                                        }}>
                                            {isTop && topOrder ? (
                                                <div style={{ textAlign: 'left', width: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--notion-text)' }}>#{topOrder.orderNumber}</span>
                                                        <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{getTimeAgo(new Date(topOrder.updatedAt || topOrder.createdAt))}</span>
                                                    </div>
                                                    <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--notion-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {topOrder.customerName || 'Guest'} • {topOrder.orderType.replace('_', ' ')}
                                                    </div>
                                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '8px', background: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-blue)' }}>
                                                            Click to expand {orders.length} orders
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Time ago helper
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return '';
}

// New Order Modal
function NewOrderModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
    const { createOrder } = useOrders();
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [menuSearch, setMenuSearch] = useState('');
    const [orderType, setOrderType] = useState<string>('DINE_IN');
    const [customerName, setCustomerName] = useState('');
    const [roomId, setRoomId] = useState<string>('');
    const [selectedTableId, setSelectedTableId] = useState('');
    const [guestId, setGuestId] = useState<string | null>(null);
    const [items, setItems] = useState<{ menuItemId: number; name: string; quantity: number; price: number; notes: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rooms, setRooms] = useState<any[]>([]);
    const [tables, setTables] = useState<any[]>([]);
    const [addToGuestBill, setAddToGuestBill] = useState(true);
    const [applyVat, setApplyVat] = useState(false);
    const [applyServiceCharge, setApplyServiceCharge] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setItems([]);
            setMenuSearch('');
            setCustomerName('');
            setRoomId('');
            setSelectedTableId('');
            setGuestId(null);
            setOrderType('DINE_IN');
            setAddToGuestBill(true);
            setApplyVat(false);
            setApplyServiceCharge(false);
            api.get<any[]>('/menu').then(res => setMenuItems(res.data || [])).catch(() => { });
            api.get<any[]>('/rooms').then(res => setRooms(res.data || [])).catch(() => { });
            api.get<any[]>('/operations/tables').then(res => setTables(res.data || [])).catch(() => { });
        }
    }, [isOpen]);

    // Auto-fill customer name when room is selected
    useEffect(() => {
        if (orderType === 'ROOM_SERVICE' && roomId) {
            const selectedRoom = rooms.find((r: any) => String(r.id) === roomId);
            if (selectedRoom?.currentBooking?.guestName && !customerName) {
                setCustomerName(selectedRoom.currentBooking.guestName);
            }
        }
    }, [roomId, orderType, rooms]);

    const addItem = (mi: any) => {
        setItems(prev => {
            const existing = prev.find(i => i.menuItemId === mi.id);
            if (existing) return prev.map(i => i.menuItemId === mi.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { menuItemId: mi.id, name: mi.name, quantity: 1, price: Number(mi.price || 0), notes: '' }];
        });
    };

    const removeItem = (menuItemId: number) => setItems(prev => prev.filter(i => i.menuItemId !== menuItemId));
    const updateQty = (menuItemId: number, qty: number) => {
        if (qty < 1) return removeItem(menuItemId);
        setItems(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i));
    };

    const subTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const serviceChargeRate = 0.10;
    const vatRate = 0.13;
    const serviceCharge = applyServiceCharge ? subTotal * serviceChargeRate : 0;
    const vatAmount = applyVat ? (subTotal + serviceCharge) * vatRate : 0;
    const grandTotal = subTotal + serviceCharge + vatAmount;

    const handleSubmit = async () => {
        if (items.length === 0) return;
        setIsSubmitting(true);
        const payload: CreateOrderPayload = {
            orderType: orderType as OrderType,
            customerName: customerName || undefined,
            roomId: roomId ? Number(roomId) : undefined,
            restaurantTableId: orderType === 'DINE_IN' && selectedTableId ? Number(selectedTableId) : undefined,
            guestId: guestId || undefined,
            items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, price: i.price, notes: i.notes || undefined })),
            addToGuestBill: orderType === 'ROOM_SERVICE' && addToGuestBill ? true : undefined,
            applyVat,
            applyServiceCharge,
        };
        const createdOrder = await createOrder(payload);
        setIsSubmitting(false);
        if (createdOrder) {
            // Auto-print KOT
            try {
                await api.post(`/orders/kot/print/${createdOrder.id}`);
            } catch {
                // silent fail for print
            }
            setItems([]);
            setCustomerName('');
            setRoomId('');
            setSelectedTableId('');
            setGuestId(null);
            setOrderType('DINE_IN');
            setApplyVat(false);
            setApplyServiceCharge(false);
            onCreated();
            onClose();
        }
    };

    const labelStyle = { fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;
    const occupiedRooms = rooms.filter((r: any) => r.status === 'OCCUPIED' || r.currentBooking);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Order">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Order Type *</label>
                        <Select value={orderType} onChange={(e: any) => { setOrderType(e.target.value); setRoomId(''); setSelectedTableId(''); setGuestId(null); }} options={[
                            { value: 'DINE_IN', label: 'Dine In' },
                            { value: 'ROOM_SERVICE', label: 'Room Service' },
                            { value: 'TAKEAWAY', label: 'Takeaway' },
                        ]} />
                    </div>
                    <div>
                        <label style={labelStyle}>Customer / Guest</label>
                        <GuestSearchInput
                            value={customerName}
                            onSelect={(guest) => {
                                setGuestId(guest.id);
                                setCustomerName(guest.fullName);
                            }}
                            onAddNew={(name) => {
                                setGuestId(null);
                                setCustomerName(name);
                            }}
                            placeholder="Search or add guest..."
                        />
                    </div>
                </div>
                {orderType === 'ROOM_SERVICE' && (
                    <div>
                        {occupiedRooms.length > 0 ? (
                            <SearchableSelect
                                label="Room"
                                value={roomId || null}
                                onChange={val => {
                                    const v = String(val);
                                    setRoomId(v);
                                    const room = rooms.find((r: any) => String(r.id) === v);
                                    if (room?.currentBooking?.guestName) {
                                        setCustomerName(room.currentBooking.guestName);
                                    }
                                }}
                                placeholder="Select a room..."
                                searchPlaceholder="Search rooms..."
                                options={occupiedRooms.map((r: any) => ({
                                    value: r.id,
                                    label: `Room ${r.roomNumber}`,
                                    subtitle: r.currentBooking?.guestName || undefined
                                }))}
                            />
                        ) : (
                            <div>
                                <label style={labelStyle}>Room</label>
                                <Input type="number" value={roomId} onChange={(e: any) => setRoomId(e.target.value)} placeholder="Room ID" />
                            </div>
                        )}
                        {/* Add to guest bill toggle */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '8px',
                            fontSize: '13px',
                            color: 'var(--notion-text)',
                            cursor: 'pointer',
                        }}>
                            <input
                                type="checkbox"
                                checked={addToGuestBill}
                                onChange={e => setAddToGuestBill(e.target.checked)}
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    accentColor: 'var(--notion-blue)',
                                    cursor: 'pointer',
                                }}
                            />
                            Include in guest&apos;s bill
                        </label>
                    </div>
                )}
                {orderType === 'DINE_IN' && (
                    <div>
                        {tables.length > 0 ? (
                            <SearchableSelect
                                label="Table *"
                                value={selectedTableId || null}
                                onChange={val => {
                                    const v = String(val);
                                    setSelectedTableId(v);
                                    const table = tables.find((t: any) => String(t.id) === v);
                                    if (table?.layoutProps?.guestName && !customerName) {
                                        setCustomerName(table.layoutProps.guestName);
                                    }
                                }}
                                placeholder="Select a table..."
                                searchPlaceholder="Search tables..."
                                options={tables.map((t: any) => ({
                                    value: t.id,
                                    label: `Table ${t.tableNumber}`,
                                    subtitle: `${t.capacity} seats${t.status === 'OCCUPIED' ? ' — Occupied' : ''}${t.layoutProps?.guestName ? ` — ${t.layoutProps.guestName}` : ''}`
                                }))}
                            />
                        ) : (
                            <div>
                                <label style={labelStyle}>Table *</label>
                                <Input type="number" value={selectedTableId} onChange={(e: any) => setSelectedTableId(e.target.value)} placeholder="Table ID" />
                            </div>
                        )}
                        {/* Selected table info card */}
                        {selectedTableId && (() => {
                            const selectedTable = tables.find((t: any) => String(t.id) === selectedTableId);
                            if (!selectedTable) return null;
                            return (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '10px 12px',
                                    backgroundColor: selectedTable.status === 'OCCUPIED' ? 'var(--notion-red-bg)' : 'var(--notion-green-bg)',
                                    border: `1px solid ${selectedTable.status === 'OCCUPIED' ? 'var(--notion-border)' : 'var(--notion-border)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '12px',
                                    color: 'var(--notion-text-secondary)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <span>{selectedTable.location || 'Main Hall'} • {selectedTable.capacity} seats</span>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '99px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        backgroundColor: selectedTable.status === 'OCCUPIED' ? 'var(--notion-red-bg)' : 'var(--notion-green-bg)',
                                        color: selectedTable.status === 'OCCUPIED' ? 'var(--notion-red)' : 'var(--notion-green)',
                                    }}>
                                        {selectedTable.status || 'Available'}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Menu Items */}
                <div>
                    <label style={labelStyle}>Add Items from Menu</label>
                    <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                        <input
                            type="text"
                            value={menuSearch}
                            onChange={e => setMenuSearch(e.target.value)}
                            placeholder="Search menu items..."
                            style={{
                                width: '100%',
                                padding: '8px 10px 8px 32px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                                fontSize: '13px',
                                outline: 'none',
                            }}
                        />
                    </div>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
                        {menuItems
                            .filter(mi => mi.isAvailable !== false)
                            .filter(mi => !menuSearch || mi.name?.toLowerCase().includes(menuSearch.toLowerCase()))
                            .map(mi => (
                                <button key={mi.id} type="button" onClick={() => addItem(mi)} style={{
                                    display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 10px',
                                    background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                                    color: 'var(--notion-text)', fontSize: '13px', textAlign: 'left',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-tertiary)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <span>{mi.name}</span>
                                    <span style={{ color: 'var(--notion-text-secondary)' }}>NPR {Number(mi.price || 0).toLocaleString()}</span>
                                </button>
                            ))}
                        {menuItems.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No menu items. Add items in the Menu page first.</div>}
                        {menuItems.length > 0 && menuSearch && menuItems.filter(mi => mi.isAvailable !== false).filter(mi => !menuSearch || mi.name?.toLowerCase().includes(menuSearch.toLowerCase())).length === 0 && (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No items match &quot;{menuSearch}&quot;</div>
                        )}
                    </div>
                </div>

                {/* Selected Items */}
                {items.length > 0 && (
                    <div>
                        <label style={labelStyle}>Order Items</label>
                        <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            {items.map(item => (
                                <div key={item.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--notion-divider)' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--notion-text)', flex: 1 }}>{item.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '2px' }}><Minus size={14} /></button>
                                        <span style={{ fontSize: '13px', fontWeight: '500', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                        <button type="button" onClick={() => updateQty(item.menuItemId, item.quantity + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-secondary)', padding: '2px' }}><Plus size={14} /></button>
                                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', minWidth: '60px', textAlign: 'right' }}>NPR {(item.price * item.quantity).toLocaleString()}</span>
                                        <button type="button" onClick={() => removeItem(item.menuItemId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', padding: '2px' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: 'var(--notion-bg-secondary)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                <span>Subtotal</span>
                                <span>NPR {subTotal.toLocaleString()}</span>
                            </div>
                            {applyServiceCharge && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: 'var(--notion-bg-secondary)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                    <span>Service Charge (10%)</span>
                                    <span>NPR {serviceCharge.toLocaleString()}</span>
                                </div>
                            )}
                            {applyVat && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: 'var(--notion-bg-secondary)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                    <span>VAT (13%)</span>
                                    <span>NPR {vatAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--notion-bg-tertiary)', fontWeight: '600', fontSize: '14px' }}>
                                <span>Grand Total</span>
                                <span>NPR {grandTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tax / Charge Toggles */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={applyServiceCharge} onChange={e => setApplyServiceCharge(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--notion-blue)', cursor: 'pointer' }} />
                        Add Service Charge (10%)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--notion-blue)', cursor: 'pointer' }} />
                        Add VAT (13%)
                    </label>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || items.length === 0} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : `Create Order (NPR ${grandTotal.toLocaleString()})`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default function OrdersPage() {
    const {
        isLoading,
        orders,
        fetchOrders,
        updateOrderStatus,
        cancelOrder,
        addItemsToOrder,
        updateOrderItem
    } = useOrders();

    const [showNewOrder, setShowNewOrder] = useState(false);
    const [tables, setTables] = useState<any[]>([]);

    // Fetch tables
    const fetchTables = useCallback(() => {
        api.get<any[]>('/operations/tables').then(res => setTables(res.data || [])).catch(() => { });
    }, []);

    useEffect(() => { fetchTables(); }, []);

    // Payment modal state
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

    // Order detail modal state
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Keep modal totals in sync after KOT/item edits refresh the orders list
    useEffect(() => {
        if (!selectedOrder) return;
        const fresh = orders.find(o => o.id === selectedOrder.id);
        if (fresh) setSelectedOrder(fresh);
    }, [orders, selectedOrder?.id]);

    // Filter state
    const [orderSearch, setOrderSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<OrderType | 'ALL'>('ALL');

    // Server-side search (debounced) so results aren't capped to the loaded board.
    useEffect(() => {
        const t = setTimeout(() => fetchOrders(orderSearch), orderSearch ? 350 : 0);
        return () => clearTimeout(t);
    }, [orderSearch]);

    // Derive filtered orders from the main orders array
    const filteredOrders = orders.filter(o => {
        const matchesSearch = !orderSearch ||
            o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
            (o.customerName || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
            (o.room?.number?.toString() || '').includes(orderSearch);
        const matchesType = typeFilter === 'ALL' || o.orderType === typeFilter;
        return matchesSearch && matchesType;
    });

    const pendingOrders = filteredOrders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const preparingOrders = filteredOrders.filter(o => o.status === 'PREPARING');
    const readyOrders = filteredOrders.filter(o => o.status === 'READY');
    const servedOrders = filteredOrders.filter(o => o.status === 'SERVED');

    // Derive stats from orders
    const stats = {
        total: filteredOrders.length,
        pending: pendingOrders.length,
        preparing: preparingOrders.length,
        ready: readyOrders.length,
        revenue: filteredOrders.filter(o => o.status === 'SERVED').reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    };

    const handleStatusChange = async (orderId: string, status: OrderStatus) => {
        await updateOrderStatus(orderId, status);
    };

    // Cancelling voids a live kitchen order — always confirm first.
    const handleCancelOrder = (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!window.confirm(`Cancel order ${order ? '#' + order.orderNumber : ''}? This cannot be undone.`)) return;
        cancelOrder(orderId);
    };

    return (
        <>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-6)',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                        }}>
                            <UtensilsCrossed size={28} />
                            Orders
                        </h1>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--notion-text-secondary)',
                            marginTop: 'var(--space-1)',
                        }}>
                            Kitchen order management and tracking
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => fetchOrders()} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                            Refresh
                        </Button>
                        <Button variant="secondary" onClick={() => window.open('/hotel/pos', '_blank')}>
                            <ChefHat size={14} style={{ marginRight: '6px' }} />
                            Open POS
                        </Button>
                        <Button onClick={() => setShowNewOrder(true)}>
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            New Order
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-6)',
                    marginBottom: 'var(--space-6)',
                }}>
                    {[
                        { label: 'Total', value: stats?.total ?? 0, color: 'var(--notion-text)', isCurrency: false },
                        { label: 'Pending', value: stats?.pending ?? 0, color: 'var(--notion-orange)', isCurrency: false },
                        { label: 'Preparing', value: stats?.preparing ?? 0, color: 'var(--notion-purple)', isCurrency: false },
                        { label: 'Ready', value: stats?.ready ?? 0, color: 'var(--notion-green)', isCurrency: false },
                        { label: 'Revenue', value: stats?.revenue ?? 0, color: 'var(--notion-green)', isCurrency: true },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>
                                {stat.isCurrency ? `NPR ${(stat.value as number).toLocaleString()}` : stat.value}
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                        <input
                            type="text"
                            value={orderSearch}
                            onChange={e => setOrderSearch(e.target.value)}
                            placeholder="Search orders..."
                            style={{
                                width: '100%',
                                padding: '8px 10px 8px 32px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)',
                                backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)',
                                fontSize: '13px',
                                outline: 'none',
                            }}
                        />
                    </div>
                    <Select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value as OrderType | 'ALL')}
                        options={[
                            { value: 'ALL', label: 'All Types' },
                            { value: 'DINE_IN', label: 'Dine-In' },
                            { value: 'ROOM_SERVICE', label: 'Room Service' },
                            { value: 'TAKEAWAY', label: 'Takeaway' },
                        ]}
                        style={{ minWidth: '160px' }}
                    />
                </div>

                {/* Table Status Bar */}
                {tables.length > 0 && (
                    <div style={{
                        marginBottom: 'var(--space-6)',
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--notion-border)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                            <Users size={16} style={{ color: 'var(--notion-text-secondary)' }} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)' }}>Dine-In Tables</span>
                            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                ({tables.filter(t => t.status === 'OCCUPIED').length}/{tables.length} occupied)
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            {tables.map((table: any) => {
                                const isOccupied = table.status === 'OCCUPIED';
                                const guestName = table.layoutProps?.guestName;
                                return (
                                    <div key={table.id} style={{
                                        padding: '10px 14px',
                                        backgroundColor: isOccupied ? 'var(--notion-red-bg)' : 'var(--notion-bg)',
                                        border: `1px solid ${isOccupied ? 'var(--notion-border)' : 'var(--notion-border)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        minWidth: '140px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                                Table {table.tableNumber}
                                            </span>
                                            <span style={{
                                                fontSize: '10px', padding: '2px 6px', borderRadius: '99px', fontWeight: '500',
                                                backgroundColor: isOccupied ? 'var(--notion-red-bg)' : 'var(--notion-green-bg)',
                                                color: isOccupied ? 'var(--notion-red)' : 'var(--notion-green)',
                                            }}>
                                                {isOccupied ? 'Occupied' : 'Free'}
                                            </span>
                                        </div>
                                        {guestName && (
                                            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                {guestName}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Kanban Board */}
                {isLoading ? (
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                    }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                variant="card"
                                height={400}
                                style={{ flex: 1 }}
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        overflowX: 'auto',
                        paddingBottom: 'var(--space-4)',
                    }}>
                        <KanbanColumn
                            title="Pending"
                            orders={pendingOrders}
                            color="var(--notion-orange)"
                            onStatusChange={handleStatusChange}
                            onCancel={(id) => handleCancelOrder(id)}
                            onView={(order) => setSelectedOrder(order)}
                        />
                        <KanbanColumn
                            title="Preparing"
                            orders={preparingOrders}
                            color="var(--notion-purple)"
                            onStatusChange={handleStatusChange}
                            onCancel={(id) => handleCancelOrder(id)}
                            onView={(order) => setSelectedOrder(order)}
                        />
                        <KanbanColumn
                            title="Ready"
                            orders={readyOrders}
                            color="var(--notion-green)"
                            onStatusChange={handleStatusChange}
                            onCancel={(id) => handleCancelOrder(id)}
                            onView={(order) => setSelectedOrder(order)}
                        />
                        <KanbanColumn
                            title="Served"
                            orders={servedOrders}
                            color="var(--notion-text-secondary)"
                            collapsible
                            onStatusChange={handleStatusChange}
                            onRecordPayment={(order) => setPaymentOrder(order)}
                            onView={(order) => setSelectedOrder(order)}
                        />
                    </div>
                )}
            </div>

            <NewOrderModal
                isOpen={showNewOrder}
                onClose={() => setShowNewOrder(false)}
                onCreated={() => fetchOrders()}
            />

            <OrderDetailModal
                order={selectedOrder}
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onStatusChange={handleStatusChange}
                onCancel={(id) => handleCancelOrder(id)}
                onRefresh={() => fetchOrders()}
                openOrders={orders}
                onAddItems={addItemsToOrder}
                onUpdateItem={updateOrderItem}
            />

            <RecordPaymentModal
                isOpen={!!paymentOrder}
                onClose={() => setPaymentOrder(null)}
                onSuccess={() => { fetchOrders(); fetchTables(); }}
                context={paymentOrder ? {
                    orderId: paymentOrder.id,
                    guestName: paymentOrder.customerName,
                    totalDue: paymentOrder.totalAmount || 0,
                    label: `Order #${paymentOrder.orderNumber}`,
                } : undefined}
            />
        </>
    );
}

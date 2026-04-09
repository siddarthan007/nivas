'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/lib/hooks/useOrders';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
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
    UserPlus,
    UserMinus,
    CreditCard,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Order, OrderStatus, OrderType, CreateOrderPayload } from '@/lib/types/api.types';
import { toast } from 'sonner';
import RecordPaymentModal from '@/components/features/payments/RecordPaymentModal';
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
        bg: 'rgba(120,120,120,0.2)',
        text: '#666',
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
    onRecordPayment
}: {
    order: Order;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onCancel?: (orderId: string) => void;
    onRecordPayment?: (order: Order) => void;
}) {
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
        }}
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
                        #{order.orderNumber}
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
                        {timeAgo}
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
                            ₹{(item.price * item.quantity).toLocaleString()}
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
            }}>
                <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                }}>
                    ₹{(order.total || 0).toLocaleString()}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                    {config.nextStatus && (
                        <Button
                            size="sm"
                            onClick={() => onStatusChange(order.id, config.nextStatus!)}
                        >
                            {config.nextLabel}
                            <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                        </Button>
                    )}
                    {order.status === 'SERVED' && onRecordPayment && (
                        <Button
                            size="sm"
                            onClick={() => onRecordPayment(order)}
                            title="Record Payment"
                        >
                            <CreditCard size={14} style={{ marginRight: '4px' }} />
                            Pay
                        </Button>
                    )}
                    {order.status !== 'SERVED' && order.status !== 'CANCELLED' && onCancel && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onCancel(order.id)}
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

// Kanban Column
function KanbanColumn({
    title,
    orders,
    color,
    onStatusChange,
    onCancel,
    onRecordPayment
}: {
    title: string;
    orders: Order[];
    color: string;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onCancel?: (orderId: string) => void;
    onRecordPayment?: (order: Order) => void;
}) {
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
                    orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onStatusChange={onStatusChange}
                            onCancel={onCancel}
                            onRecordPayment={onRecordPayment}
                        />
                    ))
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
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// New Order Modal
function NewOrderModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
    const { createOrder } = useOrders();
    const [menuItems, setMenuItems] = useState<any[]>([]);
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

    useEffect(() => {
        if (isOpen) {
            // Reset all form state when modal opens
            setItems([]);
            setCustomerName('');
            setRoomId('');
            setSelectedTableId('');
            setGuestId(null);
            setOrderType('DINE_IN');
            setAddToGuestBill(true);
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

    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

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
        };
        const ok = await createOrder(payload);
        setIsSubmitting(false);
        if (ok) {
            setItems([]);
            setCustomerName('');
            setRoomId('');
            setSelectedTableId('');
            setGuestId(null);
            setOrderType('DINE_IN');
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
                        <label style={labelStyle}>Room</label>
                        {occupiedRooms.length > 0 ? (
                            <Select
                                value={roomId}
                                onChange={(e: any) => {
                                    setRoomId(e.target.value);
                                    // Auto-fill guest name
                                    const room = rooms.find((r: any) => String(r.id) === e.target.value);
                                    if (room?.currentBooking?.guestName) {
                                        setCustomerName(room.currentBooking.guestName);
                                    }
                                }}
                                options={[
                                    { value: '', label: 'Select a room...' },
                                    ...occupiedRooms.map((r: any) => ({
                                        value: String(r.id),
                                        label: `Room ${r.roomNumber}${r.currentBooking?.guestName ? ` — ${r.currentBooking.guestName}` : ''}`
                                    }))
                                ]}
                            />
                        ) : (
                            <Input type="number" value={roomId} onChange={(e: any) => setRoomId(e.target.value)} placeholder="Room ID" />
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
                        <label style={labelStyle}>Table *</label>
                        {tables.length > 0 ? (
                            <Select
                                value={selectedTableId}
                                onChange={(e: any) => {
                                    const val = e.target.value;
                                    setSelectedTableId(val);
                                    const table = tables.find((t: any) => String(t.id) === val);
                                    if (table?.layoutProps?.guestName && !customerName) {
                                        setCustomerName(table.layoutProps.guestName);
                                    }
                                }}
                                options={[
                                    { value: '', label: 'Select a table...' },
                                    ...tables.map((t: any) => ({
                                        value: String(t.id),
                                        label: `Table ${t.tableNumber} (${t.capacity} seats)${t.status === 'OCCUPIED' ? ' — Occupied' : ''}${t.layoutProps?.guestName ? ` — ${t.layoutProps.guestName}` : ''}`
                                    }))
                                ]}
                            />
                        ) : (
                            <Input type="number" value={selectedTableId} onChange={(e: any) => setSelectedTableId(e.target.value)} placeholder="Table ID" />
                        )}
                        {/* Selected table info card */}
                        {selectedTableId && (() => {
                            const selectedTable = tables.find((t: any) => String(t.id) === selectedTableId);
                            if (!selectedTable) return null;
                            return (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '10px 12px',
                                    backgroundColor: selectedTable.status === 'OCCUPIED' ? 'rgba(235,87,87,0.06)' : 'rgba(68,131,97,0.06)',
                                    border: `1px solid ${selectedTable.status === 'OCCUPIED' ? 'rgba(235,87,87,0.2)' : 'rgba(68,131,97,0.2)'}`,
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
                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
                        {menuItems.filter(mi => mi.isAvailable !== false).map(mi => (
                            <button key={mi.id} type="button" onClick={() => addItem(mi)} style={{
                                display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 10px',
                                background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                                color: 'var(--notion-text)', fontSize: '13px', textAlign: 'left',
                            }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <span>{mi.name}</span>
                                <span style={{ color: 'var(--notion-text-secondary)' }}>₹{Number(mi.price || 0).toLocaleString()}</span>
                            </button>
                        ))}
                        {menuItems.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>No menu items. Add items in the Menu page first.</div>}
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
                                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', minWidth: '60px', textAlign: 'right' }}>₹{(item.price * item.quantity).toLocaleString()}</span>
                                        <button type="button" onClick={() => removeItem(item.menuItemId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-red)', padding: '2px' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--notion-bg-tertiary)', fontWeight: '600', fontSize: '14px' }}>
                                <span>Total</span>
                                <span>₹{total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || items.length === 0} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : `Create Order (₹${total.toLocaleString()})`}
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
        cancelOrder
    } = useOrders();

    const [showNewOrder, setShowNewOrder] = useState(false);
    const [tables, setTables] = useState<any[]>([]);
    const [showAttachModal, setShowAttachModal] = useState<any>(null);
    const [attachName, setAttachName] = useState('');
    const [attachPhone, setAttachPhone] = useState('');

    // Fetch tables
    const fetchTables = useCallback(() => {
        api.get<any[]>('/operations/tables').then(res => setTables(res.data || [])).catch(() => { });
    }, []);

    useEffect(() => { fetchTables(); }, []);

    const handleAttachGuest = async (tableId: number) => {
        if (!attachName.trim()) return;
        try {
            await api.patch(`/operations/tables/${tableId}/attach`, { guestName: attachName, phone: attachPhone || undefined });
            toast.success('Guest attached to table');
            setShowAttachModal(null);
            setAttachName('');
            setAttachPhone('');
            fetchTables();
        } catch { toast.error('Failed to attach guest'); }
    };

    const handleDetachGuest = async (tableId: number) => {
        try {
            await api.patch(`/operations/tables/${tableId}/detach`, {});
            toast.success('Guest detached from table');
            fetchTables();
        } catch { toast.error('Failed to detach guest'); }
    };

    // Payment modal state
    const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

    // Derive filtered orders from the main orders array
    const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const preparingOrders = orders.filter(o => o.status === 'PREPARING');
    const readyOrders = orders.filter(o => o.status === 'READY');
    const servedOrders = orders.filter(o => o.status === 'SERVED');

    // Derive stats from orders
    const stats = {
        total: orders.length,
        pending: pendingOrders.length,
        preparing: preparingOrders.length,
        ready: readyOrders.length
    };

    const handleStatusChange = async (orderId: string, status: OrderStatus) => {
        await updateOrderStatus(orderId, status);
    };

    return (
        <DashboardLayout>
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
                        { label: 'Total', value: stats?.total ?? 0, color: 'var(--notion-text)' },
                        { label: 'Pending', value: stats?.pending ?? 0, color: 'var(--notion-orange)' },
                        { label: 'Preparing', value: stats?.preparing ?? 0, color: 'var(--notion-purple)' },
                        { label: 'Ready', value: stats?.ready ?? 0, color: 'var(--notion-green)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                        </div>
                    ))}
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
                                        backgroundColor: isOccupied ? 'rgba(235,87,87,0.06)' : 'var(--notion-bg)',
                                        border: `1px solid ${isOccupied ? 'rgba(235,87,87,0.2)' : 'var(--notion-border)'}`,
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
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                            {isOccupied ? (
                                                <button
                                                    onClick={() => handleDetachGuest(table.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '11px', padding: '3px 8px',
                                                        background: 'none', border: '1px solid var(--notion-border)',
                                                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                        color: 'var(--notion-red)',
                                                    }}
                                                >
                                                    <UserMinus size={10} /> Detach
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { setShowAttachModal(table); setAttachName(''); setAttachPhone(''); }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        fontSize: '11px', padding: '3px 8px',
                                                        background: 'none', border: '1px solid var(--notion-border)',
                                                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                        color: 'var(--notion-blue)',
                                                    }}
                                                >
                                                    <UserPlus size={10} /> Attach Guest
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Attach Guest Modal */}
                <Modal isOpen={!!showAttachModal} onClose={() => setShowAttachModal(null)} title={`Attach Guest to Table ${showAttachModal?.tableNumber || ''}`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Guest Name *</label>
                            <Input value={attachName} onChange={(e: any) => setAttachName(e.target.value)} placeholder="Enter guest name" />
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Phone (optional)</label>
                            <Input value={attachPhone} onChange={(e: any) => setAttachPhone(e.target.value)} placeholder="Phone number" />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => setShowAttachModal(null)} style={{ flex: 1 }}>Cancel</Button>
                            <Button onClick={() => handleAttachGuest(showAttachModal?.id)} disabled={!attachName.trim()} style={{ flex: 1 }}>Attach Guest</Button>
                        </div>
                    </div>
                </Modal>

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
                            onCancel={(id) => cancelOrder(id)}
                        />
                        <KanbanColumn
                            title="Preparing"
                            orders={preparingOrders}
                            color="var(--notion-purple)"
                            onStatusChange={handleStatusChange}
                            onCancel={(id) => cancelOrder(id)}
                        />
                        <KanbanColumn
                            title="Ready"
                            orders={readyOrders}
                            color="var(--notion-green)"
                            onStatusChange={handleStatusChange}
                            onCancel={(id) => cancelOrder(id)}
                        />
                        <KanbanColumn
                            title="Served"
                            orders={servedOrders.slice(0, 10)}
                            color="var(--notion-text-secondary)"
                            onStatusChange={handleStatusChange}
                            onRecordPayment={(order) => setPaymentOrder(order)}
                        />
                    </div>
                )}
            </div>

            <NewOrderModal
                isOpen={showNewOrder}
                onClose={() => setShowNewOrder(false)}
                onCreated={() => fetchOrders()}
            />

            <RecordPaymentModal
                isOpen={!!paymentOrder}
                onClose={() => setPaymentOrder(null)}
                onSuccess={() => { fetchOrders(); fetchTables(); }}
                context={paymentOrder ? {
                    orderId: paymentOrder.id,
                    guestName: paymentOrder.customerName,
                    totalDue: paymentOrder.total || 0,
                    label: `Order #${paymentOrder.orderNumber}`,
                } : undefined}
            />
        </DashboardLayout>
    );
}

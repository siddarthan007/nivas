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
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Order, OrderStatus, CreateOrderPayload } from '@/lib/types/api.types';

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
    onCancel
}: {
    order: Order;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onCancel?: (orderId: string) => void;
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
    onCancel
}: {
    title: string;
    orders: Order[];
    color: string;
    onStatusChange: (orderId: string, status: OrderStatus) => void;
    onCancel?: (orderId: string) => void;
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
    const [items, setItems] = useState<{ menuItemId: number; name: string; quantity: number; price: number; notes: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            api.get<any[]>('/menu').then(res => setMenuItems(res.data || [])).catch(() => {});
        }
    }, [isOpen]);

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
            orderType: orderType as any,
            customerName: customerName || undefined,
            roomId: roomId ? Number(roomId) : undefined,
            items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, price: i.price, notes: i.notes || undefined })),
        };
        const ok = await createOrder(payload);
        setIsSubmitting(false);
        if (ok) {
            setItems([]);
            setCustomerName('');
            setRoomId('');
            setOrderType('DINE_IN');
            onCreated();
            onClose();
        }
    };

    const labelStyle = { fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Order">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Order Type *</label>
                        <Select value={orderType} onChange={(e: any) => setOrderType(e.target.value)} options={[
                            { value: 'DINE_IN', label: 'Dine In' },
                            { value: 'ROOM_SERVICE', label: 'Room Service' },
                            { value: 'TAKEAWAY', label: 'Takeaway' },
                        ]} />
                    </div>
                    <div>
                        <label style={labelStyle}>Customer Name</label>
                        <Input value={customerName} onChange={(e: any) => setCustomerName(e.target.value)} placeholder="Guest name" />
                    </div>
                </div>
                {orderType === 'ROOM_SERVICE' && (
                    <div>
                        <label style={labelStyle}>Room Number</label>
                        <Input type="number" value={roomId} onChange={(e: any) => setRoomId(e.target.value)} placeholder="Room ID" />
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

    // Derive filtered orders from the main orders array
    const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const preparingOrders = orders.filter(o => o.status === 'PREPARING');
    const readyOrders = orders.filter(o => o.status === 'READY');

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

                    {/* Kanban Board */}
                    {isLoading ? (
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-4)',
                        }}>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} style={{
                                    flex: 1,
                                    height: '400px',
                                    backgroundColor: 'var(--notion-bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
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
                        </div>
                    )}
            </div>

            <NewOrderModal
                isOpen={showNewOrder}
                onClose={() => setShowNewOrder(false)}
                onCreated={() => fetchOrders()}
            />
        </DashboardLayout>
    );
}

'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useOrders } from '@/lib/hooks/useOrders';
import { useMenu } from '@/lib/hooks/useMenu';
import { useRooms } from '@/lib/hooks/useRooms';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import {
    UtensilsCrossed,
    Plus,
    Search,
    Clock,
    CheckCircle2,
    XCircle,
    ChefHat,
    ShoppingBag,
    ConciergeBell,
    Trash2
} from 'lucide-react';
import type { CreateOrderPayload, MenuItem, Order, OrderStatus } from '@/lib/types/api.types';

// Order Status Badge
function OrderStatusBadge({ status }: { status: OrderStatus }) {
    const styles: Record<OrderStatus, { bg: string; text: string; icon: any }> = {
        PENDING: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)', icon: Clock },
        CONFIRMED: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', icon: CheckCircle2 },
        PREPARING: { bg: 'var(--notion-purple-bg)', text: 'var(--notion-purple)', icon: ChefHat },
        READY: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', icon: ShoppingBag },
        SERVED: { bg: 'var(--notion-gray-bg)', text: 'var(--notion-text-secondary)', icon: ConciergeBell },
        CANCELLED: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)', icon: XCircle },
    };

    const style = styles[status] || styles.PENDING;
    const Icon = style.icon;

    return (
        <span style={{
            backgroundColor: style.bg,
            color: style.text,
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            <Icon size={12} />
            {status}
        </span>
    );
}

// Create Order Modal
function CreateOrderModal({
    isOpen,
    onClose,
    onCreate
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: CreateOrderPayload) => Promise<boolean>;
}) {
    const { rooms } = useRooms();
    const { menuItems, fetchMenu } = useMenu();
    const [loading, setLoading] = useState(false);
    const [cart, setCart] = useState<{ menuItem: MenuItem; quantity: number }[]>([]);
    const [roomId, setRoomId] = useState<string>('');
    const [customerName, setCustomerName] = useState('');
    const [orderType, setOrderType] = useState<'ROOM_SERVICE' | 'DINE_IN' | 'TAKEAWAY'>('ROOM_SERVICE');
    const [searchMenu, setSearchMenu] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchMenu();
        }
    }, [isOpen]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.menuItem.id === item.id);
            if (existing) {
                return prev.map(i => i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { menuItem: item, quantity: 1 }];
        });
    };

    const removeFromCart = (itemId: number) => {
        setCart(prev => prev.filter(i => i.menuItem.id !== itemId));
    };

    const updateQuantity = (itemId: number, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.menuItem.id === itemId) {
                const newQty = Math.max(1, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        setLoading(true);

        const payload: CreateOrderPayload = {
            orderType,
            roomId: orderType === 'ROOM_SERVICE' ? Number(roomId) : undefined,
            customerName: orderType !== 'ROOM_SERVICE' ? customerName : undefined,
            items: cart.map(i => ({
                menuItemId: i.menuItem.id,
                quantity: i.quantity,
                price: i.menuItem.price
            }))
        };

        const success = await onCreate(payload);
        if (success) {
            onClose();
            setCart([]);
            setRoomId('');
            setCustomerName('');
        }
        setLoading(false);
    };

    const filteredMenu = menuItems.filter(i =>
        i.isAvailable &&
        (i.name || '').toLowerCase().includes(searchMenu.toLowerCase())
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Order" size="lg">
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-6)', minHeight: '400px' }}>
                {/* Left: Menu Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Input
                        placeholder="Search menu..."
                        value={searchMenu}
                        onChange={e => setSearchMenu(e.target.value)}
                        icon={<Search size={14} />}
                    />

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        maxHeight: '400px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '8px'
                    }}>
                        {filteredMenu.map(item => (
                            <div
                                key={item.id}
                                onClick={() => addToCart(item)}
                                style={{
                                    border: '1px solid var(--notion-border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: 'var(--notion-bg)',
                                    transition: 'all 0.2s'
                                }}
                                className="hover-card"
                            >
                                <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>₹${item.price}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Cart & Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', borderLeft: '1px solid var(--notion-border)', paddingLeft: 'var(--space-4)' }}>
                    <div>
                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Order Type</label>
                        <Select
                            value={orderType}
                            onChange={e => setOrderType(e.target.value as any)}
                            options={[
                                { value: 'ROOM_SERVICE', label: 'Room Service' },
                                { value: 'DINE_IN', label: 'Dine In' },
                                { value: 'TAKEAWAY', label: 'Takeaway' }
                            ]}
                        />
                    </div>

                    {orderType === 'ROOM_SERVICE' ? (
                        <div>
                            <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Room</label>
                            <Select
                                value={roomId}
                                onChange={e => setRoomId(e.target.value)}
                                options={[
                                    { value: '', label: 'Select Room' },
                                    ...rooms.filter(r => r.status === 'OCCUPIED').map(r => ({
                                        value: r.id.toString(),
                                        label: `Room ${r.number}`
                                    }))
                                ]}
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Customer Name</label>
                            <Input
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                placeholder="Guest Name"
                            />
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px' }}>
                        {cart.map(item => (
                            <div key={item.menuItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '14px' }}>
                                <div style={{ flex: 1 }}>
                                    <div>{item.menuItem.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>₹${item.menuItem.price} x {item.quantity}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button onClick={() => updateQuantity(item.menuItem.id, -1)} style={{ padding: '2px 6px', border: '1px solid var(--notion-border)', borderRadius: '4px' }}>-</button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.menuItem.id, 1)} style={{ padding: '2px 6px', border: '1px solid var(--notion-border)', borderRadius: '4px' }}>+</button>
                                    <button onClick={() => removeFromCart(item.menuItem.id)} style={{ marginLeft: '4px', color: 'var(--notion-red)' }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '1px solid var(--notion-border)', paddingTop: '12px', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '12px' }}>
                            <span>Total</span>
                            <span>₹${totalAmount}</span>
                        </div>
                        <Button
                            variant="primary"
                            fullWidth
                            onClick={handleSubmit}
                            disabled={loading || cart.length === 0 || (orderType === 'ROOM_SERVICE' && !roomId)}
                            loading={loading}
                        >
                            Place Order
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function OrdersPage() {
    const { orders, isLoading, fetchOrders, createOrder, updateOrderStatus } = useOrders();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');

    useEffect(() => {
        fetchOrders();
    }, []);

    const filteredOrders = orders.filter(o => {
        if (filter === 'ACTIVE') return ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status);
        if (filter === 'COMPLETED') return ['SERVED', 'CANCELLED'].includes(o.status);
        return true;
    });

    const getNextStatus = (current: OrderStatus): OrderStatus | null => {
        const flow: Record<string, OrderStatus> = {
            'PENDING': 'CONFIRMED',
            'CONFIRMED': 'PREPARING',
            'PREPARING': 'READY',
            'READY': 'SERVED'
        };
        return flow[current] || null;
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            <UtensilsCrossed size={28} />
                            Orders
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                            Kitchen display system and order management
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} variant="primary">
                        <Plus size={14} style={{ marginRight: '8px' }} /> New Order
                    </Button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--notion-border)', paddingBottom: '1px' }}>
                    {(['ACTIVE', 'COMPLETED', 'ALL'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: filter === f ? 'var(--notion-text)' : 'var(--notion-text-tertiary)',
                                borderBottom: filter === f ? '2px solid var(--notion-text)' : '2px solid transparent',
                                backgroundColor: 'transparent',
                                borderTop: 'none',
                                borderLeft: 'none',
                                borderRight: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '-2px'
                            }}
                        >
                            {f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                {/* Orders Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                    {isLoading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--notion-text-secondary)' }}>Loading orders...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--notion-text-secondary)' }}>No orders found.</div>
                    ) : (
                        filteredOrders.map(order => (
                            <div key={order.id} style={{
                                backgroundColor: 'var(--notion-bg)',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-4)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--space-3)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '16px' }}>
                                            {order.room ? `Room ${order.room.number}` : order.customerName || 'Walk-in'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                            #{order.orderNumber} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <OrderStatusBadge status={order.status} />
                                </div>

                                <div style={{ borderTop: '1px solid var(--notion-border)', borderBottom: '1px solid var(--notion-border)', padding: '8px 0', minHeight: '80px' }}>
                                    {order.items.map(item => (
                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--notion-text-secondary)' }}>{item.quantity}x</span>
                                            <span style={{ flex: 1, marginLeft: '8px' }}>{item.menuItem?.name || 'Unknown Item'}</span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                    <div style={{ fontWeight: '600' }}>₹${order.total}</div>

                                    {getNextStatus(order.status) && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                                        >
                                            Mark {getNextStatus(order.status)?.toLowerCase()}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <CreateOrderModal
                    isOpen={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    onCreate={createOrder}
                />
            </div>
        </DashboardLayout>
    );
}

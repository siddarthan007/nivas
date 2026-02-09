'use client';

import { useState } from 'react';
import { useGuestPortal } from '@/lib/hooks/useGuestPortal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import {
    Hotel,
    UtensilsCrossed,
    Sparkles,
    Receipt,
    LogOut,
    Phone,
    Clock,
    ShoppingCart,
    Plus,
    Minus,
    CheckCircle,
    Loader2,
    AlertCircle,
    BedDouble,
    DoorOpen,
} from 'lucide-react';

// Login Screen
function GuestLogin({
    onLogin,
    isLoading,
    error
}: {
    onLogin: (roomNumber: string, pin: string) => void;
    isLoading: boolean;
    error: string | null;
}) {
    const [roomNumber, setRoomNumber] = useState('');
    const [pin, setPin] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomNumber && pin.length === 4) {
            onLogin(roomNumber, pin);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--notion-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-8)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: 'var(--notion-blue-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-4)',
                    }}>
                        <Hotel size={32} style={{ color: 'var(--notion-blue)' }} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        Guest Portal
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-2)' }}>
                        Enter your room number and PIN to continue
                    </p>
                </div>

                {error && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3)',
                        backgroundColor: 'var(--notion-red-bg)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-4)',
                        fontSize: '14px',
                        color: 'var(--notion-red)',
                    }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Room Number
                        </label>
                        <Input
                            value={roomNumber}
                            onChange={e => setRoomNumber(e.target.value)}
                            placeholder="e.g., 301"
                            required
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            PIN (Last 4 digits of phone)
                        </label>
                        <Input
                            type="password"
                            maxLength={4}
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••"
                            required
                        />
                    </div>

                    <Button type="submit" disabled={isLoading || pin.length !== 4}>
                        {isLoading ? (
                            <>
                                <Loader2 size={16} style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                                Logging in...
                            </>
                        ) : (
                            'Access Portal'
                        )}
                    </Button>
                </form>

                <p style={{
                    fontSize: '12px',
                    color: 'var(--notion-text-muted)',
                    textAlign: 'center',
                    marginTop: 'var(--space-4)',
                }}>
                    <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Need help? Contact the front desk
                </p>
            </div>
        </div>
    );
}

// Cart Item
interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

// Main Portal Dashboard
function PortalDashboard({
    session,
    bills,
    menuByCategory,
    requests,
    totalSpent,
    pendingAmount,
    onPlaceOrder,
    onRequestHousekeeping,
    onRequestCheckout,
    onLogout,
}: {
    session: { guestName: string; roomNumber: string; checkInDate: string; checkOutDate: string };
    bills: { id: string; category: string; description: string; amount: number; date: string; status: string }[];
    menuByCategory: Record<string, { id: string; name: string; price: number; description?: string; available: boolean }[]>;
    requests: { id: string; type: string; status: string; createdAt: string }[];
    totalSpent: number;
    pendingAmount: number;
    onPlaceOrder: (items: { menuItemId: string; quantity: number }[], deliveryTo: 'ROOM' | 'RESTAURANT', notes?: string) => Promise<boolean>;
    onRequestHousekeeping: (notes?: string) => Promise<boolean>;
    onRequestCheckout: () => Promise<boolean>;
    onLogout: () => void;
}) {
    const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'bills' | 'requests'>('home');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [orderNotes, setOrderNotes] = useState('');
    const [deliveryTo, setDeliveryTo] = useState<'ROOM' | 'RESTAURANT'>('ROOM');
    const [isOrdering, setIsOrdering] = useState(false);
    const [showHousekeepingModal, setShowHousekeepingModal] = useState(false);
    const [housekeepingNotes, setHousekeepingNotes] = useState('');

    const addToCart = (item: { id: string; name: string; price: number }) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeFromCart = (id: string) => {
        setCart(prev => {
            const item = prev.find(i => i.id === id);
            if (item && item.quantity > 1) {
                return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.id !== id);
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handlePlaceOrder = async () => {
        setIsOrdering(true);
        const success = await onPlaceOrder(
            cart.map(item => ({ menuItemId: item.id, quantity: item.quantity })),
            deliveryTo,
            orderNotes
        );
        if (success) {
            setCart([]);
            setOrderNotes('');
            setShowCart(false);
        }
        setIsOrdering(false);
    };

    const handleHousekeeping = async () => {
        await onRequestHousekeeping(housekeepingNotes);
        setHousekeepingNotes('');
        setShowHousekeepingModal(false);
    };

    const tabs = [
        { id: 'home' as const, label: 'Home', icon: Hotel },
        { id: 'menu' as const, label: 'Menu', icon: UtensilsCrossed },
        { id: 'bills' as const, label: 'Bills', icon: Receipt },
        { id: 'requests' as const, label: 'Services', icon: Sparkles },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--notion-bg)',
            paddingBottom: '80px',
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderBottom: '1px solid var(--notion-border)',
                padding: 'var(--space-4)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    maxWidth: '600px',
                    margin: '0 auto',
                }}>
                    <div>
                        <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                            Welcome, {session.guestName}
                        </div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <BedDouble size={18} />
                            Room {session.roomNumber}
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={onLogout}>
                        <LogOut size={14} />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-4)' }}>
                {activeTab === 'home' && (
                    <>
                        {/* Quick Stats */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 'var(--space-3)',
                            marginBottom: 'var(--space-5)',
                        }}>
                            <div style={{
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                                padding: 'var(--space-4)',
                            }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Total Spent</div>
                                <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                    NPR {totalSpent.toLocaleString()}
                                </div>
                            </div>
                            <div style={{
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                                padding: 'var(--space-4)',
                            }}>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Pending</div>
                                <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)' }}>
                                    NPR {pendingAmount.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div style={{ marginBottom: 'var(--space-5)' }}>
                            <h2 style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-3)',
                            }}>
                                Quick Actions
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <button
                                    onClick={() => setActiveTab('menu')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-3)',
                                        padding: 'var(--space-4)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--notion-border)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'background-color 150ms ease',
                                    }}
                                >
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-yellow-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <UtensilsCrossed size={22} style={{ color: 'var(--notion-orange)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--notion-text)' }}>Order Food</div>
                                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            To room or restaurant
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setShowHousekeepingModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-3)',
                                        padding: 'var(--space-4)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--notion-border)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'background-color 150ms ease',
                                    }}
                                >
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-blue-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Sparkles size={22} style={{ color: 'var(--notion-blue)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--notion-text)' }}>Request Housekeeping</div>
                                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            Clean room, towels, etc.
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={onRequestCheckout}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-3)',
                                        padding: 'var(--space-4)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--notion-border)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'background-color 150ms ease',
                                    }}
                                >
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-green-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <DoorOpen size={22} style={{ color: 'var(--notion-green)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--notion-text)' }}>Request Checkout</div>
                                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            Notify front desk
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Stay Info */}
                        <div style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                            padding: 'var(--space-4)',
                        }}>
                            <h3 style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-3)',
                            }}>
                                Stay Details
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 'var(--space-3)',
                                fontSize: '13px',
                            }}>
                                <div>
                                    <div style={{ color: 'var(--notion-text-secondary)' }}>Check-in</div>
                                    <div style={{ color: 'var(--notion-text)' }}>
                                        {new Date(session.checkInDate).toLocaleDateString()}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--notion-text-secondary)' }}>Check-out</div>
                                    <div style={{ color: 'var(--notion-text)' }}>
                                        {new Date(session.checkOutDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'menu' && (
                    <>
                        <h2 style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            marginBottom: 'var(--space-4)',
                        }}>
                            Our Menu
                        </h2>

                        {Object.entries(menuByCategory).map(([category, items]) => (
                            <div key={category} style={{ marginBottom: 'var(--space-5)' }}>
                                <h3 style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: 'var(--notion-text-secondary)',
                                    marginBottom: 'var(--space-3)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    {category}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {items.map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 'var(--space-3)',
                                                backgroundColor: 'var(--notion-bg-secondary)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--notion-border)',
                                                opacity: item.available ? 1 : 0.5,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>
                                                    {item.name}
                                                </div>
                                                {item.description && (
                                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                        {item.description}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '13px', color: 'var(--notion-blue)', marginTop: '2px' }}>
                                                    NPR {item.price}
                                                </div>
                                            </div>
                                            {item.available && (
                                                <Button size="sm" onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}>
                                                    <Plus size={14} />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'bills' && (
                    <>
                        <h2 style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            marginBottom: 'var(--space-4)',
                        }}>
                            Your Bills
                        </h2>

                        {bills.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-8)',
                                color: 'var(--notion-text-secondary)',
                            }}>
                                <Receipt size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                                <p>No bills yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {bills.map(bill => (
                                    <div
                                        key={bill.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--space-3) var(--space-4)',
                                            backgroundColor: 'var(--notion-bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--notion-border)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>
                                                {bill.description}
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-2)',
                                                fontSize: '12px',
                                                color: 'var(--notion-text-secondary)',
                                            }}>
                                                <span>{bill.category}</span>
                                                <span>•</span>
                                                <span>{new Date(bill.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '600', color: 'var(--notion-text)' }}>
                                                NPR {bill.amount}
                                            </div>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '10px',
                                                fontWeight: '500',
                                                backgroundColor: bill.status === 'PAID' ? 'var(--notion-green-bg)' : 'var(--notion-yellow-bg)',
                                                color: bill.status === 'PAID' ? 'var(--notion-green)' : 'var(--notion-orange)',
                                            }}>
                                                {bill.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'requests' && (
                    <>
                        <h2 style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                            marginBottom: 'var(--space-4)',
                        }}>
                            Service Requests
                        </h2>

                        {requests.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-8)',
                                color: 'var(--notion-text-secondary)',
                            }}>
                                <Sparkles size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                                <p>No active requests</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {requests.map(req => (
                                    <div
                                        key={req.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--space-3) var(--space-4)',
                                            backgroundColor: 'var(--notion-bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--notion-border)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>
                                                {req.type.replace('_', ' ')}
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '12px',
                                                color: 'var(--notion-text-secondary)',
                                            }}>
                                                <Clock size={12} />
                                                {new Date(req.createdAt).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            backgroundColor: req.status === 'COMPLETED' ? 'var(--notion-green-bg)' :
                                                req.status === 'IN_PROGRESS' ? 'var(--notion-blue-bg)' : 'var(--notion-yellow-bg)',
                                            color: req.status === 'COMPLETED' ? 'var(--notion-green)' :
                                                req.status === 'IN_PROGRESS' ? 'var(--notion-blue)' : 'var(--notion-orange)',
                                        }}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom Navigation */}
            <nav style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'var(--notion-bg-secondary)',
                borderTop: '1px solid var(--notion-border)',
                padding: 'var(--space-2)',
                display: 'flex',
                justifyContent: 'center',
            }}>
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    maxWidth: '400px',
                    width: '100%',
                }}>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: 'var(--space-2)',
                                    backgroundColor: isActive ? 'var(--notion-bg-active)' : 'transparent',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: isActive ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                                    transition: 'all 150ms ease',
                                }}
                            >
                                <Icon size={20} />
                                <span style={{ fontSize: '11px', fontWeight: '500' }}>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Cart Button */}
            {cart.length > 0 && (
                <button
                    onClick={() => setShowCart(true)}
                    style={{
                        position: 'fixed',
                        bottom: '90px',
                        right: '20px',
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--notion-blue)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    <ShoppingCart size={24} />
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        backgroundColor: 'var(--notion-red)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        fontSize: '11px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                </button>
            )}

            {/* Cart Modal */}
            <Modal
                isOpen={showCart}
                onClose={() => setShowCart(false)}
                title="Your Order"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {cart.map(item => (
                        <div
                            key={item.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 'var(--space-3)',
                                backgroundColor: 'var(--notion-bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>{item.name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                    NPR {item.price} x {item.quantity}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <button
                                    onClick={() => removeFromCart(item.id)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--notion-text)',
                                    }}
                                >
                                    <Minus size={14} />
                                </button>
                                <span style={{ fontWeight: '600', color: 'var(--notion-text)' }}>{item.quantity}</span>
                                <button
                                    onClick={() => addToCart(item)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--notion-text)',
                                    }}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    ))}

                    <div style={{
                        padding: 'var(--space-3)',
                        backgroundColor: 'var(--notion-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Deliver to
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button
                                size="sm"
                                variant={deliveryTo === 'ROOM' ? 'primary' : 'secondary'}
                                onClick={() => setDeliveryTo('ROOM')}
                                style={{ flex: 1 }}
                            >
                                Room
                            </Button>
                            <Button
                                size="sm"
                                variant={deliveryTo === 'RESTAURANT' ? 'primary' : 'secondary'}
                                onClick={() => setDeliveryTo('RESTAURANT')}
                                style={{ flex: 1 }}
                            >
                                Restaurant
                            </Button>
                        </div>
                    </div>

                    <Input
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        placeholder="Special instructions (optional)"
                    />

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: 'var(--space-3) 0',
                        borderTop: '1px solid var(--notion-divider)',
                        fontWeight: '600',
                    }}>
                        <span style={{ color: 'var(--notion-text)' }}>Total</span>
                        <span style={{ color: 'var(--notion-blue)' }}>NPR {cartTotal.toLocaleString()}</span>
                    </div>

                    <Button onClick={handlePlaceOrder} disabled={isOrdering} style={{ width: '100%' }}>
                        {isOrdering ? (
                            <>
                                <Loader2 size={16} style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                                Placing Order...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={16} style={{ marginRight: '6px' }} />
                                Place Order
                            </>
                        )}
                    </Button>
                </div>
            </Modal>

            {/* Housekeeping Modal */}
            <Modal
                isOpen={showHousekeepingModal}
                onClose={() => setShowHousekeepingModal(false)}
                title="Request Housekeeping"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        Our housekeeping team will attend to your room shortly.
                    </p>
                    <Input
                        value={housekeepingNotes}
                        onChange={e => setHousekeepingNotes(e.target.value)}
                        placeholder="Additional notes (optional)"
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => setShowHousekeepingModal(false)} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button onClick={handleHousekeeping} style={{ flex: 1 }}>
                            <Sparkles size={14} style={{ marginRight: '6px' }} />
                            Request
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// Main Page Component
export default function GuestPortalPage() {
    const {
        session,
        isAuthenticated,
        isLoading,
        error,
        bills,
        menuByCategory,
        requests,
        totalSpent,
        pendingAmount,
        loginWithPin,
        placeOrder,
        requestHousekeeping,
        requestCheckout,
        logout,
    } = useGuestPortal();

    if (!isAuthenticated) {
        return (
            <GuestLogin
                onLogin={loginWithPin}
                isLoading={isLoading}
                error={error}
            />
        );
    }

    if (!session) return null;

    return (
        <PortalDashboard
            session={session}
            bills={bills}
            menuByCategory={menuByCategory}
            requests={requests}
            totalSpent={totalSpent}
            pendingAmount={pendingAmount}
            onPlaceOrder={placeOrder}
            onRequestHousekeeping={requestHousekeeping}
            onRequestCheckout={requestCheckout}
            onLogout={logout}
        />
    );
}

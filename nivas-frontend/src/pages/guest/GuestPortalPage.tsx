'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useGuestPortal, type ActivityItem, type GuestBillSummary, type PortalConfig } from '@/lib/hooks/useGuestPortal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useTheme } from '@/lib/contexts/ThemeContext';
import {
    Hotel,
    UtensilsCrossed,
    Sparkles,
    Receipt,
    LogOut,
    Wifi,
    Phone,
    Mail,
    MapPin,
    Clock,
    ShoppingCart,
    Plus,
    Minus,
    CheckCircle,
    Loader2,
    AlertCircle,
    BedDouble,
    DoorOpen,
    Dumbbell,
    Waves,
    Coffee,
    RefreshCw,
    Star,
    Send,
    Sun,
    Moon,
    Package,
    CalendarDays,
} from 'lucide-react';

// Small theme toggle for guest portal header
function ThemeToggleButton() {
    const { resolvedTheme, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            title={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            style={{
                background: 'transparent',
                border: '1px solid var(--notion-border)',
                color: 'var(--notion-text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
            }}
            className="hover-bg"
        >
            {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
    );
}

// Login Screen
function GuestLogin({
    onLogin,
    isLoading,
    error
}: {
    onLogin: (roomNumber: string, pin: string, hotelSlug?: string) => void;
    isLoading: boolean;
    error: string | null;
}) {
    const [roomNumber, setRoomNumber] = useState('');
    const [pin, setPin] = useState('');
    const [hotelSlug, setHotelSlug] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('hotel') || '';
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomNumber && pin.length === 4) {
            onLogin(roomNumber, pin, hotelSlug || undefined);
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

// --- Activity progress helpers (shared by Home "Active" + Services tab) ---

/** Step labels + current index for an activity item, differentiated by kind. */
function getActivityProgress(item: Pick<ActivityItem, 'kind' | 'status'>): { steps: string[]; currentStep: number; cancelled: boolean } {
    const status = (item.status || '').toUpperCase();
    const cancelled = status === 'CANCELLED';
    if (item.kind === 'ORDER') {
        const steps = ['Received', 'Preparing', 'Ready', 'Served'];
        const map: Record<string, number> = { PENDING: 0, CONFIRMED: 0, PREPARING: 1, READY: 2, SERVED: 3, COMPLETED: 3 };
        return { steps, currentStep: map[status] ?? 0, cancelled };
    }
    const steps = ['Requested', 'In Progress', 'Done'];
    const map: Record<string, number> = { PENDING: 0, IN_PROGRESS: 1, STARTED: 1, COMPLETED: 2, DONE: 2 };
    return { steps, currentStep: map[status] ?? 0, cancelled };
}

/** A status badge {label,bg,color} for an activity item. */
function getActivityBadge(item: Pick<ActivityItem, 'kind' | 'status'>): { label: string; bg: string; color: string } {
    const s = (item.status || '').toUpperCase();
    if (s === 'CANCELLED') return { label: 'Cancelled', bg: 'var(--notion-red-bg)', color: 'var(--notion-red)' };
    if (s === 'SERVED' || s === 'COMPLETED' || s === 'DONE') return { label: item.kind === 'ORDER' ? 'Served' : 'Done', bg: 'var(--notion-green-bg)', color: 'var(--notion-green)' };
    if (s === 'READY') return { label: 'Ready', bg: 'var(--notion-blue-bg)', color: 'var(--notion-blue)' };
    if (s === 'PREPARING' || s === 'IN_PROGRESS' || s === 'STARTED') return { label: item.kind === 'ORDER' ? 'Preparing' : 'In progress', bg: 'var(--notion-blue-bg)', color: 'var(--notion-blue)' };
    return { label: item.kind === 'ORDER' ? 'Received' : 'Requested', bg: 'var(--notion-yellow-bg)', color: 'var(--notion-orange)' };
}

/** Human-friendly title for an activity item. */
function getActivityTitle(item: Pick<ActivityItem, 'kind' | 'type' | 'orderNumber'>): string {
    if (item.kind === 'ORDER') return item.orderNumber ? `Order #${item.orderNumber}` : 'Food Order';
    const t = (item.type || 'CLEANING').replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Whether an activity item is in a terminal (done/cancelled) state. */
function isActivityDone(item: Pick<ActivityItem, 'status'>): boolean {
    const s = (item.status || '').toUpperCase();
    return s === 'SERVED' || s === 'COMPLETED' || s === 'DONE' || s === 'CANCELLED';
}

// Main Portal Dashboard
function PortalDashboard({
    session,
    bills,
    billSummary,
    portalConfig,
    menuByCategory,
    requests,
    totalSpent,
    pendingAmount,
    onPlaceOrder,
    onRequestHousekeeping,
    onRequestCheckout,
    onRequestAmenity,
    fetchRequests,
    onLogout,
}: {
    session: { guestName: string; roomNumber: string; checkInDate: string; checkOutDate: string };
    bills: { id: string; category: string; description: string; amount: number; date: string; status: string }[];
    billSummary: GuestBillSummary | null;
    portalConfig: PortalConfig | null;
    menuByCategory: Record<string, { id: string; name: string; price: number; description?: string; available: boolean }[]>;
    requests: ActivityItem[];
    totalSpent: number;
    pendingAmount: number;
    onPlaceOrder: (items: { menuItemId: string; quantity: number }[], deliveryTo: 'ROOM' | 'RESTAURANT', notes?: string) => Promise<boolean>;
    onRequestHousekeeping: (notes?: string) => Promise<boolean>;
    onRequestCheckout: () => Promise<boolean>;
    onRequestAmenity: (notes: string) => Promise<boolean>;
    fetchRequests: () => void;
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
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showAmenityModal, setShowAmenityModal] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

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

    const handleCheckout = async () => {
        setIsCheckingOut(true);
        await onRequestCheckout();
        setIsCheckingOut(false);
        setShowCheckoutModal(false);
    };

    const handleAmenityRequest = async (amenity: string) => {
        await onRequestAmenity(`Requesting: ${amenity}`);
        setShowAmenityModal(false);
    };

    const handleFeedbackSubmit = async () => {
        if (feedbackRating <= 0) return;
        try {
            // Persist to the backend (was only saved to localStorage — never reached staff).
            await api.post('/guest/actions/feedback', { rating: feedbackRating, comment: feedbackComment || undefined });
            setFeedbackSubmitted(true);
        } catch (e: any) {
            toast.error(e?.message || 'Could not submit feedback. Please try again.');
        }
    };

    const checkIn = new Date(session.checkInDate);
    const checkOut = new Date(session.checkOutDate);
    const today = new Date();
    const totalDays = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.ceil((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, totalDays - elapsedDays);
    const progressPercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    const pendingRequests = requests.filter(r => !isActivityDone(r));

    useEffect(() => {
        if (pendingRequests.length === 0) return;
        const interval = setInterval(() => fetchRequests(), 30_000);
        return () => clearInterval(interval);
    }, [pendingRequests.length, fetchRequests]);

    const amenityOptions = [
        { label: 'Extra Towels', icon: '🛁' },
        { label: 'Extra Pillows', icon: '🛏️' },
        { label: 'Toiletries', icon: '🧴' },
        { label: 'Iron & Board', icon: '👔' },
        { label: 'Baby Crib', icon: '👶' },
        { label: 'Water Bottles', icon: '💧' },
    ];

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
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <ThemeToggleButton />
                        <Button variant="secondary" size="sm" onClick={() => fetchRequests()}>
                            <RefreshCw size={14} />
                        </Button>
                        <Button variant="secondary" size="sm" onClick={onLogout}>
                            <LogOut size={14} />
                        </Button>
                    </div>
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

                        {/* Stay Progress */}
                        <div style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                            padding: 'var(--space-4)',
                            marginBottom: 'var(--space-5)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CalendarDays size={16} />
                                    Stay Progress
                                </h3>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-blue)' }}>
                                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                                </span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                backgroundColor: 'var(--notion-bg-tertiary)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                marginBottom: 'var(--space-3)',
                            }}>
                                <div style={{
                                    width: `${progressPercent}%`,
                                    height: '100%',
                                    backgroundColor: 'var(--notion-blue)',
                                    borderRadius: '4px',
                                    transition: 'width 500ms ease',
                                }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <div>
                                    <div style={{ color: 'var(--notion-text-secondary)' }}>Check-in</div>
                                    <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>
                                        {checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                                <div style={{ alignSelf: 'center', fontSize: '11px', color: 'var(--notion-text-muted)' }}>
                                    {elapsedDays} of {totalDays} nights
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: 'var(--notion-text-secondary)' }}>Check-out</div>
                                    <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>
                                        {checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hotel Info / Portal Config */}
                        {portalConfig && (
                            <div style={{
                                backgroundColor: 'var(--notion-bg-secondary)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--notion-border)',
                                padding: 'var(--space-4)',
                                marginBottom: 'var(--space-5)',
                            }}>
                                {portalConfig.welcomeMessage && (
                                    <div style={{ fontSize: '14px', color: 'var(--notion-text)', marginBottom: 'var(--space-3)', fontWeight: '500' }}>
                                        {portalConfig.welcomeMessage}
                                    </div>
                                )}

                                {portalConfig.wifiNetworks.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-3)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Wifi size={12} />
                                            WiFi
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {portalConfig.wifiNetworks.map((net, i) => (
                                                <div key={i} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '8px 12px',
                                                    backgroundColor: 'var(--notion-bg)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--notion-border)',
                                                }}>
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>{net.ssid}</div>
                                                        {net.floor && <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>{net.floor}</div>}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', fontFamily: 'monospace' }}>
                                                        {net.password}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(portalConfig.hotelPhone || portalConfig.hotelEmail || Object.keys(portalConfig.contactNumbers).length > 0) && (
                                    <div style={{ marginBottom: 'var(--space-3)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Phone size={12} />
                                            Contacts
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                            {portalConfig.hotelPhone && (
                                                <a href={`tel:${portalConfig.hotelPhone}`} style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    padding: '4px 10px', backgroundColor: 'var(--notion-bg)',
                                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                                    fontSize: '12px', color: 'var(--notion-blue)', textDecoration: 'none'
                                                }}>
                                                    <Phone size={12} /> {portalConfig.hotelPhone}
                                                </a>
                                            )}
                                            {portalConfig.hotelEmail && (
                                                <a href={`mailto:${portalConfig.hotelEmail}`} style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    padding: '4px 10px', backgroundColor: 'var(--notion-bg)',
                                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                                    fontSize: '12px', color: 'var(--notion-blue)', textDecoration: 'none'
                                                }}>
                                                    <Mail size={12} /> {portalConfig.hotelEmail}
                                                </a>
                                            )}
                                            {Object.entries(portalConfig.contactNumbers).map(([label, number]) => (
                                                <a key={label} href={`tel:${number}`} style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    padding: '4px 10px', backgroundColor: 'var(--notion-bg)',
                                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                                    fontSize: '12px', color: 'var(--notion-blue)', textDecoration: 'none'
                                                }}>
                                                    <Phone size={12} /> {label}: {number}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {portalConfig.customSections.map((section, i) => (
                                    <div key={i} style={{ marginBottom: i < portalConfig.customSections.length - 1 ? 'var(--space-3)' : 0 }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                                            {section.title}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--notion-text)', whiteSpace: 'pre-line' }}>
                                            {section.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

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
                                    onClick={() => setShowCheckoutModal(true)}
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

                                <button
                                    onClick={() => setShowAmenityModal(true)}
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
                                        backgroundColor: 'var(--notion-bg-active)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Package size={22} style={{ color: 'var(--notion-text-secondary)' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--notion-text)' }}>Request Amenities</div>
                                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            Towels, pillows, toiletries
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Active Orders & Requests */}
                        {pendingRequests.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-5)' }}>
                                <h2 style={{
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: 'var(--notion-text)',
                                    marginBottom: 'var(--space-3)',
                                }}>
                                    Active Orders &amp; Requests
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {pendingRequests.map(req => {
                                        const { steps, currentStep } = getActivityProgress(req);
                                        const badge = getActivityBadge(req);
                                        return (
                                            <div key={req.id} style={{
                                                padding: 'var(--space-4)',
                                                backgroundColor: 'var(--notion-bg-secondary)',
                                                borderRadius: 'var(--radius-lg)',
                                                border: '1px solid var(--notion-border)',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                                    <span style={{ fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {req.kind === 'ORDER' ? <UtensilsCrossed size={14} style={{ color: 'var(--notion-orange)' }} /> : <Sparkles size={14} style={{ color: 'var(--notion-blue)' }} />}
                                                        {getActivityTitle(req)}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: 'var(--radius-full)',
                                                        backgroundColor: badge.bg,
                                                        color: badge.color,
                                                    }}>
                                                        {badge.label}
                                                    </span>
                                                </div>
                                                {req.kind === 'ORDER' && req.items.length > 0 && (
                                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                                        {req.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                                                    </div>
                                                )}
                                                {req.kind === 'SERVICE' && req.notes && (
                                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                                        {req.notes}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                                                    {steps.map((label, i) => (
                                                        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <div style={{
                                                                width: '100%',
                                                                height: '4px',
                                                                borderRadius: '2px',
                                                                backgroundColor: i <= currentStep ? 'var(--notion-blue)' : 'var(--notion-bg-tertiary)',
                                                                position: 'relative',
                                                                overflow: 'hidden',
                                                            }}>
                                                                {i === currentStep && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                                                        animation: 'shimmer 1.5s infinite',
                                                                    }} />
                                                                )}
                                                            </div>
                                                            <span style={{
                                                                fontSize: '10px',
                                                                color: i <= currentStep ? 'var(--notion-blue)' : 'var(--notion-text-muted)',
                                                                fontWeight: i === currentStep ? '600' : '400',
                                                            }}>
                                                                {label}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

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

                        {/* Hotel Info & Amenities */}
                        <div style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                            padding: 'var(--space-4)',
                            marginTop: 'var(--space-4)',
                        }}>
                            <h3 style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-3)',
                            }}>
                                Hotel Info & Amenities
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '13px' }}>
                                    <Wifi size={16} style={{ color: 'var(--notion-blue)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>WiFi</div>
                                        <div style={{ color: 'var(--notion-text-secondary)' }}>Network: Hotel_Guest · Ask front desk for password</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '13px' }}>
                                    <Waves size={16} style={{ color: 'var(--notion-blue)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>Pool</div>
                                        <div style={{ color: 'var(--notion-text-secondary)' }}>7:00 AM – 9:00 PM</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '13px' }}>
                                    <Dumbbell size={16} style={{ color: 'var(--notion-blue)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>Gym</div>
                                        <div style={{ color: 'var(--notion-text-secondary)' }}>6:00 AM – 10:00 PM</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '13px' }}>
                                    <Coffee size={16} style={{ color: 'var(--notion-blue)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>Restaurant</div>
                                        <div style={{ color: 'var(--notion-text-secondary)' }}>Breakfast 7–10 AM · Lunch 12–3 PM · Dinner 6–10 PM</div>
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    fontSize: '13px',
                                    paddingTop: 'var(--space-2)',
                                    borderTop: '1px solid var(--notion-divider)',
                                }}>
                                    <Phone size={16} style={{ color: 'var(--notion-green)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ color: 'var(--notion-text)', fontWeight: '500' }}>Front Desk</div>
                                        <div style={{ color: 'var(--notion-text-secondary)' }}>Dial 0 from room phone · Available 24/7</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rate Your Stay */}
                        <div style={{
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                            padding: 'var(--space-4)',
                            marginTop: 'var(--space-4)',
                        }}>
                            <h3 style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-3)',
                            }}>
                                Rate Your Stay
                            </h3>
                            {feedbackSubmitted ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 'var(--space-4)',
                                    color: 'var(--notion-green)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                }}>
                                    <CheckCircle size={32} />
                                    <span style={{ fontWeight: '500' }}>Thank you for your feedback!</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                onClick={() => setFeedbackRating(star)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    transition: 'transform 150ms ease',
                                                    transform: feedbackRating >= star ? 'scale(1.2)' : 'scale(1)',
                                                }}
                                            >
                                                <Star
                                                    size={28}
                                                    fill={feedbackRating >= star ? 'var(--notion-yellow, #f5a623)' : 'none'}
                                                    style={{ color: feedbackRating >= star ? 'var(--notion-yellow, #f5a623)' : 'var(--notion-text-muted)' }}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <Input
                                        value={feedbackComment}
                                        onChange={e => setFeedbackComment(e.target.value)}
                                        placeholder="Tell us about your experience (optional)"
                                    />
                                    <Button
                                        onClick={handleFeedbackSubmit}
                                        disabled={feedbackRating === 0}
                                        style={{ width: '100%' }}
                                    >
                                        <Send size={14} style={{ marginRight: '6px' }} />
                                        Submit Feedback
                                    </Button>
                                </div>
                            )}
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
                            Your Bill
                        </h2>

                        {!billSummary ? (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-8)',
                                color: 'var(--notion-text-secondary)',
                            }}>
                                <Receipt size={40} style={{ opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                                <p>No bill yet</p>
                                <p style={{ fontSize: '13px', marginTop: 'var(--space-2)' }}>Your charges will appear once checked in.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {/* Summary Card */}
                                <div style={{
                                    padding: 'var(--space-4)',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>Room Charge</span>
                                        <span style={{ fontWeight: '500' }}>NPR {billSummary.roomCharge.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>Food &amp; Beverage</span>
                                        <span style={{ fontWeight: '500' }}>NPR {billSummary.ordersTotal.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>Service Charge ({(billSummary.serviceChargeRate * 100).toFixed(0)}%)</span>
                                        <span style={{ fontWeight: '500' }}>NPR {billSummary.serviceCharge.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>VAT ({(billSummary.taxRate * 100).toFixed(0)}%)</span>
                                        <span style={{ fontWeight: '500' }}>NPR {billSummary.vat.toLocaleString()}</span>
                                    </div>
                                    <div style={{ height: '1px', backgroundColor: 'var(--notion-border)', marginBottom: 'var(--space-3)' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                        <span style={{ fontWeight: '600', color: 'var(--notion-text)' }}>Total</span>
                                        <span style={{ fontWeight: '700', color: 'var(--notion-text)' }}>NPR {billSummary.grandTotal.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>Paid</span>
                                        <span style={{ fontWeight: '500', color: 'var(--notion-green)' }}>NPR {billSummary.paidAmount.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--notion-text-secondary)' }}>Amount Due</span>
                                        <span style={{ fontWeight: '700', color: billSummary.dueAmount > 0 ? 'var(--notion-orange)' : 'var(--notion-green)' }}>
                                            NPR {billSummary.dueAmount.toLocaleString()}
                                        </span>
                                    </div>
                                    {billSummary.pendingOrdersTotal > 0 && (
                                        <div style={{ marginTop: 'var(--space-3)', fontSize: '12px', color: 'var(--notion-text-muted)', textAlign: 'center' }}>
                                            NPR {billSummary.pendingOrdersTotal.toLocaleString()} in pending orders not yet billed
                                        </div>
                                    )}
                                </div>

                                {/* Itemized Line Items */}
                                {bills.length > 0 && (
                                    <>
                                        <h3 style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            color: 'var(--notion-text)',
                                            marginTop: 'var(--space-2)',
                                        }}>
                                            Charges
                                        </h3>
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
                                                        <div style={{ fontWeight: '500', color: 'var(--notion-text)', fontSize: '14px' }}>
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
                                                            NPR {bill.amount.toLocaleString()}
                                                        </div>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '10px',
                                                            fontWeight: '500',
                                                            backgroundColor: bill.status === 'BILLED' ? 'var(--notion-green-bg)' :
                                                                bill.status === 'PAID' ? 'var(--notion-green-bg)' : 'var(--notion-yellow-bg)',
                                                            color: bill.status === 'BILLED' ? 'var(--notion-green)' :
                                                                bill.status === 'PAID' ? 'var(--notion-green)' : 'var(--notion-orange)',
                                                        }}>
                                                            {bill.status === 'BILLED' ? 'Billed' : bill.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
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
                                {requests.map(req => {
                                    const badge = getActivityBadge(req);
                                    return (
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
                                            <div style={{ fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {req.kind === 'ORDER' ? <UtensilsCrossed size={14} style={{ color: 'var(--notion-orange)' }} /> : <Sparkles size={14} style={{ color: 'var(--notion-blue)' }} />}
                                                {getActivityTitle(req)}
                                                {req.kind === 'ORDER' && req.totalAmount != null && (
                                                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', fontWeight: 400 }}>
                                                        · NPR {req.totalAmount.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            {req.kind === 'ORDER' && req.items.length > 0 && (
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '2px' }}>
                                                    {req.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                                                </div>
                                            )}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '12px',
                                                color: 'var(--notion-text-secondary)',
                                                marginTop: '2px',
                                            }}>
                                                <Clock size={12} />
                                                {new Date(req.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            backgroundColor: badge.bg,
                                            color: badge.color,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {badge.label}
                                        </span>
                                    </div>
                                    );
                                })}
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
                padding: 'var(--space-3) var(--space-2)',
                paddingBottom: 'env(safe-area-inset-bottom, var(--space-3))',
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
                        color: 'var(--foreground-inverse)',
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
                        color: 'var(--foreground-inverse)',
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

            {/* Checkout Confirmation Modal */}
            <Modal
                isOpen={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                title="Request Checkout"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{
                        padding: 'var(--space-4)',
                        backgroundColor: 'var(--notion-yellow-bg)',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'center',
                    }}>
                        <AlertCircle size={24} style={{ color: 'var(--notion-orange)', marginBottom: 'var(--space-2)' }} />
                        <p style={{ fontSize: '14px', color: 'var(--notion-text)', margin: 0 }}>
                            Are you sure you want to request checkout? The front desk will prepare your bill.
                        </p>
                    </div>
                    {pendingAmount > 0 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--notion-bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '14px',
                        }}>
                            <span style={{ color: 'var(--notion-text-secondary)' }}>Pending bill</span>
                            <span style={{ fontWeight: '600', color: 'var(--notion-orange)' }}>NPR {pendingAmount.toLocaleString()}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => setShowCheckoutModal(false)} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button onClick={handleCheckout} disabled={isCheckingOut} style={{ flex: 1 }}>
                            {isCheckingOut ? (
                                <>
                                    <Loader2 size={14} style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                                    Requesting...
                                </>
                            ) : (
                                <>
                                    <DoorOpen size={14} style={{ marginRight: '6px' }} />
                                    Confirm Checkout
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Amenity Request Modal */}
            <Modal
                isOpen={showAmenityModal}
                onClose={() => setShowAmenityModal(false)}
                title="Request Amenities"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                        Tap an item to request it. We'll deliver it to your room.
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 'var(--space-2)',
                    }}>
                        {amenityOptions.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => handleAmenityRequest(opt.label)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    padding: 'var(--space-4)',
                                    backgroundColor: 'var(--notion-bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--notion-border)',
                                    cursor: 'pointer',
                                    transition: 'background-color 150ms ease',
                                }}
                            >
                                <span style={{ fontSize: '24px' }}>{opt.icon}</span>
                                <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                    {opt.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
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
        billSummary,
        portalConfig,
        menuByCategory,
        requests,
        totalSpent,
        pendingAmount,
        loginWithPin,
        placeOrder,
        requestHousekeeping,
        requestRoomService,
        requestCheckout,
        fetchRequests,
        submitFeedback,
        logout,
    } = useGuestPortal();

    if (isLoading && !isAuthenticated) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--notion-bg)',
            }}>
                <Loader2 size={32} style={{ color: 'var(--notion-blue)', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

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
        <>
            <PortalDashboard
                session={session}
                bills={bills}
                billSummary={billSummary}
                portalConfig={portalConfig}
                menuByCategory={menuByCategory}
                requests={requests}
                totalSpent={totalSpent}
                pendingAmount={pendingAmount}
                onPlaceOrder={placeOrder}
                onRequestHousekeeping={requestHousekeeping}
                onRequestCheckout={requestCheckout}
                onRequestAmenity={requestRoomService}
                fetchRequests={fetchRequests}
                onLogout={logout}
            />
        </>
    );
}

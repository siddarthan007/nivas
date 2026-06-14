'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Button from '@/components/ui/Button';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import { useKitchen, type KitchenOrder, type KitchenOrderItem } from '@/lib/hooks/useKitchen';
import { usePermissions } from '@/lib/hooks/usePermissions';
import {
    ChefHat,
    Clock,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Flame,
    Timer,
    Maximize2,
    Minimize2,
    Loader2,
    UtensilsCrossed
} from 'lucide-react';

// Status colors
const getStatusStyle = (status: string) => {
    switch (status) {
        case 'PENDING': return { bg: 'var(--notion-yellow-bg)', border: 'var(--notion-yellow)', text: 'var(--notion-yellow)' };
        case 'PREPARING': return { bg: 'var(--notion-blue-bg)', border: 'var(--notion-blue)', text: 'var(--notion-blue)' };
        case 'READY': return { bg: 'var(--notion-green-bg)', border: 'var(--notion-green)', text: 'var(--notion-green)' };
        default: return { bg: 'var(--notion-gray-bg)', border: 'var(--notion-border)', text: 'var(--notion-text-secondary)' };
    }
};

const getOrderTypeLabel = (type: string) => {
    switch (type) {
        case 'DINE_IN': return 'Dine In';
        case 'TAKEAWAY': return 'Takeaway';
        case 'ROOM_SERVICE': return 'Room Service';
        case 'DELIVERY': return 'Delivery';
        default: return type;
    }
};

// Time elapsed helper
const getTimeElapsed = (createdAt: string): string => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
};

// KOT Card Component
function KOTCard({ order, onStatusChange, onItemStatusChange, onDismiss, isUpdating, isShaking }: { order: KitchenOrder; onStatusChange: (id: number, status: KitchenOrder['status']) => void; onItemStatusChange: (orderId: number, itemId: number, status: KitchenOrderItem['status']) => void; onDismiss?: (id: number) => void; isUpdating: boolean; isShaking?: boolean }) {
    const { can } = usePermissions();
    const statusStyle = getStatusStyle(order.status);
    const timeElapsed = getTimeElapsed(order.createdAt);
    const isOverdue = new Date().getTime() - new Date(order.createdAt).getTime() > 15 * 60000; // 15 mins

    // Calculate item progress
    const itemsDone = order.items.filter(i => i.status === 'READY').length;
    const totalItems = order.items.length;
    const allItemsReady = totalItems > 0 && itemsDone === totalItems;

    return (
        <div style={{
            animation: isShaking ? 'kotShake 0.45s ease-in-out 1, kotGlow 1.6s ease-in-out 2' : 'none',
            backgroundColor: 'var(--notion-bg)',
            border: `2px solid ${statusStyle.border}`,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: isOverdue ? '0 0 0 2px var(--notion-red)' : 'var(--shadow-md)',
            transition: 'all 0.2s ease'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                backgroundColor: statusStyle.bg,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${statusStyle.border}`
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--notion-text)' }}>
                        #{order.orderNumber}
                    </span>
                    {order.priority === 'RUSH' && <Flame size={16} color="var(--notion-red)" />}
                    {order.priority === 'VIP' && <span style={{ fontSize: '12px', backgroundColor: 'var(--notion-yellow)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>VIP</span>}
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '13px',
                    color: isOverdue ? 'var(--notion-red)' : 'var(--notion-text-secondary)'
                }}>
                    {isOverdue ? <AlertCircle size={14} /> : <Clock size={14} />}
                    {timeElapsed}
                </div>
            </div>

            {/* Order Info */}
            <div style={{
                padding: '8px 16px',
                backgroundColor: 'var(--notion-bg-secondary)',
                display: 'flex',
                gap: '16px',
                fontSize: '13px',
                color: 'var(--notion-text-secondary)'
            }}>
                <span>{getOrderTypeLabel(order.orderType)}</span>
                {order.tableNumber && <span>Table: <strong>{order.tableNumber}</strong></span>}
                {order.roomNumber && <span>Room: <strong>{order.roomNumber}</strong></span>}
                <span style={{ marginLeft: 'auto', fontWeight: '600', color: itemsDone === totalItems ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                    {itemsDone}/{totalItems} items
                </span>
            </div>

            {/* Items */}
            <div style={{ padding: '12px 16px', maxHeight: '200px', overflowY: 'auto' }}>
                {order.items.map((item, idx) => (
                    <div key={item.id || idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '8px 0',
                        borderBottom: idx < order.items.length - 1 ? '1px solid var(--notion-border)' : 'none',
                        opacity: item.status === 'READY' ? 0.6 : 1
                    }}>
                        <div style={{ marginRight: '12px', paddingTop: '2px' }}>
                            <div 
                                onClick={() => onItemStatusChange(order.id, item.id, item.status === 'READY' ? 'PREPARING' : 'READY')}
                                style={{
                                    width: '20px', height: '20px', borderRadius: '4px', 
                                    border: `2px solid ${item.status === 'READY' ? 'var(--notion-green)' : 'var(--notion-border)'}`,
                                    backgroundColor: item.status === 'READY' ? 'var(--notion-green)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                {item.status === 'READY' && <CheckCircle2 size={14} color="white" />}
                            </div>
                        </div>
                        <div style={{ flex: 1, textDecoration: item.status === 'READY' ? 'line-through' : 'none' }}>
                            <div style={{ fontWeight: '500', color: 'var(--notion-text)' }}>
                                {item.name}
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--notion-orange)', marginTop: '2px', textDecoration: 'none' }}>
                                    {item.modifiers.join(', ')}
                                </div>
                            )}
                        </div>
                        <div style={{
                            fontWeight: '700',
                            fontSize: '18px',
                            color: 'var(--notion-text)',
                            minWidth: '40px',
                            textAlign: 'right',
                            textDecoration: item.status === 'READY' ? 'line-through' : 'none'
                        }}>
                            x{item.quantity}
                        </div>
                    </div>
                ))}
            </div>

            {/* Notes */}
            {order.notes && (
                <div style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--notion-yellow-bg)',
                    fontSize: '12px',
                    color: 'var(--notion-yellow)'
                }}>
                    <strong>Note:</strong> {order.notes}
                </div>
            )}

            {/* Actions */}
            <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--notion-border)',
                display: 'flex',
                gap: '8px'
            }}>
                {order.status === 'PENDING' && (
                    <Button
                        variant="primary"
                        size="sm"
                        style={{ flex: 1 }}
                        onClick={() => onStatusChange(order.id, 'PREPARING')}
                        disabled={isUpdating}
                        icon={isUpdating ? <Loader2 size={14} className="animate-spin" /> : undefined}
                    >
                        Start Preparing
                    </Button>
                )}
                {order.status === 'PREPARING' && (
                    <Button
                        variant="primary"
                        size="sm"
                        style={{ flex: 1, backgroundColor: 'var(--notion-green)' }}
                        onClick={() => onStatusChange(order.id, 'READY')}
                        disabled={isUpdating}
                        icon={isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    >
                        Mark Ready
                    </Button>
                )}
                {order.status === 'READY' && (
                    <>
                        <Button
                            variant="primary"
                            size="sm"
                            style={{ flex: 1, backgroundColor: 'var(--notion-green)' }}
                            onClick={() => onStatusChange(order.id, 'SERVED')}
                            disabled={isUpdating}
                            icon={isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        >
                            Mark Served
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            style={{ color: 'var(--notion-text-secondary)' }}
                            onClick={() => onDismiss?.(order.id)}
                            disabled={isUpdating}
                            title="Dismiss from display"
                        >
                            Dismiss
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

// Empty state
function EmptyColumn() {
    return (
        <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--notion-text-secondary)'
        }}>
            <UtensilsCrossed size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div style={{ fontSize: '13px' }}>No orders</div>
        </div>
    );
}

function playKitchenAlert() {
    try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch { /* ignore */ }
}

export default function KitchenDisplayPage() {
    const { orders, isLoading, error, refresh, updateOrderStatus, updateItemStatus, socketStatus } = useKitchen();

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [shakingIds, setShakingIds] = useState<Set<number>>(new Set());
    const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

    // Auto-clear READY orders after 15 minutes (waiter likely already served)
    useEffect(() => {
        const readyOrders = orders.filter(o => o.status === 'READY' && !dismissedIds.has(o.id));
        if (readyOrders.length === 0) return;
        const timers = readyOrders.map(o => {
            const elapsed = Date.now() - new Date(o.createdAt).getTime();
            const delay = Math.max(0, 15 * 60 * 1000 - elapsed);
            return setTimeout(() => {
                setDismissedIds(prev => new Set(prev).add(o.id));
            }, delay);
        });
        return () => timers.forEach(clearTimeout);
    }, [orders, dismissedIds]);

    // Auto-refresh only when socket is not connected (fallback polling)
    useEffect(() => {
        if (!autoRefresh || socketStatus === 'connected') return;
        const interval = setInterval(() => {
            refresh();
            setLastRefresh(new Date());
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, socketStatus, refresh]);

    const prevOrderIdsRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        const currentIds = new Set(orders.map(o => o.id));
        const newIds = orders.filter(o => !prevOrderIdsRef.current.has(o.id) && o.status === 'PENDING');
        if (newIds.length > 0) {
            playKitchenAlert();
            setShakingIds(prev => {
                const next = new Set(prev);
                newIds.forEach(o => next.add(o.id));
                return next;
            });
        }
        prevOrderIdsRef.current = currentIds;
    }, [orders]);

    const handleStatusChange = async (orderId: number, newStatus: KitchenOrder['status']) => {
        setUpdatingId(orderId);
        await updateOrderStatus(orderId, newStatus);
        setUpdatingId(null);
        // Remove from shaking once acknowledged
        setShakingIds(prev => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
        });
    };

    const handleRefresh = async () => {
        await refresh();
        setLastRefresh(new Date());
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Group orders by status (exclude manually dismissed)
    const visibleOrders = orders.filter(o => !dismissedIds.has(o.id));
    const pendingOrders = visibleOrders.filter(o => o.status === 'PENDING');
    const preparingOrders = visibleOrders.filter(o => o.status === 'PREPARING');
    const readyOrders = visibleOrders.filter(o => o.status === 'READY');

    const content = (
        <>
        <style>{`
            @keyframes kotShake {
                0% { transform: translateX(0); }
                30% { transform: translateX(-3px); }
                60% { transform: translateX(3px); }
                100% { transform: translateX(0); }
            }
            @keyframes kotGlow {
                0%, 100% { box-shadow: 0 0 0 0 transparent; }
                50% { box-shadow: 0 0 0 2px var(--notion-blue); }
            }
            @media (prefers-reduced-motion: reduce) {
                [style*="kotShake"], [style*="kotGlow"] { animation: none !important; }
            }
        `}</style>
        <div style={{
            padding: 'var(--space-4)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--notion-bg-secondary)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--notion-bg)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                flexWrap: 'wrap',
                gap: 'var(--space-3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <ChefHat size={28} color="var(--notion-orange)" />
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>
                            Kitchen Display System
                        </h1>
                        <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Last updated: {lastRefresh.toLocaleTimeString()}
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: socketStatus === 'connected' ? 'var(--notion-green)' : socketStatus === 'connecting' ? 'var(--notion-yellow)' : 'var(--notion-red)',
                                display: 'inline-block'
                            }} title={`Socket: ${socketStatus}`} />
                        </p>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div style={{
                        padding: 'var(--space-2) var(--space-3)',
                        backgroundColor: 'var(--notion-red-bg)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--notion-red)',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        marginRight: 'var(--space-4)',
                        fontSize: '14px'
                    }}>
                        <span style={{ color: 'var(--notion-yellow)' }}>● Pending: {pendingOrders.length}</span>
                        <span style={{ color: 'var(--notion-blue)' }}>● Preparing: {preparingOrders.length}</span>
                        <span style={{ color: 'var(--notion-green)' }}>● Ready: {readyOrders.length}</span>
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        icon={isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleFullscreen}
                        icon={isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    >
                        {isFullscreen ? 'Exit' : 'Fullscreen'}
                    </Button>
                </div>
            </div>

            {/* Orders Grid - 3 Columns by Status */}
            {isLoading && orders.length === 0 ? (
                <div style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--space-4)',
                    overflowY: 'auto',
                }}>
                    {['PENDING', 'PREPARING', 'READY'].map(label => (
                        <div key={label}>
                            <Skeleton variant="line" width="100%" height={40} borderRadius="var(--radius-md)" style={{ marginBottom: 'var(--space-3)' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--space-4)',
                    overflowY: 'auto'
                }}>
                    {/* Pending Column */}
                    <div>
                        <div style={{
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--notion-yellow-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-3)',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: 'var(--notion-yellow)'
                        }}>
                            <Timer size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            PENDING ({pendingOrders.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {pendingOrders.length === 0 ? (
                                <EmptyColumn />
                            ) : (
                                pendingOrders.map(order => (
                                    <KOTCard
                                        key={order.id}
                                        order={order}
                                        onStatusChange={handleStatusChange}
                                        onItemStatusChange={updateItemStatus}
                                        isUpdating={updatingId === order.id}
                                        isShaking={shakingIds.has(order.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Preparing Column */}
                    <div>
                        <div style={{
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--notion-blue-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-3)',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: 'var(--notion-blue)'
                        }}>
                            <Flame size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            PREPARING ({preparingOrders.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {preparingOrders.length === 0 ? (
                                <EmptyColumn />
                            ) : (
                                preparingOrders.map(order => (
                                    <KOTCard
                                        key={order.id}
                                        order={order}
                                        onStatusChange={handleStatusChange}
                                        onItemStatusChange={updateItemStatus}
                                        isUpdating={updatingId === order.id}
                                        isShaking={shakingIds.has(order.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Ready Column */}
                    <div>
                        <div style={{
                            padding: 'var(--space-3)',
                            backgroundColor: 'var(--notion-green-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-3)',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: 'var(--notion-green)'
                        }}>
                            <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                            READY ({readyOrders.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {readyOrders.length === 0 ? (
                                <EmptyColumn />
                            ) : (
                                readyOrders.map(order => (
                                    <KOTCard
                                        key={order.id}
                                        order={order}
                                        onStatusChange={handleStatusChange}
                                        onItemStatusChange={updateItemStatus}
                                        onDismiss={(id) => setDismissedIds(prev => new Set(prev).add(id))}
                                        isUpdating={updatingId === order.id}
                                        isShaking={shakingIds.has(order.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );

    return content;
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/lib/contexts/WebSocketContext";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter } from "@/lib/router";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    Bell,
    CheckSquare,
    MessageSquare,
    Calendar,
    Clock,
    CheckCheck,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
} from "lucide-react";

interface Notification {
    id: string;
    type: "task" | "message" | "leave" | "attendance" | "system" | "booking" | "alert" | "order" | "inventory" | "payment";
    title: string;
    description?: string;
    time: string;
    createdAt?: string;
    read: boolean;
    href?: string;
    metadata?: any;
}

/**
 * Resolve a notification to a destination route that actually exists in the app.
 * Type-driven first (reliable), then metadata-id fallback. Never builds detail
 * routes that have no matching handler (which previously 404'd on click).
 */
function deriveHref(type?: string, metadata?: any): string | undefined {
    const m = metadata || {};
    if (m.href || m.path) return m.href || m.path;
    const t = (type || "").toUpperCase();

    // Type-driven routing
    if (t.startsWith("LICENSE") || t.includes("PAYMENT") || t.startsWith("TRIAL")) return "/hotel/billing";
    if (t.includes("KITCHEN")) return "/hotel/kitchen";
    if (t.includes("ORDER")) return "/hotel/orders";
    if (t.includes("HOUSEKEEPING") || t.includes("CHECKOUT_ROOM")) return "/hotel/housekeeping";
    if (t.includes("CHECKOUT_REQUEST") || t.includes("BOOKING")) return "/hotel/bookings";
    if (t.includes("NIGHT_AUDIT")) return "/hotel/finance";
    if (t.includes("DND")) return "/hotel/rooms";
    if (t.includes("INVENTORY")) return "/hotel/inventory";
    if (t.includes("MESSAGE")) return "/hotel/messages";

    // Metadata-id fallback (only routes that exist)
    if (m.guestId) return `/hotel/guests/${m.guestId}`;
    if (m.bookingId) return "/hotel/bookings";
    if (m.orderId) return "/hotel/orders";
    if (m.tableId) return "/hotel/operations/tables";
    if (m.invoiceId || m.paymentId) return "/hotel/finance";
    if (m.taskId) return "/hotel/housekeeping";
    if (m.roomId) return "/hotel/rooms";
    return undefined;
}

/**
 * Collapse duplicate notifications: by id, and by metadata.dedupeKey (keeping the
 * newest). Input is expected newest-first. Prevents managers/owners — who receive
 * every role's copy of the same underlying event — from seeing duplicates.
 */
function dedupeNotifications(list: Notification[]): Notification[] {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const out: Notification[] = [];
    for (const n of list) {
        if (seenIds.has(n.id)) continue;
        const key = n.metadata?.dedupeKey;
        if (key) {
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
        }
        seenIds.add(n.id);
        out.push(n);
    }
    return out;
}

const formatNotificationTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function playNotificationSound() {
    try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        // Subtle soft two-note chime — gentle attack, low volume, smooth decay.
        const t = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.setValueAtTime(880, t + 0.09);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.42);
    } catch { /* ignore */ }
}

export default function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isShaking, setIsShaking] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    // Tracks alert keys already toasted so the same underlying event (delivered to
    // multiple roles) only chimes once.
    const seenRef = useRef<Set<string>>(new Set());
    const { status: wsStatus, on } = useWebSocket();
    const { user } = useAuth();
    const isSuperAdmin = user?.userType === 'SUPER_ADMIN';
    const router = useRouter();

    const mapApiNotification = useCallback((n: any): Notification => ({
        id: n.id,
        type: n.type?.toLowerCase() || 'system',
        title: n.title || 'Notification',
        description: n.message || n.description,
        time: n.time || formatNotificationTime(n.createdAt || ''),
        createdAt: n.createdAt,
        read: !!n.isRead,
        href: n.metadata?.href || n.metadata?.path || deriveHref(n.type, n.metadata),
        metadata: n.metadata,
    }), []);

    const fetchNotifications = useCallback(async () => {
        if (isSuperAdmin) return; // no hotel-scoped notifications for platform admin
        try {
            const res = await api.get("/notifications");
            if (res.data) {
                const fetched = dedupeNotifications((res.data as any[]).map(mapApiNotification));
                // Merge: prefer fetched read state, keep WS real-time items not yet in DB
                setNotifications(prev => {
                    const fetchedIds = new Set(fetched.map(n => n.id));
                    const wsExtras = prev.filter(n => !fetchedIds.has(n.id));
                    return dedupeNotifications([...fetched, ...wsExtras]);
                });
            }
        } catch {
            // Keep existing notifications on error
        } finally {
            setLoading(false);
        }
    }, [mapApiNotification, isSuperAdmin]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Slow fallback poll when WS disconnected
    useEffect(() => {
        if (wsStatus === 'connected') return;
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [wsStatus, fetchNotifications]);

    // Refresh on open but merge instead of replace
    useEffect(() => {
        if (isOpen) fetchNotifications();
    }, [isOpen, fetchNotifications]);

    // WebSocket: initial state + real-time bell notifications only.
    // Live-data events (KITCHEN_NEW_ORDER, DND_UPDATE, ...) are intentionally NOT
    // handled here — they are consumed by WebSocketProvider for cache invalidation.
    useEffect(() => {
        const unsubConnected = on('CONNECTED', (payload: any) => {
            if (payload?.latestNotifications) {
                setNotifications(dedupeNotifications(payload.latestNotifications.map(mapApiNotification)));
            }
            setLoading(false);
        });

        const unsubNotif = on('NOTIFICATION', (record: any) => {
            if (!record) return;
            const newNotif = mapApiNotification(record);
            newNotif.time = 'Just now';
            if (!newNotif.createdAt) newNotif.createdAt = new Date().toISOString();

            const alertKey = newNotif.metadata?.dedupeKey || newNotif.id;
            const alreadyAlerted = seenRef.current.has(alertKey);
            seenRef.current.add(alertKey);

            setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return dedupeNotifications([newNotif, ...prev]);
            });

            if (!alreadyAlerted) {
                playNotificationSound();
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 1500);
                toast.info(newNotif.title, { description: newNotif.description });
            }
        });

        return () => {
            unsubConnected();
            unsubNotif();
        };
    }, [on, mapApiNotification]);

    const markAsRead = async (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        try {
            await api.patch(`/notifications/${id}/read`);
        } catch { /* best-effort */ }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            await api.patch('/notifications/read-all');
        } catch { /* best-effort */ }
    };

    const handleClick = (notification: Notification) => {
        markAsRead(notification.id);
        const href = notification.href || deriveHref(notification.type, notification.metadata);
        if (href) {
            setIsOpen(false);
            if (href.startsWith('http')) {
                window.open(href, '_blank');
            } else {
                router.push(href);
            }
        }
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedId(prev => prev === id ? null : id);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const getIcon = (type: Notification["type"]) => {
        switch (type) {
            case "task": return <CheckSquare size={14} style={{ color: "#eb5757" }} />;
            case "message": return <MessageSquare size={14} style={{ color: "#9b59b6" }} />;
            case "leave": return <Calendar size={14} style={{ color: "#f2994a" }} />;
            case "attendance": return <Clock size={14} style={{ color: "#0f9d58" }} />;
            case "booking": return <Calendar size={14} style={{ color: "#529cca" }} />;
            case "alert": return <AlertCircle size={14} style={{ color: "#eb5757" }} />;
            case "order": return <CheckSquare size={14} style={{ color: "var(--notion-orange)" }} />;
            case "inventory": return <CheckSquare size={14} style={{ color: "var(--notion-purple)" }} />;
            case "payment": return <CheckSquare size={14} style={{ color: "var(--notion-green)" }} />;
            default: return <Bell size={14} style={{ color: "var(--notion-text-muted)" }} />;
        }
    };

    return (
        <div ref={panelRef} style={{ position: "relative" }}>
            <style>{`
                @keyframes bellShake {
                    0% { transform: rotate(0deg); }
                    20% { transform: rotate(6deg); }
                    40% { transform: rotate(-5deg); }
                    60% { transform: rotate(3deg); }
                    80% { transform: rotate(-2deg); }
                    100% { transform: rotate(0deg); }
                }
                .bell-shake {
                    animation: bellShake 0.7s cubic-bezier(0.36, 0.07, 0.19, 0.97);
                    animation-iteration-count: 1;
                    transform-origin: top center;
                }
                @media (prefers-reduced-motion: reduce) { .bell-shake { animation: none; } }
            `}</style>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: "relative",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    background: isOpen ? "var(--notion-bg-tertiary)" : "transparent",
                    border: "none",
                    color: "var(--notion-text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                className={isShaking ? 'bell-shake hover-bg' : 'hover-bg'}
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        minWidth: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: "#eb5757",
                        color: "var(--foreground-inverse)",
                        fontSize: "9px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 3px",
                    }}>
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
                {/* WS connection status dot — hidden for super-admin (no hotel live
                    feed, so it would always show red/offline). */}
                {!isSuperAdmin && (
                    <span style={{
                        position: "absolute",
                        bottom: "2px",
                        left: "2px",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: wsStatus === 'connected' ? '#0f9d58' : wsStatus === 'connecting' ? '#f2994a' : '#eb5757',
                    }} title={wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'} />
                )}
            </button>

            {/* Dropdown Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: "fixed",
                            top: "56px",
                            right: "16px",
                            width: "380px",
                            maxHeight: "500px",
                            background: "var(--notion-bg-secondary)",
                            border: "1px solid var(--notion-border)",
                            borderRadius: "8px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                            overflow: "hidden",
                            zIndex: 9999,
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            borderBottom: "1px solid var(--notion-divider)",
                            flexShrink: 0,
                        }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--notion-text)" }}>
                                Notifications {unreadCount > 0 && <span style={{ color: "var(--notion-text-secondary)", fontWeight: 400 }}>({unreadCount} unread)</span>}
                            </span>
                            <div style={{ display: "flex", gap: "8px" }}>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "var(--notion-blue)",
                                            fontSize: "11px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            padding: "4px 8px",
                                            borderRadius: "4px",
                                        }}
                                        className="hover-bg"
                                    >
                                        <CheckCheck size={12} />
                                        Mark all read
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "6px",
                        }}>
                            {loading ? (
                                <div style={{ padding: "24px", textAlign: "center", color: "var(--notion-text-muted)", fontSize: "13px" }}>
                                    Loading...
                                </div>
                            ) : notifications.length > 0 ? notifications.map((notification) => {
                                const isExpanded = expandedId === notification.id;
                                return (
                                    <div
                                        key={notification.id}
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            background: notification.read ? "transparent" : "rgba(82, 156, 202, 0.08)",
                                            marginBottom: "2px",
                                            transition: "background 0.15s ease",
                                        }}
                                        className="hover-bg"
                                    >
                                        <div
                                            onClick={() => handleClick(notification)}
                                            style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
                                        >
                                            <div style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "6px",
                                                background: "var(--notion-bg-tertiary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: "13px",
                                                    fontWeight: notification.read ? 400 : 500,
                                                    color: "var(--notion-text)",
                                                    marginBottom: "2px",
                                                    lineHeight: "1.4",
                                                }}>
                                                    {notification.title}
                                                </div>
                                                {notification.description && !isExpanded && (
                                                    <div style={{
                                                        fontSize: "12px",
                                                        color: "var(--notion-text-muted)",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}>
                                                        {notification.description}
                                                    </div>
                                                )}
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                                                    <span style={{ fontSize: "11px", color: "var(--notion-text-muted)" }}>
                                                        {formatNotificationTime(notification.createdAt || '') || notification.time}
                                                    </span>
                                                    {notification.href && (
                                                        <ExternalLink size={10} style={{ color: "var(--notion-blue)" }} />
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                                {!notification.read && (
                                                    <div style={{
                                                        width: "6px",
                                                        height: "6px",
                                                        borderRadius: "50%",
                                                        background: "var(--notion-blue)",
                                                    }} />
                                                )}
                                                {notification.description && (
                                                    <button
                                                        onClick={(e) => toggleExpand(notification.id, e)}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            padding: "2px",
                                                            color: "var(--notion-text-muted)",
                                                            display: "flex",
                                                        }}
                                                    >
                                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Expanded description */}
                                        {isExpanded && notification.description && (
                                            <div style={{
                                                marginTop: "8px",
                                                marginLeft: "38px",
                                                fontSize: "12px",
                                                color: "var(--notion-text-secondary)",
                                                lineHeight: "1.5",
                                                padding: "8px 10px",
                                                background: "var(--notion-bg-tertiary)",
                                                borderRadius: "4px",
                                            }}>
                                                {notification.description}
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div style={{
                                    padding: "32px",
                                    textAlign: "center",
                                    color: "var(--notion-text-muted)",
                                    fontSize: "13px",
                                }}>
                                    <Bell size={24} style={{ opacity: 0.3, marginBottom: "8px" }} />
                                    <div>No notifications yet</div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

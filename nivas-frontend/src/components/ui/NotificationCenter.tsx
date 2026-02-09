"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
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
    type: "task" | "message" | "leave" | "attendance" | "system" | "booking" | "alert";
    title: string;
    description?: string;
    time: string;
    createdAt?: string;
    read: boolean;
    href?: string;
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

export default function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await api.get("/notifications");
            if (res.data) {
                const items = (res.data as any[]).map((n: any) => ({
                    ...n,
                    time: n.time || formatNotificationTime(n.createdAt || ''),
                }));
                setNotifications(items);
            }
        } catch {
            // Keep existing notifications on error
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        // Poll every 10 seconds for near-realtime
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Refresh on open
    useEffect(() => {
        if (isOpen) fetchNotifications();
    }, [isOpen, fetchNotifications]);

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
        if (notification.href) {
            window.location.href = notification.href;
            setIsOpen(false);
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
            default: return <Bell size={14} style={{ color: "var(--notion-text-muted)" }} />;
        }
    };

    return (
        <div ref={panelRef} style={{ position: "relative" }}>
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
                className="hover-bg"
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
                        color: "#fff",
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

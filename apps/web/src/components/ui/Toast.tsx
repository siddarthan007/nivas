"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    action?: { label: string; onClick: () => void };
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, action?: Toast["action"]) => void;
    success: (message: string, action?: Toast["action"]) => void;
    error: (message: string, action?: Toast["action"]) => void;
    warning: (message: string, action?: Toast["action"]) => void;
    info: (message: string, action?: Toast["action"]) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within ToastProvider");
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = "info", action?: Toast["action"]) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type, action }]);

        // Auto remove after 4 seconds
        setTimeout(() => removeToast(id), 4000);
    }, [removeToast]);

    const value: ToastContextType = {
        toast: addToast,
        success: (msg, action) => addToast(msg, "success", action),
        error: (msg, action) => addToast(msg, "error", action),
        warning: (msg, action) => addToast(msg, "warning", action),
        info: (msg, action) => addToast(msg, "info", action),
    };

    const icons = {
        success: CheckCircle,
        error: XCircle,
        warning: AlertTriangle,
        info: Info,
    };

    const iconColors = {
        success: "#0f9d58",
        error: "#eb5757",
        warning: "#f2994a",
        info: "#529cca",
    };

    return (
        <ToastContext.Provider value={value}>
            {children}

            {/* Notion-style Toast Container - only render on client */}
            {mounted && toasts.length > 0 && (
                <div style={{
                    position: "fixed",
                    bottom: "20px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    zIndex: 9999,
                    pointerEvents: "none",
                }}>
                    {toasts.map((toast) => {
                        const Icon = icons[toast.type];
                        const iconColor = iconColors[toast.type];

                        return (
                            <div
                                key={toast.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "10px 14px",
                                    background: "var(--notion-bg-secondary)",
                                    border: "1px solid var(--notion-border)",
                                    borderRadius: "6px",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                    pointerEvents: "auto",
                                    minWidth: "200px",
                                    maxWidth: "360px",
                                }}
                            >
                                <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />
                                <span style={{
                                    flex: 1,
                                    fontSize: "13px",
                                    color: "var(--notion-text)",
                                    fontWeight: 400,
                                    lineHeight: 1.4,
                                }}>
                                    {toast.message}
                                </span>
                                {toast.action && (
                                    <button
                                        onClick={toast.action.onClick}
                                        style={{
                                            padding: "4px 8px",
                                            fontSize: "12px",
                                            fontWeight: 500,
                                            background: "var(--notion-bg-tertiary)",
                                            color: "var(--notion-text)",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {toast.action.label}
                                    </button>
                                )}
                                <button
                                    onClick={() => removeToast(toast.id)}
                                    style={{
                                        padding: "2px",
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--notion-text-muted)",
                                        display: "flex",
                                        marginLeft: "4px",
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </ToastContext.Provider>
    );
}
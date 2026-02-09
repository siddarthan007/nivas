"use client";

import { useState, useEffect, useRef } from "react";

// Navigation wrapper for non-Next.js projects
const usePathname = () => typeof window !== 'undefined' ? window.location.pathname : '/';
const useRouter = () => ({
    push: (href: string) => { window.location.href = href; }
});

import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    X,
    CheckSquare,
    MessageSquare,
    Calendar,
    Clock,
    Megaphone,
    Search
} from "lucide-react";

interface QuickAction {
    icon: React.ReactNode;
    label: string;
    action: () => void;
}

export default function ContextQuickActions() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
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

    // Close on Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, []);

    const getActions = (): QuickAction[] => {
        const baseActions: QuickAction[] = [];

        // Context-specific actions
        if (pathname.includes("/tasks")) {
            baseActions.push({
                icon: <CheckSquare size={15} />,
                label: "New Task",
                action: () => {
                    const event = new CustomEvent("openNewTaskModal");
                    window.dispatchEvent(event);
                    setIsOpen(false);
                }
            });
        }

        if (pathname.includes("/messages")) {
            baseActions.push({
                icon: <MessageSquare size={15} />,
                label: "New Message",
                action: () => {
                    router.push("/dashboard/messages");
                    setIsOpen(false);
                }
            });
        }

        if (pathname.includes("/leaves")) {
            baseActions.push({
                icon: <Calendar size={15} />,
                label: "Request Leave",
                action: () => {
                    const event = new CustomEvent("openLeaveRequestModal");
                    window.dispatchEvent(event);
                    setIsOpen(false);
                }
            });
        }

        // Default actions for dashboard
        if (pathname === "/dashboard" || baseActions.length === 0) {
            baseActions.push(
                {
                    icon: <CheckSquare size={15} />,
                    label: "New Task",
                    action: () => {
                        router.push("/dashboard/tasks");
                        setIsOpen(false);
                    }
                },
                {
                    icon: <MessageSquare size={15} />,
                    label: "Messages",
                    action: () => {
                        router.push("/dashboard/messages");
                        setIsOpen(false);
                    }
                }
            );
        }

        // Always add search
        baseActions.push({
            icon: <Search size={15} />,
            label: "Search",
            action: () => {
                const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
                document.dispatchEvent(event);
                setIsOpen(false);
            }
        });

        return baseActions;
    };

    const actions = getActions();

    return (
        <div ref={panelRef} className="quick-actions" style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 1000 }}>
            {/* Action buttons - Notion style */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: "absolute",
                            bottom: "48px",
                            right: "0",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            minWidth: "140px",
                        }}
                    >
                        {actions.map((action, index) => (
                            <motion.button
                                key={index}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={action.action}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px 12px",
                                    background: "var(--notion-bg-secondary)",
                                    border: "1px solid var(--notion-border)",
                                    borderRadius: "6px",
                                    color: "var(--notion-text)",
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                    whiteSpace: "nowrap",
                                }}
                                className="hover-bg"
                            >
                                <span style={{ color: "var(--notion-text-muted)" }}>{action.icon}</span>
                                {action.label}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Button - Notion Style (subtle) */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    background: "var(--notion-bg-secondary)",
                    border: "1px solid var(--notion-border)",
                    color: "var(--notion-text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                whileHover={{
                    background: "var(--notion-bg-tertiary)",
                    borderColor: "var(--notion-text-muted)"
                }}
                whileTap={{ scale: 0.95 }}
            >
                <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <Plus size={18} />
                </motion.div>
            </motion.button>
        </div>
    );
}
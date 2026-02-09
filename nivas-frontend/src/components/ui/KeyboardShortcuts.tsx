"use client";

import { useState, useEffect, useCallback } from "react";

// Navigation wrapper for non-Next.js projects
const useRouter = () => ({
    push: (href: string) => { window.location.href = href; }
});

import { X, Command, ArrowUp, ArrowDown } from "lucide-react";

interface Shortcut {
    keys: string[];
    description: string;
    category: string;
}

const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ["G", "D"], description: "Go to Dashboard", category: "Navigation" },
    { keys: ["G", "T"], description: "Go to Tasks", category: "Navigation" },
    { keys: ["G", "M"], description: "Go to Messages", category: "Navigation" },
    { keys: ["G", "L"], description: "Go to Leaves", category: "Navigation" },
    { keys: ["G", "A"], description: "Go to Attendance", category: "Navigation" },
    { keys: ["G", "P"], description: "Go to Profile", category: "Navigation" },

    // Actions
    { keys: ["⌘", "K"], description: "Open Command Palette", category: "Actions" },
    { keys: ["⌘", "\\"], description: "Toggle Sidebar", category: "Actions" },
    { keys: ["N"], description: "New (create in context)", category: "Actions" },
    { keys: ["Esc"], description: "Close modal/panel", category: "Actions" },

    // List Navigation
    { keys: ["J"], description: "Move down in list", category: "Lists" },
    { keys: ["K"], description: "Move up in list", category: "Lists" },
    { keys: ["Enter"], description: "Open selected item", category: "Lists" },

    // Help
    { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts", category: "Help" },
];

export default function KeyboardShortcuts() {
    const [isOpen, setIsOpen] = useState(false);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const router = useRouter();

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't trigger if typing in input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        // Show shortcuts overlay with Ctrl + / or Ctrl + ?
        if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.key === "?")) {
            e.preventDefault();
            setIsOpen(prev => !prev);
            return;
        }

        const key = e.key.toUpperCase();

        // Close with Escape
        if (e.key === "Escape") {
            setIsOpen(false);
            setPendingKey(null);
            return;
        }

        // G + Key navigation combos
        if (pendingKey === "G") {
            e.preventDefault();
            const routes: Record<string, string> = {
                "D": "/dashboard",
                "T": "/dashboard/tasks",
                "M": "/dashboard/messages",
                "L": "/dashboard/leaves",
                "A": "/dashboard/attendance",
                "P": "/dashboard/profile",
            };
            if (routes[key]) {
                router.push(routes[key]);
            }
            setPendingKey(null);
            return;
        }

        // Start G combo
        if (key === "G" && !e.metaKey && !e.ctrlKey) {
            setPendingKey("G");
            // Clear pending after 1 second
            setTimeout(() => setPendingKey(null), 1000);
            return;
        }

        // Toggle Zen Mode with Cmd/Ctrl + \
        if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
            e.preventDefault();
            window.dispatchEvent(new Event("toggle-focus-mode"));
            return;
        }
    }, [pendingKey, router]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (!isOpen) return null;

    const categories = [...new Set(shortcuts.map(s => s.category))];

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
        }} onClick={() => setIsOpen(false)}>
            <div
                style={{
                    background: "var(--notion-bg-secondary)",
                    border: "1px solid var(--notion-border)",
                    borderRadius: "12px",
                    padding: "24px",
                    maxWidth: "500px",
                    width: "90%",
                    maxHeight: "70vh",
                    overflow: "auto",
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--notion-text)", margin: 0 }}>
                        ⌨️ Keyboard Shortcuts
                    </h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--notion-text-muted)",
                            cursor: "pointer",
                            padding: "4px",
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {categories.map(category => (
                    <div key={category} style={{ marginBottom: "20px" }}>
                        <h3 style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--notion-text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: "10px",
                        }}>
                            {category}
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {shortcuts.filter(s => s.category === category).map((shortcut, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "8px 12px",
                                        background: "var(--notion-bg-tertiary)",
                                        borderRadius: "6px",
                                    }}
                                >
                                    <span style={{ fontSize: "13px", color: "var(--notion-text)" }}>
                                        {shortcut.description}
                                    </span>
                                    <div style={{ display: "flex", gap: "4px" }}>
                                        {shortcut.keys.map((key, j) => (
                                            <kbd
                                                key={j}
                                                style={{
                                                    padding: "4px 8px",
                                                    fontSize: "11px",
                                                    fontWeight: 600,
                                                    background: "var(--notion-bg)",
                                                    border: "1px solid var(--notion-border)",
                                                    borderRadius: "4px",
                                                    color: "var(--notion-text-secondary)",
                                                    fontFamily: "var(--font-mono)",
                                                }}
                                            >
                                                {key}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--notion-border)",
                    fontSize: "12px",
                    color: "var(--notion-text-muted)",
                    textAlign: "center",
                }}>
                    Press <kbd style={{ padding: "2px 6px", background: "var(--notion-bg)", borderRadius: "3px", fontSize: "11px" }}>Ctrl + /</kbd> anytime to toggle this menu
                </div>
            </div>
        </div>
    );
}
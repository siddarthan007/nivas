"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Coffee, Sunset, X } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";

export default function TimeGreeting() {
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const [greeting, setGreeting] = useState({ text: "", icon: Sun, tip: "" });

    useEffect(() => {
        setMounted(true);

        const hour = new Date().getHours();

        if (hour >= 5 && hour < 12) {
            setGreeting({
                text: "Good morning",
                icon: Coffee,
                tip: "Start your day with focus!",
            });
        } else if (hour >= 12 && hour < 17) {
            setGreeting({
                text: "Good afternoon",
                icon: Sun,
                tip: "Stay productive!",
            });
        } else if (hour >= 17 && hour < 21) {
            setGreeting({
                text: "Good evening",
                icon: Sunset,
                tip: "Wrapping up the day?",
            });
        } else {
            setGreeting({
                text: "Working late",
                icon: Moon,
                tip: "Don't forget to rest!",
            });
        }

        // Show after mount
        setTimeout(() => setVisible(true), 100);

        // Auto-hide after 6 seconds
        const timer = setTimeout(() => setVisible(false), 6000);
        return () => clearTimeout(timer);
    }, []);

    if (!mounted || !visible || !user) return null;

    const Icon = greeting.icon;
    const firstName = user.name?.split(" ")[0] || "there";

    return (
        <div
            style={{
                position: "fixed",
                top: "16px",
                right: "16px",
                padding: "14px 18px",
                background: "var(--notion-bg-secondary)",
                border: "1px solid var(--notion-border)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(-10px)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
            }}
        >
            {/* Icon */}
            <div style={{
                width: "38px",
                height: "38px",
                borderRadius: "6px",
                background: "var(--notion-bg-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}>
                <Icon size={18} style={{ color: "var(--notion-orange)" }} />
            </div>

            {/* Text */}
            <div style={{ minWidth: "120px" }}>
                <div style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--notion-text)",
                    marginBottom: "2px"
                }}>
                    {greeting.text}, {firstName}
                </div>
                <div style={{
                    fontSize: "12px",
                    color: "var(--notion-text-muted)"
                }}>
                    {greeting.tip}
                </div>
            </div>

            {/* Close button */}
            <button
                onClick={() => setVisible(false)}
                style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--notion-text-muted)",
                    cursor: "pointer",
                    padding: "4px",
                    marginLeft: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                }}
                className="hover-bg"
            >
                <X size={14} />
            </button>
        </div>
    );
}
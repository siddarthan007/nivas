"use client";

import { motion, AnimatePresence } from "framer-motion";

interface NotificationBadgeProps {
    count: number;
    maxCount?: number;
    showZero?: boolean;
    className?: string;
    animate?: boolean;
}

export default function NotificationBadge({
    count,
    maxCount = 99,
    showZero = false,
    className = "",
    animate = true,
}: NotificationBadgeProps) {
    if (count === 0 && !showZero) return null;

    const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

    const badge = (
        <span
            className={`notification-badge ${className}`}
            style={{
                backgroundColor: "var(--notion-red)",
                color: "white",
                fontSize: "10px",
                fontWeight: "600",
                padding: "2px 5px",
                borderRadius: "10px",
                minWidth: "16px",
                textAlign: "center",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
            }}
        >
            {displayCount}
        </span>
    );

    if (!animate) return badge;

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={count}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 25,
                }}
                className={`notification-badge ${className}`}
                style={{
                    backgroundColor: "var(--notion-red)",
                    color: "white",
                    fontSize: "10px",
                    fontWeight: "600",
                    padding: "2px 5px",
                    borderRadius: "10px",
                    minWidth: "16px",
                    textAlign: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                }}
            >
                {displayCount}
            </motion.span>
        </AnimatePresence>
    );
}
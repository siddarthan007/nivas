"use client";

import { motion } from "framer-motion";

interface NavSkeletonProps {
    count?: number;
    isCollapsed?: boolean;
}

export default function NavSkeleton({ count = 7, isCollapsed = false }: NavSkeletonProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 4px" }}>
            {Array.from({ length: count }).map((_, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: index * 0.1,
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: isCollapsed ? "8px" : "6px 12px",
                        justifyContent: isCollapsed ? "center" : "flex-start",
                    }}
                >
                    {/* Icon skeleton */}
                    <div
                        style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "4px",
                            backgroundColor: "var(--notion-bg-tertiary)",
                        }}
                    />

                    {/* Label skeleton */}
                    {!isCollapsed && (
                        <div
                            style={{
                                height: "12px",
                                width: `${60 + Math.random() * 40}%`,
                                borderRadius: "4px",
                                backgroundColor: "var(--notion-bg-tertiary)",
                            }}
                        />
                    )}
                </motion.div>
            ))}
        </div>
    );
}
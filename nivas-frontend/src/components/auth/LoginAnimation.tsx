"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function LoginAnimation() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX / window.innerWidth,
                y: e.clientY / window.innerHeight,
            });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Dark Notion-themed geometric shapes
    const shapes = [
        { type: "circle", x: 18, y: 20, size: 90, color: "rgba(78, 149, 198, 0.15)", speed: 1.2 },
        { type: "rect", x: 82, y: 15, size: 50, color: "rgba(76, 171, 154, 0.12)", speed: 1.5 },
        { type: "circle", x: 60, y: 70, size: 120, color: "rgba(154, 109, 215, 0.1)", speed: 0.8 },
        { type: "rect", x: 12, y: 62, size: 55, color: "rgba(215, 125, 67, 0.12)", speed: 1.8 },
        { type: "circle", x: 78, y: 82, size: 35, color: "rgba(218, 103, 154, 0.12)", speed: 2.0 },
    ];

    return (
        <div
            style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
            }}
        >
            {/* Subtle dot grid */}
            <div
                style={{
                    backgroundImage: `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
                    backgroundSize: '28px 28px',
                    position: 'absolute',
                    inset: 0,
                }}
            />

            {/* Floating geometric shapes */}
            {shapes.map((shape, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${shape.x}%`,
                        top: `${shape.y}%`,
                        width: shape.size,
                        height: shape.size,
                        borderRadius: shape.type === "circle" ? "50%" : "4px",
                        backgroundColor: shape.color,
                        border: "1px solid rgba(255,255,255,0.03)",
                        filter: 'blur(1px)',
                    }}
                    animate={{
                        x: mousePosition.x * 20 * shape.speed,
                        y: mousePosition.y * 20 * shape.speed,
                        rotate: [0, 8, -8, 0],
                    }}
                    transition={{
                        x: { type: "spring", stiffness: 40, damping: 25 },
                        y: { type: "spring", stiffness: 40, damping: 25 },
                        rotate: { repeat: Infinity, duration: 10 / shape.speed, ease: "easeInOut", repeatType: "reverse" }
                    }}
                />
            ))}

            {/* Bottom gradient fade */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '40%',
                    background: 'linear-gradient(to top, var(--notion-bg-secondary), transparent)',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}
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

    // Notion-style Pastel Geometric shapes
    const shapes = [
        { type: "circle", x: 15, y: 15, size: 80, color: "#FFD6E0", speed: 1.5 }, // Pastel Pink
        { type: "rect", x: 85, y: 25, size: 60, color: "#C9E4DE", speed: 1.2 }, // Pastel Mint
        { type: "circle", x: 55, y: 75, size: 100, color: "#DBCDF0", speed: 0.8 }, // Pastel Lavender
        { type: "rect", x: 10, y: 65, size: 50, color: "#F2F2F2", speed: 1.8 }, // Light Gray
        { type: "circle", x: 80, y: 80, size: 30, color: "#F7D9C4", speed: 2 }, // Pastel Peach
    ];

    return (
        <div
            className="relative w-full h-full overflow-hidden bg-[#F7F7F5]"
            style={{ backgroundColor: '#F7F7F5', position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
        >
            {/* Notion-style Dot Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.4]"
                style={{
                    backgroundImage: `radial-gradient(#d1d1d1 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.4
                }}
            />

            {/* Floating Geometric Shapes - Flat 2D */}
            {shapes.map((shape, i) => (
                <motion.div
                    key={i}
                    className="absolute"
                    style={{
                        left: `${shape.x}%`,
                        top: `${shape.y}%`,
                        width: shape.size,
                        height: shape.size,
                        borderRadius: shape.type === "circle" ? "50%" : "2px",
                        backgroundColor: shape.color,
                        border: "1px solid rgba(0,0,0,0.03)", // Subtle border for definition
                    }}
                    animate={{
                        x: mousePosition.x * 15 * shape.speed,
                        y: mousePosition.y * 15 * shape.speed,
                        rotate: [0, 10, -10, 0], // Gentle rotation, not spinning
                    }}
                    transition={{
                        x: { type: "spring", stiffness: 50, damping: 20 },
                        y: { type: "spring", stiffness: 50, damping: 20 },
                        rotate: { repeat: Infinity, duration: 8 / shape.speed, ease: "easeInOut", repeatType: "reverse" }
                    }}
                />
            ))}

            {/* Animated Lines/Connecting Nodes effect could be added here for more complexity */}

            {/* Overlay causing a subtle vignette or noise if desired, but keeping it clean for flat 2D */}
        </div>
    );
}
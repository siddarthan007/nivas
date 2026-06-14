"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface CelebrationContextType {
    celebrate: (type?: "confetti" | "success" | "streak") => void;
    showStreak: (count: number, label: string) => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export function useCelebration() {
    const context = useContext(CelebrationContext);
    if (!context) throw new Error("useCelebration must be used within CelebrationProvider");
    return context;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
    rotation: number;
    velocity: { x: number; y: number };
}

interface StreakData {
    count: number;
    label: string;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [streak, setStreak] = useState<StreakData | null>(null);

    const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96E6A1", "#DDA0DD"];

    const celebrate = useCallback((type: "confetti" | "success" | "streak" = "confetti") => {
        if (type === "success") {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
            return;
        }

        // Create confetti particles
        const newParticles: Particle[] = [];
        for (let i = 0; i < 50; i++) {
            newParticles.push({
                id: Date.now() + i,
                x: 50 + Math.random() * 20 - 10, // Start near center
                y: 50,
                color: colors[Math.floor(Math.random() * colors.length)] ?? "#FFD700",
                size: 6 + Math.random() * 6,
                rotation: Math.random() * 360,
                velocity: {
                    x: (Math.random() - 0.5) * 4,
                    y: -3 - Math.random() * 3,
                },
            });
        }
        setParticles(newParticles);

        // Clear after animation
        setTimeout(() => setParticles([]), 3000);
    }, []);

    const showStreak = useCallback((count: number, label: string) => {
        setStreak({ count, label });
        setTimeout(() => setStreak(null), 3000);
    }, []);

    // Animate particles
    useEffect(() => {
        if (particles.length === 0) return;

        const interval = setInterval(() => {
            setParticles(prev => prev.map(p => ({
                ...p,
                x: p.x + p.velocity.x,
                y: p.y + p.velocity.y,
                velocity: {
                    x: p.velocity.x * 0.99,
                    y: p.velocity.y + 0.1, // Gravity
                },
                rotation: p.rotation + 5,
            })).filter(p => p.y < 150)); // Remove when below screen
        }, 16);

        return () => clearInterval(interval);
    }, [particles.length > 0]);

    return (
        <CelebrationContext.Provider value={{ celebrate, showStreak }}>
            {children}

            {/* Confetti Container */}
            {particles.length > 0 && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 10000,
                    overflow: "hidden",
                }}>
                    {particles.map(p => (
                        <div
                            key={p.id}
                            style={{
                                position: "absolute",
                                left: `${p.x}%`,
                                top: `${p.y}%`,
                                width: p.size,
                                height: p.size * 0.6,
                                background: p.color,
                                borderRadius: "2px",
                                transform: `rotate(${p.rotation}deg)`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Success checkmark */}
            {showSuccess && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 10000,
                }}>
                    <div style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        background: "var(--notion-green)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "popIn 0.3s ease-out",
                    }}>
                        <span style={{ fontSize: "40px" }}>✓</span>
                    </div>
                </div>
            )}

            {/* Streak counter */}
            {streak && (
                <div style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none",
                    zIndex: 10000,
                    animation: "streakIn 0.5s ease-out",
                }}>
                    <div style={{
                        fontSize: "64px",
                        fontWeight: 800,
                        color: "var(--notion-orange)",
                        textShadow: "0 0 40px rgba(242, 153, 74, 0.5)",
                    }}>
                        {streak.count}🔥
                    </div>
                    <div style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "var(--notion-text)",
                        marginTop: "8px",
                    }}>
                        {streak.label}
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes popIn {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes streakIn {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    50% { transform: translate(-50%, -50%) scale(1.1); }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
            `}} />
        </CelebrationContext.Provider>
    );
}
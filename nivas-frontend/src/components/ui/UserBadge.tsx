"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Bug, Zap, Moon, Target, Star, Award } from "lucide-react";

export type BadgeType =
    | "early_adopter"
    | "bug_hunter"
    | "fast_responder"
    | "night_owl"
    | "task_master"
    | "team_player"
    | "streak_keeper";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

interface BadgeConfig {
    icon: React.ReactNode;
    label: string;
    description: string;
    rarity: BadgeRarity;
    gradient: string;
    glow: string;
}

const badgeConfigs: Record<BadgeType, BadgeConfig> = {
    early_adopter: {
        icon: <Star size={14} />,
        label: "Early Adopter",
        description: "One of the first 10 users to join",
        rarity: "legendary",
        gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
        glow: "rgba(255, 215, 0, 0.4)",
    },
    bug_hunter: {
        icon: <Bug size={14} />,
        label: "Bug Hunter",
        description: "Reported 5+ bugs",
        rarity: "rare",
        gradient: "linear-gradient(135deg, #4CAB9A 0%, #2D8A7A 100%)",
        glow: "rgba(76, 171, 154, 0.4)",
    },
    fast_responder: {
        icon: <Zap size={14} />,
        label: "Fast Responder",
        description: "Average reply time under 5 mins",
        rarity: "common",
        gradient: "linear-gradient(135deg, #D99834 0%, #B87A20 100%)",
        glow: "rgba(217, 152, 52, 0.4)",
    },
    night_owl: {
        icon: <Moon size={14} />,
        label: "Night Owl",
        description: "Active after midnight 10+ times",
        rarity: "common",
        gradient: "linear-gradient(135deg, #9A6DD7 0%, #7A4DB7 100%)",
        glow: "rgba(154, 109, 215, 0.4)",
    },
    task_master: {
        icon: <Target size={14} />,
        label: "Task Master",
        description: "Completed 50+ tasks",
        rarity: "epic",
        gradient: "linear-gradient(135deg, #E06C6C 0%, #C04C4C 100%)",
        glow: "rgba(224, 108, 108, 0.4)",
    },
    team_player: {
        icon: <Award size={14} />,
        label: "Team Player",
        description: "Helped 10+ teammates",
        rarity: "rare",
        gradient: "linear-gradient(135deg, #4E95C6 0%, #3A75A6 100%)",
        glow: "rgba(78, 149, 198, 0.4)",
    },
    streak_keeper: {
        icon: <Trophy size={14} />,
        label: "Streak Keeper",
        description: "30-day login streak",
        rarity: "epic",
        gradient: "linear-gradient(135deg, #DA679A 0%, #BA477A 100%)",
        glow: "rgba(218, 103, 154, 0.4)",
    },
};

const rarityOrder: Record<BadgeRarity, number> = {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3,
};

const rarityColors: Record<BadgeRarity, string> = {
    common: "var(--notion-text-muted)",
    rare: "var(--notion-blue)",
    epic: "var(--notion-purple)",
    legendary: "var(--notion-yellow)",
};

interface UserBadgeProps {
    type: BadgeType;
    size?: "sm" | "md" | "lg";
    showTooltip?: boolean;
}

export default function UserBadge({ type, size = "md", showTooltip = true }: UserBadgeProps) {
    const [isHovered, setIsHovered] = useState(false);
    const config = badgeConfigs[type];

    if (!config) return null;

    const sizes = {
        sm: { badge: 24, icon: 12, fontSize: 10 },
        md: { badge: 32, icon: 14, fontSize: 11 },
        lg: { badge: 40, icon: 18, fontSize: 12 },
    };

    const s = sizes[size];

    return (
        <div
            style={{ position: "relative", display: "inline-flex" }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                whileHover={{ scale: 1.1 }}
                style={{
                    width: s.badge,
                    height: s.badge,
                    borderRadius: "50%",
                    background: config.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                    cursor: "pointer",
                }}
            >
                {config.icon}
            </motion.div>

            {/* Tooltip */}
            {showTooltip && isHovered && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        position: "absolute",
                        bottom: "calc(100% + 8px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "var(--notion-bg-tertiary)",
                        border: "1px solid var(--notion-border)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        minWidth: "160px",
                        zIndex: 100,
                        boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, fontSize: s.fontSize + 2, color: "var(--notion-text)" }}>
                            {config.label}
                        </span>
                        <span
                            style={{
                                fontSize: "9px",
                                textTransform: "uppercase",
                                color: rarityColors[config.rarity],
                                fontWeight: 600,
                            }}
                        >
                            {config.rarity}
                        </span>
                    </div>
                    <div style={{ fontSize: s.fontSize, color: "var(--notion-text-secondary)" }}>
                        {config.description}
                    </div>
                    {/* Tooltip Arrow */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: "-4px",
                            left: "50%",
                            transform: "translateX(-50%) rotate(45deg)",
                            width: "8px",
                            height: "8px",
                            backgroundColor: "var(--notion-bg-tertiary)",
                            borderRight: "1px solid var(--notion-border)",
                            borderBottom: "1px solid var(--notion-border)",
                        }}
                    />
                </motion.div>
            )}
        </div>
    );
}

// Badge Collection Component
interface BadgeCollectionProps {
    badges: BadgeType[];
    maxVisible?: number;
}

export function BadgeCollection({ badges, maxVisible = 5 }: BadgeCollectionProps) {
    // Sort by rarity (legendary first)
    const sortedBadges = [...badges].sort(
        (a, b) => rarityOrder[badgeConfigs[b]?.rarity || "common"] - rarityOrder[badgeConfigs[a]?.rarity || "common"]
    );

    const visibleBadges = sortedBadges.slice(0, maxVisible);
    const remainingCount = badges.length - maxVisible;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {visibleBadges.map((badge) => (
                <UserBadge key={badge} type={badge} size="sm" />
            ))}
            {remainingCount > 0 && (
                <div
                    style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "var(--notion-bg-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        color: "var(--notion-text-muted)",
                        fontWeight: 600,
                    }}
                >
                    +{remainingCount}
                </div>
            )}
        </div>
    );
}
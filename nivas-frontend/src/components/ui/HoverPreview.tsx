"use client";

import { useState, useRef, type ReactNode } from "react";
import { Calendar, User, Tag, Clock } from "lucide-react";

interface HoverPreviewProps {
    children: ReactNode;
    content: {
        title?: string;
        subtitle?: string;
        details?: { icon: ReactNode; label: string; value: string }[];
        status?: { color: string; label: string };
    };
    delay?: number;
}

export default function HoverPreview({ children, content, delay = 400 }: HoverPreviewProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPosition({
            x: rect.left + rect.width / 2,
            y: rect.top,
        });

        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ display: "inline-block" }}
            >
                {children}
            </div>

            {isVisible && (
                <div
                    style={{
                        position: "fixed",
                        left: position.x,
                        top: position.y - 8,
                        transform: "translate(-50%, -100%)",
                        background: "var(--notion-bg-secondary)",
                        border: "1px solid var(--notion-border)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        minWidth: "220px",
                        maxWidth: "300px",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
                        zIndex: 9999,
                        animation: "previewIn 0.15s ease-out",
                        pointerEvents: "none",
                    }}
                >
                    {/* Status badge */}
                    {content.status && (
                        <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "3px 8px",
                            background: `${content.status.color}20`,
                            borderRadius: "4px",
                            marginBottom: "8px",
                        }}>
                            <span style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: content.status.color,
                            }} />
                            <span style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: content.status.color,
                                textTransform: "uppercase",
                            }}>
                                {content.status.label}
                            </span>
                        </div>
                    )}

                    {/* Title */}
                    {content.title && (
                        <div style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--notion-text)",
                            marginBottom: content.subtitle ? "2px" : "8px",
                        }}>
                            {content.title}
                        </div>
                    )}

                    {/* Subtitle */}
                    {content.subtitle && (
                        <div style={{
                            fontSize: "12px",
                            color: "var(--notion-text-muted)",
                            marginBottom: "10px",
                        }}>
                            {content.subtitle}
                        </div>
                    )}

                    {/* Details */}
                    {content.details && content.details.length > 0 && (
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            paddingTop: "8px",
                            borderTop: "1px solid var(--notion-border)",
                        }}>
                            {content.details.map((detail, i) => (
                                <div key={i} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    fontSize: "12px",
                                }}>
                                    <span style={{ color: "var(--notion-text-muted)" }}>
                                        {detail.icon}
                                    </span>
                                    <span style={{ color: "var(--notion-text-muted)" }}>
                                        {detail.label}:
                                    </span>
                                    <span style={{ color: "var(--notion-text)", fontWeight: 500 }}>
                                        {detail.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Arrow */}
                    <div style={{
                        position: "absolute",
                        bottom: "-6px",
                        left: "50%",
                        transform: "translateX(-50%) rotate(45deg)",
                        width: "12px",
                        height: "12px",
                        background: "var(--notion-bg-secondary)",
                        borderRight: "1px solid var(--notion-border)",
                        borderBottom: "1px solid var(--notion-border)",
                    }} />
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes previewIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -100%) translateY(5px);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -100%) translateY(0);
                    }
                }
            `}} />
        </>
    );
}

// Quick preview for user avatars
export function UserHoverPreview({
    children,
    user
}: {
    children: ReactNode;
    user: { name: string; role?: string; email?: string; department?: string }
}) {
    return (
        <HoverPreview
            content={{
                title: user.name,
                subtitle: user.role,
                details: [
                    ...(user.email ? [{ icon: <User size={12} />, label: "Email", value: user.email }] : []),
                    ...(user.department ? [{ icon: <Tag size={12} />, label: "Dept", value: user.department }] : []),
                ],
            }}
        >
            {children}
        </HoverPreview>
    );
}

// Quick preview for tasks
export function TaskHoverPreview({
    children,
    task
}: {
    children: ReactNode;
    task: { title: string; status: string; priority?: string; dueDate?: string; assignee?: string }
}) {
    const statusColors: Record<string, string> = {
        PENDING: "var(--notion-text-muted)",
        IN_PROGRESS: "var(--notion-blue)",
        REVIEW: "var(--notion-orange)",
        COMPLETED: "var(--notion-green)",
    };

    return (
        <HoverPreview
            content={{
                title: task.title,
                status: { color: statusColors[task.status] || "gray", label: task.status },
                details: [
                    ...(task.priority ? [{ icon: <Tag size={12} />, label: "Priority", value: task.priority }] : []),
                    ...(task.assignee ? [{ icon: <User size={12} />, label: "Assignee", value: task.assignee }] : []),
                    ...(task.dueDate ? [{ icon: <Calendar size={12} />, label: "Due", value: task.dueDate }] : []),
                ],
            }}
        >
            {children}
        </HoverPreview>
    );
}
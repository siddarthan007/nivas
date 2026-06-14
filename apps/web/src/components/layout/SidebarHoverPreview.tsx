import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CheckSquare, TrendingUp, Clock } from "lucide-react";
import Badge from "@/components/ui/Badge";

interface Task {
    id: string;
    title: string;
    status: string;
    priority: string;
}

interface SidebarHoverPreviewProps {
    children: ReactNode;
    itemId: string;
    isCollapsed: boolean;
}

export default function SidebarHoverPreview({
    children,
    itemId,
    isCollapsed
}: SidebarHoverPreviewProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [stats, setStats] = useState({ completed: 0, total: 0, streak: 0 });
    const [hasFetched, setHasFetched] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Only show preview for specific items
    const shouldShowPreview = itemId === "tasks";

    const fetchPreviewData = async () => {
        if (hasFetched) return;

        try {
            const res = await fetch("/api/tasks?limit=5");
            if (res.ok) {
                const data = await res.json();
                setTasks(data.slice(0, 4));
                const completed = data.filter((t: Task) => t.status === "COMPLETED").length;
                setStats({
                    completed,
                    total: data.length,
                    streak: completed >= 3 ? completed : 0
                });
                setHasFetched(true);
            }
        } catch (e) {
            console.error("Failed to fetch preview data");
        }
    };

    const handleMouseEnter = () => {
        if (!shouldShowPreview) return;

        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
            fetchPreviewData();
        }, 200);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    if (!shouldShowPreview) {
        return <>{children}</>;
    }

    const statusColors: Record<string, "default" | "info" | "warning" | "success"> = {
        PENDING: "default",
        IN_PROGRESS: "info",
        REVIEW: "warning",
        COMPLETED: "success",
    };

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ position: "relative" }}
        >
            {children}

            {isVisible && (
                <div
                    style={{
                        position: "fixed",
                        left: isCollapsed ? "60px" : "250px",
                        top: "auto",
                        background: "var(--notion-bg-secondary)",
                        border: "1px solid var(--notion-border)",
                        borderRadius: "8px",
                        padding: "12px",
                        width: "280px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                        zIndex: 99999,
                    }}
                    onMouseEnter={() => setIsVisible(true)}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Header */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                        paddingBottom: "10px",
                        borderBottom: "1px solid var(--notion-divider)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <CheckSquare size={16} style={{ color: "var(--notion-blue)" }} />
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--notion-text)" }}>
                                My Tasks
                            </span>
                        </div>
                        {stats.streak >= 3 && (
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 8px",
                                background: "rgba(242, 153, 74, 0.2)",
                                borderRadius: "12px",
                                fontSize: "11px",
                                color: "#f2994a",
                                fontWeight: 600
                            }}>
                                <TrendingUp size={12} />
                                {stats.streak} done
                            </div>
                        )}
                    </div>

                    {/* Stats Row */}
                    <div style={{
                        display: "flex",
                        gap: "16px",
                        marginBottom: "12px",
                        fontSize: "12px"
                    }}>
                        <div>
                            <span style={{ color: "var(--notion-text-muted)" }}>Done: </span>
                            <span style={{ color: "#0f9d58", fontWeight: 600 }}>{stats.completed}</span>
                        </div>
                        <div>
                            <span style={{ color: "var(--notion-text-muted)" }}>Total: </span>
                            <span style={{ color: "var(--notion-text)", fontWeight: 600 }}>{stats.total}</span>
                        </div>
                    </div>

                    {/* Task List */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {tasks.length > 0 ? tasks.map((task) => (
                            <div
                                key={task.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "6px 8px",
                                    borderRadius: "4px",
                                    background: "var(--notion-bg-tertiary)",
                                }}
                            >
                                <span style={{
                                    flex: 1,
                                    fontSize: "12px",
                                    color: "var(--notion-text)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}>
                                    {task.title}
                                </span>
                                <Badge variant={statusColors[task.status] || "default"} size="sm">
                                    {task.status.replace("_", " ")}
                                </Badge>
                            </div>
                        )) : (
                            <div style={{ fontSize: "12px", color: "var(--notion-text-muted)", padding: "8px" }}>
                                No tasks yet
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop: "1px solid var(--notion-divider)",
                        fontSize: "11px",
                        color: "var(--notion-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                    }}>
                        <Clock size={10} />
                        Click to view all tasks
                    </div>
                </div>
            )}
        </div>
    );
}
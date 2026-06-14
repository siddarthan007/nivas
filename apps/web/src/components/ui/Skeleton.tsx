"use client";

type SkeletonVariant = "line" | "circle" | "card";

interface SkeletonProps {
    variant?: SkeletonVariant;
    width?: string | number;
    height?: string | number;
    borderRadius?: string;
    className?: string;
    style?: React.CSSProperties;
}

const variantDefaults: Record<SkeletonVariant, { width: string | number; height: string | number; borderRadius: string }> = {
    line: { width: "100%", height: "14px", borderRadius: "4px" },
    circle: { width: "40px", height: "40px", borderRadius: "50%" },
    card: { width: "100%", height: "120px", borderRadius: "var(--radius-lg, 8px)" },
};

export function Skeleton({
    variant = "line",
    width,
    height,
    borderRadius,
    className = "",
    style = {},
}: SkeletonProps) {
    const defaults = variantDefaults[variant];
    const resolvedWidth = width ?? defaults.width;
    const resolvedHeight = height ?? defaults.height;
    const resolvedRadius = borderRadius ?? defaults.borderRadius;

    return (
        <div
            className={`skeleton-pulse ${className}`}
            style={{
                width: typeof resolvedWidth === "number" ? `${resolvedWidth}px` : resolvedWidth,
                height: typeof resolvedHeight === "number" ? `${resolvedHeight}px` : resolvedHeight,
                borderRadius: resolvedRadius,
                backgroundColor: "var(--notion-bg-tertiary, #2a2a2a)",
                animation: "skeleton-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                ...style,
            }}
        />
    );
}

// Pre-built skeleton patterns
export function SkeletonText({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: `${gap}px` }}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="line"
                    width={i === lines - 1 ? "60%" : "100%"}
                    height={14}
                />
            ))}
        </div>
    );
}

export function SkeletonCard() {
    return (
        <div style={{
            padding: "16px",
            background: "var(--notion-bg-secondary)",
            borderRadius: "var(--radius-lg, 8px)",
            border: "1px solid var(--notion-border)",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <Skeleton variant="circle" />
                <div style={{ flex: 1 }}>
                    <Skeleton variant="line" width="60%" height={14} style={{ marginBottom: "8px" }} />
                    <Skeleton variant="line" width="40%" height={12} />
                </div>
            </div>
            <SkeletonText lines={2} />
        </div>
    );
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "12px 16px",
            borderBottom: "1px solid var(--notion-divider)",
        }}>
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="line"
                    width={i === 0 ? "30%" : `${100 / columns}%`}
                    height={14}
                />
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div style={{ border: "1px solid var(--notion-border)", borderRadius: "var(--radius-lg, 8px)" }}>
            <div style={{
                display: "flex",
                gap: "16px",
                padding: "12px 16px",
                background: "var(--notion-bg-secondary)",
                borderBottom: "1px solid var(--notion-border)",
            }}>
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} variant="line" width={`${100 / columns}%`} height={12} />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonTableRow key={i} columns={columns} />
            ))}
        </div>
    );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: items }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 12px",
                        background: "var(--notion-bg-secondary)",
                        borderRadius: "6px",
                    }}
                >
                    <Skeleton variant="line" width={20} height={20} borderRadius="4px" />
                    <Skeleton variant="line" width="70%" height={14} />
                    <Skeleton variant="line" width={60} height={20} borderRadius="12px" style={{ marginLeft: "auto" }} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonStyles() {
    return (
        <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes skeleton-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            .skeleton-pulse {
                position: relative;
                overflow: hidden;
            }
        `}} />
    );
}

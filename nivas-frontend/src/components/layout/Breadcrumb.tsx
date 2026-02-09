import Link from "@/components/ui/Link";
import { usePathname } from "@/lib/router";
import { ChevronRight, Home } from "lucide-react";

export default function Breadcrumb() {
    const pathname = usePathname();

    if (pathname === "/dashboard") return null;

    const segments = pathname.split('/').filter(Boolean);

    // Custom label map could go here if needed
    const getLabel = (segment: string) => {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                color: "var(--notion-text-secondary)",
                padding: "6px 0 12px 0", // Adjusted padding for better spacing
            }}
        >
            <Link
                href="/dashboard"
                className="hover-bg"
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "4px",
                    borderRadius: "3px",
                    color: "inherit",
                    textDecoration: "none"
                }}
            >
                <Home size={14} />
            </Link>

            {segments.map((segment, index) => {
                // Skip 'dashboard' as it's the home icon
                if (segment === 'dashboard') return null;

                const href = `/${segments.slice(0, index + 1).join('/')}`;
                const isLast = index === segments.length - 1;

                return (
                    <div key={href} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ChevronRight size={12} style={{ opacity: 0.5 }} />
                        {isLast ? (
                            <span style={{ fontWeight: '500', color: "var(--notion-text)" }}>
                                {getLabel(segment)}
                            </span>
                        ) : (
                            <Link
                                href={href}
                                className="hover-bg"
                                style={{
                                    padding: "2px 6px",
                                    borderRadius: "3px",
                                    color: "inherit",
                                    textDecoration: "none"
                                }}
                            >
                                {getLabel(segment)}
                            </Link>
                        )}
                    </div>
                );
            })}
        </div>
    );
}